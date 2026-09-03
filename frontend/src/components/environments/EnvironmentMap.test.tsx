import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import { EnvironmentMap } from "@/components/environments/EnvironmentMap";
import { ToastViewport } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import type { EnvironmentResponse, EnvironmentSummary, GroupedEnvironments } from "@/types/api";

/**
 * The three checks that are actually about *this* screen rather than about the
 * API behind it: that the shape `/grouped` describes is the shape rendered, that
 * the pair dialog offers only what the invariants allow, and that both
 * consequences of a type change (FR-3.12) are on screen without a manual reload.
 *
 * The adapter holds mutable state rather than a fixed script, because the point
 * of two of these tests is that the *second* read differs from the first.
 */

/**
 * Real UUIDs, not "p1" and "a1". The environment form validates against
 * `environmentCreateSchema`, whose `projectId` is a `z.uuid()` — a friendly
 * placeholder id fails client-side validation and the PATCH is never sent, which
 * would make the type-change test pass or fail for a reason unrelated to it.
 */
const ID = {
  project: "11111111-1111-4111-8111-111111111111",
  app: "22222222-2222-4222-8222-222222222222",
  database: "33333333-3333-4333-8333-333333333333",
  previewApp: "44444444-4444-4444-8444-444444444444",
  previewDatabase: "55555555-5555-4555-8555-555555555555",
} as const;

const environment = (overrides: Partial<EnvironmentResponse>): EnvironmentResponse => ({
  id: "e",
  projectId: ID.project,
  name: "Environment",
  platform: "VERCEL",
  type: "PRODUCTION",
  branch: null,
  url: null,
  notes: null,
  isDatabase: false,
  pairedWith: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const summary = (row: EnvironmentResponse): EnvironmentSummary => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  branch: row.branch,
});

/** The seed: a paired Production pair, an unpaired Preview app, an orphan Preview database. */
const seed = (): EnvironmentResponse[] => [
  environment({
    id: ID.app,
    name: "Web (Vercel)",
    branch: "main",
    url: "https://atlas.vercel.app",
    pairedWith: { id: ID.database, name: "Neon main", platform: "NEON", branch: "main" },
  }),
  environment({
    id: ID.database,
    name: "Neon main",
    platform: "NEON",
    isDatabase: true,
    branch: "main",
    pairedWith: { id: ID.app, name: "Web (Vercel)", platform: "VERCEL", branch: "main" },
  }),
  environment({ id: ID.previewApp, name: "Preview web", type: "PREVIEW" }),
  environment({
    id: ID.previewDatabase,
    name: "Neon preview",
    platform: "NEON",
    isDatabase: true,
    type: "PREVIEW",
  }),
];

/**
 * The arithmetic `/grouped` does on the server, done here only so the fake can
 * answer a *second* read correctly after a mutation. Nothing in the component
 * knows this rule — that is the whole reason the endpoint exists.
 */
function group(rows: EnvironmentResponse[]): GroupedEnvironments {
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    groups: (["PRODUCTION", "PREVIEW", "DEVELOPMENT"] as const).map((type) => {
      const members = rows.filter((row) => row.type === type);
      const taken = new Set<string>();

      const grouped = members
        .filter((row) => !row.isDatabase)
        .map((application) => {
          taken.add(application.id);
          const partner = application.pairedWith ? byId.get(application.pairedWith.id) : undefined;
          if (partner && partner.type === type) {
            taken.add(partner.id);
            return { application: summary(application), database: summary(partner) };
          }
          return { application: summary(application), database: null };
        });

      return {
        type,
        rows: grouped,
        orphanDatabases: members.filter((row) => row.isDatabase && !taken.has(row.id)).map(summary),
      };
    }),
  };
}

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

interface Server {
  rows: EnvironmentResponse[];
  requests: { method: string; url: string; body: unknown }[];
}

