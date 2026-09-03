import { Link } from "react-router";

import { cn } from "@/lib/cn";
import { dueLabel } from "@/lib/dates";
import { TASK_PRIORITY } from "@/lib/design";
import { Icon } from "@/components/ui/Icon";
import type { NeedsAttention, TaskResponse } from "@/types/api";

/**
 * FR-6.3. Two groups, in this order: what is late or due tonight, then the rest
 * of the week.
 *
 * The server sends three buckets (FR-4.10). Overdue and due-today are drawn as
 * one urgent group because they call for the same thing — look at this today —
 * and splitting them would put a header between two rows that mean the same. The
 * *rows* still say which is which, in words, because a 2 px red rail is a colour
 * and NFR-4.4 does not let colour carry meaning alone.
 */

interface NeedsAttentionRailProps {
  needsAttention: NeedsAttention;
}

export const NeedsAttentionRail = ({ needsAttention }: NeedsAttentionRailProps) => {
  const urgent = [...needsAttention.overdue, ...needsAttention.dueToday];
  const soon = needsAttention.dueSoon;
  const total = urgent.length + soon.length;

  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="flex flex-col rounded-lg border border-line bg-surface"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="needs-attention-heading" className="text-eyebrow uppercase text-ink-muted">
          Needs attention
        </h2>
        <span className="text-xs tabular-nums text-ink-muted">
          {total === 1 ? "1 task" : total + " tasks"}
        </span>
      </header>

      {total === 0 ? (
        /* §9.7's empty state, and a specific sentence rather than "No data":
           nothing is due, which is information, not an absence of it. */
        <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
          <Icon name="success" size={20} className="text-green-600" />
          <p className="text-sm text-ink">Nothing due this week</p>
          <p className="max-w-[32ch] text-xs text-ink-muted">
            No open task is overdue or due in the next seven days.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-3">
          {urgent.length > 0 && (
            <Group title="Overdue and due today" tasks={urgent} urgent />
          )}
          {soon.length > 0 && <Group title="Next 7 days" tasks={soon} />}
        </div>
      )}

      <footer className="border-t border-line px-4 py-2.5">
        <Link
          to="/tasks"
          className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover"
        >
          All tasks
          <Icon name="chevronRight" size={14} />
        </Link>
      </footer>
    </section>
  );
};

interface GroupProps {
  title: string;
  tasks: readonly TaskResponse[];
  urgent?: boolean;
}

const Group = ({ title, tasks, urgent = false }: GroupProps) => (
  <div className="flex flex-col gap-1.5">
    <p
      className={cn(
        "px-1 text-eyebrow uppercase",
        // The second group is deliberately quieter: it is the same information
        // one week out, and two headers at the same weight makes neither urgent.
        urgent ? "text-ink-secondary" : "text-ink-muted",
      )}
    >
      {title}
    </p>
    <ul className="flex flex-col gap-1">
      {tasks.map((task) => (
        <li key={task.id}>
          <Row task={task} urgent={urgent} />
        </li>
      ))}
    </ul>
  </div>
);

const Row = ({ task, urgent }: { task: TaskResponse; urgent: boolean }) => {
  const priority = TASK_PRIORITY[task.priority];

  return (
    <Link
      to={"/tasks?task=" + task.id}
      className={cn(
        "flex flex-col gap-0.5 rounded-md border-l-2 py-1.5 pl-2.5 pr-2",
        "transition-colors duration-150 ease-enter hover:bg-surface-sunken animate-list-enter",
        urgent ? "border-l-red-600" : "border-l-line",
      )}
    >
      <span className="truncate text-sm text-ink">{task.title}</span>
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        {/* The words are the signal, not the rail: "Overdue by 2 days" reads the
            same in greyscale (NFR-4.4). */}
        <span className={urgent ? "text-red-600" : undefined}>{dueLabel(task.dueDate)}</span>
        {task.project && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{task.project.name}</span>
          </>
        )}
        {(task.priority === "HIGH" || task.priority === "URGENT") && (
          <>
            <span aria-hidden="true">·</span>
            <span>{priority.label}</span>
          </>
        )}
      </span>
    </Link>
  );
};
