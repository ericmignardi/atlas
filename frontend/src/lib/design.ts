import type {
  EnvironmentType,
  Platform,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@/types/api";

/**
 * PRD §9.4 and §9.5, as one map. Every enum value in Atlas gets its label and
 * its colour recipe from here and nowhere else — no `status === "ACTIVE" ? …`
 * scattered through components, because that is how a design system becomes
 * seven slightly different greens.
 *
 * The class strings are written out in full rather than assembled from parts.
 * Tailwind scans source text for candidates; a class built as
 * `bg-tint-${name}` is invisible to it and the CSS is simply never generated.
 */

export type Tint = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "teal";

/** The background / ink / border triple of a §9.5 recipe, ready to spread onto a className. */
export const TINT_CLASSES: Record<Tint, string> = {
  neutral: "bg-tint-neutral text-tint-neutral-ink border-tint-neutral-line",
  blue: "bg-tint-blue text-tint-blue-ink border-tint-blue-line",
  green: "bg-tint-green text-tint-green-ink border-tint-green-line",
  amber: "bg-tint-amber text-tint-amber-ink border-tint-amber-line",
  red: "bg-tint-red text-tint-red-ink border-tint-red-line",
  violet: "bg-tint-violet text-tint-violet-ink border-tint-violet-line",
  teal: "bg-tint-teal text-tint-teal-ink border-tint-teal-line",
};

/**
 * The saturated half of a recipe on its own, for a mark that is too small to be
 * a badge — the 9 px square on a board column header (§8.2). A pale
 * `bg-tint-blue` at that size is invisible against the surface, so the dot takes
 * the ink instead. Written out in full for the same reason as above.
 */
export const TINT_DOT: Record<Tint, string> = {
  neutral: "bg-tint-neutral-ink",
  blue: "bg-tint-blue-ink",
  green: "bg-tint-green-ink",
  amber: "bg-tint-amber-ink",
  red: "bg-tint-red-ink",
  violet: "bg-tint-violet-ink",
  teal: "bg-tint-teal-ink",
};

/**
 * FR-5.4 / §9.5. The tags table stores the *ink* hex of a recipe, so the UI maps
 * it back to the whole triple. An unrecognised hex — a colour set before the
 * palette changed — falls back to neutral rather than rendering nothing.
 */
const TINT_BY_INK: Record<string, Tint> = {
  "#2251b4": "blue",
  "#16643b": "green",
  "#8a5a08": "amber",
  "#5b2bb0": "violet",
  "#0f6157": "teal",
  "#9b2c22": "red",
  "#454d5f": "neutral",
};

export function tintForColor(hex: string | null | undefined): Tint {
  return TINT_BY_INK[hex?.toLowerCase() ?? ""] ?? "neutral";
}

/**
 * The palette cycle, in the server's order (`TagPalette.COLOURS`), for
 * previewing a tag before it exists and for the swatch row in the tag form.
 *
 * The hexes are the *ink* of each recipe, which is what the `color` column
 * stores — so a swatch the user picks can be sent straight to the API, and
 * `tintForColor` maps it back to the full triple on the way in.
 */
export const TAG_PALETTE: readonly { tint: Tint; hex: string }[] = [
  { tint: "blue", hex: "#2251B4" },
  { tint: "green", hex: "#16643B" },
  { tint: "amber", hex: "#8A5A08" },
  { tint: "violet", hex: "#5B2BB0" },
  { tint: "teal", hex: "#0F6157" },
  { tint: "red", hex: "#9B2C22" },
  { tint: "neutral", hex: "#454D5F" },
];

interface EnumRecipe {
  label: string;
  tint: Tint;
  /** ARCHIVED is a real state, not a lesser one — but it should not compete for attention. */
  muted?: boolean;
}

export const PROJECT_STATUS: Record<ProjectStatus, EnumRecipe> = {
  IDEA: { label: "Idea", tint: "neutral" },
  ACTIVE: { label: "Active", tint: "blue" },
  PAUSED: { label: "Paused", tint: "amber" },
  SHIPPED: { label: "Shipped", tint: "green" },
  ARCHIVED: { label: "Archived", tint: "neutral", muted: true },
};

export const TASK_STATUS: Record<TaskStatus, EnumRecipe> = {
  TODO: { label: "To do", tint: "neutral" },
  IN_PROGRESS: { label: "In progress", tint: "blue" },
  /** Violet, not red: blocked is a dependency, not a severity (§9.4). */
  BLOCKED: { label: "Blocked", tint: "violet" },
  DONE: { label: "Done", tint: "green" },
};

export const TASK_PRIORITY: Record<TaskPriority, EnumRecipe> = {
  LOW: { label: "Low", tint: "neutral" },
  MEDIUM: { label: "Medium", tint: "neutral" },
  HIGH: { label: "High", tint: "amber" },
  URGENT: { label: "Urgent", tint: "red" },
};

export const ENVIRONMENT_TYPE: Record<EnvironmentType, EnumRecipe> = {
  PRODUCTION: { label: "Production", tint: "red" },
  PREVIEW: { label: "Preview", tint: "amber" },
  DEVELOPMENT: { label: "Development", tint: "neutral" },
};

/**
 * §9.1 / §9.4: each environment-type group is a card with a coloured left rail.
 * The rail is a border, not a badge, so it needs its own class — the tint's
 * border colour would be far too pale to read as a rail.
 */
export const ENVIRONMENT_TYPE_RAIL: Record<EnvironmentType, string> = {
  PRODUCTION: "border-l-red-600",
  PREVIEW: "border-l-amber-600",
  DEVELOPMENT: "border-l-line",
};

export const PLATFORM: Record<Platform, EnumRecipe> = {
  VERCEL: { label: "Vercel", tint: "neutral" },
  /** FR-3.6: the one database platform, and the teal marker is how you see that at a glance. */
  NEON: { label: "Neon", tint: "teal" },
  LOCAL: { label: "Local", tint: "neutral" },
  OTHER: { label: "Other", tint: "neutral" },
};

/** Labels without the colour, for a <Select> where a coloured option would be noise. */
export const labelFor = {
  projectStatus: (value: ProjectStatus) => PROJECT_STATUS[value].label,
  taskStatus: (value: TaskStatus) => TASK_STATUS[value].label,
  taskPriority: (value: TaskPriority) => TASK_PRIORITY[value].label,
  environmentType: (value: EnvironmentType) => ENVIRONMENT_TYPE[value].label,
  platform: (value: Platform) => PLATFORM[value].label,
};
