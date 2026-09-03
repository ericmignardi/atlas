import { useCallback, useMemo, useState } from "react";

import { isApiError } from "@/lib/apiClient";
import { listProjects } from "@/lib/projectsApi";
import {
  EMPTY_TASK_FILTERS,
  filterTasks,
  isTaskFiltered,
  sortTasks,
  UNASSIGNED,
  type TaskFilterState,
  type TaskSortKey,
} from "@/lib/taskFilters";
import { applyMoves, type TaskMovePlan } from "@/lib/taskOrder";
import { deleteTask, listTasks, moveTask, taskBoard, updateTask } from "@/lib/tasksApi";
import { useApi } from "@/hooks/useApi";
import { usePrefsStore } from "@/stores/prefsStore";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, FilteredEmptyState, Skeleton } from "@/components/ui/states";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskToolbar } from "@/components/tasks/TaskToolbar";
import type { TaskResponse, TaskStatus } from "@/types/api";

/**
 * §8.2 – §8.4. The board, the list, and everything that mutates a task —
 * written as a component that takes an optional `projectId`, so `/tasks` and
 * the project detail tab are the same code with a different scope rather than
 * two implementations that agree for a while.
 *
 * ── Two fetches, one active at a time ─────────────────────────────────────
 *
 * The board cannot be assembled from the list: FR-4.12 narrows Done to the last
 * seven days and that rule lives on the server, so a client that built the board
 * itself would need a second copy of it. So there are two requests and the
 * inactive one is switched off — flipping the view costs a fetch, which is
 * cheaper than keeping two caches in step through every mutation.
 *
 * ── Why the board is not filtered ─────────────────────────────────────────
 *
 * The filters apply to the list only, and that is a deliberate limit rather
 * than an omission. A board *is* the status axis, so filtering by status leaves
 * three empty columns and one table. Worse, filtering by anything at all breaks
 * the ordering: a compaction renumbers the cards it can see, and cards hidden by
 * a filter would be silently reordered around them. The board is scoped by
 * project — which the server does, so the hidden rows are not there at all —
 * and everything else is what the list is for.
 */

interface TaskWorkspaceProps {
  /** Scopes everything to one project, and locks the form's project field. */
  projectId?: string;
  /** Used in the empty state's sentence. */
  projectName?: string;
}

