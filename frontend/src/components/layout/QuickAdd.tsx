import { useCallback, useEffect } from "react";

import { cn } from "@/lib/cn";
import { listProjects } from "@/lib/projectsApi";
import { listTags } from "@/lib/tagsApi";
import { useApi } from "@/hooks/useApi";
import { usePrefsStore, type QuickAddType } from "@/stores/prefsStore";
import { toast, useUiStore } from "@/stores/uiStore";
import { useDashboard } from "@/hooks/useDashboard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { EnvironmentFormModal } from "@/components/environments/EnvironmentFormModal";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";

/**
 * FR-6.6 and the ⌘N half of FR-7.6, split across two components for one reason:
 * the *button* belongs on the dashboard header, and the *forms* have to be
 * reachable from every route.
 *
 * `QuickAddButton` only dispatches into `uiStore`. `QuickAddHost` sits in the app
 * shell and renders whichever form the store names. Pressing ⌘N on the tags page
 * therefore opens the same modal the dashboard's button does, without the tags
 * page knowing anything about it.
 */

const LABELS: Record<QuickAddType, string> = {
  task: "task",
  project: "project",
  environment: "environment",
};

/**
 * The split button of FR-6.6: pressing the body creates the last type used,
 * pressing the chevron picks a different one.
 *
 * Two `<button>` elements rather than one with a click-target test. A button
 * that does two things depending on where inside it you clicked is unusable
 * with a keyboard — there is only one Enter — so the chevron is a real control
 * with its own tab stop and its own accessible name.
 */
export const QuickAddButton = () => {
  const lastType = usePrefsStore((state) => state.lastQuickAddType);
  const setLastType = usePrefsStore((state) => state.setLastQuickAddType);
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  const open = (type: QuickAddType) => {
    setLastType(type);
    openQuickAdd(type);
  };

  return (
    <div className="inline-flex items-stretch">
      <Button
        variant="primary"
        icon="plus"
        onClick={() => open(lastType)}
        className="rounded-r-none border-r-0"
      >
        New {LABELS[lastType]}
      </Button>

      <Menu
        label="Choose what to create"
        align="right"
        trigger={({ onClick, "aria-expanded": expanded }) => (
          <Button
            variant="primary"
            aria-label="Choose what to create"
            aria-expanded={expanded}
            aria-haspopup="menu"
            onClick={onClick}
            className={cn(
              "w-8 rounded-l-none px-0",
              // A hairline between the two halves, so the split reads as a split
              // rather than as one very wide button.
              "border-l border-l-on-accent/25",
            )}
          >
            <Icon name="chevronDown" size={15} />
          </Button>
        )}
        actions={[
          { label: "New project", icon: "projects", onSelect: () => open("project") },
          { label: "New environment", icon: "environments", onSelect: () => open("environment") },
          { label: "New task", icon: "tasks", onSelect: () => open("task") },
        ]}
      />
    </div>
  );
};

/**
 * The three forms, mounted once in the shell.
 *
 * Everything they need — the project list for a task's project field, the tag
 * list for a project's chips — is fetched **only while a form is open**. Quick
 * add is a control that is idle almost all of the time, and two requests on
 * every page load to fill selects nobody has asked for yet is the wrong trade.
 */
export const QuickAddHost = () => {
  const quickAdd = useUiStore((state) => state.quickAdd);
  const closeQuickAdd = useUiStore((state) => state.closeQuickAdd);
  const dashboard = useDashboard();

  const needsProjects = quickAdd === "task" || quickAdd === "environment";
  const projects = useApi(listProjects, [], { enabled: needsProjects });
  const tags = useApi(listTags, [], { enabled: quickAdd === "project" });

  /**
   * Anything created here moves at least one tile and possibly the pinned row,
   * so the shared payload is re-read rather than patched. Patching would mean
   * teaching this component how a new task changes seven counts, which is the
   * server's job and is already written down there.
   */
  const onSaved = useCallback(() => {
    void dashboard.refetch();
    closeQuickAdd();
  }, [dashboard, closeQuickAdd]);

  /**
   * FR-3.1: an environment cannot exist without a project, so with none there is
   * nothing to open. Saying so is better than a form whose only select is empty
   * and whose Create button can only ever fail.
   */
  useEffect(() => {
    if (quickAdd !== "environment" || projects.isLoading || projects.data === undefined) return;
    if (projects.data.length > 0) return;

    toast.info(
      "Create a project first",
      "An environment belongs to a project, so there is nowhere to put one yet.",
    );
    closeQuickAdd();
  }, [quickAdd, projects.isLoading, projects.data, closeQuickAdd]);

  if (quickAdd === "project") {
    return (
      <ProjectFormModal
        open
        onClose={closeQuickAdd}
        tags={tags.data ?? []}
        onSaved={onSaved}
      />
    );
  }

  if (quickAdd === "task") {
    return (
      <TaskFormModal
        open
        onClose={closeQuickAdd}
        projects={projects.data ?? []}
        onSaved={onSaved}
      />
    );
  }

  if (quickAdd === "environment") {
    const all = projects.data ?? [];
    // The "no projects at all" case is handled in the effect above, not here:
    // a toast and a store write during render are side effects, and React is
    // entitled to run this function twice.
    if (projects.isLoading || all.length === 0) return null;

    return (
      <EnvironmentFormModal
        open
        onClose={closeQuickAdd}
        projectId={all[0].id}
        projects={all}
        onSaved={onSaved}
      />
    );
  }

  return null;
};
