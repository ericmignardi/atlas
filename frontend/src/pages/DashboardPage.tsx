import { useMemo, type ReactNode } from "react";

import { useUiStore } from "@/stores/uiStore";
import { useDashboard } from "@/hooks/useDashboard";
import { QuickAddButton } from "@/components/layout/QuickAdd";
import { NeedsAttentionRail } from "@/components/dashboard/NeedsAttentionRail";
import { PinnedProjects } from "@/components/dashboard/PinnedProjects";
import { StatTile } from "@/components/dashboard/StatTile";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

/**
 * §6 / FR-6.1 – FR-6.6. The landing screen, from one `GET /api/dashboard`.
 *
 * The payload is not fetched here: it is read from `DashboardProvider`, which
 * holds it at the app shell because the sidebar's counts come out of the same
 * response. See that file for why one request beats two.
 *
 * ── The layout, and the one thing that matters about it ───────────────────
 *
 * `1fr / 388px` above `lg`: pinned projects on the left, "Needs attention" on
 * the right. Below `lg` the two stack — and the rail goes **above** the left
 * column, using flex `order`, not below it in source order. Overdue work is the
 * reason to open the page at all, and a narrower window must not push it under
 * the fold. Source order stays "main content first" for a screen reader; only
 * the visual order flips.
 */

const DashboardPage = () => {
  const { data, error, isLoading, refetch } = useDashboard();

  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  /**
   * FR-6.5. "Thursday 10 September" — computed once per render rather than
   * pulled through `dates.ts`, because this is the one place in Atlas that wants
   * a weekday, and a helper with one caller is indirection rather than reuse.
   */
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  }

  if (!data) return null;

  const { stats, pinnedProjects, needsAttention, isNewAccount } = data;

  /**
   * FR-6.4. One empty state, not a grid of empty panels.
   *
   * Zero tiles, four dashed cards and an empty rail is technically a correct
   * rendering of an empty account and a terrible first screen: it shows six
   * things that are not there and no way to fix any of them. A new account gets
   * one sentence and one button instead.
   */
  if (isNewAccount) {
    return (
      <div className="flex flex-col gap-6">
        <Header today={today} activeProjects={0} />
        <EmptyState
          icon="projects"
          title="Start with a project"
          description="Everything in Atlas hangs off a project — its environments, its tasks, and its tags. Create the first one and this page fills in."
          action={
            <Button variant="primary" icon="plus" onClick={() => openQuickAdd("project")}>
              Create a project
            </Button>
          }
          className="bg-surface py-16"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header today={today} activeProjects={stats.activeProjects} action={<QuickAddButton />} />

      {/* FR-6.1. Four across on a wide screen, two on a narrow one — never one,
          which would push the rail an entire screen down. */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Projects"
          value={stats.activeProjects}
          icon="projects"
          to="/projects"
          detail={"active of " + stats.totalProjects + " total"}
        />
        <StatTile
          label="Open tasks"
          value={stats.openTasks}
          icon="tasks"
          to="/tasks"
          pill={{ label: "overdue", count: stats.overdueTasks }}
          detail={stats.overdueTasks === 0 ? "nothing overdue" : undefined}
        />
        <StatTile
          label="Environments"
          value={stats.environments}
          icon="environments"
          to="/environments"
          detail={
            stats.platforms === 1 ? "on 1 platform" : "across " + stats.platforms + " platforms"
          }
        />
        <StatTile
          label="Tags"
          value={stats.tags}
          icon="tags"
          to="/tags"
          detail={stats.tags === 0 ? "none yet" : undefined}
        />
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_388px] lg:items-start">
        {/* `order` on the flex column only: inside the grid both cells are placed
            by the template and order does nothing, which is exactly right. */}
        <section aria-labelledby="pinned-heading" className="order-2 flex flex-col gap-3 lg:order-none">
          <h2 id="pinned-heading" className="text-eyebrow uppercase text-ink-muted">
            Pinned projects
          </h2>
          <PinnedProjects projects={pinnedProjects} />
        </section>

        <div className="order-1 lg:order-none">
          <NeedsAttentionRail needsAttention={needsAttention} />
        </div>
      </div>
    </div>
  );
};

interface HeaderProps {
  today: string;
  activeProjects: number;
  action?: ReactNode;
}

const Header = ({ today, activeProjects, action }: HeaderProps) => (
  <header className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl text-ink">{today}</h1>
      <p className="text-sm text-ink-secondary">
        {activeProjects === 1 ? "1 project active" : activeProjects + " projects active"}
      </p>
    </div>
    {action}
  </header>
);

/**
 * §9.7: matched geometry. The skeleton is the same grid as the real page, so
 * nothing moves when the data lands — which is the whole difference between a
 * skeleton and a spinner.
 */
const DashboardSkeleton = () => (
  <div className="flex flex-col gap-6" aria-hidden="true">
    <Skeleton className="h-[52px] w-[280px]" />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[0, 1, 2, 3].map((tile) => (
        <Skeleton key={tile} className="h-[104px]" />
      ))}
    </div>
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_388px] lg:items-start">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-[132px]" />
        ))}
      </div>
      <Skeleton className="h-[320px]" />
    </div>
  </div>
);

export default DashboardPage;
