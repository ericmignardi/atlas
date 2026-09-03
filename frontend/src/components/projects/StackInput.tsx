import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * FR-2.9's tech stack: free text, Enter commits a chip, 24 items maximum.
 *
 * The cap is enforced here *and* by `projectCreateSchema` *and* by
 * `@Size(max = 24)` on the server. That is not redundancy for its own sake — the
 * input's job is to make the limit visible before it is reached, the schema's is
 * to catch a paste that skips the keyboard entirely, and the server's is that
 * neither of the first two is running when the request arrives.
 *
 * Deduplicated on commit, case-insensitively, so "React" and "react" cannot both
 * end up in the row. The value stored is what the user typed the first time.
 */

const MAX_ITEMS = 24;

interface StackInputProps {
  value: string[];
  onChange: (items: string[]) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export const StackInput = ({ value, onChange, id, ...aria }: StackInputProps) => {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const full = value.length >= MAX_ITEMS;

  const commit = (raw: string) => {
    const entry = raw.trim();
    if (!entry || full) return;
    const clash = value.some((item) => item.toLowerCase() === entry.toLowerCase());
    if (!clash) onChange([...value, entry]);
    setDraft("");
  };

  const remove = (index: number) => {
    onChange(value.filter((_, position) => position !== index));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Comma as well as Enter: "React, TypeScript, Postgres" is how a stack is
    // written down everywhere else, and pasting it should not need re-typing.
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      remove(value.length - 1);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5",
          "transition-colors duration-150 ease-enter focus-within:border-accent",
          aria["aria-invalid"] && "border-red-600",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item, index) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken px-2 py-0.5 font-mono text-mono-sm text-ink-secondary"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove ${item}`}
              className="-mr-0.5 rounded-full opacity-60 transition-opacity hover:opacity-100"
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}

        <input
          {...aria}
          ref={inputRef}
          id={id}
          value={draft}
          disabled={full}
          autoComplete="off"
          placeholder={full ? "" : value.length === 0 ? "React, Postgres, Docker…" : ""}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          // Committing on blur as well as on Enter: a half-typed entry that
          // vanishes when you click Save is a bug report, however defensible.
          onBlur={() => commit(draft)}
          className="min-w-[140px] flex-1 bg-transparent font-mono text-mono-sm text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:text-ink-muted disabled:cursor-not-allowed"
        />
      </div>

      {/* Visible before it matters, not only once it bites. */}
      <p
        className={cn("self-end text-xs tabular-nums", full ? "text-amber-600" : "text-ink-muted")}
      >
        {value.length} / {MAX_ITEMS}
      </p>
    </div>
  );
};
