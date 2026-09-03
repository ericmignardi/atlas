import { useEffect, useRef, type RefObject } from "react";

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
  /**
   * Held in a ref, and the effect below deliberately does **not** depend on it.
   *
   * Callers pass an inline arrow, so `onEscape` has a new identity on every
   * render. With it in the dependency array the effect tears down and re-runs
   * each time — and re-running it calls `first.focus()`, which moves focus to
   * the dialog's first control. Inside a dialog that is only a confirmation
   * that is invisible; inside one containing a *form*, every keystroke changes
   * state, re-renders, and yanks the caret out of the field the user is typing
   * in after the first character.
   */
  const latestEscape = useRef(onEscape);
  useEffect(() => {
    latestEscape.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;

    const node = container.current;
    if (!node) return;

    // Remembered before the first focus move, restored on unmount — NFR-4.5's
    // third clause. Without it, dismissing a dialog dumps focus on <body> and
    // the next Tab starts from the top of the page.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));

    /**
     * Focus something inside, rather than the dialog itself, so a form is ready
     * to type into.
     *
     * "The first focusable element" is not good enough on its own: in DOM order
     * that is the header's close button, so opening a form puts the caret on
     * Dismiss. A dialog that has a field worth starting in marks it with
     * `data-autofocus` and gets it. `autoFocus` is not used for this — React
     * implements it by calling `.focus()` itself rather than by emitting the
     * attribute, so there would be nothing here to query.
     */
    const preferred = node.querySelector<HTMLElement>("[data-autofocus]");
    (preferred ?? focusable()[0] ?? node).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        latestEscape.current?.();
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
  }, [container, active]);
}
