import { cn } from "@/lib/cn";
import { labelFor } from "@/lib/design";
import { UNASSIGNED, type TaskFilterState } from "@/lib/taskFilters";
import { IconButton } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectResponse,
  type TaskPriority,
  type TaskStatus,
} from "@/types/api";
import type { TaskView } from "@/stores/prefsStore";

/**
 * §8.3's filter row. Three selects, one toggle, and the board/list switch.
 *
 * The status select is hidden in board view rather than disabled, because a
 * board *is* the status axis — filtering to one status leaves three empty
 * columns and one full one, which is a worse table than the table. Everything
 * else applies to both presentations.
 */

const STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: labelFor.taskStatus(status),
}));

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: labelFor.taskPriority(priority),
}));

interface TaskToolbarProps {
  filters: TaskFilterState;
  onFilterChange: (patch: Partial<TaskFilterState>) => void;
  onClear: () => void;
  /** Absent inside a project's own tab, where the filter would have one option. */
  projects?: readonly ProjectResponse[];
  view: TaskView;
  onViewChange: (view: TaskView) => void;
  shown: number;
  total: number;
  filtered: boolean;
}

export const TaskToolbar = ({
  filters,
  onFilterChange,
  onClear,
  projects,
  view,
  onViewChange,
  shown,
  total,
  filtered,
}: TaskToolbarProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      {projects && (
        <Select
          options={[
            { value: UNASSIGNED, label: "Unassigned" },
            ...projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
          placeholder="Any project"
          value={filters.project}
          aria-label="Filter by project"
          onChange={(event) => onFilterChange({ project: event.target.value })}
          className="w-[190px]"
        />
      )}

      {view === "list" && (
        <Select
          options={STATUS_OPTIONS}
          placeholder="Any status"
          value={filters.status}
          aria-label="Filter by status"
          onChange={(event) => onFilterChange({ status: event.target.value as TaskStatus | "" })}
          className="w-[150px]"
        />
      )}

      <Select
        options={PRIORITY_OPTIONS}
        placeholder="Any priority"
        value={filters.priority}
        aria-label="Filter by priority"
        onChange={(event) => onFilterChange({ priority: event.target.value as TaskPriority | "" })}
        className="w-[150px]"
      />

      <div className="ml-auto flex items-center gap-2">
        {/*
          FR-4.12 and FR-4.13 pull in different directions here, and the toggle
          only governs the list. The board's Done column is narrowed on the
          server to the last seven days, which is not a filter the client can
          widen — so showing the toggle in board view would be a control that
          does nothing.
        */}
        {view === "list" && (
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={filters.includeCompleted}
              onChange={(event) => onFilterChange({ includeCompleted: event.target.checked })}
              className="h-3.5 w-3.5 cursor-pointer rounded-sm border border-line accent-accent"
            />
            Show completed
          </label>
        )}

        {/* FR-4.13: the choice persists, which is the whole point of having it. */}
        <div
          role="group"
          aria-label="Presentation"
          className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
        >
          <IconButton
            icon="grid"
            label="Board view"
            size="sm"
            aria-pressed={view === "board"}
            onClick={() => onViewChange("board")}
            className={cn(view === "board" && "bg-tint-blue text-accent")}
          />
          <IconButton
            icon="list"
            label="List view"
            size="sm"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={cn(view === "list" && "bg-tint-blue text-accent")}
          />
        </div>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-ink-muted tabular-nums">
        Showing {shown} of {total}
      </p>

      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs text-accent transition-colors hover:text-accent-hover"
        >
          Clear filters
        </button>
      )}
    </div>
  </div>
);
