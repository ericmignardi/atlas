import { useCallback, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { isApiError } from "@/lib/apiClient";
import { shortDate } from "@/lib/dates";
import { TINT_CLASSES, tintForColor } from "@/lib/design";
import { deleteTag, listTags } from "@/lib/tagsApi";
import { useApi } from "@/hooks/useApi";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import {
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  PageHeader,
  SkeletonList,
} from "@/components/ui/states";
import { TagFormModal } from "@/components/tags/TagFormModal";
import type { TagResponse } from "@/types/api";

/**
 * §7.5. A table, because five columns of the same five shapes is what a table is
 * for — cards here would be five hundred pixels of chrome around a word and a
 * number.
 *
 * The one column that earns its place is `usageCount`. A tag list without it
 * cannot answer the only question anyone asks of a tag list: which of these is
 * dead weight.
 */

const TagsPage = () => {
  const tags = useApi(listTags, []);

  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search, 200).trim().toLowerCase();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TagResponse | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<TagResponse | undefined>(undefined);

  const all = useMemo(() => tags.data ?? [], [tags.data]);
  const visible = useMemo(
    () => (query ? all.filter((tag) => tag.name.includes(query)) : all),
    [all, query],
  );

  const onSaved = useCallback(
    (saved: TagResponse) =>
      tags.setData((current) => {
        const list = current ?? [];
        const exists = list.some((tag) => tag.id === saved.id);
        const next = exists
          ? list.map((tag) => (tag.id === saved.id ? saved : tag))
          : [...list, saved];
        // The server returns the list alphabetically; a rename that skipped the
        // re-sort would leave the row sitting where its old name put it.
        return next.sort((a, b) => a.name.localeCompare(b.name));
      }),
    [tags],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteTag(pendingDelete.id);
      tags.setData((current) => (current ?? []).filter((tag) => tag.id !== pendingDelete.id));
      toast.success(`${pendingDelete.name} deleted`);
    } catch (error) {
      toast.error(
        "Could not delete that tag",
        isApiError(error) ? error.message : "Try again in a moment.",
      );
    } finally {
      setPendingDelete(undefined);
    }
  }, [pendingDelete, tags]);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Work"
        title="Tags"
        description="Labels shared across projects. Deleting one never deletes what it was on."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            New tag
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative w-[280px]">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tags…"
            aria-label="Search tags"
            className="pl-9"
          />
        </div>
        <p className="text-xs tabular-nums text-ink-muted">
          Showing {visible.length} of {all.length}
        </p>
      </div>

      {tags.isLoading ? (
        <SkeletonList rows={6} rowClassName="h-[44px]" />
      ) : tags.error ? (
        <ErrorState message={tags.error.message} onRetry={() => void tags.refetch()} />
      ) : visible.length === 0 ? (
        all.length === 0 ? (
          <EmptyState
            icon="tags"
            title="No tags yet"
            description="Tags cut across projects — “client-work”, “needs-invoice”, “side-project”. Add them from a project, or create one here first."
            action={
              <Button variant="primary" icon="plus" onClick={openCreate}>
                Create a tag
              </Button>
            }
          />
        ) : (
          <FilteredEmptyState noun="tags" onClear={() => setSearch("")} />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <Th className="w-[40%]">Tag</Th>
                <Th className="w-[20%]">Used on</Th>
                <Th className="w-[25%]">Created</Th>
                {/* The actions column has no visible heading, but a screen
                    reader reading a table row still needs one. */}
                <Th className="w-[15%] text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tag) => (
                <tr
                  key={tag.id}
                  className="group border-b border-line last:border-b-0 transition-colors hover:bg-surface-sunken"
                >
                  <Td>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                        TINT_CLASSES[tintForColor(tag.color)],
                      )}
                    >
                      {tag.name}
                    </span>
                  </Td>
                  <Td className="text-sm tabular-nums text-ink-secondary">
                    {tag.usageCount === 0 ? (
                      // Named rather than left as a bare 0: an unused tag is the
                      // thing this table exists to surface.
                      <span className="text-ink-muted">Unused</span>
                    ) : (
                      `${tag.usageCount} project${tag.usageCount === 1 ? "" : "s"}`
                    )}
                  </Td>
                  <Td className="text-sm text-ink-muted">{shortDate(tag.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Menu
                        label={`Actions for ${tag.name}`}
                        actions={[
                          {
                            label: "Rename or recolour",
                            icon: "edit",
                            onSelect: () => {
                              setEditing(tag);
                              setFormOpen(true);
                            },
                          },
                          {
                            label: "Delete",
                            icon: "delete",
                            danger: true,
                            onSelect: () => setPendingDelete(tag),
                          },
                        ]}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TagFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        tag={editing}
        onSaved={onSaved}
      />

      {/*
        FR-8.2, and §7.5 words it exactly: the consequence has to say what
        survives, not only what goes. "Remove from 6 projects" sounds like it
        deletes six projects unless the next sentence says otherwise.
      */}
      <ConfirmDialog
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
        title={`Delete ${pendingDelete?.name ?? "tag"}?`}
        consequence={
          pendingDelete
            ? `This removes ${pendingDelete.name} from ${pendingDelete.usageCount} project${pendingDelete.usageCount === 1 ? "" : "s"}. The projects themselves are not deleted.`
            : ""
        }
      />
    </div>
  );
};

const Th = ({ className, children }: { className?: string; children?: ReactNode }) => (
  <th scope="col" className={cn("px-4 py-2.5 text-eyebrow uppercase text-ink-muted", className)}>
    {children}
  </th>
);

const Td = ({ className, children }: { className?: string; children?: ReactNode }) => (
  <td className={cn("px-4 py-2.5", className)}>{children}</td>
);

export default TagsPage;
