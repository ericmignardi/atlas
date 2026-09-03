import { api } from "@/lib/apiClient";
import type { TagCreate, TagUpdate } from "@/schemas/tag";
import type { TagResponse } from "@/types/api";

/**
 * PRD §6.10. The list carries `usageCount`, which is what makes the tags table
 * worth having — a tag nobody uses is a tag to delete, and you can only see
 * that if the count is on the row.
 */

export const listTags = (): Promise<TagResponse[]> => api.get<TagResponse[]>("/tags");

/**
 * FR-5.3: the server returns 201 for a new tag and 200 for one that already
 * existed, and the body is the tag either way. So the "Create *name*" row in
 * `TagInput` is safe to click twice — the second click resolves to the same tag
 * rather than a duplicate or a 409.
 */
export const createTag = (input: TagCreate): Promise<TagResponse> =>
  api.post<TagResponse>("/tags", input);

export const updateTag = (id: string, input: TagUpdate): Promise<TagResponse> =>
  api.patch<TagResponse>(`/tags/${id}`, input);

/** FR-5.9: the join rows go with it; the projects that carried it survive. */
export const deleteTag = (id: string): Promise<void> => api.delete(`/tags/${id}`);
