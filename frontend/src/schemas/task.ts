import { z } from "zod";

import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/types/api";

/**
 * PRD §7.4, mirroring `CreateTaskRequest` / `UpdateTaskRequest` / `MoveTaskRequest`.
 *
 * `completedAt` has no field here because it has none on the server either
 * (FR-4.6): it is stamped when a task crosses into DONE and cleared when it
 * crosses out. There is nothing for a client to send, so there is nothing to
 * forget to ignore.
 */

export const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Must be at most 200 characters"),
  description: z.string().max(4000, "Must be at most 4000 characters").optional(),
  status: z.enum(TASK_STATUSES).default("TODO"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  /** ISO-8601 instant, which is what the server's `Instant` deserialiser wants. */
  dueDate: z.iso.datetime("Must be a valid date").nullable().optional(),
  /** FR-4.5: optional. Null is the Unassigned bucket, not an error. */
  projectId: z.uuid().nullable().optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

/** FR-4.8. A PUT, not a PATCH: a move with half its body missing is not a move. */
export const taskMoveSchema = z.object({
  status: z.enum(TASK_STATUSES),
  sortOrder: z.int(),
});

export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TaskMove = z.infer<typeof taskMoveSchema>;

/** The body of a PATCH. Same reasoning as `ProjectPatch` and `EnvironmentPatch`. */
export interface TaskPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** FR-4.5: an explicit null moves the task to the Unassigned bucket. */
  projectId?: string | null;
  dueDate?: string | null;
}
