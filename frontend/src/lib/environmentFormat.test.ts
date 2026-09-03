import { describe, expect, it } from "vitest";

import { checkFormat, PLATFORM_FIELDS } from "@/lib/environmentFormat";
import { eligiblePartners } from "@/lib/environmentPairing";
import type { EnvironmentResponse } from "@/types/api";

/**
 * FR-3.16, FR-3.17, and the client half of FR-3.7 – FR-3.10.
 *
 * The format check is the one place in Atlas where being *precise about what it
 * does not do* is the requirement: it looks at a string, it never opens a
 * socket, and a pass has to be worded so nobody reads it as "the database is
 * up". The tests below pin the shapes; the disclaimer beside the button is
 * pinned by the form's own copy.
 */

describe("PLATFORM_FIELDS", () => {
  it("relabels the one URL column per platform (FR-3.16)", () => {
    expect(PLATFORM_FIELDS.NEON.urlLabel).toBe("Connection string");
    expect(PLATFORM_FIELDS.VERCEL.urlLabel).toBe("Deployment URL");
    // The whole reason the labels differ: one column, two very different values.
    expect(PLATFORM_FIELDS.NEON.urlPlaceholder).toContain("postgresql://");
    expect(PLATFORM_FIELDS.VERCEL.urlPlaceholder).toContain("https://");
  });
});

describe("checkFormat", () => {
  it("accepts a Neon connection string, which no URL validator would", () => {
    const result = checkFormat(
      "NEON",
      "postgresql://atlas:pw@ep-cool-dawn-123.eu-central-1.aws.neon.tech/atlas?sslmode=require",
    );
    expect(result.ok).toBe(true);
    expect(result.message).toContain("atlas");
    expect(result.message).toContain("neon.tech");
  });

  it("passes a connection string with no sslmode but says so", () => {
    const result = checkFormat("NEON", "postgres://atlas:pw@ep-cool.neon.tech/atlas");
    expect(result.ok).toBe(true);
    expect(result.message).toContain("sslmode=require");
  });

  it("rejects an https URL pasted into a Neon row", () => {
    const result = checkFormat("NEON", "https://atlas.vercel.app");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("postgresql://");
  });

  it("rejects a connection string with no database after the host", () => {
    expect(checkFormat("NEON", "postgresql://atlas:pw@ep-cool.neon.tech").ok).toBe(false);
  });

  it("accepts a deployment URL and rejects a bare hostname", () => {
    expect(checkFormat("VERCEL", "https://atlas.vercel.app").ok).toBe(true);
    // No scheme: the most common paste, and the message says what is missing.
    const bare = checkFormat("VERCEL", "atlas.vercel.app");
    expect(bare.ok).toBe(false);
    expect(bare.message).toContain("https://");
  });

  it("passes plain http with a note off localhost, and without one on it", () => {
    const deployed = checkFormat("VERCEL", "http://atlas.example.com");
    expect(deployed.ok).toBe(true);
    expect(deployed.message).toContain("not https");

    const local = checkFormat("LOCAL", "http://localhost:5173");
    expect(local.ok).toBe(true);
    expect(local.message).not.toContain("not https");
  });

  it("takes either shape on OTHER, because that is what OTHER means", () => {
    expect(checkFormat("OTHER", "postgresql://u:p@host/db?sslmode=require").ok).toBe(true);
    expect(checkFormat("OTHER", "https://example.com").ok).toBe(true);
  });

  it("says there is nothing to check rather than failing an empty field", () => {
    const result = checkFormat("VERCEL", "   ");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Nothing to check");
  });
});

const environment = (overrides: Partial<EnvironmentResponse>): EnvironmentResponse => ({
  id: "e1",
  projectId: "p1",
  name: "Web",
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

describe("eligiblePartners", () => {
  const source = environment({ id: "app", name: "Web (Vercel)" });

  it("offers only the same project, the same type, and the other kind", () => {
    const candidates = [
      source,
      environment({ id: "db", name: "Neon main", platform: "NEON", isDatabase: true }),
      environment({
        id: "wrong-type",
        name: "Neon preview",
        platform: "NEON",
        isDatabase: true,
        type: "PREVIEW",
      }),
      environment({
        id: "wrong-project",
        name: "Other project db",
        platform: "NEON",
        isDatabase: true,
        projectId: "p2",
      }),
      environment({ id: "another-app", name: "Docs site" }),
    ];

    expect(eligiblePartners(source, candidates).map((row) => row.id)).toEqual(["db"]);
  });

  it("still offers a candidate that is already paired — displacement is a choice", () => {
    const taken = environment({
      id: "db",
      name: "Neon main",
      platform: "NEON",
      isDatabase: true,
      pairedWith: { id: "other", name: "Docs site", platform: "VERCEL", branch: null },
    });

    // FR-3.11 releases the old partner rather than refusing, so hiding the row
    // would remove a legitimate operation. The dialog states the consequence.
    expect(eligiblePartners(source, [taken]).map((row) => row.id)).toEqual(["db"]);
  });
});
