import { Link } from "react-router";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * FR-6.1. Four tiles, one shape.
 *
 * Each one is a **link**, not a card with a click handler: every tile is a
 * summary of a list that exists elsewhere, so the honest element is an anchor —
 * middle-click opens it in a tab, the status bar shows where it goes, and the
 * keyboard reaches it without a `tabIndex` of its own.
 *
 * The number is `tabular-nums`, so 1,000 and 1,111 occupy the same width and the
 * row does not shift as the counts change under a refetch.
 */

interface StatTileProps {
  label: string;
  value: number;
  icon: IconName;
  to: string;
  /** The quieter second line: "of 11 projects", "across 3 platforms". */
  detail?: string;
  /**
   * FR-6.1's overdue pill. Rendered only when the count is above zero — a "0
   * overdue" badge is a red mark for the absence of a problem.
   */
  pill?: { label: string; count: number };
}

export const StatTile = ({ label, value, icon, to, detail, pill }: StatTileProps) => (
  <Link
    to={to}
    className={cn(
      "flex flex-col gap-2 rounded-lg border border-line bg-surface p-4",
      "transition-colors duration-150 ease-enter hover:border-ink-muted/35",
    )}
  >
    <span className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-muted">
      <Icon name={icon} size={13} />
      {label}
    </span>

    <span className="flex items-baseline gap-2">
      <span className="text-2xl tabular-nums text-ink">{value}</span>
      {pill && pill.count > 0 && (
        <span className="rounded-full bg-tint-red px-2 py-0.5 text-xs text-tint-red-ink">
          {pill.count} {pill.label}
        </span>
      )}
    </span>

    {/* Reserved even when empty, so four tiles with three details stay the same
        height and the row does not step down in the middle. */}
    <span className="min-h-4 text-xs text-ink-muted">{detail}</span>
  </Link>
);
