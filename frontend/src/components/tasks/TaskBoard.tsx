import { Fragment, useState, type DragEvent } from "react";

import { cn } from "@/lib/cn";
import { labelFor, TASK_STATUS, TINT_DOT } from "@/lib/design";
import { columnFor, planMove, type TaskMovePlan } from "@/lib/taskOrder";
import { Icon } from "@/components/ui/Icon";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TASK_STATUSES, type BoardResponse, type TaskResponse, type TaskStatus } from "@/types/api";

/**
 * §8.2. Four columns, drag-and-drop, and no library.
 *
 * ── The HTML5 API, and its one non-obvious rule ───────────────────────────
 *
 * `onDragOver` **must** call `preventDefault()`. The default action of dragging
 * over an element is "this is not a drop target", so a handler that does nothing
 * but observe leaves the element rejecting every drop — the cursor shows the
 * no-entry sign and `onDrop` never fires. It is the single most common way a
 * hand-rolled board silently does not work.
 *
 * ── Zones rather than pointer arithmetic ──────────────────────────────────
 *
 * Where a card lands is decided by an explicit drop zone between every pair of
 * cards, not by comparing `event.clientY` against each card's midpoint. The
 * zones *are* the gaps — they are the 8 px that would have been `gap-2` — so
 * nothing shifts when a drag begins and no space is spent on them at rest.
 *
 * The trade is deliberate. Midpoint arithmetic has to re-measure on every
 * `dragover` frame, it disagrees with itself while the list is animating, and
 * it is untestable outside a real browser because jsdom reports every rectangle
 * as zero. A zone knows its own index. The arithmetic that *is* interesting —
 * choosing a `sortOrder` between two neighbours, and compacting the column when
 * there is no integer to choose — lives in `taskOrder.ts`, where it is a pure
 * function with a test.
 */

interface TaskBoardProps {
  board: BoardResponse;
  showProject: boolean;
  /** The plan for a move. Empty when the drop changes nothing. */
  onMove: (moves: TaskMovePlan[]) => void;
  onCreate: (status: TaskStatus) => void;
  onEdit: (task: TaskResponse) => void;
  onDelete: (task: TaskResponse) => void;
}

interface DropTarget {
  status: TaskStatus;
  index: number;
}

