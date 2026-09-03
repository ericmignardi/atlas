import { z } from "zod";

import { PROJECT_STATUSES } from "@/types/api";

/**
 * PRD §7.2, mirroring `CreateProjectRequest` / `UpdateProjectRequest`.
 *
 * `slug` is absent because the server derives it from the name (FR-2.3), and
 * `isPinned` because the cap of four lives behind its own endpoint (FR-2.8).
 * A client field for either would be a second way to break an invariant.
 */

/**
 * The empty alternative matters: clearing a URL input sends "", not a missing
 * key, and rejecting it would make "remove the repo link" impossible. It is the
 * server's `ProjectUrls.PATTERN` written in TypeScript.
 */
const optionalUrl = z
  .string()
  .max(500, "Must be at most 500 characters")
  .refine(
    (value) => value === "" || /^https?:\/\/\S+$/.test(value),
    "Must be an http or https URL",
  );

/**
 * FR-2.9. Duplicates are removed and order preserved — the same rule the server
 * applies, done here too so the chips the user sees match what gets saved.
 */
const techStack = z
  .array(z.string().min(1, "Cannot be blank").max(40, "Must be at most 40 characters"))
  .max(24, "Must contain at most 24 items")
  .transform((items) => [...new Set(items.map((item) => item.trim()).filter(Boolean))]);

const startedAt = z.iso.date("Must be a valid date").refine((value) => {
  const date = new Date(value);
  const now = new Date();
  const floor = new Date(now.getFullYear() - 50, now.getMonth(), now.getDate());
  const ceiling = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  return date >= floor && date <= ceiling;
}, "Must be within the last 50 years and not more than a year ahead");

export const projectCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Must be at most 120 characters"),
  client: z.string().max(120, "Must be at most 120 characters").optional(),
  description: z.string().max(4000, "Must be at most 4000 characters").optional(),
  status: z.enum(PROJECT_STATUSES).default("IDEA"),
  repoUrl: optionalUrl.optional(),
  liveUrl: optionalUrl.optional(),
  engagement: z.string().max(80, "Must be at most 80 characters").optional(),
  techStack: techStack.default([]),
  startedAt: startedAt.optional(),
  tagIds: z.array(z.uuid()).default([]),
});

/**
 * PRD §6.9. The update is a PATCH with JsonNullable semantics on the server:
 * key absent means leave it alone, key present and null means clear it. `.partial()`
 * gives the first; the form decides when to send an explicit null for the second.
 */
export const projectUpdateSchema = projectCreateSchema.partial();

export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

/**
 * The body of a PATCH, written as a type rather than derived from the schema.
 *
 * `projectUpdateSchema.partial()` gives "key absent means leave it alone", which
 * is two of the server's three intentions. The third — key present and null,
 * meaning *clear this column* — cannot come out of a `.partial()` of a schema
 * whose fields are non-nullable, and it is exactly what "the user emptied the
 * client field" has to send. A `.nullable()` on every field would then let a
 * null through on `name`, which the server rejects with a 400.
 *
 * So the form validates its inputs against `projectCreateSchema`, which is where
 * the real rules live, and maps the result onto this: nullable where the column
 * is, plain where it is not.
 */
export interface ProjectPatch {
  name?: string;
  client?: string | null;
  description?: string | null;
  status?: ProjectCreate["status"];
  repoUrl?: string | null;
  liveUrl?: string | null;
  engagement?: string | null;
  techStack?: string[];
  startedAt?: string | null;
  tagIds?: string[];
}
