import { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useUiStore, type Toast as ToastModel, type ToastTone } from "@/stores/uiStore";

const TONE: Record<ToastTone, { icon: IconName; className: string }> = {
  success: { icon: "success", className: "text-green-600" },
  error: { icon: "error", className: "text-red-600" },
  info: { icon: "info", className: "text-accent" },
};

/** Long enough to read a sentence; failures stay until dismissed, so they can be read twice. */
const DISMISS_AFTER_MS = 5000;

const ToastRow = ({ toast }: { toast: ToastModel }) => {
  const dismiss = useUiStore((state) => state.dismissToast);
  const tone = TONE[toast.tone];

  useEffect(() => {
    // An error is the one thing worth interrupting for, and it usually carries a
    // reason the user needs to act on. It waits for a click.
    if (toast.tone === "error") return;
    const timer = setTimeout(() => dismiss(toast.id), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, dismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-[360px] items-start gap-2.5 rounded-lg border border-line",
        "bg-surface px-3.5 py-3 shadow-overlay animate-toast-enter",
      )}
    >
      <Icon name={tone.icon} size={16} className={cn("mt-0.5", tone.className)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm text-ink">{toast.message}</p>
        {toast.detail && <p className="text-xs text-ink-muted">{toast.detail}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="rounded-sm text-ink-muted transition-colors hover:text-ink"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
};

/**
 * FR-8.3. Mounted once, near the root; every mutation everywhere feeds it
 * through `toast.success(…)` / `toast.error(…)` rather than rendering its own.
 *
 * `aria-live="polite"` on the region means a screen reader announces each toast
 * when it is idle rather than cutting off whatever it was saying — the same
 * reasoning as the field errors. `role="status"` gives it the implicit
 * politeness for the browsers that need it spelled out.
 */
export const ToastViewport = () => {
  const toasts = useUiStore((state) => state.toasts);

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-60 flex flex-col-reverse gap-2"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
};
