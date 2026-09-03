import { cn } from "@/lib/cn";
import { TINT_CLASSES, tintForColor } from "@/lib/design";
import { Icon } from "@/components/ui/Icon";
import type { TagSummary } from "@/types/api";

interface TagChipProps {
  tag: TagSummary;
  /** Renders a remove control. Omit it and the chip is a label, not a control. */
  onRemove?: (tag: TagSummary) => void;
  className?: string;
}

/**
 * §9.3: fully rounded, where a badge is radius-md. That difference is the whole
 * signal — a chip is a thing you attached, a badge is a state the record is in.
 *
 * The colour comes from the stored ink hex mapped back to a §9.5 recipe, so a
 * palette revision is a change to theme.css and never a data migration.
 */
export const TagChip = ({ tag, onRemove, className }: TagChipProps) => {
  const tint = tintForColor(tag.color);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        TINT_CLASSES[tint],
        className,
      )}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(tag)}
          aria-label={`Remove tag ${tag.name}`}
          className="-mr-0.5 rounded-full opacity-60 transition-opacity hover:opacity-100"
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
};

/** Monospace, per FR-2.9 — a tech-stack entry is a technology name, not prose. */
export const TechChip = ({ value }: { value: string }) => (
  <span className="inline-flex items-center rounded-full border border-line bg-surface-sunken px-2 py-0.5 font-mono text-mono-sm text-ink-secondary">
    {value}
  </span>
);
