import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/Button";

/**
 * The "…" row menu. Three or four actions that do not each deserve a button:
 * open the live site, pin, delete.
 *
 * Not a portal, unlike Modal. A row menu is anchored to its trigger and has to
 * move with it when the list scrolls; portalling it to the body means
 * re-measuring on every scroll frame, which is the price a floating-element
 * library exists to pay. Absolutely positioned against the trigger, the browser
 * does it for free — the cost is that an ancestor with `overflow: hidden` would
 * clip it, so the card that hosts one does not have that.
 */

export interface MenuAction {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** Red text. The confirmation still happens — this is the warning, not the guard. */
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  label: string;
  actions: MenuAction[];
  align?: "left" | "right";
  /** For a trigger that is not the default "…" button. */
  trigger?: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
}

export const Menu = ({ label, actions, align = "right", trigger }: MenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  /**
   * Two ways out, both required. `pointerdown` rather than `click`, so the menu
   * is gone before the click lands on whatever is underneath — otherwise
   * clicking a card behind an open menu both closes the menu and opens the card.
   */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Opening with the keyboard has to land somewhere, or Tab walks the rest of
  // the page while a menu sits open behind the cursor.
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const select = (action: MenuAction) => {
    setOpen(false);
    action.onSelect();
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger ? (
        trigger({ onClick: () => setOpen((value) => !value), "aria-expanded": open })
      ) : (
        <IconButton
          icon="more"
          label={label}
          size="sm"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
        />
      )}

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "absolute top-full z-40 mt-1 min-w-[176px] rounded-md border border-line bg-surface p-1",
            "shadow-overlay animate-fade-in",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => select(action)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                "transition-colors duration-150 ease-enter",
                "disabled:cursor-not-allowed disabled:opacity-55",
                action.danger
                  ? "text-red-600 hover:bg-tint-red"
                  : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {action.icon && <Icon name={action.icon} size={14} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
