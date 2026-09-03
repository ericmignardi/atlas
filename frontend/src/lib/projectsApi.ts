import { api } from "@/lib/apiClient";
import type { ProjectCreate, ProjectPatch } from "@/schemas/project";
import type { ProjectResponse } from "@/types/api";

/**
 * PRD §6.9. One module per resource, sitting between the pages and the axios
 * verbs, so a component never builds a URL and a path is written down once.
 *
 * The list is fetched **unfiltered** and narrowed in the browser (§7.2). At this
 * scale that is instant and it makes every filter change free — no request, no
 * loading state, no race. `includeArchived` is the one parameter that has to go
 * to the server, because FR-2.7 omits archived projects by default and the
 * client cannot filter in rows it was never sent.
 */

export const listProjects = (): Promise<ProjectResponse[]> =>
  api.get<ProjectResponse[]>("/projects", { includeArchived: true });

export const getProjectBySlug = (slug: string): Promise<ProjectResponse> =>
  api.get<ProjectResponse>(`/projects/slug/${encodeURIComponent(slug)}`);

export const createProject = (input: ProjectCreate): Promise<ProjectResponse> =>
  api.post<ProjectResponse>("/projects", input);

/**
 * PATCH with JsonNullable semantics on the server: a key that is absent leaves
 * the column alone, a key present and null clears it. The form builds the body,
 * because only the form knows which of the two a blank input means.
 */
export const updateProject = (id: string, input: ProjectPatch): Promise<ProjectResponse> =>
  api.patch<ProjectResponse>(`/projects/${id}`, input);

export const deleteProject = (id: string): Promise<void> => api.delete(`/projects/${id}`);

/** FR-2.8: a fifth pin is a 409, which the caller turns into a toast. */
export const pinProject = (id: string): Promise<ProjectResponse> =>
  api.post<ProjectResponse>(`/projects/${id}/pin`);

/** Returns the updated project, not 204 — so the card can re-render from the response. */
export const unpinProject = (id: string): Promise<ProjectResponse> =>
  api.delete<ProjectResponse>(`/projects/${id}/pin`);

/** One call for both directions, since every caller is a toggle. */
export const setPinned = (id: string, pinned: boolean): Promise<ProjectResponse> =>
  pinned ? pinProject(id) : unpinProject(id);
