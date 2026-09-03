import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskResponse,
  type TaskStatus,
} from "@/types/api";

/**
 * FR-4.13 and FR-4.14, in the browser.
 *
 * The server can do all of this — `TaskFilter` takes a project, a status, a
 * priority and a sort — and the list still does it locally, for the reason
 * `projectFilters.ts` sets out: one request, no loading state between filter
 * changes, and no race to lose. `includeCompleted` is again the exception,
 * because it decides what is *sent*, and the list is fetched with it on so that
 * flipping the toggle costs nothing.
 *
 * The sort is a column header rather than a dropdown, so unlike the projects
 * list it carries a direction. Clicking the sorted column flips it.
 */

export type TaskSortKey = "status" | "title" | "project" | "priority" | "due";
export type SortDirection = "asc" | "desc";

/** The filter select's value for FR-4.5's unassigned bucket, which has no id. */
export const UNASSIGNED = "none";

export interface TaskFilterState {
  /** A project id, `UNASSIGNED`, or "" for any. */
  project: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  includeCompleted: boolean;
  sort: TaskSortKey;
  direction: SortDirection;
}

export const EMPTY_TASK_FILTERS: TaskFilterState = {
  project: "",
  status: "",
  priority: "",
  includeCompleted: false,
  sort: "status",
  direction: "asc",
};

/** Sort is presentation, not a filter: clearing filters must not reorder the table. */
export function isTaskFiltered(filters: TaskFilterState): boolean {
  return (
    filters.project !== "" ||
    filters.status !== "" ||
    filters.priority !== "" ||
    filters.includeCompleted
  );
}

export function filterTasks(
  tasks: readonly TaskResponse[],
  filters: TaskFilterState,
): TaskResponse[] {
  return tasks.filter((task) => {
    // An explicit status filter of DONE beats the toggle: asking for completed
    // tasks and being shown none because a checkbox is off reads as a bug.
    if (!filters.includeCompleted && filters.status !== "DONE" && task.status === "DONE") {
      return false;
    }
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;

    if (filters.project === UNASSIGNED) return task.project === null;
    if (filters.project && task.project?.id !== filters.project) return false;

    return true;
  });
}

const STATUS_RANK = new Map(TASK_STATUSES.map((status, index) => [status, index]));
const PRIORITY_RANK = new Map(TASK_PRIORITIES.map((priority, index) => [priority, index]));

export function sortTasks(
  tasks: readonly TaskResponse[],
  sort: TaskSortKey,
  direction: SortDirection,
): TaskResponse[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...tasks].sort((a, b) => {
    /**
     * The empty values are ordered *before* the sign is applied, and that is
     * the whole reason this is two steps rather than one comparator.
     *
     * A task with no due date is not "the furthest away" — it is outside the
     * ordering. Fold it into the comparison and the descending sort floats
     * every undated row to the top, burying the rows the sort was asked for.
     * So blanks sink to the bottom in both directions.
     */
    const blanks = blanksLast(a, b, sort);
    const primary = blanks !== 0 ? blanks : compare(a, b, sort) * sign;

    // Made total, so a re-render of an equal pair does not reshuffle the table.
    return primary || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

/** Only two of the five sorts have an absent case; the rest are always present. */
function blanksLast(a: TaskResponse, b: TaskResponse, sort: TaskSortKey): number {
  const missing =
    sort === "due"
      ? (task: TaskResponse) => task.dueDate === null
      : sort === "project"
        ? (task: TaskResponse) => task.project === null
        : null;

  if (!missing) return 0;
  return Number(missing(a)) - Number(missing(b));
}

function compare(a: TaskResponse, b: TaskResponse, sort: TaskSortKey): number {
  switch (sort) {
    case "status":
      return (
        (STATUS_RANK.get(a.status) ?? 0) - (STATUS_RANK.get(b.status) ?? 0) ||
        a.sortOrder - b.sortOrder
      );
    case "priority":
      return (PRIORITY_RANK.get(a.priority) ?? 0) - (PRIORITY_RANK.get(b.priority) ?? 0);
    case "title":
      return a.title.localeCompare(b.title);
    case "project":
      return (a.project?.name ?? "").localeCompare(b.project?.name ?? "");
    /** ISO-8601 sorts correctly as text, which is most of the point of it. */
    case "due":
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  }
}
