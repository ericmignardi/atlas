import type { ZodError, ZodType } from "zod";

import { isApiError } from "@/lib/apiClient";

/**
 * One field-error shape for the whole application (FR-8.4). A Zod failure and a
 * server 400 are different objects with different vocabularies; both end up
 * here as `{ fieldName: "first message" }`, which is what a form row can render.
 *
 * First message only, deliberately. A password can fail three rules at once and
 * a stack of three red lines under one input is noise — fix the first, resubmit,
 * see the next.
 */
export type FieldErrors = Record<string, string>;

/** Flattens a ZodError. Nested paths join with a dot: `techStack.2`. */
export function fromZodError(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    fields[key] ??= issue.message;
  }
  return fields;
}

/**
 * Turns a caught mutation failure into field errors plus a form-level message.
 * A 400 with a `fields` map lands on the inputs; anything else — a 409 pin cap,
 * a 500, a dropped connection — has no field to land on and becomes the banner.
 */
export function fromApiError(error: unknown): { fields: FieldErrors; message: string } {
  if (!isApiError(error)) {
    return { fields: {}, message: "Something went wrong. Try again." };
  }

  const fields: FieldErrors = {};
  for (const [key, messages] of Object.entries(error.fields)) {
    if (messages.length > 0) {
      fields[key] = capitalise(messages[0]);
    }
  }

  return { fields, message: error.message };
}

/**
 * Validates and returns either the parsed value or the field errors. A discriminated
 * union rather than a throw, because a form submit handler is exactly the place
 * where "invalid" is an expected outcome, not an exception.
 */
export type ParseResult<T> = { ok: true; data: T } | { ok: false; fields: FieldErrors };

export function parseForm<T>(schema: ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, fields: fromZodError(result.error) };
}

/**
 * Bean Validation messages read as sentence fragments — "must not be blank" —
 * because they are designed to follow a field name. Beside the input, the field
 * name is the label directly above, so the fragment needs to start a sentence.
 */
function capitalise(message: string): string {
  return message.charAt(0).toUpperCase() + message.slice(1);
}
