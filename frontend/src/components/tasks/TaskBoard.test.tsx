import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { ToastViewport } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useUiStore } from "@/stores/uiStore";
import { TASK_STATUSES, type BoardResponse, type TaskResponse, type TaskStatus } from "@/types/api";

/**
 * The board, driven through `TaskWorkspace` so the whole path is real: the drop
 * computes a plan, the plan is applied optimistically, the PUT goes out, and the
 * refetch settles it. Mocking the mutation would leave the interesting half —
 * the optimistic update and its rollback — untested.
 *
 * jsdom fires no native drag and reports every rectangle as zero, so the events
 * are synthesised. That is exactly why the position arithmetic is in
 * `taskOrder.ts` behind a pure-function test and the drop targets here are
 * indexed zones rather than measured midpoints: what this file checks is the
 * wiring, and `taskOrder.test.ts` checks the numbers.
 */

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const task = (
  id: string,
  title: string,
  sortOrder: number,
  status: TaskStatus = "TODO",
  overrides: Partial<TaskResponse> = {},
): TaskResponse => ({
  id,
  title,
  description: null,
  status,
  priority: "MEDIUM",
  dueDate: null,
  sortOrder,
  completedAt: status === "DONE" ? ago(1) : null,
  isOverdue: false,
  project: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const seed = (): TaskResponse[] => [
  task("t1", "Wire the pair dialog", 0),
  task("t2", "Write the migration", 10),
  task("t3", "Chase the invoice", 20),
  task("p1", "Draft the README", 0, "IN_PROGRESS"),
  task("d1", "Ship the API", 0, "DONE", { completedAt: ago(2) }),
  // FR-4.12's boundary: real, completed, and outside the seven-day window.
  task("d2", "Old thing", 5, "DONE", { completedAt: ago(10) }),
];

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

interface Server {
  rows: TaskResponse[];
  moves: { id: string; body: { status: TaskStatus; sortOrder: number } }[];
  /** Set to make the next move fail, as a server would on a conflict. */
  rejectMoves: boolean;
}

/** FR-4.11 and FR-4.12, on the server side of the fake — which is where they live. */
function board(rows: readonly TaskResponse[]): BoardResponse {
  const since = Date.now() - 7 * DAY;
  return {
    columns: TASK_STATUSES.map((status) => ({
      status,
      tasks: rows
        .filter((row) => row.status === status)
        .filter(
          (row) =>
            status !== "DONE" || (row.completedAt !== null && Date.parse(row.completedAt) >= since),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    })),
  };
}

const serve = (): Server => {
  const server: Server = { rows: seed(), moves: [], rejectMoves: false };

  __setAdapter(async (config) => {
    const url = config.url ?? "";
    const method = (config.method ?? "get").toLowerCase();
    const body = config.data ? JSON.parse(config.data as string) : undefined;

    if (url === "/projects") return ok(config, []);
    if (url === "/tasks/board") return ok(config, board(server.rows));
    if (url === "/tasks" && method === "get") return ok(config, server.rows);

    const move = /^\/tasks\/([^/]+)\/move$/.exec(url);
    if (move && method === "put") {
      if (server.rejectMoves) {
        throw Object.assign(new Error("conflict"), {
          isAxiosError: true,
          config,
          response: {
            data: {
              timestamp: "2026-09-09T09:00:00Z",
              status: 409,
              error: "That task was changed somewhere else.",
            },
            status: 409,
            statusText: "Conflict",
            headers: new AxiosHeaders(),
            config,
          },
        });
      }
      server.moves.push({ id: move[1], body });
      const row = server.rows.find((candidate) => candidate.id === move[1]);
      if (!row) throw new Error("unknown task");
      // FR-4.6: the stamp moves on a transition, not on every save.
      if (body.status === "DONE" && row.status !== "DONE")
        row.completedAt = new Date().toISOString();
      if (body.status !== "DONE" && row.status === "DONE") row.completedAt = null;
      row.status = body.status;
      row.sortOrder = body.sortOrder;
      return ok(config, row);
    }

    throw new Error("unexpected " + method + " " + url);
  });

  return server;
};

const renderWorkspace = () =>
  render(
    <MemoryRouter>
      <TaskWorkspace />
      <ToastViewport />
    </MemoryRouter>,
  );

/** A `dataTransfer` good enough for the handlers: they set data and an effect. */
const dataTransfer = () => ({
  setData: () => {},
  getData: () => "",
  effectAllowed: "",
  dropEffect: "",
});

const column = (name: string) => screen.getByRole("region", { name });

const zonesIn = (name: string) => within(column(name)).getAllByTestId("drop-zone");

const dragCardTo = (title: string, target: HTMLElement) => {
  fireEvent.dragStart(screen.getByRole("article", { name: title }), {
    dataTransfer: dataTransfer(),
  });
  fireEvent.dragEnter(target, { dataTransfer: dataTransfer() });
  fireEvent.drop(target, { dataTransfer: dataTransfer() });
};

const titlesIn = (name: string) =>
  within(column(name))
    .queryAllByRole("article")
    .map((node) => node.getAttribute("aria-label"));

beforeEach(() => {
  __resetRefreshState();
  useAuthStore.setState({
    user: null,
    accessToken: "token",
    refreshToken: null,
    status: "authenticated",
  });
  useUiStore.setState({ toasts: [] });
  usePrefsStore.setState({ taskView: "board" });
});

afterEach(() => {
  __resetRefreshState();
});

describe("TaskBoard", () => {
  it("moves a card to another column and persists it as a single PUT", async () => {
    const server = serve();
    renderWorkspace();

    await screen.findByRole("article", { name: "Wire the pair dialog" });

    // Onto the topmost zone of In progress, which already holds one card at 0.
    dragCardTo("Wire the pair dialog", zonesIn("In progress")[0]);

    await waitFor(() =>
      expect(titlesIn("In progress")).toEqual(["Wire the pair dialog", "Draft the README"]),
    );

    // Top of the column is `min - 1`, which is the rule the server itself uses
    // for a newly created task (FR-4.7) — so a reload comes back the same way.
    expect(server.moves).toEqual([{ id: "t1", body: { status: "IN_PROGRESS", sortOrder: -1 } }]);
    expect(titlesIn("To do")).toEqual(["Write the migration", "Chase the invoice"]);
  });

  it("drops between two cards rather than at the end", async () => {
    const server = serve();
    renderWorkspace();

    await screen.findByRole("article", { name: "Chase the invoice" });

    // To do renders t1, t2, t3 with a zone before each and one after. Index 1 is
    // the gap between the first and second card.
    dragCardTo("Chase the invoice", zonesIn("To do")[1]);

    await waitFor(() =>
      expect(titlesIn("To do")).toEqual([
        "Wire the pair dialog",
        "Chase the invoice",
        "Write the migration",
      ]),
    );

    // Between 0 and 10, and only the dragged row is touched.
    expect(server.moves).toEqual([{ id: "t3", body: { status: "TODO", sortOrder: 5 } }]);
  });

  it("makes the status select do exactly what the drag does (NFR-4.6)", async () => {
    const server = serve();
    const user = userEvent.setup();
    renderWorkspace();

    await user.selectOptions(
      await screen.findByLabelText("Status of Wire the pair dialog"),
      "IN_PROGRESS",
    );

    await waitFor(() => expect(titlesIn("In progress")).toContain("Wire the pair dialog"));

    // Byte for byte the request the first test's drag produced.
    expect(server.moves).toEqual([{ id: "t1", body: { status: "IN_PROGRESS", sortOrder: -1 } }]);
  });

  it("rolls the card back and says so when the move is refused", async () => {
    const server = serve();
    renderWorkspace();

    await screen.findByRole("article", { name: "Wire the pair dialog" });
    server.rejectMoves = true;

    dragCardTo("Wire the pair dialog", zonesIn("Blocked")[0]);

    const toast = await screen.findByRole("status");
    expect(within(toast).getByText("Could not move that task")).toBeInTheDocument();
    expect(within(toast).getByText("That task was changed somewhere else.")).toBeInTheDocument();

    // Back where it started, at the top of To do — not stranded in Blocked.
    await waitFor(() => expect(titlesIn("Blocked")).toEqual([]));
    expect(titlesIn("To do")).toEqual([
      "Wire the pair dialog",
      "Write the migration",
      "Chase the invoice",
    ]);
  });

  it("shows only the last seven days in Done, and the rest only in the list (FR-4.12)", async () => {
    serve();
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByRole("article", { name: "Ship the API" });
    // Completed ten days ago: the server leaves it out of the board, and the
    // client does not second-guess that in either direction.
    expect(titlesIn("Done")).toEqual(["Ship the API"]);

    await user.click(screen.getByRole("button", { name: "List view" }));
    await user.click(await screen.findByLabelText("Show completed"));

    expect(await screen.findByText("Old thing")).toBeInTheDocument();
    expect(screen.getByText("Ship the API")).toBeInTheDocument();
  });
});