export const TaskWorkspace = ({ projectId, projectName }: TaskWorkspaceProps) => {
  const view = usePrefsStore((state) => state.taskView);
  const setView = usePrefsStore((state) => state.setTaskView);

  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskResponse | undefined>(undefined);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("TODO");
  const [pendingDelete, setPendingDelete] = useState<TaskResponse | undefined>(undefined);

  /** The project select doubles as the board's server-side scope. */
  const scope =
    projectId ?? (filters.project && filters.project !== UNASSIGNED ? filters.project : undefined);

  const board = useApi(() => taskBoard(scope), [scope], { enabled: view === "board" });
  const list = useApi(() => listTasks(projectId), [projectId], { enabled: view === "list" });

  /** Only for the filter select and the form's project field, neither of which
      exists when the workspace is already scoped to one project. */
  const projects = useApi(listProjects, [], { enabled: projectId === undefined });

  const active = view === "board" ? board : list;

  const allTasks = useMemo(() => list.data ?? [], [list.data]);
  const visible = useMemo(
    () => sortTasks(filterTasks(allTasks, filters), filters.sort, filters.direction),
    [allTasks, filters],
  );

  /** The denominator is what the completed toggle admits, not every row fetched —
      "Showing 3 of 40" counting rows the list is deliberately hiding reads as a bug. */
  const total = useMemo(
    () =>
      allTasks.filter(
        (task) => task.status !== "DONE" || filters.includeCompleted || filters.status === "DONE",
      ).length,
    [allTasks, filters.includeCompleted, filters.status],
  );

  const boardCount = useMemo(
    () => (board.data?.columns ?? []).reduce((sum, column) => sum + column.tasks.length, 0),
    [board.data],
  );

  const reload = useCallback(() => active.refetch(), [active]);

  /**
   * FR-4.8, optimistically. The card moves on the same tick as the drop and the
   * PUT follows; a failure puts it back and says so (§8.2).
   *
   * The moves are issued **in order and one at a time**, because a compaction
   * emits several and they are a single intended arrangement — firing them in
   * parallel and losing one leaves the column interleaved with no way to say
   * which write won. Sequential, stop at the first failure, roll the client
   * back to what the user saw before the drag, and let the next load settle
   * whatever prefix the server kept.
   */
  const runMoves = useCallback(
    async (moves: TaskMovePlan[]) => {
      const current = board.data;
      if (moves.length === 0 || !current) return;

      board.setData(applyMoves(current, moves));

      try {
        for (const move of moves) {
          await moveTask(move.id, { status: move.status, sortOrder: move.sortOrder });
        }
        // The server owns `completedAt`, `isOverdue`, and the seven-day Done
        // window (FR-4.6, FR-4.9, FR-4.12), none of which the optimistic update
        // can compute. `isRefetching` rather than `isLoading`, so the board does
        // not blank while this lands.
        await board.refetch();
      } catch (error) {
        board.setData(current);
        toast.error(
          "Could not move that task",
          isApiError(error) ? error.message : "Try again in a moment.",
        );
      }
    },
    [board],
  );

  /**
   * The list's checkbox. A PATCH rather than a move, because the list shows no
   * positions — there is no neighbour on screen to compute one from, and the
   * server's own "top of the column" rule (FR-4.7) is the right answer.
   */
  const toggleDone = useCallback(
    async (task: TaskResponse) => {
      const next: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
      const previous = list.data ?? [];

      list.setData(previous.map((row) => (row.id === task.id ? { ...row, status: next } : row)));

      try {
        const saved = await updateTask(task.id, { status: next });
        list.setData((rows) => (rows ?? []).map((row) => (row.id === saved.id ? saved : row)));
      } catch (error) {
        list.setData(previous);
        toast.error(
          "Could not update that task",
          isApiError(error) ? error.message : "Try again in a moment.",
        );
      }
    },
    [list],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteTask(pendingDelete.id);
      toast.success(pendingDelete.title + " deleted");
      await reload();
    } catch (error) {
      toast.error(
        "Could not delete that task",
        isApiError(error) ? error.message : "Try again in a moment.",
      );
    } finally {
      setPendingDelete(undefined);
    }
  }, [pendingDelete, reload]);

  const openCreate = (status: TaskStatus) => {
    setEditing(undefined);
    setCreateStatus(status);
    setFormOpen(true);
  };

  const openEdit = (task: TaskResponse) => {
    setEditing(task);
    setFormOpen(true);
  };

  /** Clicking the sorted column flips it; clicking another one selects it ascending. */
  const onSort = (key: TaskSortKey) =>
    setFilters((current) => ({
      ...current,
      sort: key,
      direction: current.sort === key && current.direction === "asc" ? "desc" : "asc",
    }));

  const filtered = isTaskFiltered(filters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* The toolbar renders through every state: hiding it while loading
              makes the page jump, and hiding it on an error takes away the
              control that might have caused it. */}
          <TaskToolbar
            filters={filters}
            onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onClear={() =>
              setFilters((current) => ({
                ...EMPTY_TASK_FILTERS,
                // Sort is presentation, not a filter; resetting it would
                // silently reorder the table someone was reading.
                sort: current.sort,
                direction: current.direction,
              }))
            }
            projects={projectId ? undefined : (projects.data ?? [])}
            view={view}
            onViewChange={setView}
            shown={view === "board" ? boardCount : visible.length}
            total={view === "board" ? boardCount : total}
            filtered={filtered}
          />
        </div>

        <Button variant="primary" icon="plus" onClick={() => openCreate("TODO")}>
          New task
        </Button>
      </div>

      {active.isLoading ? (
        <WorkspaceSkeleton board={view === "board"} />
      ) : active.error ? (
        <ErrorState message={active.error.message} onRetry={() => void reload()} />
      ) : view === "board" ? (
        board.data && boardCount === 0 ? (
          <EmptyState
            icon="tasks"
            title="Nothing on the board"
            description={
              projectName
                ? "No tasks for " +
                  projectName +
                  " yet. Add the first one and it lands at the top of To do."
                : "Add a task and it lands at the top of To do. Drag it between columns, or use the status control on the card — both do the same thing."
            }
            action={
              <Button variant="primary" icon="plus" onClick={() => openCreate("TODO")}>
                Add a task
              </Button>
            }
          />
        ) : (
          board.data && (
            <TaskBoard
              board={board.data}
              showProject={projectId === undefined}
              onMove={(moves) => void runMoves(moves)}
              onCreate={openCreate}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          )
        )
      ) : visible.length === 0 ? (
        /* §9.7's two states, and they are two different problems: "you have no
           tasks" wants a Create button, "none of your forty match" wants the
           filter cleared. */
        allTasks.length === 0 ? (
          <EmptyState
            icon="tasks"
            title="No tasks yet"
            description="A task can belong to a project or stand on its own. Add the first one and this list has something to sort."
            action={
              <Button variant="primary" icon="plus" onClick={() => openCreate("TODO")}>
                Add a task
              </Button>
            }
          />
        ) : filtered ? (
          <FilteredEmptyState
            noun="tasks"
            onClear={() =>
              setFilters((current) => ({
                ...EMPTY_TASK_FILTERS,
                sort: current.sort,
                direction: current.direction,
              }))
            }
          />
        ) : (
          /* A third state the projects list has an analogue of: every task
             exists, all of them are done, and the toggle is hiding the lot. */
          <EmptyState
            icon="success"
            title="Everything here is done"
            description="You have tasks, but all of them are completed and completed tasks are hidden by default."
            action={
              <Button
                icon="filter"
                onClick={() => setFilters((current) => ({ ...current, includeCompleted: true }))}
              >
                Show completed
              </Button>
            }
          />
        )
      ) : (
        <TaskList
          tasks={visible}
          sort={filters.sort}
          direction={filters.direction}
          onSort={onSort}
          showProject={projectId === undefined}
          onToggleDone={(task) => void toggleDone(task)}
          onEdit={openEdit}
          onDelete={setPendingDelete}
        />
      )}

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        task={editing}
        defaultStatus={createStatus}
        lockedProjectId={projectId}
        projects={projects.data ?? []}
        onSaved={() => void reload()}
      />

      <ConfirmDialog
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
        title={"Delete " + (pendingDelete?.title ?? "task") + "?"}
        consequence="The task is removed. Its project and everything else stay as they are. This cannot be undone."
      />
    </div>
  );
};

/** §9.7: matched geometry — four columns or a table, whichever is about to arrive. */
const WorkspaceSkeleton = ({ board }: { board: boolean }) =>
  board ? (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} style={{ opacity: Math.max(0.3, 1 - index * 0.18) }}>
          <Skeleton className="h-[260px]" />
        </div>
      ))}
    </div>
  ) : (
    <Skeleton className="h-[320px]" />
  );
