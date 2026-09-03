import { Suspense, useMemo } from "react";
import { Outlet, useNavigate } from "react-router";

import { cn } from "@/lib/cn";
import { useIsBelowLarge } from "@/hooks/useMediaQuery";
import { useKeyboardShortcuts, type Shortcut } from "@/hooks/useKeyboardShortcuts";
import { usePrefsStore } from "@/stores/prefsStore";
import { useUiStore } from "@/stores/uiStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { WidthNotice } from "@/components/layout/WidthNotice";
import { SkeletonList } from "@/components/ui/states";

/**
 * The shell every authenticated page renders inside: sidebar, content column,
 * and the global shortcuts (FR-7.6).
 */
export const AppLayout = () => {
  const navigate = useNavigate();
  const belowLarge = useIsBelowLarge();

  const sidebarCollapsed = usePrefsStore((state) => state.sidebarCollapsed);
  const toggleSidebar = usePrefsStore((state) => state.toggleSidebar);
  const togglePalette = useUiStore((state) => state.togglePalette);

  /**
   * PRD §9.1: below 1024 px the sidebar is collapsed *without overwriting the
   * stored preference*. So the rendered state is derived, and the preference is
   * only ever changed by the user clicking the control — resize the window back
   * and the sidebar they chose comes back with it.
   */
  const collapsed = belowLarge || sidebarCollapsed;

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "k", meta: true, handler: togglePalette },
      { key: "\\", meta: true, handler: toggleSidebar },
      { key: "1", handler: () => navigate("/") },
      { key: "2", handler: () => navigate("/projects") },
      { key: "3", handler: () => navigate("/tasks") },
      { key: "4", handler: () => navigate("/environments") },
      { key: "5", handler: () => navigate("/tags") },
    ],
    [navigate, toggleSidebar, togglePalette],
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      <WidthNotice />

      <div className="hidden min-h-dvh md:block">
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

        <div
          className={cn(
            "transition-[padding] duration-200 ease-enter",
            collapsed ? "pl-[60px]" : "pl-[248px]",
          )}
        >
          {/* §9.1: max width 1280, centred, 32 px of horizontal padding. */}
          <main className="mx-auto max-w-[1280px] px-8 py-7">
            {/* Route components are lazy (NFR-1.3), so the shell needs a fallback
                that does not move the layout — matched geometry, not a spinner. */}
            <Suspense fallback={<SkeletonList rows={3} rowClassName="h-24" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
};
