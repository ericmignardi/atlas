import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/**
 * Every date the interface renders passes through here. The server sends
 * `Instant` as an ISO-8601 string and `LocalDate` as `yyyy-MM-dd`, and both are
 * strings by the time they reach React — parsing them at forty call sites is
 * forty chances to hand `new Date()` a value it silently reads as Invalid Date
 * and renders as "Invalid Date" in production.
 */

const parse = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
};

/** "3 days ago". Strict, so it never rounds "26 days" up to "about a month". */
export function relativeTime(value: string | null | undefined): string {
  const date = parse(value);
  return date ? `${formatDistanceToNowStrict(date)} ago` : "—";
}

/** "12 Mar 2026" — unambiguous in both the reader's hemispheres, unlike 03/12. */
export function shortDate(value: string | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "d MMM yyyy") : "—";
}

/** The `yyyy-MM-dd` a native date input requires, from whatever the server sent. */
export function dateInputValue(value: string | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "yyyy-MM-dd") : "";
}

/**
 * A `yyyy-MM-dd` from a date input, as the instant the server stores.
 *
 * The time is the **end** of that day in the browser's zone, and that is the
 * whole decision. `dueDate` is compared against `now` to derive `isOverdue`
 * (FR-4.9), so a task due today stamped at midnight is overdue by breakfast —
 * which is not what anyone means by "due today". Stamped at 23:59:59.999 it
 * stays in FR-4.10's *today* bucket for the whole day and turns overdue when the
 * day actually ends.
 */
export function dueDateToInstant(value: string): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  // Local construction on purpose: the user picked a date on their calendar,
  // not on the server's.
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/**
 * "Overdue by 2 days", "Due today", "Due in 5 days" — the sentence, not the
 * date. NFR-4.4: this is the text that has to carry the meaning, because the
 * red is not allowed to carry it alone.
 */
export function dueLabel(value: string | null | undefined, done = false): string | null {
  const date = parse(value);
  if (!date) return null;

  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (done) return `Due ${shortDate(value)}`;
  if (days < 0) return days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
