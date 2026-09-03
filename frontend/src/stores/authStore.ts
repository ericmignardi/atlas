import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AuthResponse, UserResponse } from "@/types/api";

/**
 * `unknown` is the state on a cold load, before the persisted refresh token has
 * been redeemed for an access token. It matters: without it, every protected
 * route would bounce to /login for the one tick before the session comes back,
 * and a reload would lose the user's place. AuthGate resolves it exactly once.
 */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  user: UserResponse | null;
  /** In memory only — see the note below. */
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;

  /** Adopt a fresh token pair and the user it belongs to (login, register). */
  signIn: (auth: AuthResponse) => void;
  /** Replace the pair after a refresh; the user is unchanged. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Forget everything and become anonymous. */
  signOut: () => void;
  /** A persisted refresh token turned out to be dead. Same effect, clearer name. */
  clearSession: () => void;
}

/**
 * ── On token storage ──────────────────────────────────────────────────────
 *
 * The access token lives in memory only. The refresh token is persisted to
 * localStorage so a reload does not sign the user out.
 *
 * localStorage is readable by any script running on the page, so an XSS becomes
 * a token theft: the attacker walks away with a 7-day refresh token and can mint
 * access tokens until it expires or is revoked. The stronger design is an
 * httpOnly, Secure, SameSite=Strict cookie holding the refresh token — script
 * cannot read it at all, and the browser attaches it to /api/auth/refresh
 * automatically. That would move the decision to the server (a Set-Cookie on
 * login, a cookie-reading refresh endpoint) and bring CSRF into scope, which is
 * why it is not what this build does.
 *
 * Keeping the *access* token out of storage is the part that is worth doing
 * cheaply: it caps the window an XSS can steal to the current tab's lifetime for
 * the short-lived credential, and the long-lived one is at least revocable
 * server-side (FR-1.6), so a logout genuinely ends the session.
 *
 * For production: httpOnly refresh cookie, access token still in memory,
 * refresh-token rotation on every use (which the server already does), and a
 * Content-Security-Policy tight enough that the XSS never runs.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: "unknown",

      signIn: (auth) =>
        set({
          user: auth.user,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          status: "authenticated",
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, status: "authenticated" }),

      signOut: () =>
        set({ user: null, accessToken: null, refreshToken: null, status: "anonymous" }),

      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null, status: "anonymous" }),
    }),
    {
      name: "atlas.auth",
      /**
       * Only the refresh token crosses into storage. `partialize` is what makes
       * that true rather than aspirational — persisting the whole state would
       * put the access token and the user record in localStorage as well.
       */
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);

/** Non-reactive reads, for the axios interceptors — they are not components. */
export const authState = () => useAuthStore.getState();
