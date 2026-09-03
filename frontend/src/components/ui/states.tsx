import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * The three list states of PRD §9.7, as three components. Every list in Atlas
 * renders all three — FR-8.1 calls it out precisely because it is the part
 * everyone means to come back to and does not.
 */

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn("rounded-md bg-tint-neutral animate-skeleton", className)}
    aria-hidden="true"
  />
);

interface SkeletonListProps {
  rows?: number;
  /** Height of one row, so the skeleton's geometry matches the real content. */
  rowClassName?: string;
  className?: string;
}

/**
 * §9.7: matched geometry, and an opacity ramp down the list. Never a centred
 * spinner — a spinner tells you something is happening; a skeleton tells you
 * what is about to be there, and the page does not jump when it arrives.
 */
export const SkeletonList = ({
  rows = 4,
  rowClassName = "h-[72px]",
  className,
}: SkeletonListProps) => (
  <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        // The ramp down the list is what stops four identical bars from reading
        // as real content. Inline because it is a per-index value, and a utility
        // class cannot be one.
        style={{ opacity: Math.max(0.25, 1 - index * 0.18) }}
      >
        <Skeleton className={rowClassName} />
      </div>
    ))}
  </div>
);

interface EmptyStateProps {
  icon?: IconName;
  /** A specific sentence. Never "No data" — say what would be here and why it is not. */
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon = "empty",
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-6 py-12 text-center",
      className,
    )}
  >
    <Icon name={icon} size={22} className="text-ink-muted" />
    <p className="text-lg text-ink">{title}</p>
    <p className="max-w-[42ch] text-sm text-ink-secondary">{description}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>
);

interface FilteredEmptyStateProps {
  /** What was being filtered — "projects", "tasks". Reads into the sentence. */
  noun: string;
  onClear: () => void;
  className?: string;
}

/**
 * §9.7 insists these are two different states, and they are: "you have no
 * projects" wants a Create button, and "none of your projects match this
 * filter" wants the filter cleared. Offering Create to someone with forty
 * projects and a typo in the search box is the wrong answer to their problem.
 */
export const FilteredEmptyState = ({ noun, onClear, className }: FilteredEmptyStateProps) => (
  <EmptyState
    icon="filter"
    title={`No ${noun} match these filters`}
    description="Nothing here fits the current combination. Widen the filters or clear them to see everything again."
    action={
      <Button icon="close" onClick={onClear}>
        Clear filters
      </Button>
    }
    className={className}
  />
);

interface ErrorStateProps {
  /** Plain language, and never a raw exception — §9.7. */
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = ({ message, onRetry, className }: ErrorStateProps) => (
  <div
    role="alert"
    className={cn(
      "flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-6 py-12 text-center",
      className,
    )}
  >
    <Icon name="warning" size={22} className="text-red-600" />
    <p className="text-lg text-ink">That did not load</p>
    <p className="max-w-[42ch] text-sm text-ink-secondary">{message}</p>
    {onRetry && (
      <div className="mt-2">
        <Button icon="retry" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )}
  </div>
);

interface PageHeaderProps {
  title: string;
  /** The 11px uppercase label above the title — where you are, in one word. */
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  eyebrow,
  description,
  actions,
  className,
}: PageHeaderProps) => (
  <header className={cn("flex items-start justify-between gap-4", className)}>
    <div className="flex min-w-0 flex-col gap-1">
      {eyebrow && <p className="text-eyebrow uppercase text-ink-muted">{eyebrow}</p>}
      <h1 className="truncate text-xl text-ink">{title}</h1>
      {description && <p className="text-sm text-ink-secondary">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
);
