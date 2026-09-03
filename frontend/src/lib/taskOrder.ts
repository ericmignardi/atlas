import { TASK_STATUSES, type BoardResponse, type TaskResponse, type TaskStatus } from "@/types/api";

/**
 * Where a card lands, as arithmetic.
 *
 * `sortOrder` ascends down a column, and the server puts a new task at
 * `min - 1` (FR-4.7), so "top" is the smallest number. Reordering is therefore
 * a matter of choosing a value between two neighbours — the fractional-ordering
 * trick — which touches **one row** instead of renumbering the whole column on
 * every drag.
 *
 * ── The part the trick usually leaves out ─────────────────────────────────
 *
 * `sortOrder` is an `int`, on the wire and in the column. Between 7 and 8 there
 * is no integer, and Atlas's data is dense by construction: every task is
 * created at `min - 1`, so a fresh column is …, -2, -1, 0 with no gaps at all.
 * A midpoint strategy that assumes room would silently write a duplicate
 * `sortOrder`, and a duplicate means the two cards tie — which the database
 * breaks arbitrarily, so the board comes back from a reload in a different
 * order than the one the user just arranged.
 *
 * So a move is a *plan*, not a value. In the ordinary case it is one entry and
 * one PUT. When the neighbours are adjacent the plan compacts the destination
 * column onto a stride instead, which costs one PUT per card that actually
 * moved and buys {@link STRIDE} more insertions at every gap.
 */

/**
 * The spacing a compaction lays down. 64 leaves six clean midpoints between any
 * two neighbours before another compaction is needed, and keeps the numbers
 * small enough to read in a database client while debugging.
 */
export const STRIDE = 64;

export interface TaskMovePlan {
  id: string;
  status: TaskStatus;
  sortOrder: number;
}

/**
 * The moves that put `task` at `zoneIndex` in `destination`.
 *
 * `destination` is the column **as rendered**, which means it still contains
 * the dragged card when the drag started in that same column. Taking it that
 * way is deliberate: the drop zones are indexed against what is on screen, and
 * making the caller pre-filter the array is how an off-by-one gets in.
 *
 * Returns an empty array when the drop changes nothing — dropping a card back
 * into the gap it came out of is a very easy thing to do by accident, and it
 * should cost no request.
 */
export function planMove(
  destination: readonly TaskResponse[],
  task: TaskResponse,
  status: TaskStatus,
  zoneIndex: number,
): TaskMovePlan[] {
  const currentIndex = destination.findIndex((candidate) => candidate.id === task.id);
  const others = destination.filter((candidate) => candidate.id !== task.id);

  // Zones are numbered over the rendered list; once the dragged card is taken
  // out, every zone after it shifts down by one.
  const shifted = currentIndex >= 0 && zoneIndex > currentIndex ? zoneIndex - 1 : zoneIndex;
  const index = Math.max(0, Math.min(shifted, others.length));

  if (task.status === status && currentIndex === index) return [];

  const before = others[index - 1];
  const after = others[index];

  const one = (sortOrder: number): TaskMovePlan[] => [{ id: task.id, status, sortOrder }];

  if (!before && !after) return one(0);
  if (!before) return one(after.sortOrder - 1);
  if (!after) return one(before.sortOrder + 1);

  // Strictly greater than 1 is the test: a gap of exactly 1 has no integer in
  // it, and a gap of 0 is an existing tie that this is a chance to heal.
  if (after.sortOrder - before.sortOrder > 1) {
    return one(Math.floor((before.sortOrder + after.sortOrder) / 2));
  }

  return compact(others, task, status, index);
}

/**
 * Renumber the destination column onto {@link STRIDE}, and emit a move for
 * every card whose number actually changed. The dragged card is always in the
 * result — its status may be changing even when its number happens to land on
 * the value it already had.
 */
function compact(
  others: readonly TaskResponse[],
  task: TaskResponse,
  status: TaskStatus,
  index: number,
): TaskMovePlan[] {
  const ordered = [...others.slice(0, index), task, ...others.slice(index)];

  return ordered.flatMap((candidate, position) => {
    const sortOrder = position * STRIDE;
    if (candidate.id === task.id) return [{ id: task.id, status, sortOrder }];
    if (candidate.sortOrder === sortOrder) return [];
    return [{ id: candidate.id, status: candidate.status, sortOrder }];
  });
}

/**
 * The optimistic board (FR-8.3's "it responds now, it reconciles later").
 *
 * Applied to the whole board rather than to one column, because a move between
 * columns changes two of them and a compaction can change several rows in one.
 * The result is re-sorted by the same rule the server uses, so what appears on
 * the drop is what comes back from the next fetch.
 */
export function applyMoves(board: BoardResponse, moves: readonly TaskMovePlan[]): BoardResponse {
  if (moves.length === 0) return board;

  const byId = new Map(moves.map((move) => [move.id, move]));

  const all = board.columns.flatMap((column) =>
    column.tasks.map((task) => {
      const move = byId.get(task.id);
      return move ? { ...task, status: move.status, sortOrder: move.sortOrder } : task;
    }),
  );

  return {
    columns: TASK_STATUSES.map((status) => ({
      status,
      tasks: all.filter((task) => task.status === status).sort(boardOrder),
    })),
  };
}

/**
 * The server orders a column by `sortOrder` alone and lets the database break
 * ties. The client cannot afford that: two cards swapping places on every
 * render is a visible bug, so the comparison is made total.
 */
function boardOrder(a: TaskResponse, b: TaskResponse): number {
  return (
    a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

/** The column a status names, or an empty list — the board always has all four. */
export function columnFor(board: BoardResponse | undefined, status: TaskStatus): TaskResponse[] {
  return board?.columns.find((column) => column.status === status)?.tasks ?? [];
}
