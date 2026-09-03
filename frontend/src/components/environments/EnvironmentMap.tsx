import { useCallback, useMemo, useState } from "react";

import { isApiError } from "@/lib/apiClient";
import {
  deleteEnvironment,
  groupedEnvironments,
  listEnvironments,
  pairEnvironments,
  unpairEnvironment,
} from "@/lib/environmentsApi";
import { useApi } from "@/hooks/useApi";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { EnvironmentFormModal } from "@/components/environments/EnvironmentFormModal";
import { EnvironmentGroupCard } from "@/components/environments/EnvironmentGroupCard";
import { PairDialog } from "@/components/environments/PairDialog";
import {
  ENVIRONMENT_TYPES,
  type EnvironmentResponse,
  type EnvironmentSummary,
  type EnvironmentType,
  type GroupedEnvironments,
} from "@/types/api";

/**
 * §8.1 and §8.4. The environment map for one project, written as a component
 * that takes a `projectId` rather than as a page — because it is needed twice,
 * on `/environments` and on the project detail tab, and the second one is not a
 * port of the first.
 *
 * ── Two requests, one screen ──────────────────────────────────────────────
 *
 * `/environments/grouped` is the authority on *shape*: which application claims
 * which database, in which direction, which databases are left over, and the
 * fixed order of the three type groups (FR-3.5, FR-3.15). None of that is
 * re-derived here — the arithmetic exists on the server and a second copy in
 * the browser would be a second copy to get wrong.
 *
 * But it answers in `EnvironmentSummary`: id, name, platform, branch. A tile
 * also shows the URL, the notes indicator, and a menu that needs the type. So
 * `/environments?projectId=` is fetched alongside it, in parallel, and each
 * summary is looked up by id. Shape from one, detail from the other.
 *
 * ── Why every mutation refetches ──────────────────────────────────────────
 *
 * Elsewhere in Atlas a mutation's response is folded back into the cache and
 * nothing is re-read. That is wrong here, and pairing is the reason: pairing A
 * with B releases A's old partner *and* B's old partner (FR-3.11), so a single
 * operation can change four rows while the response describes two. Folding in
 * the two we were told about would leave a third tile on screen still claiming a
 * partner that no longer exists — the exact dangling reference the invariant is
 * there to prevent, reintroduced in the client.
 */

interface EnvironmentMapProps {
  projectId: string;
  /** The project's name, for the delete confirmation and the empty state. */
  projectName: string;
}

interface MapData {
  grouped: GroupedEnvironments;
  list: EnvironmentResponse[];
}

