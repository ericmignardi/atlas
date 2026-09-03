import { cn } from "@/lib/cn";
import { PlatformBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import { toast } from "@/stores/uiStore";
import type { EnvironmentResponse } from "@/types/api";

/**
 * FR-3.15's tile: one environment, everything you would want off it at a
 * glance, and nothing you would have to open a form to read.
 *
 * The URL is the awkward part. It is one column carrying either a deployment
 * URL or a Neon connection string (§7.3), so it is rendered monospaced,
 * truncated, and **never linked** — a connection string is not a link, and a
 * connection string carries a password, so putting it in an `href` would leak it
 * into browser history and the Referer header of whatever it opened. The copy
 * button is the affordance instead: it puts the exact stored value on the
 * clipboard, which is what a connection string is for.
 */

interface EnvironmentTileProps {
  environment: EnvironmentResponse;
  onEdit: (environment: EnvironmentResponse) => void;
  onPair: (environment: EnvironmentResponse) => void;
  onUnpair: (environment: EnvironmentResponse) => void;
  onDelete: (environment: EnvironmentResponse) => void;
  className?: string;
}

export const EnvironmentTile = ({
  environment,
  onEdit,
  onPair,
  onUnpair,
  onDelete,
  className,
}: EnvironmentTileProps) => {
  const paired = environment.pairedWith !== null;

  const actions: MenuAction[] = [
    { label: "Edit", icon: "edit", onSelect: () => onEdit(environment) },
    paired
      ? { label: "Unpair", icon: "unlink", onSelect: () => onUnpair(environment) }
      : { label: "Pair…", icon: "link", onSelect: () => onPair(environment) },
    { label: "Delete", icon: "delete", danger: true, onSelect: () => onDelete(environment) },
  ];

  return (
    <div
      className={cn(
        "group flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5",
        "transition-colors duration-150 ease-enter hover:border-ink-muted/35",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* FR-3.6: the database marker is a glyph as well as a teal chip, so
              the distinction is not made by colour alone (NFR-4.4). */}
          <Icon
            name={environment.isDatabase ? "database" : "environments"}
            size={14}
            className={environment.isDatabase ? "text-teal-600" : "text-ink-muted"}
          />
          <p className="truncate text-sm text-ink">{environment.name}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* An indicator, not the note. `Tooltip` is deliberately
              `whitespace-nowrap` for one-line labels, and 4000 characters of
              notes in one is a ribbon across the viewport — the native title
              wraps and the text lives on the edit form. */}
          {environment.notes && (
            <span className="inline-flex text-ink-muted" title={environment.notes}>
              <Icon name="note" size={13} label="Has notes" />
            </span>
          )}
          <Menu label={`Actions for ${environment.name}`} actions={actions} />
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <PlatformBadge platform={environment.platform} />
        {environment.branch && (
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-line bg-surface-sunken px-2 py-0.5 font-mono text-mono-sm text-ink-secondary">
            <Icon name="branch" size={11} />
            <span className="truncate">{environment.branch}</span>
          </span>
        )}
      </div>

      {environment.url ? (
        <div className="flex min-w-0 items-center gap-1">
          <p
            className="truncate font-mono text-mono-sm text-ink-muted"
            title={environment.url}
            data-testid="environment-url"
          >
            {environment.url}
          </p>
          <CopyButton value={environment.url} name={environment.name} />
        </div>
      ) : (
        <p className="text-xs text-ink-muted">No address recorded</p>
      )}
    </div>
  );
};

/**
 * `navigator.clipboard` is absent in an insecure context and in jsdom, and
 * `writeText` rejects when the document is not focused. All three end in the
 * same place: say it did not work rather than showing a success toast for
 * something that silently did nothing.
 */
const CopyButton = ({ value, name }: { value: string; name: string }) => (
  <button
    type="button"
    aria-label={`Copy the address for ${name}`}
    title="Copy"
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success("Copied to the clipboard");
      } catch {
        toast.error("Could not copy that", "Your browser blocked clipboard access.");
      }
    }}
    className={cn(
      "shrink-0 rounded-sm p-1 text-ink-muted",
      "opacity-0 transition-opacity duration-150 ease-enter",
      "hover:text-ink group-hover:opacity-100 focus-visible:opacity-100",
    )}
  >
    <Icon name="copy" size={13} />
  </button>
);
