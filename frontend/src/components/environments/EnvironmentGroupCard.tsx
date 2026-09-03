import { cn } from "@/lib/cn";
import { ENVIRONMENT_TYPE, ENVIRONMENT_TYPE_RAIL } from "@/lib/design";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EnvironmentTile } from "@/components/environments/EnvironmentTile";
import type {
  EnvironmentGroup,
  EnvironmentResponse,
  EnvironmentSummary,
  EnvironmentType,
} from "@/types/api";

/**
 * FR-3.5 and FR-3.15. One of the three type cards: a coloured left rail, a line
 * saying what the type *means*, and rows of `application ── database`.
 *
 * The card is rendered even when the group is empty. The three types are a
 * fixed frame, not a list of what happens to exist — a layout where Preview
 * appears and disappears as environments are added is a layout you cannot aim
 * at, and an empty Production card is itself information.
 */

/** §9.4: the sentence is the point. A user who does not know what "Preview"
    means here will not learn it from a coloured rail. */
const DESCRIPTIONS: Record<EnvironmentType, string> = {
  PRODUCTION: "What your users are actually hitting. Break this one and someone notices.",
  PREVIEW: "Branch and pull-request deployments. Disposable, and safe to break.",
  DEVELOPMENT: "Your own machine, and anything else that never faces the public.",
};

interface EnvironmentGroupCardProps {
  group: EnvironmentGroup;
  /**
   * Turns a summary from `/grouped` into the full record from `/environments`.
   * A summary carries id, name, platform and branch; a tile also shows the URL,
   * the notes indicator, and a menu that needs the type.
   */
  resolve: (summary: EnvironmentSummary) => EnvironmentResponse;
  onEdit: (environment: EnvironmentResponse) => void;
  onPair: (environment: EnvironmentResponse) => void;
  onUnpair: (environment: EnvironmentResponse) => void;
  onDelete: (environment: EnvironmentResponse) => void;
  onCreate: (type: EnvironmentType) => void;
}

export const EnvironmentGroupCard = ({
  group,
  resolve,
  onEdit,
  onPair,
  onUnpair,
  onDelete,
  onCreate,
}: EnvironmentGroupCardProps) => {
  const { label } = ENVIRONMENT_TYPE[group.type];
  const count = group.rows.length + group.orphanDatabases.length;
  const tileProps = { onEdit, onPair, onUnpair, onDelete };

  return (
    <section
      aria-label={`${label} environments`}
      className={cn(
        "rounded-lg border border-line border-l-[3px] bg-surface",
        ENVIRONMENT_TYPE_RAIL[group.type],
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm text-ink">{label}</h3>
            <span className="rounded-full bg-tint-neutral px-1.5 py-0.5 text-xs text-ink-muted tabular-nums">
              {count}
            </span>
          </div>
          <p className="text-xs text-ink-muted">{DESCRIPTIONS[group.type]}</p>
        </div>

        <Button size="sm" icon="plus" onClick={() => onCreate(group.type)}>
          Add
        </Button>
      </header>

      <div className="flex flex-col gap-2 p-4">
        {count === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-muted">
            Nothing in {label.toLowerCase()} yet.
          </p>
        ) : (
          <>
            {group.rows.map((row) => (
              <PairRow
                key={row.application.id}
                application={resolve(row.application)}
                database={row.database ? resolve(row.database) : null}
                {...tileProps}
                onPair={onPair}
              />
            ))}

            {/* A database nobody claimed. Not an error and not hidden: FR-3.6
                allows a database to stand alone, and a Neon branch that has
                lost its application is exactly the thing you want to see. */}
            {group.orphanDatabases.map((summary) => (
              <div key={summary.id} className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr]">
                <div className="hidden lg:block" aria-hidden="true" />
                <div className="hidden lg:block" aria-hidden="true" />
                <EnvironmentTile environment={resolve(summary)} {...tileProps} />
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
};

/**
 * The `app ── database` row. CSS Grid rather than flex, so the connector column
 * is the same width on every row and the database tiles line up down the card
 * regardless of how long the application names are — which is the whole visual
 * argument for the layout.
 */
const PairRow = ({
  application,
  database,
  onEdit,
  onPair,
  onUnpair,
  onDelete,
}: {
  application: EnvironmentResponse;
  database: EnvironmentResponse | null;
  onEdit: (environment: EnvironmentResponse) => void;
  onPair: (environment: EnvironmentResponse) => void;
  onUnpair: (environment: EnvironmentResponse) => void;
  onDelete: (environment: EnvironmentResponse) => void;
}) => (
  <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[1fr_auto_1fr] lg:gap-3">
    <EnvironmentTile
      environment={application}
      onEdit={onEdit}
      onPair={onPair}
      onUnpair={onUnpair}
      onDelete={onDelete}
    />

    <Connector paired={database !== null} />

    {database ? (
      <EnvironmentTile
        environment={database}
        onEdit={onEdit}
        onPair={onPair}
        onUnpair={onUnpair}
        onDelete={onDelete}
      />
    ) : (
      <DatabaseSlot application={application} onPair={onPair} />
    )}
  </div>
);

/**
 * Solid when the pair exists, dashed when it does not — so the connector says
 * the same thing as the slot beside it rather than drawing a line to nothing.
 * A rule below `lg`, where the tiles stack, and a vertical stub above it.
 */
const Connector = ({ paired }: { paired: boolean }) => (
  <div aria-hidden="true" className="flex items-center justify-center lg:w-8">
    <span
      className={cn(
        "block h-px w-8 lg:w-full",
        paired ? "border-t border-line" : "border-t border-dashed border-line",
      )}
    />
  </div>
);

/**
 * FR-3.15's dashed empty slot. It is a button, not decoration: "this
 * application has no database" is only useful if the next thing you can do is
 * give it one.
 */
const DatabaseSlot = ({
  application,
  onPair,
}: {
  application: EnvironmentResponse;
  onPair: (environment: EnvironmentResponse) => void;
}) => (
  <button
    type="button"
    onClick={() => onPair(application)}
    // Every row on the card would otherwise be a button reading "Pair a
    // database", which is three identical names in the accessibility tree.
    aria-label={`Pair a database with ${application.name}`}
    className={cn(
      "flex min-h-[84px] min-w-0 items-center justify-center gap-1.5 rounded-lg",
      "border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted",
      "transition-colors duration-150 ease-enter hover:border-accent hover:text-accent",
    )}
  >
    <Icon name="database" size={14} />
    Pair a database
  </button>
);
