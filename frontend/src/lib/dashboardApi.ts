import { api } from "@/lib/apiClient";
import type { DashboardResponse } from "@/types/api";

/**
 * PRD §6.7. One request for the entire landing screen.
 *
 * Four endpoints would be four loading states landing at four different
 * moments, and a dashboard that assembles itself in front of you looks broken
 * even when every number is right. It is also what makes the tiles trustworthy:
 * the counts and the lists are read in one transaction, so "4 open tasks" is
 * never sitting above three rows.
 */
export const getDashboard = (): Promise<DashboardResponse> =>
  api.get<DashboardResponse>("/dashboard");
