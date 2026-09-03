import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";

import { cn } from "@/lib/cn";
import { search as searchApi } from "@/lib/searchApi";
import { ENVIRONMENT_TYPE, PLATFORM, PROJECT_STATUS, TASK_STATUS } from "@/lib/design";
import { useApi } from "@/hooks/useApi";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { usePrefsStore, type QuickAddType } from "@/stores/prefsStore";
import { useUiStore } from "@/stores/uiStore";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/states";

/**
 * FR-7.1 – FR-7.5. 640 px, 120 px from the top, entering with an 8 px
 * **downward** translate — the one place in Atlas where motion comes down the
 * screen (§9.1). The palette arrives from above; a modal rises into place.
 *
 * ── One flat list, rendered in groups ─────────────────────────────────────
 *
 * The obvious shape is three arrays in three sections, each with its own index.
 * Then `↓` at the bottom of Projects has to know that Environments exists and
 * might be empty, and every navigation key becomes a special case.
 *
 * So the groups are a *rendering* concern only: everything is flattened into one
 * ordered array, the cursor is a single integer into it, and a group header is
 * drawn wherever an item's group differs from the previous one's. Arrow keys
 * then move by one, always, and an empty group simply is not there.
 *
 * ── Create actions are pinned last, and always present ────────────────────
 *
 * FR-7.4 puts three "Create…" rows in the palette. They sit at the end rather
 * than mixed in, because they answer "this does not exist yet" — and they stay
 * when a search returns nothing, which is exactly when that answer is useful.
 */

/** FR-7.5: fast enough to feel live, slow enough that a five-letter word is one request. */
const DEBOUNCE_MS = 120;

type PaletteGroup = "Projects" | "Environments" | "Tasks" | "Create";

interface PaletteItem {
  id: string;
  group: PaletteGroup;
  icon: IconName;
  /** The part of the row the query is highlighted inside. */
  label: string;
  /** Secondary text: a client, a project name, a platform. Never matched against. */
  hint?: string;
  /** A status word on the right. NFR-4.4: the label carries it, not a colour. */
  meta?: string;
  run: () => void;
}

export const CommandPalette = () => {
  const open = useUiStore((state) => state.paletteOpen);
  // Unmounted while closed, so every piece of state below resets on open and
  // nothing has to remember to clear "what you typed last time".
  return open ? <Palette /> : null;
};

