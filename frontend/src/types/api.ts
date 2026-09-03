/**
 * The wire shapes the backend returns (PRD §6). These mirror the response
 * records in `com.ericmignardi.atlas.*.dto` and are hand-maintained rather than
 * generated: the OpenAPI document is served from a running instance, and a
 * build that needs the server up to typecheck is a build that breaks on a train.
 *
 * Request shapes are *not* here. Those live in `src/schemas/` as Zod schemas
 * with the types derived by `z.infer`, so there is exactly one source of truth
 * for anything a form can produce (PRD §7).
 */

export type ProjectStatus = "IDEA" | "ACTIVE" | "PAUSED" | "SHIPPED" | "ARCHIVED";
export type EnvironmentType = "PRODUCTION" | "PREVIEW" | "DEVELOPMENT";
export type Platform = "VERCEL" | "NEON" | "LOCAL" | "OTHER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Declared in display order, which is also the server's declaration order. */
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "IDEA",
  "ACTIVE",
  "PAUSED",
  "SHIPPED",
  "ARCHIVED",
];

/** FR-3.5: Production, Preview, Development, always in that order. */
export const ENVIRONMENT_TYPES: readonly EnvironmentType[] = [
  "PRODUCTION",
  "PREVIEW",
  "DEVELOPMENT",
];

export const PLATFORMS: readonly Platform[] = ["VERCEL", "NEON", "LOCAL", "OTHER"];

/** FR-4.11: the board-column order. */
export const TASK_STATUSES: readonly TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

export const TASK_PRIORITIES: readonly TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Seconds. Derived from the server's configured TTL, not hard-coded. */
  expiresIn: number;
  user: UserResponse;
}

export interface TagSummary {
  id: string;
  name: string;
  /** The *ink* hex of a §9.5 recipe; design.ts maps it back to the triple. */
  color: string;
}

export interface TagResponse extends TagSummary {
  usageCount: number;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  slug: string;
  client: string | null;
  description: string | null;
  status: ProjectStatus;
  repoUrl: string | null;
  liveUrl: string | null;
  engagement: string | null;
  techStack: string[];
  isPinned: boolean;
  startedAt: string | null;
  tags: TagSummary[];
  environmentCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  platform: Platform;
  branch: string | null;
}

export interface EnvironmentResponse {
  id: string;
  projectId: string;
  name: string;
  platform: Platform;
  type: EnvironmentType;
  branch: string | null;
  url: string | null;
  notes: string | null;
  isDatabase: boolean;
  pairedWith: EnvironmentSummary | null;
  createdAt: string;
  updatedAt: string;
}

/** FR-3.15. A null `database` is the dashed empty slot, not a missing record. */
export interface EnvironmentRow {
  application: EnvironmentSummary;
  database: EnvironmentSummary | null;
}

/**
 * FR-3.5. Present even when empty, so the three cards do not come and go as
 * environments are added — a layout that reflows on every create is a layout
 * you cannot aim at.
 */
export interface EnvironmentGroup {
  type: EnvironmentType;
  rows: EnvironmentRow[];
  /** A database paired with nothing, which is a real state rather than an error. */
  orphanDatabases: EnvironmentSummary[];
}

/** Always three groups, always in the order Production, Preview, Development. */
export interface GroupedEnvironments {
  groups: EnvironmentGroup[];
}

/**
 * Both sides of a pairing operation. `partner` is null after unpairing
 * something that was not paired — a no-op, not a failure.
 */
export interface PairResponse {
  environment: EnvironmentResponse;
  partner: EnvironmentResponse | null;
}

export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  sortOrder: number;
  completedAt: string | null;
  isOverdue: boolean;
  /** FR-4.5: null for the Unassigned bucket. */
  project: ProjectSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  status: TaskStatus;
  tasks: TaskResponse[];
}

/** FR-4.11 and FR-4.12: four columns, always present, Done already narrowed to seven days. */
export interface BoardResponse {
  columns: BoardColumn[];
}

/**
 * PRD §6.1. The one body every failure produces. `fields` is present only on a
 * 400, and `code` only where the server names a specific business rule.
 */
export interface ErrorBody {
  timestamp: string;
  status: number;
  error: string;
  path?: string;
  code?: string;
  fields?: Record<string, string[]>;
}

/**
 * FR-4.10 / FR-6.3. Three disjoint buckets over an eight-day window: everything
 * already late, everything due before midnight tonight, and the rest of the
 * week. The split is timezone-dependent, so the server does it — a browser in
 * Vancouver and a server in UTC disagree about "today" for five hours a day.
 */
export interface NeedsAttention {
  overdue: TaskResponse[];
  dueToday: TaskResponse[];
  dueSoon: TaskResponse[];
}

/** FR-6.1's four tiles. `platforms` and `totalProjects` are the second lines under two of them. */
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  environments: number;
  platforms: number;
  tags: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  /** FR-6.2. At most four; the client draws a dashed card in each unused slot. */
  pinnedProjects: ProjectResponse[];
  needsAttention: NeedsAttention;
  /** FR-6.4. Nothing has ever been created — which is not the same as everything being archived. */
  isNewAccount: boolean;
}

/**
 * FR-7.2. Palette rows, not full records: each carries what its row renders and
 * what selecting it needs to navigate, and nothing else.
 */
export interface SearchProject {
  id: string;
  name: string;
  slug: string;
  client: string | null;
  status: ProjectStatus;
}

export interface SearchEnvironment {
  id: string;
  name: string;
  type: EnvironmentType;
  platform: Platform;
  branch: string | null;
  /** An environment is only reachable through its project's map. */
  project: ProjectSummary;
}

export interface SearchTask {
  id: string;
  title: string;
  status: TaskStatus;
  project: ProjectSummary | null;
}

/** Three groups, always present, always in this order — the palette renders them in it. */
export interface SearchResponse {
  projects: SearchProject[];
  environments: SearchEnvironment[];
  tasks: SearchTask[];
}
