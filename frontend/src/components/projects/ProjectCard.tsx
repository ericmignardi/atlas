import { Link } from "react-router";

import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/dates";
import { Badge, ProjectStatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/Button";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import { TagChip, TechChip } from "@/components/ui/TagChip";
import type { ProjectResponse } from "@/types/api";

/**
 * §7.2. One component for both presentations of FR-2.14, because grid and list
 * show the same facts in a different arrangement — two components would be two
 * places to add the next one.
 *
 * **The whole card is a link, and it contains buttons.** A `<Link>` wrapped
 * around a `<button>` is invalid HTML and behaves differently in every browser.
 * The fix is the stretched-link pattern: the title is the only real link, and an
 * `::after` pseudo-element on it covers the card. The controls sit above that
 * layer with `relative z-10`, so a click on the pin toggle is a click on the pin
 * toggle and a click anywhere else opens the project.
 */

interface ProjectCardProps {
  project: ProjectResponse;
  view: "grid" | "list";
  onTogglePin: (project: ProjectResponse) => void;
  onEdit: (project: ProjectResponse) => void;
  onDelete: (project: ProjectResponse) => void;
  /** Sets the tag filter — a chip you can read is a chip worth being able to click. */
  onTagClick?: (tagName: string) => void;
}

/** `noopener` matters: without it the opened page can reach back through `window.opener`. */
const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

export const ProjectCard = ({
  project,
  view,
  onTogglePin,
  onEdit,
  onDelete,
  onTagClick,
}: ProjectCardProps) => {
  const list = view === "list";

  const actions: MenuAction[] = [
    ...(project.repoUrl
      ? [
          {
            label: "Open repository",
            icon: "branch" as const,
            onSelect: () => openExternal(project.repoUrl as string),
          },
        ]
      : []),
    ...(project.liveUrl
      ? [
          {
            label: "Open live site",
            icon: "external" as const,
            onSelect: () => openExternal(project.liveUrl as string),
          },
        ]
      : []),
    { label: "Edit", icon: "edit", onSelect: () => onEdit(project) },
    {
      label: project.isPinned ? "Unpin" : "Pin",
      icon: project.isPinned ? "unpin" : "pin",
      onSelect: () => onTogglePin(project),
    },
    { label: "Delete", icon: "delete", danger: true, onSelect: () => onDelete(project) },
  ];

  const counts = (
    <div className="flex flex-wrap items-center gap-1.5">
      {/*
        One environment count, not a chip per type. `ProjectResponse` carries the
        total; the per-type split lives behind `GET /environments?projectId=`,
        and fanning that out per card would be forty requests to render a list.
        The split is on the detail page, where that data is loaded anyway.
      */}
      {project.environmentCount > 0 && (
        <Badge>
          <Icon name="environments" size={12} />
          {project.environmentCount}
        </Badge>
      )}
      {project.openTaskCount > 0 && (
        <Badge>
          <Icon name="tasks" size={12} />
          {project.openTaskCount}
        </Badge>
      )}
      {/* FR-4.9: overdue is the one count that has to shout. */}
      {project.overdueTaskCount > 0 && (
        <Badge tint="red">
          <Icon name="warning" size={12} />
          {project.overdueTaskCount} overdue
        </Badge>
      )}
    </div>
  );

  const chips = (project.techStack.length > 0 || project.tags.length > 0) && (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Four, then a count. The stack is a hint on a card and the whole truth on
          the detail page. */}
      {project.techStack.slice(0, 4).map((entry) => (
        <TechChip key={entry} value={entry} />
      ))}
      {project.techStack.length > 4 && (
        <span className="text-xs text-ink-muted">+{project.techStack.length - 4}</span>
      )}

      {project.tags.map((tag) =>
        onTagClick ? (
          <button
            key={tag.id}
            type="button"
            onClick={() => onTagClick(tag.name)}
            title={`Filter by ${tag.name}`}
            className="relative z-10"
          >
            <TagChip tag={tag} />
          </button>
        ) : (
          <TagChip key={tag.id} tag={tag} />
        ),
      )}
    </div>
  );

  /*
    Revealed on hover, and always present for the keyboard: `opacity-0` still
    occupies its box and still takes focus, so `focus-within` brings it back and
    nothing shifts when it appears. `display: none` would do neither.
  */
  const controls = (
    <div
      className={cn(
        "relative z-10 flex shrink-0 items-center gap-0.5",
        "opacity-0 transition-opacity duration-150 ease-enter",
        "group-hover:opacity-100 group-focus-within:opacity-100",
      )}
    >
      <IconButton
        icon={project.isPinned ? "unpin" : "pin"}
        label={project.isPinned ? `Unpin ${project.name}` : `Pin ${project.name}`}
        size="sm"
        onClick={() => onTogglePin(project)}
      />
      <Menu label={`Actions for ${project.name}`} actions={actions} />
    </div>
  );

  const title = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {project.isPinned && <Icon name="pin" size={13} className="text-accent" label="Pinned" />}
        <Link
          to={`/projects/${project.slug}`}
          className="truncate text-lg text-ink after:absolute after:inset-0 after:content-['']"
        >
          {project.name}
        </Link>
      </div>
      {project.client && <p className="truncate text-sm text-ink-muted">{project.client}</p>}
    </div>
  );

  if (list) {
    return (
      <Card
        interactive
        className="group relative flex items-center gap-4 px-4 py-3 animate-list-enter"
      >
        <div className="min-w-0 flex-[2]">{title}</div>
        <div className="hidden shrink-0 lg:block">
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="hidden min-w-0 flex-1 justify-end lg:flex">{counts}</div>
        <p className="hidden w-24 shrink-0 text-right text-xs text-ink-muted lg:block">
          {relativeTime(project.updatedAt)}
        </p>
        {controls}
      </Card>
    );
  }

  return (
    <Card interactive className="group relative flex flex-col gap-3 p-4 animate-list-enter">
      <div className="flex items-start justify-between gap-2">
        {title}
        <div className="flex shrink-0 items-center gap-1">
          <ProjectStatusBadge status={project.status} />
          {controls}
        </div>
      </div>

      {/* Two lines, then an ellipsis. A card whose height depends on how much
          someone wrote is a grid that never lines up. */}
      {project.description && (
        <p className="line-clamp-2 text-sm text-ink-secondary">{project.description}</p>
      )}

      {chips}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        {counts}
        <p className="shrink-0 text-xs text-ink-muted">{relativeTime(project.updatedAt)}</p>
      </div>
    </Card>
  );
};
