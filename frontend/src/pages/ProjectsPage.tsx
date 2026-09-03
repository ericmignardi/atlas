import { useCallback, useMemo, useState } from "react";

import { isApiError } from "@/lib/apiClient";
import {
  clientOptions,
  EMPTY_FILTERS,
  filterProjects,
  isFiltered,
  sortProjects,
  type ProjectFilterState,
} from "@/lib/projectFilters";
import { deleteProject, listProjects, setPinned } from "@/lib/projectsApi";
import { listTags } from "@/lib/tagsApi";
import { useApi } from "@/hooks/useApi";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePrefsStore } from "@/stores/prefsStore";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  PageHeader,
  Skeleton,
} from "@/components/ui/states";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { ProjectToolbar } from "@/components/projects/ProjectToolbar";
import type { ProjectResponse, TagResponse } from "@/types/api";

/**
 * §7.2. The list, its filters, and the three states of FR-8.1.
 *
 * Everything is fetched once and narrowed in the browser (see
 * `projectFilters.ts` for why). That makes every filter interaction free and
 * leaves exactly one request to reason about — which is also what makes the
 * mutations simple: each one folds its response back into the cached array, so
 * a card updates on the same tick its toast appears, with no refetch and no
 * flash of the loading state.
 */

const ProjectsPage = () => {
  const projects = useApi(listProjects, []);
  const tags = useApi(listTags, []);

  const view = usePrefsStore((state) => state.projectView);
  const setView = usePrefsStore((state) => state.setProjectView);

  /** Raw text; `filters.query` is the settled copy 200 ms behind it (§7.2). */
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const [filters, setFilters] = useState<ProjectFilterState>(EMPTY_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectResponse | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<ProjectResponse | undefined>(undefined);

  const active = useMemo<ProjectFilterState>(
    () => ({ ...filters, query: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const all = useMemo(() => projects.data ?? [], [projects.data]);
  const visible = useMemo(
    () => sortProjects(filterProjects(all, active), active.sort),
    [all, active],
  );

  /** FR-2.7: the denominator is what the current archived setting admits, not
      every row ever fetched — otherwise "Showing 3 of 40" counts rows the list
      is deliberately hiding and reads as a bug. */
  const total = useMemo(
    () =>
      all.filter(
        (project) =>
          project.status !== "ARCHIVED" || active.includeArchived || active.status === "ARCHIVED",
      ).length,
    [all, active.includeArchived, active.status],
  );

  const clients = useMemo(() => clientOptions(all), [all]);
  const filtered = isFiltered(active);

  const clearFilters = useCallback(() => {
    setSearch("");
    // Sort survives: it is a presentation choice, not a filter, and resetting it
    // would silently reorder the list someone was reading.
    setFilters((current) => ({ ...EMPTY_FILTERS, sort: current.sort }));
  }, []);

  /** Replaces one project in the cached array, matched by id. */
  const replace = useCallback(
    (saved: ProjectResponse) =>
      projects.setData((current) =>
        (current ?? []).map((project) => (project.id === saved.id ? saved : project)),
      ),
    [projects],
  );

  const onSaved = useCallback(
    (saved: ProjectResponse, mode: "created" | "updated") => {
      if (mode === "created") {
        projects.setData((current) => [saved, ...(current ?? [])]);
        // A created project can carry counts the list computes server-side, and
        // creating one may also have created tags. Both are cheap to re-read and
        // wrong to guess at.
        void tags.refetch();
      } else {
        replace(saved);
      }
    },
    [projects, tags, replace],
  );

  /**
   * FR-2.8. Optimistic, because a pin toggle that waits 200 ms for a round trip
   * feels broken — and reversible, because the fifth pin is a 409 and the icon
   * has to go back. The rollback is the whole reason this is written out rather
   * than being a `then(refetch)`.
   */
  const togglePin = useCallback(
    async (project: ProjectResponse) => {
      const next = !project.isPinned;
      replace({ ...project, isPinned: next });

      try {
        replace(await setPinned(project.id, next));
        toast.success(next ? `${project.name} pinned` : `${project.name} unpinned`);
      } catch (error) {
        replace(project);
        const message =
          isApiError(error) && error.status === 409
            ? "Four projects are already pinned. Unpin one first."
            : isApiError(error)
              ? error.message
              : "Try again in a moment.";
        toast.error(next ? "Could not pin that project" : "Could not unpin that project", message);
      }
    },
    [replace],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteProject(pendingDelete.id);
      projects.setData((current) =>
        (current ?? []).filter((project) => project.id !== pendingDelete.id),
      );
      toast.success(`${pendingDelete.name} deleted`);
    } catch (error) {
      toast.error(
        "Could not delete that project",
        isApiError(error) ? error.message : "Try again in a moment.",
      );
    } finally {
      setPendingDelete(undefined);
    }
  }, [pendingDelete, projects]);

  const onTagCreated = useCallback(
    (tag: TagResponse) =>
      tags.setData((current) =>
        (current ?? []).some((existing) => existing.id === tag.id)
          ? (current ?? [])
          : [...(current ?? []), tag].sort((a, b) => a.name.localeCompare(b.name)),
      ),
    [tags],
  );

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (project: ProjectResponse) => {
    setEditing(project);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Work"
        title="Projects"
        description="Everything you have running, and everything you have shipped."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            New project
          </Button>
        }
      />

      {/* The toolbar renders through every state. Hiding it while loading makes
          the page jump when the data lands, and hiding it on an error takes away
          the only control that might have caused it. */}
      <ProjectToolbar
        search={search}
        onSearchChange={setSearch}
        filters={active}
        onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onClear={clearFilters}
        clients={clients}
        tags={tags.data ?? []}
        view={view}
        onViewChange={setView}
        shown={visible.length}
        total={total}
        filtered={filtered}
      />

      {projects.isLoading ? (
        <ProjectSkeleton view={view} />
      ) : projects.error ? (
        <ErrorState message={projects.error.message} onRetry={() => void projects.refetch()} />
      ) : visible.length === 0 ? (
        /* §9.7 asks for two empty states because they are two different
           problems: "you have no projects" wants a Create button, and "none of
           your forty match this filter" wants the filter cleared. There is a
           third, which only shows up once an account is old enough to have
           archived something — every project exists but FR-2.7 is hiding all of
           them, and neither of the first two answers that. */
        all.length === 0 ? (
          <EmptyState
            icon="projects"
            title="No projects yet"
            description="A project is the thing everything else hangs off — its environments, its tasks, and its tags. Create the first one and the rest of Atlas has somewhere to live."
            action={
              <Button variant="primary" icon="plus" onClick={openCreate}>
                Create a project
              </Button>
            }
          />
        ) : filtered ? (
          <FilteredEmptyState noun="projects" onClear={clearFilters} />
        ) : (
          <EmptyState
            icon="empty"
            title="Everything here is archived"
            description="You have projects, but all of them are archived and archived projects are hidden by default."
            action={
              <Button
                icon="filter"
                onClick={() => setFilters((current) => ({ ...current, includeArchived: true }))}
              >
                Include archived
              </Button>
            }
          />
        )
      ) : (
        <ul
          className={
            view === "grid"
              ? "grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-2"
          }
        >
          {visible.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                view={view}
                onTogglePin={(target) => void togglePin(target)}
                onEdit={openEdit}
                onDelete={setPendingDelete}
                onTagClick={(tag) => setFilters((current) => ({ ...current, tag }))}
              />
            </li>
          ))}
        </ul>
      )}

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        project={editing}
        tags={tags.data ?? []}
        onSaved={onSaved}
        onTagCreated={onTagCreated}
      />

      {/* FR-8.2: named, and specific about what survives. Deleting a project
          cascades to its environments and detaches its tasks (FR-2.11), and a
          confirmation that does not say so is a speed bump. */}
      <ConfirmDialog
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
        title={`Delete ${pendingDelete?.name ?? "project"}?`}
        consequence={
          pendingDelete
            ? `Its ${pendingDelete.environmentCount} environment${pendingDelete.environmentCount === 1 ? "" : "s"} are deleted with it. Its tasks survive, unassigned. This cannot be undone.`
            : ""
        }
      />
    </div>
  );
};

/**
 * §9.7: matched geometry. The skeleton is laid out by the same rule as the real
 * list, so nothing moves when the data arrives — which is the entire difference
 * between a skeleton and a spinner.
 */
const ProjectSkeleton = ({ view }: { view: "grid" | "list" }) => (
  <div
    aria-hidden="true"
    className={
      view === "grid"
        ? "grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3"
        : "flex flex-col gap-2"
    }
  >
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.13) }}>
        <Skeleton className={view === "grid" ? "h-[164px]" : "h-[64px]"} />
      </div>
    ))}
  </div>
);

export default ProjectsPage;