export const TaskBoard = ({
  board,
  showProject,
  onMove,
  onCreate,
  onEdit,
  onDelete,
}: TaskBoardProps) => {
  /**
   * The dragged task is held in state rather than read back out of
   * `dataTransfer`, because `dataTransfer.getData` returns an empty string
   * during `dragover` in every browser — the payload is only readable on drop.
   * Highlighting the zone under the cursor needs to know what is being dragged
   * *before* then, so state is the source of truth and `dataTransfer` carries
   * the id for the sake of the native contract.
   */
  const [dragged, setDragged] = useState<TaskResponse | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);

  const endDrag = () => {
    setDragged(null);
    setOver(null);
  };

  const drop = (status: TaskStatus, index: number) => {
    if (!dragged) return;
    onMove(planMove(columnFor(board, status), dragged, status, index));
    endDrag();
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const tasks = columnFor(board, status);
        const dragActive = dragged !== null;
        /**
         * The index within *this* column that the card in the air would land
         * at, or null when the cursor is elsewhere. A plain boolean plus
         * `over.index` would read the same and narrow worse: TypeScript cannot
         * carry `over !== null` from one const into the JSX below it.
         */
        const target = over?.status === status ? over.index : null;

        return (
          <section
            key={status}
            aria-label={labelFor.taskStatus(status)}
            onDragOver={(event) => {
              if (!dragActive) return;
              // Without this the column refuses the drop; see the note above.
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              // Landing on the column's own background means "the end".
              setOver({ status, index: tasks.length });
            }}
            onDragLeave={(event) => {
              // `dragleave` fires when the cursor crosses onto a child, so only
              // a departure that actually leaves the column counts.
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOver((current) => (current?.status === status ? null : current));
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop(status, target ?? tasks.length);
            }}
            className={cn(
              "flex flex-col rounded-lg border bg-surface-sunken",
              // §8.2: the target says so, in the accent, dashed — the same
              // visual language as every other "this is where it goes" in Atlas.
              target !== null ? "border-dashed border-accent" : "border-line",
            )}
          >
            <header className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span
                aria-hidden="true"
                className={cn("h-[9px] w-[9px] rounded-sm", TINT_DOT[TASK_STATUS[status].tint])}
              />
              <h3 className="text-sm text-ink">{labelFor.taskStatus(status)}</h3>
              <span className="ml-auto text-xs text-ink-muted tabular-nums">{tasks.length}</span>
            </header>

            <div className="flex min-h-[120px] flex-col p-2">
              <DropZone
                active={dragActive}
                highlighted={target === 0}
                onEnter={() => setOver({ status, index: 0 })}
                onDrop={() => drop(status, 0)}
              />

              {tasks.map((task, index) => (
                <Fragment key={task.id}>
                  <TaskCard
                    task={task}
                    dragging={dragged?.id === task.id}
                    showProject={showProject}
                    onDragStart={(event) => {
                      setDragged(task);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", task.id);
                    }}
                    onDragEnd={endDrag}
                    onStatusChange={(next) =>
                      // NFR-4.6: literally the same call a drop at the top of
                      // that column makes.
                      onMove(planMove(columnFor(board, next), task, next, 0))
                    }
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />

                  <DropZone
                    active={dragActive}
                    highlighted={target === index + 1}
                    onEnter={() => setOver({ status, index: index + 1 })}
                    onDrop={() => drop(status, index + 1)}
                  />
                </Fragment>
              ))}

              {/*
                FR-4.12: Done is filled by finishing something, not by adding
                something already finished, so it ends with a zone rather than a
                button. The other three end with the button, which doubles as the
                last drop target — "Drop or add" is both halves of what it is.
              */}
              {status === "DONE" ? (
                <div className="min-h-[24px] flex-1" />
              ) : (
                <button
                  type="button"
                  onClick={() => onCreate(status)}
                  onDragOver={(event) => {
                    if (!dragActive) return;
                    event.preventDefault();
                    setOver({ status, index: tasks.length });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    drop(status, tasks.length);
                  }}
                  className={cn(
                    "mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs",
                    "transition-colors duration-150 ease-enter",
                    target === tasks.length
                      ? "border-accent text-accent"
                      : "border-line text-ink-muted hover:border-ink-muted/40 hover:text-ink",
                  )}
                >
                  <Icon name="plus" size={13} />
                  {dragActive ? "Drop here" : "Drop or add"}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

/**
 * The gap between two cards, doing a second job. Eight pixels at rest —
 * which is the spacing the column wants anyway — and a dashed accent rule when
 * the card in the air would land here.
 *
 * `onDragEnter` sets the target rather than `onDragOver` doing it, so the state
 * is written once on the way in instead of on every frame of the hover;
 * `onDragOver` is still present because without its `preventDefault` the zone
 * would not accept a drop at all.
 */
const DropZone = ({
  active,
  highlighted,
  onEnter,
  onDrop,
}: {
  active: boolean;
  highlighted: boolean;
  onEnter: () => void;
  onDrop: () => void;
}) => (
  <div
    data-testid="drop-zone"
    onDragEnter={active ? onEnter : undefined}
    onDragOver={
      active
        ? (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            onEnter();
          }
        : undefined
    }
    onDrop={
      active
        ? (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            // The column behind would otherwise re-handle it as a drop at the end.
            event.stopPropagation();
            onDrop();
          }
        : undefined
    }
    className="flex h-2 shrink-0 items-center"
  >
    <span
      aria-hidden="true"
      className={cn(
        "block h-0 w-full border-t border-dashed transition-colors duration-150 ease-enter",
        highlighted ? "border-accent" : "border-transparent",
      )}
    />
  </div>
);
