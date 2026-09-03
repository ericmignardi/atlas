import { createContext, use } from "react";

import type { ApiState } from "@/hooks/useApi";
import type { DashboardResponse } from "@/types/api";

/**
 * The context behind `DashboardProvider`, split into its own module so that the
 * provider file exports a component and nothing else — which is what keeps Fast
 * Refresh able to hot-swap it.
 */
export const DashboardContext = createContext<ApiState<DashboardResponse> | null>(null);

/**
 * Throws outside the provider rather than returning undefined. A stat tile
 * silently rendering zeroes because it was mounted in the wrong tree is a bug
 * that survives review; a thrown error is not.
 */
export const useDashboard = (): ApiState<DashboardResponse> => {
  const value = use(DashboardContext);
  if (!value) {
    throw new Error("useDashboard must be used inside <DashboardProvider>");
  }
  return value;
};
