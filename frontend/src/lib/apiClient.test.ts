import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError, api, __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

/**
 * The refresh interceptor is the one piece of frontend plumbing that is genuinely
 * hard to get right, and every failure mode is invisible in manual testing: it
 * only shows up when an access token expires with several requests in flight,
 * which happens fifteen minutes into a session and never while you are looking.
 */

const EXPIRED = "expired-access-token";
const FRESH = "fresh-access-token";

interface Recorder {
  refreshCalls: number;
  /** Every Authorization header the fake server saw, in order. */
  authHeaders: (string | undefined)[];
}

/**
 * A fake transport. Custom axios adapters are responsible for settling their own
 * responses — the core does not apply `validateStatus` for you — so a non-2xx
 * has to be rejected with an AxiosError, exactly as the real adapters do.
 */
function fakeServer(recorder: Recorder, options: { refreshSucceeds?: boolean } = {}): AxiosAdapter {
  const { refreshSucceeds = true } = options;

  return async (config) => {
    const headers = AxiosHeaders.from(config.headers);
    const authorization = headers.get("Authorization") as string | undefined;

    const ok = (data: unknown): AxiosResponse => ({
      data,
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    });

    const fail = (status: number, body: unknown) => {
      const response: AxiosResponse = {
        data: body,
        status,
        statusText: "Error",
        headers: new AxiosHeaders(),
        config,
      };
      throw new AxiosError("Request failed", String(status), config, {}, response);
    };

    if (config.url === "/auth/refresh") {
      recorder.refreshCalls += 1;
      if (!refreshSucceeds) {
        return fail(401, { timestamp: "", status: 401, error: "Refresh token is revoked" });
      }
      // Rotation: the server issues a new pair and revokes the old refresh token.
      return ok({
        accessToken: FRESH,
        refreshToken: "refresh-2",
        tokenType: "Bearer",
        expiresIn: 900,
        user: { id: "u1", email: "a@b.co", displayName: null, roles: ["ROLE_USER"], createdAt: "" },
      });
    }

    recorder.authHeaders.push(authorization);

    if (authorization === `Bearer ${EXPIRED}`) {
      return fail(401, { timestamp: "", status: 401, error: "Access token has expired" });
    }

    return ok({ url: config.url });
  };
}

let recorder: Recorder;

beforeEach(() => {
  recorder = { refreshCalls: 0, authHeaders: [] };
  __resetRefreshState();
  useAuthStore.setState({
    user: null,
    accessToken: EXPIRED,
    refreshToken: "refresh-1",
    status: "authenticated",
  });
});

afterEach(() => {
  __resetRefreshState();
});

describe("apiClient refresh", () => {
  it("refreshes once and replays the original request", async () => {
    __setAdapter(fakeServer(recorder));

    const result = await api.get<{ url: string }>("/projects");

    expect(recorder.refreshCalls).toBe(1);
    expect(result.url).toBe("/projects");
    // The first attempt carried the dead token; the replay carried the new one.
    expect(recorder.authHeaders).toEqual([`Bearer ${EXPIRED}`, `Bearer ${FRESH}`]);
    expect(useAuthStore.getState().accessToken).toBe(FRESH);
  });

  it("refreshes once for five parallel requests, not five times", async () => {
    __setAdapter(fakeServer(recorder));

    const results = await Promise.all([
      api.get<{ url: string }>("/projects"),
      api.get<{ url: string }>("/tasks"),
      api.get<{ url: string }>("/environments"),
      api.get<{ url: string }>("/tags"),
      api.get<{ url: string }>("/auth/me"),
    ]);

    // Without the shared promise this is 5, four of which redeem a refresh
    // token the first call already rotated away — and the user is signed out
    // mid-session.
    expect(recorder.refreshCalls).toBe(1);
    expect(results).toHaveLength(5);
    expect(recorder.authHeaders.filter((h) => h === `Bearer ${FRESH}`)).toHaveLength(5);
  });

  it("clears the session when the refresh token is dead", async () => {
    // Already on /login, so the interceptor's redirect is a no-op and jsdom is
    // not asked to navigate.
    window.history.pushState({}, "", "/login");
    __setAdapter(fakeServer(recorder, { refreshSucceeds: false }));

    await expect(api.get("/projects")).rejects.toBeInstanceOf(ApiError);

    expect(recorder.refreshCalls).toBe(1);
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("does not retry a request twice", async () => {
    // A server that 401s whatever token it is given: the replay fails too, and
    // the loop has to stop rather than refreshing forever.
    __setAdapter(async (config) => {
      if (config.url === "/auth/refresh") {
        recorder.refreshCalls += 1;
        return {
          data: {
            accessToken: FRESH,
            refreshToken: "refresh-2",
            tokenType: "Bearer",
            expiresIn: 900,
            user: null,
          },
          status: 200,
          statusText: "OK",
          headers: new AxiosHeaders(),
          config,
        } as AxiosResponse;
      }
      recorder.authHeaders.push(AxiosHeaders.from(config.headers).get("Authorization") as string);
      throw new AxiosError("Unauthorized", "401", config, {}, {
        data: { status: 401, error: "Nope" },
        status: 401,
        statusText: "Error",
        headers: new AxiosHeaders(),
        config,
      } as AxiosResponse);
    });

    await expect(api.get("/projects")).rejects.toBeInstanceOf(ApiError);
    expect(recorder.refreshCalls).toBe(1);
    expect(recorder.authHeaders).toHaveLength(2);
  });
});

describe("ApiError normalisation", () => {
  it("carries the server's field map through to the form", async () => {
    __setAdapter(async (config) => {
      throw new AxiosError("Bad request", "400", config, {}, {
        data: {
          timestamp: "",
          status: 400,
          error: "Validation failed",
          fields: { name: ["must not be blank"], techStack: ["must contain at most 24 items"] },
        },
        status: 400,
        statusText: "Bad Request",
        headers: new AxiosHeaders(),
        config,
      } as AxiosResponse);
    });

    useAuthStore.setState({ accessToken: FRESH });

    const error = await api.post("/projects", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.isValidation).toBe(true);
    expect(apiError.fieldError("name")).toBe("must not be blank");
  });

  it("reports a status of 0 when the request never reached the server", async () => {
    __setAdapter(async (config) => {
      throw new AxiosError("Network Error", "ERR_NETWORK", config);
    });

    useAuthStore.setState({ accessToken: FRESH });

    const error = (await api.get("/projects").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(0);
    expect(error.message).toMatch(/could not reach the server/i);
  });
});
