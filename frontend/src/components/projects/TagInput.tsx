import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { createTag } from "@/lib/tagsApi";
import { TINT_CLASSES, tintForColor } from "@/lib/design";
import { toast } from "@/stores/uiStore";
import { Icon } from "@/components/ui/Icon";
import { TagChip } from "@/components/ui/TagChip";
import type { TagResponse, TagSummary } from "@/types/api";

/**
 * FR-5.10. Autocomplete over the tags that exist, plus an inline "Create *name*"
 * row for one that does not.
 *
 * Built on a plain text input inside a chip well rather than a `<select
 * multiple>`: the native control cannot show a colour, cannot offer to create a
 * value that is not in its list, and on every platform looks like nothing else
 * in the form.
 *
 * Names are lowercased before they are compared or sent, matching what the
 * server persists (FR-5.2) — so typing "React" when `react` exists offers the
 * existing tag rather than a second one that differs only in case.
 */

interface TagInputProps {
  /** The tags currently on the project. Controlled — the form owns the array. */
  value: TagSummary[];
  onChange: (tags: TagSummary[]) => void;
  /** Every tag on the account, for the suggestion list. */
  available: readonly TagResponse[];
  /** Called when a tag is created here, so the page can fold it into its own list. */
  onCreated?: (tag: TagResponse) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export const TagInput = ({ value, onChange, available, onCreated, id, ...aria }: TagInputProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();
  const selectedIds = useMemo(() => new Set(value.map((tag) => tag.id)), [value]);

  const suggestions = useMemo(
    () =>
      available
        .filter((tag) => !selectedIds.has(tag.id))
        .filter((tag) => (needle ? tag.name.includes(needle) : true))
        .slice(0, 8),
    [available, selectedIds, needle],
  );

  /**
   * The Create row appears only when the typed name is not already a tag —
   * including one already on this project, where offering to create it would be
   * a second row for something visible two lines above.
   */
  const exists = available.some((tag) => tag.name === needle);
  const canCreate = needle.length > 0 && !exists;

  const add = (tag: TagSummary) => {
    if (!selectedIds.has(tag.id)) onChange([...value, tag]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (tag: TagSummary) => {
    onChange(value.filter((candidate) => candidate.id !== tag.id));
    inputRef.current?.focus();
  };

  const create = async () => {
    setCreating(true);
    try {
      // FR-5.3: an existing name comes back as the existing tag with a 200, so a
      // race against another tab cannot produce a duplicate here.
      const tag = await createTag({ name: needle });
      onCreated?.(tag);
      add(tag);
    } catch {
      toast.error("Could not create that tag", "It was not added to the project.");
    } finally {
      setCreating(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // FR-5.10: Backspace on an empty input removes the last chip. The empty
    // check is what stops it from eating a chip while the user is mid-word.
    if (event.key === "Backspace" && query === "" && value.length > 0) {
      event.preventDefault();
      remove(value[value.length - 1]);
      return;
    }

    if (event.key === "Enter") {
      // Enter inside a tag input means "take the first suggestion", never
      // "submit the project form" — the form has ⌘Enter for that (FR-7.6).
      event.preventDefault();
      if (suggestions.length > 0) {
        add(suggestions[0]);
      } else if (canCreate && !creating) {
        void create();
      }
      return;
    }

    if (event.key === "Escape" && open) {
      // Stopped here, or the dialog around the form closes as well and the user
      // loses everything they typed for the sake of dismissing a dropdown.
      event.stopPropagation();
      setOpen(false);
    }
  };

  const showMenu = open && (suggestions.length > 0 || canCreate);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5",
          "transition-colors duration-150 ease-enter focus-within:border-accent",
          aria["aria-invalid"] && "border-red-600",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <TagChip key={tag.id} tag={tag} onRemove={remove} />
        ))}

        <input
          {...aria}
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showMenu}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={value.length === 0 ? "Add tags…" : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A blur that fires before the click on a suggestion would close the
          // menu out from under the pointer. The delay is the ugly, reliable
          // fix; the alternative is tracking pointerdown on the list itself.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      {showMenu && (
        <ul
          role="listbox"
          className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-overlay animate-fade-in"
        >
          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => add(tag)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border",
                    TINT_CLASSES[tintForColor(tag.color)],
                  )}
                />
                <span className="flex-1 truncate">{tag.name}</span>
                <span className="text-xs tabular-nums text-ink-muted">{tag.usageCount}</span>
              </button>
            </li>
          ))}

          {canCreate && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                disabled={creating}
                onClick={create}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-accent transition-colors hover:bg-tint-blue disabled:opacity-55"
              >
                <Icon
                  name={creating ? "spinner" : "plus"}
                  size={14}
                  className={cn(creating && "animate-spin")}
                />
                Create <span className="font-medium">{needle}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
