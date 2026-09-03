import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { IconButton } from "@/components/ui/Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Buttons for the bottom rule. Primary action last, matching platform order. */
  footer?: ReactNode;
  /** 560 px is the default (§9.1); `wide` is for a form with two columns. */
  size?: "default" | "wide";
  children: ReactNode;
}

/**
 * NFR-4.5 in one component: focus is trapped, Escape closes, and focus returns
 * to whatever opened it. Doing that per-dialog is how a codebase ends up with
 * three of the four behaviours in most places and all four in none.
 *
 * `aria-modal` does not, on its own, trap anything — it tells assistive
 * technology to treat everything outside this node as inert, which is why the
 * keyboard trap has to be implemented separately for it to be true.
 */
export const Modal = ({
  open,
  onClose,
  title,
  description,
  footer,
  size = "default",
  children,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, onClose);

  // A dialog over a scrolling page that still scrolls behind it feels broken,
  // and on a short viewport the backdrop scrolls away from under the dialog.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6 pt-[10vh]">
      {/* Presentational: the dialog owns the Escape key, and a screen reader
          should never be offered "click the backdrop" as a way out. */}
      <div
        className="fixed inset-0 bg-ink/25 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-xl border border-line bg-surface shadow-modal animate-modal-enter",
          size === "wide" ? "max-w-[720px]" : "max-w-[560px]",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-1">
            <h2 id="modal-title" className="text-lg text-ink">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="text-sm text-ink-secondary">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
        </header>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
