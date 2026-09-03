import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { PageHeader } from "@/components/ui/states";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";

/**
 * §8.2 and §8.3. Every task, across every project and none.
 *
 * The page is a header and one component. `TaskWorkspace` owns the board, the
 * list, the filters and every mutation, because the project detail page needs
 * exactly the same thing scoped to one project (§8.4) — and a screen ported
 * later is a screen that has already drifted.
 *
 * The one thing the page owns is `?task=<id>`, which the command palette
 * navigates to (FR-7.3). It is a URL parameter rather than router state so that
 * the link is shareable and a refresh is harmless; the workspace hands it back
 * once consumed and it is dropped with `replace`, so Back does not walk through
 * every task that was opened this way.
 */

const TasksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusTaskId = searchParams.get("task") ?? undefined;

  const clearFocus = useCallback(
    () =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          params.delete("task");
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Work"
        title="Tasks"
        description="The board is for arranging what you are doing. The list is for finding one thing."
      />
      <TaskWorkspace focusTaskId={focusTaskId} onFocusHandled={clearFocus} />
    </div>
  );
};

export default TasksPage;
