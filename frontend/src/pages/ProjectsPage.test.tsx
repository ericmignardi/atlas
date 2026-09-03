import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import ProjectsPage from "@/pages/ProjectsPage";
import { ToastViewport } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProjectResponse } from "@/types/api";

/**
 * FR-2.8's failure path, which is the one worth a test: pinning a fifth project
 * is a 409, and the requirement is that it produces a toast rather than a crash
 * or a pin that appears to have worked.
 *
 * The interesting part is the rollback. The toggle is optimistic — it has to be,
 * a pin that waits for a round trip feels broken — so a rejected pin must put
 * the icon back. Nothing about a passing happy path tells you whether it does.
 */

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: "p1",
  name: "Harbourfront Dental",
  slug: "harbourfront-dental",
  client: null,
  description: null,
  status: "ACTIVE",
  repoUrl: null,
  liveUrl: null,
  engagement: null,
  techStack: [],
  isPinned: false,
  startedAt: null,
  tags: [],
  environmentCount: 0,
  openTaskCount: 0,
  overdueTaskCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

/**
 * A fake transport rather than a mocked module, so the request actually goes
 * through `apiClient` — its interceptors, its error normalisation, and the
 * `ApiError` the page branches on are all part of what is being tested.
 */
const routeTo = (handlers: {
  projects: ProjectResponse[];
  onPin?: (config: InternalAxiosRequestConfig) => AxiosResponse | never;
  onCreate?: (config: InternalAxiosRequestConfig) => AxiosResponse | never;
  onDelete?: (config: InternalAxiosRequestConfig) => AxiosResponse | never;
}) =>
  __setAdapter(async (config) => {
    const url = config.url ?? "";
    const method = (config.method ?? "get").toLowerCase();

    if (url.endsWith("/pin")) {
      if (!handlers.onPin) throw new Error("unexpected pin");
      return handlers.onPin(config);
    }
    if (url === "/projects" && method === "post") {
      if (!handlers.onCreate) throw new Error("unexpected create");
      return handlers.onCreate(config);
    }
    if (url.startsWith("/projects") && method === "delete") {
      if (!handlers.onDelete) throw new Error("unexpected delete");
      return handlers.onDelete(config);
    }
    if (url.startsWith("/projects")) return ok(config, handlers.projects);
    if (url.startsWith("/tags")) return ok(config, []);
    throw new Error(`unexpected request to ${url}`);
  });

const renderPage = () =>
  render(
    <>
      <RouterProvider
        router={createMemoryRouter([{ path: "/projects", element: <ProjectsPage /> }], {
          initialEntries: ["/projects"],
        })}
      />
      <ToastViewport />
    </>,
  );

beforeEach(() => {
  __resetRefreshState();
  useAuthStore.setState({
    user: null,
    accessToken: "token",
    refreshToken: null,
    status: "authenticated",
  });
  useUiStore.setState({ toasts: [] });
  usePrefsStore.setState({ projectView: "grid" });
});

afterEach(() => {
  __resetRefreshState();
});

describe("ProjectsPage", () => {
  it("shows the 409 message as a toast and puts the pin back", async () => {
    routeTo({
      projects: [project()],
      onPin: () => {
        // The body a live server sends once four projects are pinned.
        const error = Object.assign(new Error("conflict"), {
          isAxiosError: true,
          config: {} as InternalAxiosRequestConfig,
          response: {
            data: {
              timestamp: "2026-09-08T09:00:00Z",
              status: 409,
              error: "At most 4 projects can be pinned",
              code: "PIN_LIMIT",
            },
            status: 409,
            statusText: "Conflict",
            headers: new AxiosHeaders(),
            config: {} as InternalAxiosRequestConfig,
          },
        });
        throw error;
      },
    });

    const user = userEvent.setup();
    renderPage();

    const pin = await screen.findByRole("button", { name: "Pin Harbourfront Dental" });
    await user.click(pin);

    const toast = await screen.findByRole("status");
    expect(within(toast).getByText("Could not pin that project")).toBeInTheDocument();
    expect(
      within(toast).getByText("Four projects are already pinned. Unpin one first."),
    ).toBeInTheDocument();

    // The rollback: still "Pin", not "Unpin".
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pin Harbourfront Dental" })).toBeInTheDocument(),
    );
  });

  it("distinguishes an empty account from an empty filter", async () => {
    routeTo({ projects: [] });
    const user = userEvent.setup();
    const { unmount } = renderPage();

    // Nothing exists: the answer is a Create button.
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    unmount();

    routeTo({ projects: [project()] });
    renderPage();
    await screen.findByRole("link", { name: "Harbourfront Dental" });

    // Something exists but nothing matches: the answer is to clear the filter,
    // and offering Create here would be answering a question nobody asked.
    await user.type(screen.getByLabelText("Search projects"), "zzz");

    const empty = (await screen.findByText("No projects match these filters")).closest("div");
    // Scoped, because the toolbar carries its own Clear filters once anything is
    // applied — two controls for the same action is deliberate, not a duplicate.
    await user.click(within(empty as HTMLElement).getByRole("button", { name: "Clear filters" }));

    expect(await screen.findByRole("link", { name: "Harbourfront Dental" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search projects")).toHaveValue("");
  });

  it("creates a project with ⌘Enter and shows it without a refetch", async () => {
    // The list request answers with an empty account and never changes. If the
    // new card appears anyway, it came from the create response being folded
    // into the cache — which is the behaviour under test.
    routeTo({
      projects: [],
      onCreate: (config) =>
        ok(config, project({ id: "new", name: "Northwind Portal", slug: "northwind-portal" })),
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText(/^Name/), "Northwind Portal");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(await screen.findByRole("link", { name: "Northwind Portal" })).toBeInTheDocument();
    expect(
      within(await screen.findByRole("status")).getByText("Northwind Portal created"),
    ).toBeInTheDocument();
  });

  it("names the project in the delete confirmation, then removes the card", async () => {
    routeTo({
      projects: [project({ environmentCount: 2 })],
      onDelete: (config) => ({ ...ok(config, ""), status: 204, statusText: "No Content" }),
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("link", { name: "Harbourfront Dental" });
    await user.click(screen.getByRole("button", { name: "Actions for Harbourfront Dental" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    // FR-8.2: the object by name, and what actually happens to what hangs off it.
    expect(screen.getByText("Delete Harbourfront Dental?")).toBeInTheDocument();
    expect(
      screen.getByText(/Its 2 environments are deleted with it\. Its tasks survive, unassigned\./),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Harbourfront Dental" })).not.toBeInTheDocument(),
    );
  });
});
