import { PageHeader } from "@/components/ui/states";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";

/**
 * §8.2 and §8.3. Every task, across every project and none.
 *
 * The page is a header and one component. `TaskWorkspace` owns the board, the
 * list, the filters and every mutation, because the project detail page needs
 * exactly the same thing scoped to one project (§8.4) — and a screen ported
 * later is a screen that has already drifted.
 */

const TasksPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      eyebrow="Work"
      title="Tasks"
      description="The board is for arranging what you are doing. The list is for finding one thing."
    />
    <TaskWorkspace />
  </div>
);

export default TasksPage;