export const EnvironmentMap = ({ projectId, projectName }: EnvironmentMapProps) => {
  const environments = useApi<MapData>(
    async () => {
      const [grouped, list] = await Promise.all([
        groupedEnvironments(projectId),
        listEnvironments(projectId),
      ]);
      return { grouped, list };
    },
    [projectId],
    { enabled: Boolean(projectId) },
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnvironmentResponse | undefined>(undefined);
  const [createType, setCreateType] = useState<EnvironmentType>("PRODUCTION");
  const [pairing, setPairing] = useState<EnvironmentResponse | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<EnvironmentResponse | undefined>(undefined);

  const list = useMemo(() => environments.data?.list ?? [], [environments.data]);

  const byId = useMemo(
    () => new Map(list.map((environment) => [environment.id, environment])),
    [list],
  );

  /**
   * The two requests are issued together but answered separately, so there is a
   * window in which one has a row the other does not — a create that lands
   * between them, say. Rather than let a tile vanish, an unresolved summary is
   * widened into a record with the fields it does carry and empty ones for the
   * rest. It is a torn read at worst, and the next refetch settles it.
   */
  const resolve = useCallback(
    (summary: EnvironmentSummary): EnvironmentResponse =>
      byId.get(summary.id) ?? {
        id: summary.id,
        projectId,
        name: summary.name,
        platform: summary.platform,
        type: "PRODUCTION",
        branch: summary.branch,
        url: null,
        notes: null,
        isDatabase: summary.platform === "NEON",
        pairedWith: null,
        createdAt: "",
        updatedAt: "",
      },
    [byId, projectId],
  );

  const reload = useCallback(() => environments.refetch(), [environments]);

  const openCreate = (type: EnvironmentType) => {
    setEditing(undefined);
    setCreateType(type);
    setFormOpen(true);
  };

  const openEdit = (environment: EnvironmentResponse) => {
    setEditing(environment);
    setFormOpen(true);
  };

  const confirmPair = useCallback(
    async (targetId: string) => {
      if (!pairing) return;
      try {
        const result = await pairEnvironments(pairing.id, targetId);
        await reload();
        toast.success(
          result.partner
            ? result.environment.name + " paired with " + result.partner.name
            : result.environment.name + " paired",
        );
        setPairing(undefined);
      } catch (error) {
        // The dialog only ever offers eligible candidates, so a 409 here means
        // the data moved under the dialog — another tab, or a stale list. The
        // reason code is the useful part, and the server writes it in English.
        toast.error(
          "Could not pair those environments",
          isApiError(error) ? error.message : "Try again in a moment.",
        );
      }
    },
    [pairing, reload],
  );

  const unpair = useCallback(
    async (environment: EnvironmentResponse) => {
      try {
        await unpairEnvironment(environment.id);
        await reload();
        toast.success(environment.name + " unpaired");
      } catch (error) {
        toast.error(
          "Could not unpair that environment",
          isApiError(error) ? error.message : "Try again in a moment.",
        );
      }
    },
    [reload],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteEnvironment(pendingDelete.id);
      await reload();
      toast.success(pendingDelete.name + " deleted");
    } catch (error) {
      toast.error(
        "Could not delete that environment",
        isApiError(error) ? error.message : "Try again in a moment.",
      );
    } finally {
      setPendingDelete(undefined);
    }
  }, [pendingDelete, reload]);

  if (environments.isLoading) return <MapSkeleton />;

  if (environments.error) {
    return <ErrorState message={environments.error.message} onRetry={() => void reload()} />;
  }

  const groups = environments.data?.grouped.groups ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* The three cards are a fixed frame (FR-3.5), so they render even when
          empty — but an account's first visit deserves a sentence rather than
          three empty boxes and no explanation. */}
      {list.length === 0 && (
        <EmptyState
          icon="environments"
          title={"No environments for " + projectName + " yet"}
          description="An environment is one place this project runs: a Vercel deployment, a Neon branch, your own machine. Add an application and a database of the same type, pair them, and the map draws the link."
          action={
            <Button variant="primary" icon="plus" onClick={() => openCreate("PRODUCTION")}>
              Add an environment
            </Button>
          }
        />
      )}

      {ENVIRONMENT_TYPES.map((type) => {
        const group = groups.find((candidate) => candidate.type === type);
        return (
          <EnvironmentGroupCard
            key={type}
            group={group ?? { type, rows: [], orphanDatabases: [] }}
            resolve={resolve}
            onEdit={openEdit}
            onPair={setPairing}
            onUnpair={(environment) => void unpair(environment)}
            onDelete={setPendingDelete}
            onCreate={openCreate}
          />
        );
      })}

      <EnvironmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        projectId={projectId}
        environment={editing}
        defaultType={createType}
        onSaved={() => void reload()}
      />

      <PairDialog
        open={pairing !== undefined}
        source={pairing}
        candidates={list}
        onCancel={() => setPairing(undefined)}
        onConfirm={confirmPair}
      />

      {/* FR-8.2: what goes, and what survives. FR-3.13 is the interesting half —
          the partner is released rather than deleted, and saying so is the
          difference between a confirmation and a speed bump. */}
      <ConfirmDialog
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
        title={"Delete " + (pendingDelete?.name ?? "environment") + "?"}
        consequence={
          pendingDelete?.pairedWith
            ? pendingDelete.pairedWith.name +
              " is not deleted with it — it stays in " +
              projectName +
              ", unpaired. This cannot be undone."
            : "It is removed from " + projectName + ". This cannot be undone."
        }
      />
    </div>
  );
};

/** §9.7: matched geometry — three cards, laid out by the same rule as the real one. */
const MapSkeleton = () => (
  <div className="flex flex-col gap-4" aria-hidden="true">
    {[0, 1, 2].map((index) => (
      <div key={index} style={{ opacity: Math.max(0.35, 1 - index * 0.22) }}>
        <Skeleton className="h-[196px]" />
      </div>
    ))}
  </div>
);
