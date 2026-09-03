import { useEffect, useState } from "react";

/**
 * §7.2's 200 ms search box.
 *
 * The naive version debounces the *handler*, which means the input is no longer
 * controlled by what you typed and the caret jumps around. This debounces the
 * value instead: the input stays instant and fully controlled, and only the
 * derived value the filter reads settles late.
 *
 * The cleanup is the whole mechanism. Every keystroke schedules a timer and
 * cancels the previous one, so the value only ever lands 200 ms after the last
 * keystroke — never 200 ms after the first.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
