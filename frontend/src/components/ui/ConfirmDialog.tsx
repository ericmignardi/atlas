import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  /**
   * FR-8.2 has two clauses and they are both required. `title` names the object
   * — "Delete Atlas", not "Are you sure?" — and `consequence` states what will
   * happen in the same words the data model would use: what cascades, what
   * survives, what cannot be undone. A confirmation that says neither is a
   * speed bump, and users learn to click through speed bumps without reading.
   */
  title: string;
  consequence: string;
  confirmLabel?: string;
  /** Non-destructive confirmations exist too — discarding an edit, say. */
  tone?: "danger" | "primary";
}

export const ConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
  title,
  consequence,
  confirmLabel = "Delete",
  tone = "danger",
}: ConfirmDialogProps) => {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={title}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-secondary">{consequence}</p>
    </Modal>
  );
};