const serve = (): Server => {
  const server: Server = { rows: seed(), requests: [] };

  __setAdapter(async (config) => {
    const url = config.url ?? "";
    const method = (config.method ?? "get").toLowerCase();
    const body = config.data ? JSON.parse(config.data as string) : undefined;
    server.requests.push({ method, url, body });

    if (url === "/environments/grouped") return ok(config, group(server.rows));
    if (url === "/environments" && method === "get") return ok(config, server.rows);

    const pair = /^\/environments\/([^/]+)\/pair$/.exec(url);
    if (pair && method === "put") {
      const a = server.rows.find((row) => row.id === pair[1]);
      const b = server.rows.find((row) => row.id === body.targetId);
      if (!a || !b) throw new Error("unknown environment");
      // FR-3.11: release whatever either side was holding, then join them.
      for (const row of server.rows) {
        if (row.pairedWith && [a.id, b.id].includes(row.pairedWith.id)) row.pairedWith = null;
      }
      a.pairedWith = summary(b);
      b.pairedWith = summary(a);
      return ok(config, { environment: a, partner: b });
    }

    const patch = /^\/environments\/([^/]+)$/.exec(url);
    if (patch && method === "patch") {
      const row = server.rows.find((candidate) => candidate.id === patch[1]);
      if (!row) throw new Error("unknown environment");
      // FR-3.12: a type change releases the pairing on both sides.
      if (body.type && body.type !== row.type && row.pairedWith) {
        const partner = server.rows.find((candidate) => candidate.id === row.pairedWith?.id);
        if (partner) partner.pairedWith = null;
        row.pairedWith = null;
      }
      Object.assign(row, body);
      return ok(config, row);
    }

    throw new Error("unexpected " + method + " " + url);
  });

  return server;
};

const renderMap = () =>
  render(
    <MemoryRouter>
      <EnvironmentMap projectId={ID.project} projectName="Atlas" />
      <ToastViewport />
    </MemoryRouter>,
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
});

afterEach(() => {
  __resetRefreshState();
});

describe("EnvironmentMap", () => {
  it("renders the three groups in order, with a pair, a dashed slot, and an orphan", async () => {
    serve();
    renderMap();

    // FR-3.5: the fixed order, and all three present whether or not they hold
    // anything — Development is empty here and still has a card.
    await waitFor(() =>
      expect(screen.getAllByRole("region").map((node) => node.getAttribute("aria-label"))).toEqual([
        "Production environments",
        "Preview environments",
        "Development environments",
      ]),
    );

    const production = screen.getByRole("region", { name: "Production environments" });
    expect(within(production).getByText("Web (Vercel)")).toBeInTheDocument();
    expect(within(production).getByText("Neon main")).toBeInTheDocument();
    // Paired, so no slot on this row.
    expect(within(production).queryByRole("button", { name: /^Pair a database/ })).toBeNull();

    const preview = screen.getByRole("region", { name: "Preview environments" });
    // FR-3.15: the unpaired application gets the dashed empty database slot…
    expect(
      within(preview).getByRole("button", { name: "Pair a database with Preview web" }),
    ).toBeInTheDocument();
    // …and the database nobody claimed is still shown, in its own group.
    expect(within(preview).getByText("Neon preview")).toBeInTheDocument();

    // The URL comes from `/environments`, not from `/grouped`, which carries no
    // such field — this is the join the component exists to do.
    expect(screen.getByTitle("https://atlas.vercel.app")).toBeInTheDocument();
  });

  it("offers only eligible partners, and pairing updates both tiles without a reload", async () => {
    const server = serve();
    const user = userEvent.setup();
    renderMap();

    await user.click(
      await screen.findByRole("button", { name: "Pair a database with Preview web" }),
    );

    const options = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    // Same project, same type, opposite kind. "Neon main" is Production and
    // "Preview web" is the source itself, so neither is offered.
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Neon preview");

    await user.click(options[0]);
    await user.click(screen.getByRole("button", { name: "Pair" }));

    const preview = await screen.findByRole("region", { name: "Preview environments" });
    await waitFor(() =>
      expect(within(preview).queryByRole("button", { name: /^Pair a database/ })).toBeNull(),
    );

    expect(server.requests).toContainEqual({
      method: "put",
      url: "/environments/" + ID.previewApp + "/pair",
      body: { targetId: ID.previewDatabase },
    });
    expect(
      within(await screen.findByRole("status")).getByText("Preview web paired with Neon preview"),
    ).toBeInTheDocument();
  });

  it("shows both consequences of a type change on a paired environment (FR-3.12)", async () => {
    serve();
    const user = userEvent.setup();
    renderMap();

    await user.click(await screen.findByRole("button", { name: "Actions for Web (Vercel)" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    await user.selectOptions(screen.getByLabelText("Type"), "PREVIEW");

    // Said before the save, not discovered after it.
    expect(screen.getByText(/saving this releases the pairing on both sides/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // Both sides: the application has moved to Preview and lost its partner…
    const preview = await screen.findByRole("region", { name: "Preview environments" });
    await waitFor(() =>
      expect(
        within(preview).getByRole("button", { name: "Pair a database with Web (Vercel)" }),
      ).toBeInTheDocument(),
    );

    // …and the database it left behind is an orphan in Production, not a tile
    // still claiming a partner that moved out from under it.
    const production = screen.getByRole("region", { name: "Production environments" });
    expect(within(production).getByText("Neon main")).toBeInTheDocument();
    expect(within(production).queryByText("Web (Vercel)")).toBeNull();
  });
});
