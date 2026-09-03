import { useSyncExternalStore } from "react";

/**
 * `useSyncExternalStore` rather than useState + useEffect: the media query is an
 * external source of truth that can already be false on the very first render,
 * and the effect version renders once with the wrong answer before correcting
 * itself. On the sidebar that shows as a visible snap on load.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // Server snapshot. Atlas does not server-render, but jsdom in the test run
    // reaches this before matchMedia is patched, and `false` is the safe answer.
    () => false,
  );
}

/** PRD §9.1: below this the sidebar auto-collapses, without touching the preference. */
export const useIsBelowLarge = () => useMediaQuery("(max-width: 1023px)");
