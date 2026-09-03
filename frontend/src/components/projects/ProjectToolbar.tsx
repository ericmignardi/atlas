import { cn } from "@/lib/cn";
import { labelFor } from "@/lib/design";
import type { ProjectFilterState, ProjectSortKey } from "@/lib/projectFilters";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Select } from "@/components/ui/Input";
import { PROJECT_STATUSES, type ProjectStatus, type TagResponse } from "@/types/api";

/**
 * §7.2's filter row, plus the two things that make a filter row honest: the
 * chips that say what is currently applied, and the count that says how much of
 * the list you are looking at.
 *
 * The search box is **uncontrolled by the filter state**. The page holds the raw
 * text and debounces it into `filters.query` 200 ms later; feeding the settled
 * value back into the input would make every keystroke wait for the debounce and
 * the field would feel broken. `search` is the live value, `filters.query` the
 * settled one, and they are deliberately different props.
 */

const STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({
  value: status,
  label: labelFor.projectStatus(status),
}));

const SORT_OPTIONS: { value: ProjectSortKey; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Recently created" },
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
];

interface ProjectToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: ProjectFilterState;
  onFilterChange: (patch: Partial<ProjectFilterState>) => void;
  onClear: () => void;
  clients: readonly string[];
  tags: readonly TagResponse[];
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  shown: number;
  total: number;
  filtered: boolean;
}

export const ProjectToolbar = ({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClear,
  clients,
  tags,
  view,
  onViewChange,
  shown,
  total,
  filtered,
}: ProjectToolbarProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Icon
          name="search"
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name, client, description…"
          aria-label="Search projects"
          className="pl-9"
        />
      </div>

      <Select
        options={STATUS_OPTIONS}
        placeholder="Any status"
        value={filters.status}
        aria-label="Filter by status"
        onChange={(event) => onFilterChange({ status: event.target.value as ProjectStatus | "" })}
        className="w-[150px]"
      />

      <Select
        options={clients.map((client) => ({ value: client, label: client }))}
        placeholder="Any client"
        value={filters.client}
        aria-label="Filter by client"
        onChange={(event) => onFilterChange({ client: event.target.value })}
        className="w-[160px]"
      />

      <Select
        options={tags.map((tag) => ({ value: tag.name, label: tag.name }))}
        placeholder="Any tag"
        value={filters.tag}
        aria-label="Filter by tag"
        onChange={(event) => onFilterChange({ tag: event.target.value })}
        className="w-[150px]"
      />

      <Select
        options={SORT_OPTIONS}
        value={filters.sort}
        aria-label="Sort projects"
        onChange={(event) => onFilterChange({ sort: event.target.value as ProjectSortKey })}
        className="w-[170px]"
      />

      {/* FR-2.14. A two-button group rather than a select: there are two states,
          both have an obvious glyph, and a dropdown for two options is a click
          nobody should have to spend. */}
      <div
        role="group"
        aria-label="Presentation"
        className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
      >
        <IconButton
          icon="grid"
          label="Grid view"
          size="sm"
          aria-pressed={view === "grid"}
          onClick={() => onViewChange("grid")}
          className={cn(view === "grid" && "bg-tint-blue text-accent")}
        />
        <IconButton
          icon="list"
          label="List view"
          size="sm"
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
          className={cn(view === "list" && "bg-tint-blue text-accent")}
        />
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-ink-muted tabular-nums">
        Showing {shown} of {total}
      </p>

      {/* Each chip removes exactly the one filter it names. A single "clear all"
          is the wrong granularity when three filters are on and one is wrong. */}
      {filters.query.trim() && (
        <FilterChip label={`“${filters.query.trim()}”`} onRemove={() => onSearchChange("")} />
      )}
      {filters.status && (
        <FilterChip
          label={labelFor.projectStatus(filters.status)}
          onRemove={() => onFilterChange({ status: "" })}
        />
      )}
      {filters.client && (
        <FilterChip label={filters.client} onRemove={() => onFilterChange({ client: "" })} />
      )}
      {filters.tag && (
        <FilterChip label={`#${filters.tag}`} onRemove={() => onFilterChange({ tag: "" })} />
      )}
      {filters.includeArchived && (
        <FilterChip
          label="Including archived"
          onRemove={() => onFilterChange({ includeArchived: false })}
        />
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* FR-2.7. A checkbox rather than a status option, because "archived and
            active together" is a thing you want and a select cannot say. */}
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-ink-secondary">
          <input
            type="checkbox"
            checked={filters.includeArchived}
            onChange={(event) => onFilterChange({ includeArchived: event.target.checked })}
            className="h-3.5 w-3.5 cursor-pointer rounded-sm border border-line accent-accent"
          />
          Include archived
        </label>

        {filtered && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-accent transition-colors hover:text-accent-hover"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  </div>
);

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-tint-blue-line bg-tint-blue px-2 py-0.5 text-xs text-tint-blue-ink">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter ${label}`}
      className="-mr-0.5 rounded-full opacity-60 transition-opacity hover:opacity-100"
    >
      <Icon name="close" size={12} />
    </button>
  </span>
);
