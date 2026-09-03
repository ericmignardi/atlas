import { useState } from "react";

import { cn } from "@/lib/cn";
import { labelFor } from "@/lib/design";
import { eligiblePartners } from "@/lib/environmentPairing";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { PlatformBadge } from "@/components/ui/Badge";
import type { EnvironmentResponse } from "@/types/api";

/**
 * FR-3.7 – FR-3.11, made visible.
 *
 * The four invariants — same project, same type, not itself, and one partner
 * each — are enforced by the server, which answers a breach with a 409 and a
 * reason code. This dialog **filters the list to eligible candidates only**, so
 * the rules are legible in the interface rather than discoverable by being told
 * no. The server still checks, because a filtered dropdown is a convenience and
 * never a security boundary.
 *
 * The fourth invariant is the one that cannot be filtered away, only explained:
 * a candidate that is already paired is still offered, because re-pairing it is
 * a legitimate thing to want. It carries the consequence on the row — "currently
 * paired with X" — so the release is something the user chose rather than
 * something they discovered afterwards (FR-3.11).
 */

interface PairDialogProps {
  open: boolean;
  /** The environment being paired *from*. Its project and type set the filter. */
  source: EnvironmentResponse | undefined;
  /** Every environment in the project, from which the eligible set is derived. */
  candidates: readonly EnvironmentResponse[];
  onCancel: () => void;
  onConfirm: (targetId: string) => Promise<void>;
}

export const PairDialog = ({ open, source, candidates, onCancel, onConfirm }: PairDialogProps) => {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  if (!open || !source) return null;

  const eligible = eligiblePartners(source, candidates);
  const wanted = source.isDatabase ? "application" : "database";

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onConfirm(selected);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={`Pair ${source.name}`}
      description={`Only ${labelFor.environmentType(source.type).toLowerCase()} ${wanted} environments in this project can be paired with it.`}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!selected} loading={busy}>
            Pair
          </Button>
        </>
      }
    >
      {eligible.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-secondary">
          There is no {labelFor.environmentType(source.type).toLowerCase()} {wanted} in this project
          to pair with. Create one first — a pairing has to be between two environments of the same
          type.
        </p>
      ) : (
        <ul role="radiogroup" aria-label="Eligible partners" className="flex flex-col gap-1.5">
          {eligible.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected === candidate.id}
                data-autofocus={candidate.id === eligible[0].id ? "" : undefined}
                onClick={() => setSelected(candidate.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left",
                  "transition-colors duration-150 ease-enter",
                  selected === candidate.id
                    ? "border-accent bg-tint-blue"
                    : "border-line hover:border-ink-muted/40",
                )}
              >
                <Icon
                  name={candidate.isDatabase ? "database" : "environments"}
                  size={15}
                  className={candidate.isDatabase ? "text-teal-600" : "text-ink-muted"}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-ink">{candidate.name}</span>
                  {candidate.pairedWith && (
                    <span className="truncate text-xs text-amber-600">
                      Currently paired with {candidate.pairedWith.name} — pairing it here releases
                      that.
                    </span>
                  )}
                </span>
                <span className="ml-auto shrink-0">
                  <PlatformBadge platform={candidate.platform} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};
