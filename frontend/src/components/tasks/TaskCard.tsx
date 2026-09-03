import type { DragEvent } from "react";
import { Link } from "react-router";

import { cn } from "@/lib/cn";
import { dueLabel } from "@/lib/dates";
import { labelFor } from "@/lib/design";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import { TaskPriorityBadge } from "@/components/ui/Badge";
import { TASK_STATUSES, type TaskResponse, type TaskStatus } from "@/types/api";

/**
 * §8.2. One card on the board.
 *
 * ── The status select is not a convenience ────────────────────────────────
 *
 * NFR-4.6. Drag-and-drop is unusable without a pointer, and a board that can
 * only be operated by dragging is a board a keyboard user cannot use at all.
 * The select on every card performs the *same* move — it goes through the same
 * `planMove` and the same `PUT /tasks/{id}/move` as a drop at the top of the
 * target column — so the two cannot drift apart, and there is no second code
 * path to forget about.
 *
 * ── Why the controls are `draggable={false}` ──────────────────────────────
 *
 * The card is the drag handle, which is what makes the board feel direct. But a
 * mousedown that lands on the select would otherwise start a drag of the card
 * instead of opening the dropdown. Marking the control strip non-draggable
 * stops the drag from starting there, and the `dragstart` guard is the belt to
 * that pair of braces — a bubbling dragstart would still reach the card.
 */

interface TaskCardProps {
  task: TaskResponse;
  /** True while *this* card is the one being dragged. */
  dragging: boolean;
  /** False inside a project's own tab, where every card is that project's. */
  showProject: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onEdit: (task: TaskResponse) => void;
  onDelete: (task: TaskResponse) => void;
}

export const TaskCard = ({
  task,
  dragging,
  showProject,
  onDragStart,
  onDragEnd,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskCardProps) => {
  const due = dueLabel(task.dueDate, task.status === "DONE");

  const actions: MenuAction[] = [
    { label: "Edit", icon: "edit", onSelect: () => onEdit(task) },
    { label: "Delete", icon: "delete", danger: true, onSelect: () => onDelete(task) },
  ];

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={task.title}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5",
        "transition-[border-color,transform,box-shadow] duration-150 ease-enter",
        "hover:border-ink-muted/35",
        // §8.2: the card lifts and tilts while it is in the air. One degree —
        // enough to read as "picked up", not enough to look like a gimmick.
        dragging && "-rotate-1 cursor-grabbing opacity-90 shadow-overlay",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm text-ink">{task.title}</p>
        <div draggable={false} onDragStart={(event) => event.preventDefault()} className="shrink-0">
          <Menu label={"Actions for " + task.title} actions={actions} />
        </div>
      </div>

      {(showProject || due) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showProject &&
            (task.project ? (
              <Link
                to={"/projects/" + task.project.slug}
                draggable={false}
                className="truncate text-xs text-ink-muted transition-colors hover:text-accent"
              >
                {task.project.name}
              </Link>
            ) : (
              <span className="text-xs text-ink-muted">Unassigned</span>
            ))}

          {/* NFR-4.4: the icon and the words carry it. Red is the third signal,
              never the only one — "Overdue by 2 days" reads the same in
              greyscale. */}
          {due && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                task.isOverdue ? "text-red-600" : "text-ink-muted",
              )}
            >
              <Icon name={task.isOverdue ? "warning" : "calendar"} size={12} />
              {due}
            </span>
          )}
        </div>
      )}

      <div
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        className="flex items-center justify-between gap-2"
      >
        <TaskPriorityBadge priority={task.priority} />

        <select
          value={task.status}
          aria-label={"Status of " + task.title}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
          className={cn(
            "h-6 cursor-pointer rounded-sm border border-line bg-surface px-1.5 text-xs text-ink-secondary",
            "transition-colors duration-150 ease-enter hover:border-ink-muted/40",
          )}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {labelFor.taskStatus(status)}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
};
