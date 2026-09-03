import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

/**
 * A compound component: `Tabs` owns the selection, `Tabs.List`, `Tabs.Tab`, and
 * `Tabs.Panel` read it from context. The alternative — one component taking an
 * array of `{ id, label, content }` — cannot express a tab whose label carries a
 * count badge without growing a render prop for it, and the render prop is just
 * context with extra steps.
 *
 * Controlled, with no internal state at all. The project detail page keeps the
 * value in `?tab=` so a tab is linkable and survives a reload (§7.4), and a
 * component that also held its own copy would have two answers to "which tab is
 * open" the first time someone pressed Back.
 *
 * Keyboard behaviour follows the APG tabs pattern: arrows move between tabs,
 * Home and End jump to the ends, and only the selected tab is in the tab order,
 * so Tab from the list lands in the panel rather than walking every tab first.
 */

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`<Tabs.${component}> must be rendered inside <Tabs>`);
  }
  return context;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onChange, baseId }}>
      <div className={cn("flex flex-col gap-5", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

const TabsList = ({ children, className }: { children: ReactNode; className?: string }) => {
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Roving focus. The tabs are read out of the DOM rather than from a prop,
   * because the list's children are written as JSX by the caller and this
   * component has no other way to know how many there are or what order they
   * are in.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    if (tabs.length === 0) return;

    const current = tabs.findIndex((tab) => tab === document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : // Wrapping, which is what the pattern specifies: right from the last
            // tab lands on the first rather than doing nothing.
            (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;

    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn("flex items-center gap-1 border-b border-line", className)}
    >
      {children}
    </div>
  );
};

interface TabProps {
  id: string;
  children: ReactNode;
  /** Rendered as a muted pill after the label. Zero still shows — "0 tasks" is information. */
  count?: number;
}

const Tab = ({ id, children, count }: TabProps) => {
  const { value, onChange, baseId } = useTabs("Tab");
  const selected = value === id;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${id}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onChange(id)}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
        "transition-colors duration-150 ease-enter",
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-secondary hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
            selected ? "bg-tint-blue text-tint-blue-ink" : "bg-tint-neutral text-ink-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
};

/**
 * §9.6: a 200 ms cross-fade, opacity only. The unselected panel is unmounted
 * rather than hidden, so its content is not in the accessibility tree and its
 * requests are not made — and because nothing animates height, the page below
 * does not jump while the new panel fades in.
 */
const TabsPanel = ({ id, children }: { id: string; children: ReactNode }) => {
  const { value, baseId } = useTabs("Panel");
  if (value !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      // Focusable, per the APG pattern: Tab out of the tab list lands in the
      // panel rather than skipping past its content.
      tabIndex={0}
      className="animate-fade-in"
    >
      {children}
    </div>
  );
};

/**
 * The compound surface. Attached as properties on the function declaration
 * rather than assembled with `Object.assign`, because the latter produces a call
 * expression — and a module whose only export is a call expression reads to
 * tooling (Fast Refresh among others) as a module that exports something other
 * than a component.
 */
Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = TabsPanel;
