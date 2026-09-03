import { useMemo, type ReactNode } from "react";

import { getDashboard } from "@/lib/dashboardApi";
import { useApi } from "@/hooks/useApi";
import { DashboardContext } from "@/hooks/useDashboard";

/**
 * `GET /api/dashboard` fetched once, above the router, and read by two very
 * different consumers.
 *
 * The dashboard page is the obvious one. The other is the **sidebar**: PRD §9.1
 * puts a count on four of its five nav rows and an overdue pill on Tasks, and
 * those numbers are already in this payload. The alternative is a sidebar that
 * fetches for itself — a component present on every route issuing a request on
 * every route, and then the same four numbers arriving twice, at two different
 * moments, on the one screen that shows both.
 *
 * So it is one request, held at the layout, and `refetch` is exposed for the
 * mutations that invalidate it: anything created from quick add moves at least
 * one tile.
 */
export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const state = useApi(getDashboard, []);

  /**
   * `useApi` returns a fresh object every render, so without this every consumer
   * re-renders whenever anything above them does. The identity is pinned to the
   * values that can actually change.
   */
  const value = useMemo(
    () => state,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.data, state.error, state.isLoading, state.isRefetching, state.refetch, state.setData],
  );

  return <DashboardContext value={value}>{children}</DashboardContext>;
};
