import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import { useAuthStore } from "@/stores/authStore";
import type { ProjectResponse } from "@/types/api";

/**
 * §7.4 puts the open tab in the URL rather than in state, and the reason is
 * everything a `useState` cannot do: `?tab=environments` is a link someone can
 * send, a reload comes back to the same tab, and Back is not a trapdoor out of
 * the page. None of that is visible from the happy path of clicking a tab.
 */

const PROJECT: ProjectResponse = {
  id: "p1",
  name: "Harbourfront Dental",
  slug: "harbourfront-dental",
  client: "Harbourfront Group",
  description: "A rebuild",
  status: "ACTIVE",
  repoUrl: "https://github.com/e/hd",
  liveUrl: null,
  engagement: "Retainer",
  techStack: ["React"],
  isPinned: false,
  startedAt: "2026-02-01",
  tags: [],
  environmentCount: 3,
  openTaskCount: 2,
  overdueTaskCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

const renderAt = (entry: string) => {
  const router = createMemoryRouter([{ path: "/projects/:slug", element: <ProjectDetailPage /> }], {
    initialEntries: [entry],
  });
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => {
  __resetRefreshState();
  useAuthStore.setState({
    user: null,
    accessToken: "token",
    refreshToken: null,
    status: "authenticated",
  });
  __setAdapter(async (config) => {
    const url = config.url ?? "";
    if (url.startsWith("/projects/slug/")) return ok(config, PROJECT);
    if (url.startsWith("/tags")) return ok(config, []);
    throw new Error(`unexpected request to ${url}`);
  });
});

afterEach(() => {
  __resetRefreshState();
});

describe("ProjectDetailPage", () => {
  it("opens the tab named in the query string", async () => {
    renderAt("/projects/harbourfront-dental?tab=environments");

    const tab = await screen.findByRole("tab", { name: /Environments/ });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "false");
  });

  it("falls back to Overview for a tab name that does not exist", async () => {
    renderAt("/projects/harbourfront-dental?tab=nonsense");

    expect(await screen.findByRole("tab", { name: /Overview/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("writes the tab back to the URL, and leaves the default out of it", async () => {
    const user = userEvent.setup();
    const router = renderAt("/projects/harbourfront-dental");

    await user.click(await screen.findByRole("tab", { name: /Tasks/ }));
    expect(router.state.location.search).toBe("?tab=tasks");

    // Overview is the default and does not earn a query parameter — the clean
    // URL is the one worth copying.
    await user.click(screen.getByRole("tab", { name: /Overview/ }));
    expect(router.state.location.search).toBe("");
  });

  it("shows the counts on the tabs", async () => {
    renderAt("/projects/harbourfront-dental");

    // The count pill is a sibling span, so the computed name runs the two
    // together — "Environments3", not "Environments 3".
    expect(await screen.findByRole("tab", { name: /^Environments\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Tasks\s*2$/ })).toBeInTheDocument();
  });
});
