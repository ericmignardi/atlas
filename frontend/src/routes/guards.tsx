import { Navigate, Outlet, useLocation } from "react-router";

import { useAuthStore } from "@/stores/authStore";

/**
 * The attempted path travels in location state rather than a query string: it
 * never reaches the server, never ends up in a log, and cannot be crafted into
 * an open redirect by pasting `?next=https://…` into a link. LoginPage reads it
 * back and returns the user where they were going.
 */
export interface FromLocationState {
  from?: string;
}

export const ProtectedRoute = () => {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status !== "authenticated") {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from } satisfies FromLocationState} />;
  }

  return <Outlet />;
};

/**
 * The inverse. A signed-in user landing on /login has almost always hit a stale
 * bookmark, and showing them a sign-in form for the account they are already in
 * is a small puzzle with no reward for solving it.
 */
export const GuestRoute = () => {
  const status = useAuthStore((state) => state.status);
  return status === "authenticated" ? <Navigate to="/" replace /> : <Outlet />;
};
