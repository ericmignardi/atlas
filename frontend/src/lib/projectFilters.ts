import type { ProjectResponse, ProjectStatus } from "@/types/api";

/**
 * FR-2.12 / FR-2.13, applied in the browser.
 *
 * The endpoints support the same filters server-side, and if Atlas ever held ten
 * thousand projects that is where this would move. At the scale it is built for
 * — tens, not thousands — filtering the fetched array is instant, costs no
 * request, and removes the whole class of bug where a filter change races the
 * response to a previous one. The decision is written down here rather than
 * implied by the absence of query parameters.
 *
 * Kept as pure functions over plain data so it can be tested without rendering
 * anything, which is exactly what `projectFilters.test.ts` does.
 */

export type ProjectSortKey = "updated" | "created" | "name" | "status";

export interface ProjectFilterState {
  /** The settled search text, already debounced by the page. */
  query: string;
  status: ProjectStatus | "";
  client: string;
  /** A tag *name*, because that is what the chip the user clicked says. */
  tag: string;
  /** FR-2.7: archived projects are out of sight until asked for. */
  includeArchived: boolean;
  sort: ProjectSortKey;
}

export const EMPTY_FILTERS: ProjectFilterState = {
  query: "",
  status: "",
  client: "",
  tag: "",
  includeArchived: false,
  sort: "updated",
};

/** Sort is a presentation choice, not a filter — clearing filters must not reset it. */
export const isFiltered = (filters: ProjectFilterState): boolean =>
  filters.query.trim() !== "" ||
  filters.status !== "" ||
  filters.client !== "" ||
  filters.tag !== "" ||
  filters.includeArchived;

/**
 * FR-2.12: case-insensitive substring across name, client, and description —
 * the same three columns the server searches, so the two agree about what a
 * query means.
 */
function matchesQuery(project: ProjectResponse, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [project.name, project.client, project.description].some((field) =>
    field?.toLowerCase().includes(needle),
  );
}

/**
 * FR-2.7 and its one exception: filtering *to* ARCHIVED is itself a request to
 * see them, and hiding them would make the status filter look broken. This is
 * the server's `ProjectFilter.archivedVisible()` written in TypeScript.
 */
function archivedVisible(filters: ProjectFilterState): boolean {
  return filters.includeArchived || filters.status === "ARCHIVED";
}

export function filterProjects(
  projects: readonly ProjectResponse[],
  filters: ProjectFilterState,
): ProjectResponse[] {
  const showArchived = archivedVisible(filters);

  return projects.filter((project) => {
    if (project.status === "ARCHIVED" && !showArchived) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.client && project.client !== filters.client) return false;
    if (filters.tag && !project.tags.some((tag) => tag.name === filters.tag)) return false;
    return matchesQuery(project, filters.query);
  });
}

/**
 * FR-2.8: pinned projects lead every order, matching `ProjectSort.comparator()`
 * on the server — the list and the dashboard must not disagree about what is at
 * the top.
 *
 * `toSorted` rather than `sort`: the input is the fetched array, and mutating it
 * in place would reorder the cache under a component that is mid-render.
 */
export function sortProjects(
  projects: readonly ProjectResponse[],
  sort: ProjectSortKey,
): ProjectResponse[] {
  const compare = COMPARATORS[sort];
  return [...projects].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || compare(a, b));
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** Newest first for both timestamps: "recently updated" is what you want to see. */
const COMPARATORS: Record<ProjectSortKey, (a: ProjectResponse, b: ProjectResponse) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => byText(a.name, b.name),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byText(a.name, b.name),
};

/** The server's declaration order, which is also the lifecycle order. */
const STATUS_ORDER: Record<ProjectStatus, number> = {
  IDEA: 0,
  ACTIVE: 1,
  PAUSED: 2,
  SHIPPED: 3,
  ARCHIVED: 4,
};

/** The distinct clients across the fetched list, for the client select. */
export function clientOptions(projects: readonly ProjectResponse[]): string[] {
  const names = new Set<string>();
  for (const project of projects) {
    if (project.client) names.add(project.client);
  }
  return [...names].sort(byText);
}
