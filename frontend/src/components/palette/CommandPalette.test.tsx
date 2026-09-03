import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useUiStore } from "@/stores/uiStore";
import type { SearchResponse } from "@/types/api";

/**
 * FR-7.2 – FR-7.5. Four things are worth a test here, and they are the four that
 * a screenshot cannot check:
 *
 * - the groups come out in the fixed order, as **one** navigable list, so `↓`
 *   crosses a group boundary rather than stopping at it;
 * - Enter on the selected row navigates to the right URL;
 * - the Create rows survive a search that matched nothing, because that is when
 *   they are the only useful thing on screen;
 * - the debounce coalesces a burst of keystrokes into one request.
 */

const results: SearchResponse = {
  projects: [
    { id: "p1", name: "Atlas", slug: "atlas", client: "Harbourfront", status: "ACTIVE" },
  ],
  environments: [
    {
      id: "e1",
      name: "Atlas web",
      type: "PRODUCTION",
      platform: "VERCEL",
      branch: "main",
      project: { id: "p1", name: "Atlas", slug: "atlas" },
    },
  ],
  tasks: [
    { id: "t1", title: "Atlas README", status: "TODO", project: { id: "p1", name: "Atlas", slug: "atlas" } },
  ],
};

const empty: SearchResponse = { projects: [], environments: [], tasks: [] };

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

/** Records every search that reached the transport, so the debounce is observable. */
const queries: string[] = [];

const routeTo = (payload: SearchResponse) =>
  __setAdapter(async (config) => {
    if ((config.url ?? "").startsWith("/search")) {
      queries.push(String(config.params?.q ?? ""));
      return ok(config, payload);
    }
    throw new Error("unexpected request to " + config.url);
  });

/** Renders the palette inside a router whose other route just names itself. */
const renderPalette = () => {
  const router = createMemoryRouter(
    [
      { path: "/", element: <CommandPalette /> },
      { path: "/projects/:slug", element: <p>project page</p> },
      { path: "/tasks", element: <p>tasks page</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => {
  queries.length = 0;
  __resetRefreshState();
  useAuthStore.setState({
    user: null,
    accessToken: "token",
    refreshToken: null,
    status: "authenticated",
  });
  useUiStore.setState({ paletteOpen: true, quickAdd: null, toasts: [] });
  usePrefsStore.setState({ lastQuickAddType: "task" });
});

afterEach(() => {
  __resetRefreshState();
  useUiStore.setState({ paletteOpen: false, quickAdd: null });
});

describe("CommandPalette", () => {
  it("renders the groups in the fixed order and walks across them with one cursor", async () => {
    routeTo(results);
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByRole("combobox"), "atlas");
    await screen.findByRole("option", { name: /Atlas web/ });

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.id)).toEqual([
      "project-p1",
      "environment-e1",
      "task-t1",
      "create-project",
      "create-environment",
      "create-task",
    ]);

    // The first row is selected on arrival, so Enter is always meaningful.
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    // One press crosses from Projects into Environments — the group boundary is
    // a heading, not a stop.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Atlas web/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // And ↑ from the top wraps to the last row rather than sticking.
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("option", { name: "Create a task" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("navigates to the selected result on Enter and closes", async () => {
    routeTo(results);
    const user = userEvent.setup();
    const router = renderPalette();

    await user.type(screen.getByRole("combobox"), "atlas");
    // Matched on the client, because three rows contain "Atlas".
    await screen.findByRole("option", { name: /Harbourfront/ });

    await user.keyboard("{Enter}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/projects/atlas"));
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it("keeps the Create actions when nothing matched", async () => {
    routeTo(empty);
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByRole("combobox"), "nothing");

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Create a project" })).toBeInTheDocument();
    expect(screen.getByText("0 results")).toBeInTheDocument();
  });

  it("opens quick add from a Create row and remembers the type", async () => {
    routeTo(empty);
    const user = userEvent.setup();
    renderPalette();

    await user.click(screen.getByRole("option", { name: "Create an environment" }));

    expect(useUiStore.getState().quickAdd).toBe("environment");
    // FR-6.6: the palette is one of the two ways to create, so it sets the
    // preference the split button and ⌘N read.
    expect(usePrefsStore.getState().lastQuickAddType).toBe("environment");
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it("debounces a burst of keystrokes into one request", async () => {
    routeTo(results);
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByRole("combobox"), "atlas");
    await screen.findByRole("option", { name: /Atlas web/ });

    // Five characters, one search — and it is the settled value, not a prefix.
    await waitFor(() => expect(queries).toEqual(["atlas"]));
  });

  it("closes on Escape", async () => {
    routeTo(empty);
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(useUiStore.getState().paletteOpen).toBe(false));
  });
});