const Palette = () => {
  const navigate = useNavigate();
  const close = useUiStore((state) => state.closePalette);
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);
  const setLastQuickAddType = usePrefsStore((state) => state.setLastQuickAddType);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const settled = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Where the pointer last actually was — see `onPointerMove` for what this is
   * defending against.
   */
  const pointer = useRef({ x: -1, y: -1 });
  useFocusTrap(panelRef, true, close);

  /**
   * Switched off for an empty query rather than fetching everything. The server
   * answers a blank `q` with three empty groups, so the request would be a round
   * trip for an answer the client already has — and it would fire on the
   * keystroke that clears the box, which is when nobody is waiting for one.
   */
  const results = useApi(() => searchApi(settled), [settled], { enabled: settled.length > 0 });

  const items = useMemo<PaletteItem[]>(() => {
    const go = (to: string) => {
      close();
      void navigate(to);
    };

    const create = (type: QuickAddType) => {
      // FR-6.6: creating from the palette counts as "the last type used", so the
      // next ⌘N offers the same thing.
      setLastQuickAddType(type);
      openQuickAdd(type);
    };

    const found = results.data;
    const rows: PaletteItem[] = [];

    for (const project of found?.projects ?? []) {
      rows.push({
        id: "project-" + project.id,
        group: "Projects",
        icon: "projects",
        label: project.name,
        hint: project.client ?? undefined,
        meta: PROJECT_STATUS[project.status].label,
        run: () => go("/projects/" + project.slug),
      });
    }

    for (const environment of found?.environments ?? []) {
      rows.push({
        id: "environment-" + environment.id,
        group: "Environments",
        icon: environment.platform === "NEON" ? "database" : "environments",
        label: environment.name,
        hint: environment.project.name + " · " + PLATFORM[environment.platform].label,
        meta: ENVIRONMENT_TYPE[environment.type].label,
        // An environment has no page of its own; it lives on its project's map.
        run: () => go("/environments?project=" + encodeURIComponent(environment.project.slug)),
      });
    }

    for (const task of found?.tasks ?? []) {
      rows.push({
        id: "task-" + task.id,
        group: "Tasks",
        icon: "tasks",
        label: task.title,
        hint: task.project?.name ?? "Unassigned",
        meta: TASK_STATUS[task.status].label,
        // A task has no page either: the list opens it for editing (§8.3).
        run: () => go("/tasks?task=" + task.id),
      });
    }

    rows.push(
      {
        id: "create-project",
        group: "Create",
        icon: "plus",
        label: "Create a project",
        run: () => create("project"),
      },
      {
        id: "create-environment",
        group: "Create",
        icon: "plus",
        label: "Create an environment",
        run: () => create("environment"),
      },
      {
        id: "create-task",
        group: "Create",
        icon: "plus",
        label: "Create a task",
        run: () => create("task"),
      },
    );

    return rows;
  }, [results.data, close, navigate, openQuickAdd, setLastQuickAddType]);

  const matchCount = items.filter((item) => item.group !== "Create").length;

  /**
   * Two separate problems, and neither of them is an effect.
   *
   * Typing means "start again from the top", so the cursor is reset by the
   * keystroke that caused it — in `onChange`, where the intent actually is.
   *
   * Results arriving 120 ms later can *shrink* the list under a cursor that is
   * already past its new end, and that has no user action behind it at all. So
   * it is clamped during render: a derived value, not a state write, which is
   * why there is no effect here resetting state and re-rendering to fix itself.
   */
  const activeIndex = Math.min(active, items.length - 1);

  /**
   * "The list scrolls to keep the selection visible." `block: "nearest"` is the
   * whole trick — it moves the container only when the row is actually out of
   * view, so walking down a short list does not jerk it about.
   */
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex]);

  /**
   * Hover moves the cursor, but **only when the mouse actually moved**.
   *
   * Scrolling a list under a stationary pointer makes Chrome fire a synthetic
   * `mousemove` so that `:hover` stays correct — which meant every arrow key
   * that scrolled the list handed the selection straight back to whatever row
   * happened to slide under the cursor. Holding ↓ walked two rows and stopped,
   * and Enter opened something the user had not chosen. Comparing the
   * coordinates is what tells a real mouse movement from that echo.
   */
  const onPointerMove = (index: number, event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.clientX === pointer.current.x && event.clientY === pointer.current.y) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    setActive(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // ⌘K reaches the palette but not the global handler, which suppresses
    // shortcuts while a text input has focus (FR-7.7). Handling it here is what
    // makes the binding symmetrical: the same keys that opened it close it.
    if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      // Wraps both ways: on a list this short the far end is closer than
      // scrolling back through the middle.
      setActive((activeIndex + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + items.length) % items.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      items[activeIndex]?.run();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-6 pt-[120px]">
      <div className="fixed inset-0 bg-ink/25 animate-fade-in" onClick={close} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex w-full max-w-[640px] flex-col overflow-hidden rounded-xl",
          "border border-line bg-surface shadow-modal animate-palette-enter",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" size={17} className="shrink-0 text-ink-muted" />
          <input
            data-autofocus
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Search projects, environments and tasks…"
            aria-label="Search"
            /* The combobox pattern: focus stays in the field so typing keeps
               working, and `aria-activedescendant` is what tells assistive
               technology which row the cursor is on. */
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[activeIndex]?.id}
            autoComplete="off"
            spellCheck={false}
            className="h-12 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </div>

        <div
          ref={listRef}
          id="palette-list"
          role="listbox"
          aria-label="Results"
          className="max-h-[min(56vh,420px)] overflow-y-auto p-1.5"
        >
          {results.isLoading ? (
            <div className="flex flex-col gap-1 p-1" aria-hidden="true">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-9" />
              ))}
            </div>
          ) : results.error ? (
            /* §9.7's error state at palette scale: plain language, and the
               Create rows underneath still work. */
            <p role="alert" className="px-2.5 py-3 text-sm text-ink-secondary">
              {results.error.message}
            </p>
          ) : settled.length > 0 && matchCount === 0 ? (
            <p className="px-2.5 py-3 text-sm text-ink-secondary">
              Nothing matches “{settled}”.
            </p>
          ) : null}

          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              query={settled}
              active={index === activeIndex}
              /* Headers come out of the flat list, where the group changes — so
                 an empty group leaves no orphaned header behind. */
              showHeader={index === 0 || items[index - 1].group !== item.group}
              onHover={(event) => onPointerMove(index, event)}
              onSelect={item.run}
            />
          ))}
        </div>

        <footer className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-muted">
          <span aria-live="polite">
            {settled.length === 0
              ? "Type to search"
              : matchCount === 1
                ? "1 result"
                : matchCount + " results"}
          </span>
          <span className="flex items-center gap-3">
            <Hint keys="↑ ↓" action="move" />
            <Hint keys="↵" action="open" />
            <Hint keys="esc" action="close" />
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

const Hint = ({ keys, action }: { keys: string; action: string }) => (
  <span className="flex items-center gap-1">
    <kbd className="rounded-sm border border-line bg-surface-sunken px-1 py-0.5 font-sans text-xs text-ink-secondary">
      {keys}
    </kbd>
    {action}
  </span>
);

interface RowProps {
  item: PaletteItem;
  query: string;
  active: boolean;
  showHeader: boolean;
  onHover: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onSelect: () => void;
}

const Row = ({ item, query, active, showHeader, onHover, onSelect }: RowProps) => (
  <>
    {showHeader && (
      <p className="px-2.5 pb-1 pt-2.5 text-eyebrow uppercase text-ink-muted" aria-hidden="true">
        {item.group}
      </p>
    )}
    <div
      id={item.id}
      role="option"
      aria-selected={active}
      data-active={active}
      /* Hover moves the cursor rather than drawing a second highlight. Two
         "selected" rows at once is the classic palette bug, and it makes Enter
         ambiguous to anyone reading the screen. */
      onMouseMove={onHover}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
        active ? "bg-tint-blue text-ink" : "text-ink-secondary",
      )}
    >
      <Icon name={item.icon} size={15} className={active ? "text-accent" : "text-ink-muted"} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate">
          <Highlight text={item.label} query={query} />
        </span>
        {item.hint && <span className="shrink-0 truncate text-xs text-ink-muted">{item.hint}</span>}
      </span>
      {item.meta && <span className="shrink-0 text-xs text-ink-muted">{item.meta}</span>}
    </div>
  </>
);

/**
 * FR-7.5. The matched substring, in amber.
 *
 * Only the first occurrence is marked. Marking every one turns a row like
 * "Atlas atlas atlas" into a stripe, and the highlight exists to show *why* this
 * row is in the list — which the first hit already does.
 */
const Highlight = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;

  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, at)}
      {/* `mark` is the right element for a search hit, but its user-agent yellow
          would be the one untokenised colour on the screen. */}
      <mark className="bg-transparent font-semibold text-amber-600">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
};
