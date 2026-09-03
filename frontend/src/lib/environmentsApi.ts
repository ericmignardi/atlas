import { api } from "@/lib/apiClient";
import type { EnvironmentCreate, EnvironmentPatch } from "@/schemas/environment";
import type { EnvironmentResponse, GroupedEnvironments, PairResponse } from "@/types/api";

/**
 * PRD §6.4. Every environment call is scoped to one project — there is no
 * "all my environments" endpoint, because an environment without its project is
 * a deployment target for nothing.
 *
 * Two reads, not one. `/grouped` does the pairing arithmetic (FR-3.15: which
 * application claims which database, in which direction, and which databases
 * are left over) and the UI must not re-derive that. But it answers in
 * `EnvironmentSummary` — id, name, platform, branch — and a tile also shows the
 * URL, the notes indicator, and a menu that needs the type. So the map fetches
 * both in parallel and looks each summary up in the full list by id: the
 * *shape* comes from the server, the *detail* comes from the record.
 */

export const listEnvironments = (projectId: string): Promise<EnvironmentResponse[]> =>
  api.get<EnvironmentResponse[]>("/environments", { projectId });

export const groupedEnvironments = (projectId: string): Promise<GroupedEnvironments> =>
  api.get<GroupedEnvironments>("/environments/grouped", { projectId });

export const createEnvironment = (input: EnvironmentCreate): Promise<EnvironmentResponse> =>
  api.post<EnvironmentResponse>("/environments", input);

/** PATCH with JsonNullable semantics: an absent key leaves the column alone. */
export const updateEnvironment = (
  id: string,
  input: EnvironmentPatch,
): Promise<EnvironmentResponse> => api.patch<EnvironmentResponse>(`/environments/${id}`, input);

/** FR-3.13: the partner survives, unpaired. */
export const deleteEnvironment = (id: string): Promise<void> => api.delete(`/environments/${id}`);

/**
 * FR-3.7 – FR-3.11. A 409 with `PAIR_SELF`, `PAIR_DIFFERENT_PROJECT`, or
 * `PAIR_DIFFERENT_TYPE` is the server refusing an invariant breach. The dialog
 * offers only eligible candidates, so in practice none of the three should ever
 * be reachable from the UI — which is exactly why the server still checks.
 */
export const pairEnvironments = (id: string, targetId: string): Promise<PairResponse> =>
  api.put<PairResponse>(`/environments/${id}/pair`, { targetId });

/** DELETE that answers with both records rather than 204 — see `api.delete`. */
export const unpairEnvironment = (id: string): Promise<PairResponse> =>
  api.delete<PairResponse>(`/environments/${id}/pair`);
