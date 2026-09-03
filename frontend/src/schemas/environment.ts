import { z } from "zod";

import { ENVIRONMENT_TYPES, PLATFORMS } from "@/types/api";

/**
 * PRD §7.3, mirroring `CreateEnvironmentRequest` / `UpdateEnvironmentRequest`.
 *
 * `pairedWithId` is absent by design: pairing is four invariants plus a
 * release-before-assign sequence (FR-3.7 – FR-3.11) and lives behind
 * PUT /api/environments/{id}/pair and nowhere else.
 */

export const environmentCreateSchema = z.object({
  projectId: z.uuid("Choose a project"),
  name: z.string().min(1, "Name is required").max(120, "Must be at most 120 characters"),
  platform: z.enum(PLATFORMS),
  type: z.enum(ENVIRONMENT_TYPES),
  branch: z.string().max(200, "Must be at most 200 characters").optional(),
  /**
   * FR-3.16 / §7.3: free text and deliberately *not* URL-validated. A Neon
   * connection string is `postgresql://…?sslmode=require`, which no http URL
   * check would accept, and this one field carries both.
   */
  url: z.string().max(600, "Must be at most 600 characters").optional(),
  notes: z.string().max(4000, "Must be at most 4000 characters").optional(),
});

/** projectId is absent: moving an environment between projects would have to release its pairing. */
export const environmentUpdateSchema = environmentCreateSchema.omit({ projectId: true }).partial();

export type EnvironmentCreate = z.infer<typeof environmentCreateSchema>;
export type EnvironmentUpdate = z.infer<typeof environmentUpdateSchema>;

/** The body of PUT /api/environments/{id}/pair. Releasing is DELETE on the same path. */
export const environmentPairSchema = z.object({
  targetId: z.uuid("Choose an environment to pair with"),
});

export type EnvironmentPair = z.infer<typeof environmentPairSchema>;
