import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskView = "board" | "list";
export type ProjectView = "grid" | "list";
export type QuickAddType = "task" | "project" | "environment";

interface PrefsState {
  /** FR-2.14 / PRD §9.1. The user's stated preference, not the current width. */
  sidebarCollapsed: boolean;
  taskView: TaskView;
  projectView: ProjectView;
  /** FR-6.6: the split button remembers what you made last. */
  lastQuickAddType: QuickAddType;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTaskView: (view: TaskView) => void;
  setProjectView: (view: ProjectView) => void;
  setLastQuickAddType: (type: QuickAddType) => void;
}

/**
 * Everything here survives a reload, which is the whole point: a view toggle
 * that resets on every visit is a view toggle nobody uses.
 *
 * Note what is *not* here — whether the sidebar is collapsed right now. Below
 * 1024px it is forced closed regardless (PRD §9.1), and writing that back would
 * mean resizing a window silently rewrote a preference the user set on purpose.
 * `sidebarCollapsed` is the preference; the layout derives the actual state.
 */
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      taskView: "board",
      projectView: "grid",
      lastQuickAddType: "task",

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTaskView: (taskView) => set({ taskView }),
      setProjectView: (projectView) => set({ projectView }),
      setLastQuickAddType: (lastQuickAddType) => set({ lastQuickAddType }),
    }),
    { name: "atlas.preferences" },
  ),
);
