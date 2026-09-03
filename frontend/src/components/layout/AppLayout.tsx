import { Suspense, useMemo } from "react";
import { Outlet, useNavigate } from "react-router";

import { cn } from "@/lib/cn";
import { useIsBelowLarge } from "@/hooks/useMediaQuery";
import { useKeyboardShortcuts, type Shortcut } from "@/hooks/useKeyboardShortcuts";
import { usePrefsStore } from "@/stores/prefsStore";
import { useUiStore } from "@/stores/uiStore";
import { useDashboard } from "@/hooks/useDashboard";
import { DashboardProvider } from "@/components/layout/DashboardProvider";
import { QuickAddHost } from "@/components/layout/QuickAdd";
import { Sidebar, type SidebarCounts } from "@/components/layout/Sidebar";
import { WidthNotice } from "@/components/layout/WidthNotice";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { SkeletonList } from "@/components/ui/states";

/**
 * The shell every authenticated page renders inside: sidebar, content column,
 * the command palette, the quick-add forms, and the global shortcuts (FR-7.6).
 *
 * The provider is the outer component so that everything below it — including
 * the sidebar's counts — reads one `GET /api/dashboard` rather than issuing its
 * own. See `DashboardProvider` for why that request lives here.
 */
export const AppLayout = () => (
  <DashboardProvider>
    <AppShell />
  </DashboardProvider>
);

const AppShell = () => {
  const navigate = useNavigate();
  const belowLarge = useIsBelowLarge();

  const sidebarCollapsed = usePrefsStore((state) => state.sidebarCollapsed);
  const toggleSidebar = usePrefsStore((state) => state.toggleSidebar);
  const lastQuickAddType = usePrefsStore((state) => state.lastQuickAddType);
  const togglePalette = useUiStore((state) => state.togglePalette);
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  const dashboard = useDashboard();

  /**
   * PRD §9.1: below 1024 px the sidebar is collapsed *without overwriting the
   * stored preference*. So the rendered state is derived, and the preference is
   * only ever changed by the user clicking the control — resize the window back
   * and the sidebar they chose comes back with it.
   */
  const collapsed = belowLarge || sidebarCollapsed;

  /**
   * §9.1's nav counts, out of the dashboard payload. Undefined until it lands,
   * which is what the sidebar wants — a "0" that turns into "12" half a second
   * later is worse than no number at all.
   */
  const counts = useMemo<SidebarCounts>(() => {
    const stats = dashboard.data?.stats;
    return {
      projects: stats?.totalProjects,
      overdueTasks: stats?.overdueTasks,
      environments: stats?.environments,
      tags: stats?.tags,
    };
  }, [dashboard.data]);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "k", meta: true, handler: togglePalette },
      // FR-6.6: ⌘N opens the last type used, which is the same thing the split
      // button's body does — one preference, two ways to reach it.
      { key: "n", meta: true, handler: () => openQuickAdd(lastQuickAddType) },
      { key: "\\", meta: true, handler: toggleSidebar },
      { key: "1", handler: () => navigate("/") },
      { key: "2", handler: () => navigate("/projects") },
      { key: "3", handler: () => navigate("/tasks") },
      { key: "4", handler: () => navigate("/environments") },
      { key: "5", handler: () => navigate("/tags") },
    ],
    [navigate, toggleSidebar, togglePalette, openQuickAdd, lastQuickAddType],
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      <WidthNotice />

      <div className="hidden min-h-dvh md:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          counts={counts}
          pinnedProjects={dashboard.data?.pinnedProjects}
        />

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

      {/* Both are portalled to the body, so where they sit in the tree only
          decides what they can read — the palette needs the router, and quick
          add needs the dashboard's refetch. */}
      <CommandPalette />
      <QuickAddHost />
    </>
  );
};
