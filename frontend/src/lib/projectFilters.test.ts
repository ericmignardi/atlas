import { describe, expect, it } from "vitest";

import { clientOptions, filterProjects, sortProjects, EMPTY_FILTERS } from "@/lib/projectFilters";
import type { ProjectResponse, ProjectStatus } from "@/types/api";

/**
 * The filters moved to the client, so the *server's* tests no longer cover the
 * rules the user actually experiences. These are the two that are easy to get
 * subtly wrong and impossible to notice by hand:
 *
 * - FR-2.7's archived exception — hidden by default, except when you filter
 *   *to* archived, where hiding them makes the filter look broken.
 * - FR-2.8's pinned-first ordering, which has to hold under every sort or the
 *   list and the dashboard disagree about what is at the top.
 */

let counter = 0;

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => {
  counter += 1;
  return {
    id: `id-${counter}`,
    name: `Project ${counter}`,
    slug: `project-${counter}`,
    client: null,
    description: null,
    status: "ACTIVE" as ProjectStatus,
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
  };
};

const tag = (name: string) => ({ id: `tag-${name}`, name, color: "#2251B4" });

describe("filterProjects", () => {
  it("hides archived projects by default", () => {
    const active = project({ status: "ACTIVE" });
    const archived = project({ status: "ARCHIVED" });

    expect(filterProjects([active, archived], EMPTY_FILTERS)).toEqual([active]);
  });

  it("shows archived projects when the status filter asks for them", () => {
    // FR-2.7's exception. Without it, filtering to ARCHIVED returns nothing and
    // the status select looks broken for exactly one of its five values.
    const archived = project({ status: "ARCHIVED" });

    expect(filterProjects([project(), archived], { ...EMPTY_FILTERS, status: "ARCHIVED" })).toEqual(
      [archived],
    );
  });

  it("matches the query against name, client, and description", () => {
    const byName = project({ name: "Harbourfront Dental" });
    const byClient = project({ client: "Harbourfront Group" });
    const byDescription = project({ description: "A rebuild for harbourfront." });
    const unrelated = project({ name: "Atlas" });

    const found = filterProjects([byName, byClient, byDescription, unrelated], {
      ...EMPTY_FILTERS,
      // Lower case against three differently-cased fields: FR-2.12 says
      // case-insensitive, and the server agrees.
      query: "harbourfront",
    });

    expect(found).toEqual([byName, byClient, byDescription]);
  });

  it("filters by tag name rather than tag id", () => {
    const tagged = project({ tags: [tag("client-work")] });
    const other = project({ tags: [tag("side-project")] });

    expect(filterProjects([tagged, other], { ...EMPTY_FILTERS, tag: "client-work" })).toEqual([
      tagged,
    ]);
  });
});

describe("sortProjects", () => {
  it("puts pinned projects first whatever the sort", () => {
    const pinned = project({ name: "Zulu", isPinned: true, updatedAt: "2020-01-01T00:00:00Z" });
    const recent = project({ name: "Alpha", updatedAt: "2026-06-01T00:00:00Z" });

    // Last by name and last by date, and still first in both orders.
    expect(sortProjects([recent, pinned], "name")[0]).toBe(pinned);
    expect(sortProjects([recent, pinned], "updated")[0]).toBe(pinned);
  });

  it("does not mutate the array it was given", () => {
    // The input is the fetched cache; sorting it in place would reorder state
    // under a component that is mid-render.
    const first = project({ name: "Beta" });
    const second = project({ name: "Alpha" });
    const input = [first, second];

    sortProjects(input, "name");

    expect(input).toEqual([first, second]);
  });
});

describe("clientOptions", () => {
  it("collects distinct clients and drops the projects that have none", () => {
    const projects = [
      project({ client: "Northwind" }),
      project({ client: "Northwind" }),
      project({ client: "Acme" }),
      project({ client: null }),
    ];

    expect(clientOptions(projects)).toEqual(["Acme", "Northwind"]);
  });
});
