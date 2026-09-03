import { Link } from "react-router";

import { cn } from "@/lib/cn";
import { ProjectStatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { TagChip } from "@/components/ui/TagChip";
import type { ProjectResponse } from "@/types/api";

/**
 * FR-6.2. Up to four pinned projects, two up, with a dashed invitation card in
 * every unused slot.
 *
 * ── Why the dashed cards ──────────────────────────────────────────────────
 *
 * The slot is the point. A grid that grows from one card to four as you pin
 * things gives no hint that pinning exists or that there is a limit; four
 * outlines, one of them filled, say both without a sentence. It is also why they
 * are links to the projects list rather than decoration — the invitation has to
 * lead somewhere.
 *
 * ── Not `ProjectCard` ─────────────────────────────────────────────────────
 *
 * The list card carries a pin toggle, an edit action and a delete action, all of
 * which need handlers and a confirmation dialog. On a dashboard those are the
 * wrong affordances: this is a jumping-off point, not a management surface. The
 * shared part is the design system underneath, not the component.
 */

/** FR-2.8. Four is the server's limit, so four is the number of slots. */
const SLOTS = 4;

export const PinnedProjects = ({ projects }: { projects: readonly ProjectResponse[] }) => {
  const shown = projects.slice(0, SLOTS);
  const empty = Math.max(0, SLOTS - shown.length);

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {shown.map((project) => (
        <li key={project.id}>
          <PinnedCard project={project} />
        </li>
      ))}
      {Array.from({ length: empty }, (_, index) => (
        <li key={"slot-" + index}>
          {/* Only the first slot carries the invitation. Four identical "Pin a
              project" cards read as a broken grid rather than as one offer. */}
          <EmptySlot inviting={index === 0} />
        </li>
      ))}
    </ul>
  );
};

const PinnedCard = ({ project }: { project: ProjectResponse }) => (
  <Link
    to={"/projects/" + project.slug}
    className={cn(
      "flex h-full flex-col gap-2.5 rounded-lg border border-line bg-surface p-4",
      "transition-colors duration-150 ease-enter hover:border-ink-muted/35",
      // §9.6's list-item enter. Only newly mounted cards animate — a refetch
      // that returns the same four reuses the DOM and nothing replays.
      "animate-list-enter",
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-lg text-ink">{project.name}</span>
        {project.client && (
          <span className="truncate text-xs text-ink-muted">{project.client}</span>
        )}
      </div>
      <ProjectStatusBadge status={project.status} />
    </div>

    {project.tags.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {project.tags.slice(0, 3).map((tag) => (
          <TagChip key={tag.id} tag={tag} />
        ))}
      </div>
    )}

    {/* NFR-4.4: each count says what it counts. "3" beside a red dot is a
        colour carrying meaning; "3 overdue" is not. */}
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-ink-muted">
      <Count icon="environments" value={project.environmentCount} noun="environment" />
      <Count icon="tasks" value={project.openTaskCount} noun="open task" />
      {project.overdueTaskCount > 0 && (
        <span className="flex items-center gap-1 text-red-600">
          <Icon name="warning" size={12} />
          {project.overdueTaskCount} overdue
        </span>
      )}
    </div>
  </Link>
);

const Count = ({ icon, value, noun }: { icon: "environments" | "tasks"; value: number; noun: string }) => (
  <span className="flex items-center gap-1">
    <Icon name={icon} size={12} />
    {value} {noun}
    {value === 1 ? "" : "s"}
  </span>
);

const EmptySlot = ({ inviting }: { inviting: boolean }) => (
  <Link
    to="/projects"
    className={cn(
      "flex h-full min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-lg",
      "border border-dashed border-line px-4 py-6 text-center",
      "transition-colors duration-150 ease-enter hover:border-ink-muted/45",
    )}
  >
    {inviting ? (
      <>
        <Icon name="pin" size={17} className="text-ink-muted" />
        <span className="text-sm text-ink-secondary">Pin a project</span>
        <span className="max-w-[30ch] text-xs text-ink-muted">
          Pinned projects sit here and in the sidebar. Four at a time.
        </span>
      </>
    ) : (
      <Icon name="pin" size={15} className="text-line" label="Empty pin slot" />
    )}
  </Link>
);
