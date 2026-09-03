import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface TooltipProps {
  label: string;
  side?: "top" | "right";
  children: ReactNode;
}

/**
 * CSS positioning rather than a floating-element library: Atlas uses tooltips in
 * two places — the collapsed sidebar and a couple of icon buttons — and neither
 * is near enough to a viewport edge to need collision detection. A 12 kB
 * dependency for that is a bad trade against NFR-1.3.
 *
 * Focus opens it as well as hover, so a keyboard user gets the label too
 * (NFR-4.1). `aria-describedby` rather than `aria-label`, because the trigger
 * usually has its own accessible name and this is extra detail, not a
 * replacement for it.
 */
export const Tooltip = ({ label, side = "top", children }: TooltipProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-sm bg-ink px-2 py-1",
            "text-xs text-on-accent shadow-overlay animate-fade-in",
            side === "top"
              ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
              : "left-full top-1/2 ml-2 -translate-y-1/2",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
};
