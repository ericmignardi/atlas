import { useEffect, type RefObject } from "react";

/**
 * Tab and Shift+Tab are the only two keys that can move focus out of a dialog,
 * so wrapping them at the ends of the container is the whole trap (NFR-4.5).
 *
 * The selector deliberately excludes `[tabindex="-1"]` and disabled controls:
 * both are focusable by script but not by Tab, and including them puts an
 * invisible stop in the cycle.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const node = container.current;
    if (!node) return;

    // Remembered before the first focus move, restored on unmount — NFR-4.5's
    // third clause. Without it, dismissing a dialog dumps focus on <body> and
    // the next Tab starts from the top of the page.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Focus the first control rather than the dialog itself, so a form is ready
    // to type into. Falls back to the container when there is nothing to focus.
    const first = focusable()[0];
    (first ?? node).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === firstItem || current === node)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && current === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [container, active, onEscape]);
}
