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
