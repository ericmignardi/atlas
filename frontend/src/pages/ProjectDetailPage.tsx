import { useCallback, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { isApiError } from "@/lib/apiClient";
import { relativeTime, shortDate } from "@/lib/dates";
import { deleteProject, getProjectBySlug, setPinned } from "@/lib/projectsApi";
import { listTags } from "@/lib/tagsApi";
import { useApi } from "@/hooks/useApi";
import { toast } from "@/stores/uiStore";
import { ProjectStatusBadge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import { Panel } from "@/components/ui/Card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { TagChip, TechChip } from "@/components/ui/TagChip";
import { Tabs } from "@/components/ui/Tabs";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { EnvironmentMap } from "@/components/environments/EnvironmentMap";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import type { ProjectResponse } from "@/types/api";

/**
 * §7.4. One project: its identity at the top, its detail in tabs.
 *
 * The route keys on the slug rather than the id (FR-2.10), so the URL is
 * readable and shareable. That has a consequence worth naming: **renaming a
 * project regenerates its slug** (FR-2.4), so the URL the user is standing on
 * stops resolving the moment they save. The edit handler navigates to the new
 * slug with `replace: true` — replace, not push, because the old URL is now a
 * 404 and leaving it in history means Back is broken.
 */

const TABS = ["overview", "environments", "tasks"] as const;
type TabId = (typeof TABS)[number];

const isTabId = (value: string | null): value is TabId =>
  value !== null && (TABS as readonly string[]).includes(value);

/** `noopener`, or the opened page can reach back through `window.opener`. */
const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

const ProjectDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const project = useApi(() => getProjectBySlug(slug as string), [slug], {
    enabled: Boolean(slug),
  });
  const tags = useApi(listTags, []);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * The tab lives in the URL, not in state (§7.4). `?tab=environments` opens
   * that tab directly, a reload keeps it, and Back moves between tabs — none of
   * which a `useState` gives you. An unrecognised value falls back to Overview
   * rather than rendering nothing.
   */
  const raw = searchParams.get("tab");
  const tab: TabId = isTabId(raw) ? raw : "overview";

  const setTab = (next: string) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        // Overview is the default, so it does not earn a query parameter — a
        // clean URL is the one worth copying.
        if (next === "overview") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      // Replace, so flipping through three tabs does not put three entries in
      // history and make Back feel stuck.
      { replace: true },
    );

  const current = project.data;

  const togglePin = useCallback(async () => {
    if (!current) return;
    const next = !current.isPinned;
    project.setData({ ...current, isPinned: next });

    try {
      project.setData(await setPinned(current.id, next));
      toast.success(next ? `${current.name} pinned` : `${current.name} unpinned`);
    } catch (error) {
      project.setData(current);
      const message =
        isApiError(error) && error.status === 409
          ? "Four projects are already pinned. Unpin one first."
          : isApiError(error)
            ? error.message
            : "Try again in a moment.";
      toast.error(next ? "Could not pin that project" : "Could not unpin that project", message);
    }
  }, [current, project]);

  const confirmDelete = useCallback(async () => {
    if (!current) return;
    try {
      await deleteProject(current.id);
      toast.success(`${current.name} deleted`);
      navigate("/projects", { replace: true });
    } catch (error) {
      toast.error(
        "Could not delete that project",
        isApiError(error) ? error.message : "Try again in a moment.",
      );
    } finally {
      setConfirmingDelete(false);
    }
  }, [current, navigate]);

  const onSaved = useCallback(
    (saved: ProjectResponse) => {
      project.setData(saved);
      if (saved.slug !== slug) {
        navigate(`/projects/${saved.slug}${window.location.search}`, { replace: true });
      }
    },
    [project, slug, navigate],
  );

  if (project.isLoading) return <DetailSkeleton />;

  if (project.error) {
    // A 404 here is not a failure to load — it is the answer. Either the slug is
    // wrong, or it belonged to someone else and NFR-2.8 answers with 404 rather
    // than confirming the project exists.
    if (project.error.status === 404) {
      return (
        <EmptyState
          icon="empty"
          title="No such project"
          description="Nothing here matches that address. It may have been deleted, or renamed — renaming a project changes its URL."
          action={
            <Button icon="back" onClick={() => navigate("/projects")}>
              Back to projects
            </Button>
          }
        />
      );
    }
    return <ErrorState message={project.error.message} onRetry={() => void project.refetch()} />;
  }

  if (!current) return null;

  const actions: MenuAction[] = [
    ...(current.liveUrl
      ? [
          {
            label: "Open live site",
            icon: "external" as const,
            onSelect: () => openExternal(current.liveUrl as string),
          },
        ]
      : []),
    {
      label: current.isPinned ? "Unpin" : "Pin",
      icon: current.isPinned ? "unpin" : "pin",
      onSelect: () => void togglePin(),
    },
    {
      label: "Delete",
      icon: "delete",
      danger: true,
      onSelect: () => setConfirmingDelete(true),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/projects" className="transition-colors hover:text-ink">
          Projects
        </Link>
        <Icon name="chevronRight" size={13} />
        <span className="truncate text-ink-secondary">{current.name}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-xl text-ink">{current.name}</h1>
              <ProjectStatusBadge status={current.status} />
              <IconButton
                icon={current.isPinned ? "unpin" : "pin"}
                label={current.isPinned ? "Unpin project" : "Pin project"}
                size="sm"
                onClick={() => void togglePin()}
                className={current.isPinned ? "text-accent" : undefined}
              />
            </div>

            {/* The meta line: everything that identifies the project without
                being its content. Separated by middots and wrapping as one run,
                so it reads as a sentence rather than a table. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
              {current.client && <span>{current.client}</span>}
              {current.repoUrl && (
                <>
                  <Dot />
                  <a
                    href={current.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-mono-sm text-accent transition-colors hover:text-accent-hover"
                  >
                    <Icon name="branch" size={13} />
                    {shortenUrl(current.repoUrl)}
                  </a>
                </>
              )}
              {current.startedAt && (
                <>
                  <Dot />
                  <span>Started {shortDate(current.startedAt)}</span>
                </>
              )}
              {current.engagement && (
                <>
                  <Dot />
                  <span>{current.engagement}</span>
                </>
              )}
              <Dot />
              <span>Updated {relativeTime(current.updatedAt)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {current.repoUrl && (
              <Button icon="branch" onClick={() => openExternal(current.repoUrl as string)}>
                Open repo
              </Button>
            )}
            <Button variant="primary" icon="edit" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Menu label={`Actions for ${current.name}`} actions={actions} />
          </div>
        </div>

        {(current.techStack.length > 0 || current.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {current.techStack.map((entry) => (
              <TechChip key={entry} value={entry} />
            ))}
            {current.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </header>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab id="overview">Overview</Tabs.Tab>
          <Tabs.Tab id="environments" count={current.environmentCount}>
            Environments
          </Tabs.Tab>
          <Tabs.Tab id="tasks" count={current.openTaskCount}>
            Tasks
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="overview">
          <Overview project={current} />
        </Tabs.Panel>

        {/*
          §8.4. The same two components the standalone pages render, given a
          `projectId`. They were written that way from the start rather than
          built as pages and generalised afterwards — the second version of a
          screen is where the two quietly stop agreeing.

          Both sit inside `Tabs.Panel`, which unmounts the panel that is not
          selected, so opening the project does not fetch environments and tasks
          nobody has asked to see.
        */}
        <Tabs.Panel id="environments">
          <EnvironmentMap projectId={current.id} projectName={current.name} />
        </Tabs.Panel>

        <Tabs.Panel id="tasks">
          <TaskWorkspace projectId={current.id} projectName={current.name} />
        </Tabs.Panel>
      </Tabs>

      <ProjectFormModal
        open={editing}
        onClose={() => setEditing(false)}
        project={current}
        tags={tags.data ?? []}
        onSaved={onSaved}
        onTagCreated={() => void tags.refetch()}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={confirmDelete}
        title={`Delete ${current.name}?`}
        consequence={`Its ${current.environmentCount} environment${current.environmentCount === 1 ? "" : "s"} are deleted with it. Its tasks survive, unassigned. This cannot be undone.`}
      />
    </div>
  );
};

const Dot = () => (
  <span aria-hidden="true" className="text-line">
    ·
  </span>
);

/** github.com/eric/atlas rather than the whole https:// prefix and trailing slash. */
function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const Overview = ({ project }: { project: ProjectResponse }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <Panel title="Description" className="lg:col-span-2">
      {project.description ? (
        /* `whitespace-pre-line` so the paragraph breaks someone typed survive the
           round trip. The column is capped at ~75 characters because a line of
           prose stretched to 1280 px is unreadable. */
        <p className="max-w-[75ch] whitespace-pre-line text-sm text-ink-secondary">
          {project.description}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          No description yet. Edit the project to say what it is.
        </p>
      )}
    </Panel>

    <Panel title="Details">
      <dl className="flex flex-col gap-3">
        <Detail label="Status" value={<ProjectStatusBadge status={project.status} />} />
        <Detail label="Client" value={project.client ?? "—"} />
        <Detail label="Engagement" value={project.engagement ?? "—"} />
        <Detail label="Started" value={shortDate(project.startedAt)} />
        <Detail label="Created" value={shortDate(project.createdAt)} />
        <Detail
          label="Live site"
          value={
            project.liveUrl ? (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-mono-sm text-accent transition-colors hover:text-accent-hover"
              >
                <Icon name="external" size={13} />
                {shortenUrl(project.liveUrl)}
              </a>
            ) : (
              "—"
            )
          }
        />
        <Detail
          label="Slug"
          value={<code className="font-mono text-mono-sm text-ink-secondary">{project.slug}</code>}
        />
      </dl>
    </Panel>
  </div>
);

const Detail = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="shrink-0 text-xs text-ink-muted">{label}</dt>
    <dd className="min-w-0 truncate text-right text-sm text-ink-secondary">{value}</dd>
  </div>
);

/** Matched geometry again: header block, tab rule, two panels. */
const DetailSkeleton = () => (
  <div className="flex flex-col gap-6" aria-hidden="true">
    <Skeleton className="h-4 w-40" />
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-72" />
      <Skeleton className="h-4 w-96" />
    </div>
    <Skeleton className="h-9 w-full" />
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Skeleton className="h-48 lg:col-span-2" />
      <Skeleton className="h-48" />
    </div>
  </div>
);

export default ProjectDetailPage;
