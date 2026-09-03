import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  ENVIRONMENT_TYPE,
  PLATFORM,
  PROJECT_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
  TINT_CLASSES,
  type Tint,
} from "@/lib/design";
import type {
  EnvironmentType,
  Platform,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@/types/api";

interface BadgeProps {
  tint?: Tint;
  muted?: boolean;
  className?: string;
  children: ReactNode;
}

/** Radius md — a chip is fully rounded, and shape alone tells them apart (§9.3). */
export const Badge = ({ tint = "neutral", muted = false, className, children }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap",
      TINT_CLASSES[tint],
      muted && "opacity-70",
      className,
    )}
  >
    {children}
  </span>
);

/**
 * The typed badges. Each one reads its label and tint from `design.ts`, so
 * "what colour is BLOCKED" has exactly one answer in the codebase and a page
 * cannot invent a second (§9.4).
 */

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => {
  const { label, tint, muted } = PROJECT_STATUS[status];
  return (
    <Badge tint={tint} muted={muted}>
      {label}
    </Badge>
  );
};

export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => {
  const { label, tint } = TASK_STATUS[status];
  return <Badge tint={tint}>{label}</Badge>;
};

/**
 * LOW and MEDIUM are both neutral on purpose: priority should only shout when it
 * is HIGH or URGENT, and a board where every card carries a coloured pill has
 * told you nothing.
 */
export const TaskPriorityBadge = ({ priority }: { priority: TaskPriority }) => {
  const { label, tint } = TASK_PRIORITY[priority];
  return <Badge tint={tint}>{label}</Badge>;
};

export const EnvironmentTypeBadge = ({ type }: { type: EnvironmentType }) => {
  const { label, tint } = ENVIRONMENT_TYPE[type];
  return <Badge tint={tint}>{label}</Badge>;
};

/** FR-3.6: Neon is the one database platform, and it carries the teal marker. */
export const PlatformBadge = ({ platform }: { platform: Platform }) => {
  const { label, tint } = PLATFORM[platform];
  return <Badge tint={tint}>{label}</Badge>;
};
