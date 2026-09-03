import { z } from "zod";

/**
 * PRD §7.5. Names are lowercased and trimmed before they are sent, matching what
 * the server persists — so the autocomplete in the tag input compares like with
 * like and "React" does not offer to create a second "react" (FR-5.2, FR-5.3).
 */

const name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(50, "Must be at most 50 characters")
  .transform((value) => value.toLowerCase());

/** FR-5.4: omitted on create, so the server assigns the next colour in the palette cycle. */
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour such as #2251B4");

export const tagCreateSchema = z.object({
  name,
  color: color.optional(),
});

/** FR-5.8. Both columns are NOT NULL, so neither may be sent as an explicit null. */
export const tagUpdateSchema = z.object({
  name: name.optional(),
  color: color.optional(),
});

export type TagCreate = z.infer<typeof tagCreateSchema>;
export type TagUpdate = z.infer<typeof tagUpdateSchema>;
