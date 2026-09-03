import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CardProps {
  /** Adds hover feedback. Only for cards that are actually a link or a button. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * §9.3: a resting card is a 1px border and no shadow. Shadow is reserved for
 * things that genuinely float — modals, the palette, toasts — so that when
 * something is elevated, the elevation means something.
 */
export const Card = ({ interactive = false, className, children }: CardProps) => (
  <div
    className={cn(
      "rounded-lg border border-line bg-surface",
      interactive && "transition-colors duration-150 ease-enter hover:border-ink-muted/35",
      className,
    )}
  >
    {children}
  </div>
);

interface PanelProps {
  title?: string;
  /** A count, a filter, a link — whatever belongs on the right of the header rule. */
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * A card with a titled header. Split from Card rather than made a prop, because
 * the header brings a rule, a padding contract, and a heading level with it, and
 * "Card with six optional header props" is how a primitive stops being one.
 */
export const Panel = ({ title, actions, className, bodyClassName, children }: PanelProps) => (
  <section className={cn("rounded-lg border border-line bg-surface", className)}>
    {(title || actions) && (
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        {title && <h2 className="text-eyebrow uppercase text-ink-muted">{title}</h2>}
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </header>
    )}
    <div className={cn("p-4", bodyClassName)}>{children}</div>
  </section>
);
