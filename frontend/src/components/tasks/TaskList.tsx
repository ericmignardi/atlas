import { Link } from "react-router";

import { cn } from "@/lib/cn";
import { dueLabel, shortDate } from "@/lib/dates";
import type { SortDirection, TaskSortKey } from "@/lib/taskFilters";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/ui/Badge";
import type { TaskResponse } from "@/types/api";

/**
 * §8.3. The same tasks as a table, for the times a board is the wrong shape —
 * "everything due this week across four projects" is a question a board answers
 * badly and a sorted column answers immediately.
 *
 * Every column sorts, and the header is a `<button>` inside the `<th>` rather
 * than a click handler on the cell: a sort control has to be reachable by Tab
 * and operable by Enter, and only a real button is both for free. The `th`
 * carries `aria-sort`, which is what tells a screen reader that the table is
 * ordered and by which column.
 */

interface TaskListProps {
  tasks: readonly TaskResponse[];
  sort: TaskSortKey;
  direction: SortDirection;
  /** Clicking the sorted column flips it; clicking another one selects it. */
  onSort: (key: TaskSortKey) => void;
  showProject: boolean;
  onToggleDone: (task: TaskResponse) => void;
  onEdit: (task: TaskResponse) => void;
  onDelete: (task: TaskResponse) => void;
}

const COLUMNS: { key: TaskSortKey; label: string; className?: string }[] = [
  { key: "title", label: "Task" },
  { key: "project", label: "Project", className: "w-[180px]" },
  { key: "status", label: "Status", className: "w-[130px]" },
  { key: "priority", label: "Priority", className: "w-[110px]" },
  { key: "due", label: "Due", className: "w-[170px]" },
];

export const TaskList = ({
  tasks,
  sort,
  direction,
  onSort,
  showProject,
  onToggleDone,
  onEdit,
  onDelete,
}: TaskListProps) => {
  const columns = showProject ? COLUMNS : COLUMNS.filter((column) => column.key !== "project");

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-9 px-3 py-2">
              <span className="sr-only">Completed</span>
            </th>

            {columns.map((column) => {
              const active = sort === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("px-3 py-2 text-left", column.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={cn(
                      "inline-flex items-center gap-1 text-eyebrow uppercase",
                      "transition-colors duration-150 ease-enter",
                      active ? "text-ink" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {column.label}
                    {/* The arrow only appears on the sorted column: an arrow on
                        every header is five arrows saying nothing. */}
                    {active && (
                      <Icon name={direction === "asc" ? "chevronUp" : "chevronDown"} size={12} />
                    )}
                  </button>
                </th>
              );
            })}

            <th scope="col" className="w-10 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const done = task.status === "DONE";
            const actions: MenuAction[] = [
              { label: "Edit", icon: "edit", onSelect: () => onEdit(task) },
              { label: "Delete", icon: "delete", danger: true, onSelect: () => onDelete(task) },
            ];

            return (
              <tr
                key={task.id}
                className="border-b border-line last:border-b-0 hover:bg-surface-sunken"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={done}
                    aria-label={done ? "Reopen " + task.title : "Mark " + task.title + " as done"}
                    onChange={() => onToggleDone(task)}
                    className="h-4 w-4 cursor-pointer rounded-sm border border-line accent-accent"
                  />
                </td>

                <td className="px-3 py-2">
                  {/* Struck through *and* muted. Neither alone is enough:
                      strike-through survives greyscale, the colour survives a
                      font that renders the line badly. */}
                  <span className={cn("text-ink", done && "text-ink-muted line-through")}>
                    {task.title}
                  </span>
                </td>

                {showProject && (
                  <td className="px-3 py-2">
                    {task.project ? (
                      <Link
                        to={"/projects/" + task.project.slug}
                        className="truncate text-ink-secondary transition-colors hover:text-accent"
                      >
                        {task.project.name}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">Unassigned</span>
                    )}
                  </td>
                )}

                <td className="px-3 py-2">
                  <TaskStatusBadge status={task.status} />
                </td>

                <td className="px-3 py-2">
                  <TaskPriorityBadge priority={task.priority} />
                </td>

                <td className="px-3 py-2">
                  {task.dueDate ? (
                    /* NFR-4.4: red, an icon, *and* the words. A date that is
                       only red is a date a colour-blind reader reads as fine. */
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        task.isOverdue ? "text-red-600" : "text-ink-secondary",
                      )}
                    >
                      <Icon name={task.isOverdue ? "warning" : "calendar"} size={13} />
                      <span>{shortDate(task.dueDate)}</span>
                      {task.isOverdue && (
                        <span className="text-xs">({dueLabel(task.dueDate)})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>

                <td className="px-3 py-2 text-right">
                  <Menu label={"Actions for " + task.title} actions={actions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
