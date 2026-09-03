import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { authState } from "@/stores/authStore";
import type { AuthResponse, ErrorBody } from "@/types/api";

/** Same-origin in development thanks to the Vite proxy; a real origin in production. */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api";

const LOGIN_PATH = "/login";

/**
 * Two private flags on the request config, declared by merging into axios's own
 * interface rather than cast in at each call site. `_retried` makes the replay
 * idempotent; `_skipAuthRefresh` opts the auth endpoints out of the dance —
 * a 401 from /auth/login means "wrong password", not "token expired".
 */
declare module "axios" {
  export interface AxiosRequestConfig {
    _retried?: boolean;
    _skipAuthRefresh?: boolean;
  }
}

/**
 * The single error type the rest of the application handles (FR-8.4). Every
 * failure — a 400 with a `fields` map, a network drop, a JSON parse error —
 * arrives here in the same shape, so a form never has to ask what kind of thing
 * it caught before deciding where to put the message.
 */
export class ApiError extends Error {
  /** 0 when the request never reached the server. */
  readonly status: number;
  /** PRD §6.1: present only on a 400. Keyed by DTO field name. */
  readonly fields: Record<string, string[]>;
  readonly code?: string;

  constructor(
    status: number,
    message: string,
    fields: Record<string, string[]> = {},
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.code = code;
  }

  /** The first message for a field, which is all a single-line form row can show. */
  fieldError(name: string): string | undefined {
    return this.fields[name]?.[0];
  }

  get isValidation(): boolean {
    return this.status === 400 && Object.keys(this.fields).length > 0;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/**
 * Bare axios, deliberately without interceptors. The refresh call must not be
 * able to trigger the refresh handler: a 401 from /auth/refresh means the
 * refresh token itself is dead, and retrying it would recurse until the stack
 * gave out.
 */
const bare = axios.create({ baseURL: BASE_URL, headers: { "Content-Type": "application/json" } });

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = authState();
  if (accessToken) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    config.headers = headers;
  }
  return config;
});

/**
 * ── The concurrency guard ─────────────────────────────────────────────────
 *
 * The server rotates the refresh token on every use: redeeming one revokes it
 * and issues a replacement. So if five requests are in flight when the access
 * token expires, five 401s arrive at once and five naive handlers each redeem
 * the same refresh token — the first succeeds and the other four get a 401 for a
 * revoked token, logging the user out in the middle of a working session.
 *
 * One promise, shared. Whoever arrives first starts the refresh; everyone else
 * awaits the same promise and replays against the token it resolves to. The
 * `finally` clears the slot so the *next* expiry starts a fresh one rather than
 * handing out a stale resolved value forever.
 */
let refreshPromise: Promise<string> | null = null;

async function doRefresh(refreshToken: string): Promise<string> {
  const { data } = await bare.post<AuthResponse>("/auth/refresh", { refreshToken });
  authState().setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

function refreshOnce(): Promise<string> {
  refreshPromise ??= (async () => {
    const { refreshToken } = authState();
    if (!refreshToken) {
      throw new ApiError(401, "Your session has ended. Please sign in again.");
    }
    return doRefresh(refreshToken);
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Redeem the persisted refresh token for an access token — the cold-load path,
 * used by AuthGate. It goes through the same guard as the interceptor so a boot
 * that races a first request still produces exactly one refresh.
 */
export const restoreSession = (): Promise<string> => refreshOnce();

/** Test seam: the guard is module state, and a test that ran before must not leak into the next. */
export const __resetRefreshState = () => {
  refreshPromise = null;
};

/**
 * Test seam: swaps the transport on *both* instances. The refresh client is
 * deliberately not exported — a fake that covered only `apiClient` would let the
 * real one try to reach a server, and the concurrency test would pass for the
 * wrong reason.
 */
export const __setAdapter = (adapter: AxiosAdapter) => {
  apiClient.defaults.adapter = adapter;
  bare.defaults.adapter = adapter;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      throw toApiError(error);
    }

    const config = error.config as InternalAxiosRequestConfig | undefined;
    const shouldRefresh =
      error.response?.status === 401 && config && !config._retried && !config._skipAuthRefresh;

    if (!shouldRefresh) {
      throw toApiError(error);
    }

    config._retried = true;

    let accessToken: string;
    try {
      accessToken = await refreshOnce();
    } catch {
      // The refresh token is gone or revoked: this session is over. The redirect
      // is a hard navigation rather than a router call because an interceptor has
      // no router in scope, and `location.assign` keeps the entry in history so
      // the browser Back button still behaves.
      authState().clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== LOGIN_PATH) {
        window.location.assign(LOGIN_PATH);
      }
      throw toApiError(error);
    }

    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    config.headers = headers;

    return apiClient.request(config);
  },
);

/** Normalises anything thrown on the wire into the one shape (FR-8.4). */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorBody>;
    const body = axiosError.response?.data;

    if (!axiosError.response) {
      // No response at all: the server is down, DNS failed, or CORS blocked it.
      // Status 0 is the convention for "never reached the server" and lets a
      // caller distinguish it from a 500, which means it did.
      return new ApiError(0, "Could not reach the server. Check your connection and try again.");
    }

    const status = axiosError.response.status;
    return new ApiError(
      status,
      body?.error ?? defaultMessage(status),
      body?.fields ?? {},
      body?.code,
    );
  }

  return new ApiError(0, error instanceof Error ? error.message : "Something went wrong.");
}

/**
 * Only reached when the server returned a status without the standard error
 * body — a gateway timeout page, say. The phrasing is deliberately about what
 * the user can do, not about what the code is (FR-8.1's error state).
 */
function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return "Some of that could not be saved. Check the highlighted fields.";
    case 401:
      return "Your session has ended. Please sign in again.";
    case 403:
      return "You do not have access to that.";
    case 404:
      return "That could not be found.";
    case 409:
      return "That conflicts with something that already exists.";
    default:
      return status >= 500
        ? "The server had a problem. Try again in a moment."
        : "Something went wrong.";
  }
}

/**
 * Thin verbs over the instance. They exist so callers deal in `T`, never in
 * `AxiosResponse<T>` — and so `_skipAuthRefresh` has one place to be set.
 */
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(url, { params }).then((r) => r.data),

  post: <T>(url: string, body?: unknown, config?: { skipAuthRefresh?: boolean }) =>
    apiClient.post<T>(url, body, { _skipAuthRefresh: config?.skipAuthRefresh }).then((r) => r.data),

  patch: <T>(url: string, body?: unknown) => apiClient.patch<T>(url, body).then((r) => r.data),

  put: <T>(url: string, body?: unknown) => apiClient.put<T>(url, body).then((r) => r.data),

  delete: (url: string) => apiClient.delete<void>(url).then(() => undefined),
};
