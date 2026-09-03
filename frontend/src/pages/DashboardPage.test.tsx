import { render, screen } from "@testing-library/react";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import DashboardPage from "@/pages/DashboardPage";
import { DashboardProvider } from "@/components/layout/DashboardProvider";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import type { DashboardResponse, ProjectResponse, TaskResponse } from "@/types/api";

/**
 * FR-6.1 – FR-6.4. Three things are worth a test, and they are the three where
 * being *nearly* right looks fine on screen:
 *
 * - one API call fills the whole page (the point of the endpoint);
 * - a brand-new account gets one empty state, not a grid of empty panels;
 * - the four pinned slots are always four, so the dashed invitation appears in
 *   the gaps rather than the grid quietly shrinking.
 */

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: "p1",
  name: "Harbourfront Dental",
  slug: "harbourfront-dental",
  client: "Harbourfront",
  description: null,
  status: "ACTIVE",
  repoUrl: null,
  liveUrl: null,
  engagement: null,
  techStack: [],
  isPinned: true,
  startedAt: null,
  tags: [],
  environmentCount: 2,
  openTaskCount: 3,
  overdueTaskCount: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const task = (overrides: Partial<TaskResponse> = {}): TaskResponse => ({
  id: "t1",
  title: "Renew the certificate",
  description: null,
  status: "TODO",
  priority: "HIGH",
  dueDate: "2020-01-01T00:00:00Z",
  sortOrder: 0,
  completedAt: null,
  isOverdue: true,
  project: { id: "p1", name: "Harbourfront Dental", slug: "harbourfront-dental" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const payload = (overrides: Partial<DashboardResponse> = {}): DashboardResponse => ({
  stats: {
    totalProjects: 11,
    activeProjects: 3,
    openTasks: 14,
    overdueTasks: 2,
    environments: 9,
    platforms: 3,
    tags: 6,
  },
  pinnedProjects: [project()],
  needsAttention: { overdue: [task()], dueToday: [], dueSoon: [] },
  isNewAccount: false,
  ...overrides,
});

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

/** Counts every request, so "one API call" is an assertion rather than a claim. */
let requests: string[] = [];

const routeTo = (body: DashboardResponse) =>
  __setAdapter(async (config) => {
    const url = config.url ?? "";
    requests.push(url);
    if (url === "/dashboard") return ok(config, body);
    throw new Error("unexpected request to " + url);
  });

const renderPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "/",
            element: (
              <DashboardProvider>
                <DashboardPage />
              </DashboardProvider>
            ),
          },
        ],
        { initialEntries: ["/"] },
      )}
    />,
  );

beforeEach(() => {
  requests = [];
  __resetRefreshState();
  useAuthStore.setState({
    user: null,
    accessToken: "token",
    refreshToken: null,
    status: "authenticated",
  });
  useUiStore.setState({ toasts: [], quickAdd: null, paletteOpen: false });
});

afterEach(() => {
  __resetRefreshState();
});

describe("DashboardPage", () => {
  it("fills every tile from a single request", async () => {
    routeTo(payload());
    renderPage();

    const projects = await screen.findByRole("link", { name: /Projects/ });
    expect(projects).toHaveTextContent("3");
    expect(projects).toHaveTextContent("active of 11 total");

    const tasks = screen.getByRole("link", { name: /Open tasks/ });
    expect(tasks).toHaveTextContent("14");
    // NFR-4.4: the overdue pill says "overdue", it does not merely go red.
    expect(tasks).toHaveTextContent("2 overdue");

    expect(screen.getByRole("link", { name: /Environments/ })).toHaveTextContent(
      "across 3 platforms",
    );
    expect(screen.getByRole("link", { name: /Tags/ })).toHaveTextContent("6");

    // FR-6.5's header.
    expect(screen.getByText("3 projects active")).toBeInTheDocument();

    expect(requests).toEqual(["/dashboard"]);
  });

  it("shows one empty state for a brand-new account", async () => {
    routeTo(
      payload({
        stats: {
          totalProjects: 0,
          activeProjects: 0,
          openTasks: 0,
          overdueTasks: 0,
          environments: 0,
          platforms: 0,
          tags: 0,
        },
        pinnedProjects: [],
        needsAttention: { overdue: [], dueToday: [], dueSoon: [] },
        isNewAccount: true,
      }),
    );
    renderPage();

    expect(await screen.findByText("Start with a project")).toBeInTheDocument();
    // FR-6.4: not a grid of empty panels — no tiles, no pinned slots, no rail.
    expect(screen.queryByRole("link", { name: /Open tasks/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  });

  it("keeps four pinned slots and fills the gaps with an invitation", async () => {
    routeTo(payload());
    renderPage();

    // Matched on the counts: the project's name also appears in the rail below.
    await screen.findByRole("link", { name: /2 environments/ });

    // FR-6.2: one real card, three dashed slots, and exactly one of them speaks.
    expect(screen.getByText("Pin a project")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Empty pin slot" })).toHaveLength(2);
  });

  it("groups overdue work under a heading that says so", async () => {
    routeTo(payload());
    renderPage();

    expect(await screen.findByText("Overdue and due today")).toBeInTheDocument();
    expect(screen.getByText("Renew the certificate")).toBeInTheDocument();
    // The rail is 2 px of red; the sentence is what actually carries it.
    expect(screen.getByText(/Overdue by/)).toBeInTheDocument();
  });
});
