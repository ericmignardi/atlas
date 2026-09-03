import { create } from "zustand";

import type { QuickAddType } from "@/stores/prefsStore";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  /** Optional second line: the specific reason a mutation failed. */
  detail?: string;
}

interface UiState {
  /** FR-7.1. Lives here rather than in the palette so ⌘K can reach it from anywhere. */
  paletteOpen: boolean;
  toasts: Toast[];

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  /**
   * FR-6.6 / FR-7.6. Which quick-add form is open, or null.
   *
   * It lives here rather than in the split button because the button is on the
   * dashboard and the shortcut is everywhere: pressing Ctrl+N on the tags page
   * has to open the same form, and a component that is not mounted cannot open
   * anything. The button dispatches, a host near the root renders.
   */
  quickAdd: QuickAddType | null;
  openQuickAdd: (type: QuickAddType) => void;
  closeQuickAdd: () => void;

  /** FR-8.3. Returns the id so a caller can dismiss its own toast early. */
  pushToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
}

/**
 * Not persisted, on purpose. A toast that survives a reload is a toast about
 * something that already finished, and an open modal restored on a cold load
 * has no form state behind it.
 */
export const useUiStore = create<UiState>()((set) => ({
  paletteOpen: false,
  toasts: [],

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),

  quickAdd: null,
  // Opening a form closes the palette: the palette's Create rows are one of the
  // two ways in, and leaving it open behind a modal traps focus in the wrong place.
  openQuickAdd: (quickAdd) => set({ quickAdd, paletteOpen: false }),
  closeQuickAdd: () => set({ quickAdd: null }),

  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * FR-8.3: every mutation gets a toast, on success and on failure. Exported as
 * plain functions because most callers are event handlers and async thunks, not
 * components, and `useUiStore.getState().pushToast({ tone: "success", ... })`
 * at forty call sites is forty chances to pass the wrong tone.
 */
export const toast = {
  success: (message: string, detail?: string) =>
    useUiStore.getState().pushToast({ tone: "success", message, detail }),
  error: (message: string, detail?: string) =>
    useUiStore.getState().pushToast({ tone: "error", message, detail }),
  info: (message: string, detail?: string) =>
    useUiStore.getState().pushToast({ tone: "info", message, detail }),
};
