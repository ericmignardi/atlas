import { describe, expect, it } from "vitest";

import { applyMoves, columnFor, planMove, STRIDE } from "@/lib/taskOrder";
import type { BoardResponse, TaskResponse, TaskStatus } from "@/types/api";

/**
 * The drag-and-drop arithmetic, tested where it is a pure function rather than
 * through the board — jsdom reports every rectangle as zero and fires no real
 * drag, so a test driven through the DOM could only ever check that the handlers
 * were called, not that they compute the right number.
 *
 * The case that matters is the one a fractional-ordering example never shows:
 * `sortOrder` is an integer, Atlas creates every task at `min - 1`, and a fresh
 * column is therefore …-2, -1, 0 with no gaps at all. There is no midpoint
 * between two adjacent integers, so the plan has to compact instead — and a
 * duplicate `sortOrder` would mean two cards tie, the database breaks the tie
 * arbitrarily, and the board comes back from a reload in a different order than
 * the one that was just arranged.
 */

const task = (
  id: string,
  sortOrder: number,
  status: TaskStatus = "TODO",
  overrides: Partial<TaskResponse> = {},
): TaskResponse => ({
  id,
  title: id,
  description: null,
  status,
  priority: "MEDIUM",
  dueDate: null,
  sortOrder,
  completedAt: null,
  isOverdue: false,
  project: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("planMove", () => {
  it("starts an empty column at zero", () => {
    expect(planMove([], task("x", 7, "BLOCKED"), "TODO", 0)).toEqual([
      { id: "x", status: "TODO", sortOrder: 0 },
    ]);
  });

  it("puts a drop at the top below the current minimum, matching the server's own rule", () => {
    const column = [task("a", 0), task("b", 10)];
    expect(planMove(column, task("x", 99, "DONE"), "TODO", 0)).toEqual([
      { id: "x", status: "TODO", sortOrder: -1 },
    ]);
  });

  it("puts a drop at the end above the current maximum", () => {
    const column = [task("a", 0), task("b", 10)];
    expect(planMove(column, task("x", 99, "DONE"), "TODO", 2)).toEqual([
      { id: "x", status: "TODO", sortOrder: 11 },
    ]);
  });

  it("takes the midpoint when the neighbours have room between them", () => {
    const column = [task("a", 0), task("b", 10), task("c", 20)];
    // Between a and b, and one row is touched rather than the whole column.
    expect(planMove(column, task("x", 99, "DONE"), "TODO", 1)).toEqual([
      { id: "x", status: "TODO", sortOrder: 5 },
    ]);
  });

  it("compacts the column when the neighbours are adjacent integers", () => {
    // The shape Atlas actually produces: three tasks created in a row.
    const column = [task("a", -2), task("b", -1), task("c", 0)];
    const moves = planMove(column, task("x", 99, "DONE"), "TODO", 1);

    expect(moves).toEqual([
      { id: "a", status: "TODO", sortOrder: 0 },
      { id: "x", status: "TODO", sortOrder: STRIDE },
      { id: "b", status: "TODO", sortOrder: STRIDE * 2 },
      { id: "c", status: "TODO", sortOrder: STRIDE * 3 },
    ]);

    // And the point of the stride: the next drop into the same gap is one row
    // again, not another compaction.
    const compacted = [task("a", 0), task("x", STRIDE), task("b", STRIDE * 2)];
    expect(planMove(compacted, task("y", 99, "DONE"), "TODO", 1)).toEqual([
      { id: "y", status: "TODO", sortOrder: STRIDE / 2 },
    ]);
  });

  it("heals a tie, because a gap of zero has no midpoint either", () => {
    const column = [task("a", 4), task("b", 4)];
    const moves = planMove(column, task("x", 99, "DONE"), "TODO", 1);
    expect(moves.map((move) => move.sortOrder)).toEqual([0, STRIDE, STRIDE * 2]);
  });

  it("reads zone indices against the rendered column, dragged card included", () => {
    // a, b, c on screen. Dragging a down to sit between b and c is zone 2 in
    // rendered coordinates, which is index 1 once a itself is taken out.
    const column = [task("a", 0), task("b", 10), task("c", 20)];
    expect(planMove(column, column[0], "TODO", 2)).toEqual([
      { id: "a", status: "TODO", sortOrder: 15 },
    ]);
  });

  it("costs nothing to drop a card back into the gap it came out of", () => {
    const column = [task("a", 0), task("b", 10), task("c", 20)];
    // The zones either side of b are both "where b already is".
    expect(planMove(column, column[1], "TODO", 1)).toEqual([]);
    expect(planMove(column, column[1], "TODO", 2)).toEqual([]);
  });

  it("carries the destination status, not the one the card arrived with", () => {
    const done = [task("p", 0, "DONE"), task("q", 10, "DONE")];
    expect(planMove(done, task("a", 3, "TODO"), "DONE", 1)).toEqual([
      { id: "a", status: "DONE", sortOrder: 5 },
    ]);
  });

  it("makes the status select the same operation as a drop at the top (NFR-4.6)", () => {
    const board: BoardResponse = {
      columns: [
        { status: "TODO", tasks: [task("a", 0)] },
        { status: "IN_PROGRESS", tasks: [task("b", -3, "IN_PROGRESS")] },
        { status: "BLOCKED", tasks: [] },
        { status: "DONE", tasks: [] },
      ],
    };

    const dragged = task("a", 0);
    const bySelect = planMove(columnFor(board, "IN_PROGRESS"), dragged, "IN_PROGRESS", 0);
    const byDrag = planMove(columnFor(board, "IN_PROGRESS"), dragged, "IN_PROGRESS", 0);

    expect(bySelect).toEqual([{ id: "a", status: "IN_PROGRESS", sortOrder: -4 }]);
    expect(bySelect).toEqual(byDrag);
  });
});

describe("applyMoves", () => {
  const board: BoardResponse = {
    columns: [
      { status: "TODO", tasks: [task("a", 0), task("b", 10)] },
      { status: "IN_PROGRESS", tasks: [] },
      { status: "BLOCKED", tasks: [] },
      { status: "DONE", tasks: [] },
    ],
  };

  it("moves the card between columns and re-sorts by the server's rule", () => {
    const next = applyMoves(board, [{ id: "a", status: "IN_PROGRESS", sortOrder: 5 }]);

    expect(columnFor(next, "TODO").map((row) => row.id)).toEqual(["b"]);
    expect(columnFor(next, "IN_PROGRESS").map((row) => row.id)).toEqual(["a"]);
    // All four columns, still in board order (FR-4.11).
    expect(next.columns.map((column) => column.status)).toEqual([
      "TODO",
      "IN_PROGRESS",
      "BLOCKED",
      "DONE",
    ]);
  });

  it("applies a whole compaction at once", () => {
    const next = applyMoves(board, [
      { id: "b", status: "TODO", sortOrder: 0 },
      { id: "a", status: "TODO", sortOrder: STRIDE },
    ]);
    expect(columnFor(next, "TODO").map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("returns the same board when there is nothing to do", () => {
    expect(applyMoves(board, [])).toBe(board);
  });
});
