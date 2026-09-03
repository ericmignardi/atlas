import type { Platform } from "@/types/api";

/**
 * FR-3.16 and FR-3.17 — the two places the environment form has to know what
 * platform it is looking at.
 *
 * One `url` column carries both a Vercel deployment URL and a Neon connection
 * string, which is why §7.3 leaves it free text and un-validated on the server.
 * That is the right call for storage and the wrong experience for a form: a
 * field labelled "URL" with a generic placeholder tells a user nothing about
 * which of the two this row wants. So the *label*, the *placeholder*, and the
 * *hint* come from the selected platform, and the format check is advisory.
 */

export interface PlatformFields {
  /** FR-3.16: "Connection string" for Neon, "Deployment URL" for Vercel. */
  urlLabel: string;
  urlPlaceholder: string;
  urlHint: string;
  branchPlaceholder: string;
}

export const PLATFORM_FIELDS: Record<Platform, PlatformFields> = {
  VERCEL: {
    urlLabel: "Deployment URL",
    urlPlaceholder: "https://atlas.vercel.app",
    urlHint: "The address this deployment answers on.",
    branchPlaceholder: "main",
  },
  NEON: {
    urlLabel: "Connection string",
    urlPlaceholder: "postgresql://user:password@ep-cool-dawn.neon.tech/atlas?sslmode=require",
    urlHint: "Stored as written. Treat it as a credential.",
    branchPlaceholder: "main",
  },
  LOCAL: {
    urlLabel: "Local address",
    urlPlaceholder: "http://localhost:5173",
    urlHint: "Where this runs on your own machine.",
    branchPlaceholder: "develop",
  },
  OTHER: {
    urlLabel: "URL or connection string",
    urlPlaceholder: "https://… or postgresql://…",
    urlHint: "Whatever identifies this environment.",
    branchPlaceholder: "main",
  },
};

export interface FormatCheck {
  ok: boolean;
  /** One sentence, about the shape only. Never about reachability. */
  message: string;
}

/**
 * FR-3.17. Shape only, and the UI says so in as many words: **no connection is
 * attempted**. Implying a network call that is not happening is worse than
 * offering no check at all — a "pass" would be read as "the database is up",
 * and the first time that is wrong the whole feature stops being believed.
 *
 * Every result is advisory. Nothing here blocks a save: a URL this does not
 * recognise may still be exactly right, and §7.3 deliberately lets the server
 * store it.
 */
export function checkFormat(platform: Platform, raw: string): FormatCheck {
  const value = raw.trim();

  if (!value) {
    return { ok: false, message: "Nothing to check yet — enter a value first." };
  }

  if (platform === "NEON") return checkConnectionString(value);
  if (platform === "OTHER" && isPostgresScheme(value)) return checkConnectionString(value);
  return checkUrl(platform, value);
}

const isPostgresScheme = (value: string) => /^postgres(ql)?:\/\//i.test(value);

/**
 * A Postgres connection string, checked with `URL` rather than a regex. The
 * parser already knows what a userinfo section, a percent-encoded password, and
 * a query string are; a regex that learns all three is a parser with bugs.
 */
function checkConnectionString(value: string): FormatCheck {
  if (!isPostgresScheme(value)) {
    return {
      ok: false,
      message: "A Neon connection string starts with postgresql:// or postgres://.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "That is not a connection string this can parse." };
  }

  if (!parsed.hostname) {
    return { ok: false, message: "No host in that connection string." };
  }

  // "/atlas" — one segment, and an empty path is the common paste mistake.
  const database = parsed.pathname.replace(/^\//, "");
  if (!database) {
    return { ok: false, message: "No database name after the host." };
  }

  if (parsed.searchParams.get("sslmode") !== "require") {
    return {
      ok: true,
      message: `Looks like a connection string for ${database} on ${parsed.hostname}. Neon usually wants sslmode=require.`,
    };
  }

  return {
    ok: true,
    message: `Looks like a connection string for ${database} on ${parsed.hostname}.`,
  };
}

function checkUrl(platform: Platform, value: string): FormatCheck {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "That is not a URL. It needs a scheme, like https://." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: `${parsed.protocol.replace(":", "")} is not http or https.` };
  }

  if (!parsed.hostname) {
    return { ok: false, message: "No host in that URL." };
  }

  // Plain http is right for localhost and wrong for a deployment, so it is a
  // pass with a note rather than a failure — the check advises, it does not veto.
  if (parsed.protocol === "http:" && platform !== "LOCAL") {
    return { ok: true, message: `Looks like a URL for ${parsed.hostname}, but it is not https.` };
  }

  return { ok: true, message: `Looks like a URL for ${parsed.hostname}.` };
}
