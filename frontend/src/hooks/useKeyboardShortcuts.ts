import { useEffect, useRef } from "react";

/**
 * FR-7.6 / FR-7.7.
 *
 * The whole difficulty of a global shortcut is knowing when *not* to fire it.
 * `⌘\` toggles the sidebar, but a backslash typed into a description field is a
 * backslash; `1`–`5` jump between nav sections, but a "1" in a task title is a
 * one. So an event that originated in a text input is suppressed — except for
 * Escape, which means "get me out of here" everywhere, and ⌘Enter, which means
 * "submit this form" and only makes sense while a form has focus.
 */

export interface Shortcut {
  /** `event.key`, compared case-insensitively. */
  key: string;
  /** ⌘ on macOS, Ctrl elsewhere — matched against either, so one binding covers both. */
  meta?: boolean;
  shift?: boolean;
  handler: (event: KeyboardEvent) => void;
  /** Fire even while a text input has focus. Only Escape and ⌘Enter set this. */
  allowInInput?: boolean;
  /** Suppress the shortcut without unmounting the hook — a modal turning off ⌘K, say. */
  enabled?: boolean;
}

/**
 * `isContentEditable` catches rich-text surfaces that are not inputs at all, and
 * the `role="textbox"` check catches the ones that fake it. Checking the tag
 * name alone would miss both.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.getAttribute("role") === "textbox") return true;

  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // A checkbox or a radio is an input that does not swallow characters, so a
    // single-letter shortcut is safe while one has focus.
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset"].includes(type);
  }
  return false;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  /**
   * The array is rebuilt on every render — the handlers close over current
   * state, which is the point. Held in a ref so the listener is attached once
   * instead of being torn down and re-added on every keystroke elsewhere in the
   * app, while still calling the newest handlers.
   */
  const latest = useRef(shortcuts);

  // Written in an effect rather than during render: a ref mutated mid-render is
  // a side effect, and under concurrent rendering the render that wrote it may
  // never commit.
  useEffect(() => {
    latest.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inTextEntry = isTextEntry(event.target);
      // One binding for both platforms. Comparing against navigator.platform to
      // pick one would be wrong on an external keyboard, and wrong forever after
      // the string it sniffs gets frozen.
      const metaHeld = event.metaKey || event.ctrlKey;

      for (const shortcut of latest.current) {
        if (shortcut.enabled === false) continue;
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
        if (Boolean(shortcut.meta) !== metaHeld) continue;
        if (Boolean(shortcut.shift) !== event.shiftKey) continue;
        if (inTextEntry && !shortcut.allowInInput) continue;

        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
