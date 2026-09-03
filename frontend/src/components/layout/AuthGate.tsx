import { useEffect, useRef, type ReactNode } from "react";

import { restoreSession } from "@/lib/apiClient";
import { me } from "@/lib/authApi";
import { useAuthStore } from "@/stores/authStore";
import { Skeleton } from "@/components/ui/states";

/**
 * Resolves the one ambiguous state in the auth store: a refresh token was
 * restored from localStorage, but nobody knows yet whether it still works.
 *
 * Without this, a reload renders `status: "unknown"` as "not signed in" for a
 * tick, ProtectedRoute redirects to /login, and the session that was perfectly
 * valid is thrown away — the user is signed out by their own refresh button.
 */
export const AuthGate = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((state) => state.status);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  // StrictMode mounts effects twice in development. The refresh guard in
  // apiClient would collapse the two calls anyway, but the second would still
  // redeem a token the first already rotated away, so it is stopped here.
  const attempted = useRef(false);

  useEffect(() => {
    if (status !== "unknown" || attempted.current) return;
    attempted.current = true;

    if (!refreshToken) {
      clearSession();
      return;
    }

    let cancelled = false;

    restoreSession()
      // The refresh response carries tokens but not the user record, and the
      // shell needs a display name. One extra call, once, on a cold load.
      .then(() => me())
      .then((user) => {
        if (!cancelled) {
          useAuthStore.setState({ user, status: "authenticated" });
        }
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [status, refreshToken, clearSession]);

  if (status === "unknown") {
    return (
      <div className="grid min-h-dvh place-items-center p-8">
        <div className="flex w-full max-w-[360px] flex-col gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
