import { api } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import type { AuthResponse, UserResponse } from "@/types/api";
import type { LoginInput, RegisterInput } from "@/schemas/auth";

/**
 * PRD §6.2. These sit outside the store so the store stays pure state and the
 * client stays unaware of the store's actions — otherwise apiClient imports
 * authStore imports apiClient, and the module graph has a cycle.
 *
 * Register, login, and refresh set `skipAuthRefresh`: a 401 from one of them
 * means the credentials are wrong, not that the access token expired, and
 * handing it to the refresh interceptor would turn a "wrong password" into a
 * spurious session teardown.
 */

export async function register(input: RegisterInput): Promise<AuthResponse> {
  // `confirmPassword` is a property of the form, not of the request: the server
  // has no field for it and would reject the extra key on a strict binder.
  const body = {
    email: input.email,
    password: input.password,
    displayName: input.displayName,
  };
  const auth = await api.post<AuthResponse>("/auth/register", body, { skipAuthRefresh: true });
  useAuthStore.getState().signIn(auth);
  return auth;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const auth = await api.post<AuthResponse>("/auth/login", input, { skipAuthRefresh: true });
  useAuthStore.getState().signIn(auth);
  return auth;
}

/**
 * FR-1.6. The server revokes the refresh token; the store forgets both. The
 * local half runs even if the call fails — a user who clicked "Sign out" is
 * signed out of this browser whatever the network did.
 */
export async function logout(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  try {
    if (refreshToken) {
      await api.post<void>("/auth/logout", { refreshToken });
    }
  } finally {
    useAuthStore.getState().signOut();
  }
}

export function me(): Promise<UserResponse> {
  return api.get<UserResponse>("/auth/me");
}
