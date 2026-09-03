import { api } from "@/lib/apiClient";
import type { TaskCreate, TaskMove, TaskPatch } from "@/schemas/task";
import type { BoardResponse, TaskResponse } from "@/types/api";

/**
 * PRD §6.5. Two reads with different jobs.
 *
 * `/board` is the kanban: four columns in fixed order, each ordered by
 * `sortOrder`, with Done already narrowed to FR-4.12's seven-day window. The
 * window is the reason the board cannot be assembled from the list — the client
 * would have to know the rule, and then there would be two copies of it.
 *
 * `/tasks` is the list, and it is fetched once with `includeCompleted=true` and
 * narrowed in the browser, for the same reason the projects list is (§7.2): at
 * this scale filtering locally is instant, every filter change is free, and
 * there is exactly one request to reason about. `includeCompleted` is the one
 * parameter that has to go to the server, because the client cannot filter in
 * rows it was never sent.
 */

export const listTasks = (projectId?: string): Promise<TaskResponse[]> =>
  api.get<TaskResponse[]>("/tasks", { includeCompleted: true, projectId });

export const taskBoard = (projectId?: string): Promise<BoardResponse> =>
  api.get<BoardResponse>("/tasks/board", { projectId });

/**
 * One task by id. The only caller is the command palette's Enter key: a task has
 * no page of its own, so selecting one opens it for editing, and the palette row
 * carries a title and a status rather than the whole record.
 */
export const getTask = (id: string): Promise<TaskResponse> =>
  api.get<TaskResponse>("/tasks/" + id);

export const createTask = (input: TaskCreate): Promise<TaskResponse> =>
  api.post<TaskResponse>("/tasks", input);

export const updateTask = (id: string, input: TaskPatch): Promise<TaskResponse> =>
  api.patch<TaskResponse>(`/tasks/${id}`, input);

/**
 * FR-4.8. Column and position in one call — a PUT, not a PATCH, because a move
 * with half its body missing is not a move. This is the endpoint both the drag
 * and the status select go through (NFR-4.6): one operation, two ways to ask
 * for it, so they cannot drift.
 */
export const moveTask = (id: string, input: TaskMove): Promise<TaskResponse> =>
  api.put<TaskResponse>(`/tasks/${id}/move`, input);

export const deleteTask = (id: string): Promise<void> => api.delete(`/tasks/${id}`);
