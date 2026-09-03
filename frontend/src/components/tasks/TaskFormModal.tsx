import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { createTask, updateTask } from "@/lib/tasksApi";
import { dateInputValue, dueDateToInstant } from "@/lib/dates";
import { labelFor } from "@/lib/design";
import { taskCreateSchema } from "@/schemas/task";
import { fromApiError, parseForm, type FieldErrors } from "@/schemas/fieldErrors";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectResponse,
  type TaskPriority,
  type TaskResponse,
  type TaskStatus,
} from "@/types/api";

/**
 * §7.4. One modal for create and edit, remounted by key — the same three
 * decisions as `ProjectFormModal`, and made the same way for the same reasons.
 *
 * Two things are particular to a task.
 *
 * **The project is optional.** FR-4.5 gives tasks an unassigned bucket, so the
 * select has a real "No project" row that sends an explicit null rather than
 * omitting the key. Omitting it on a PATCH would leave the old project attached,
 * which makes "detach this task" impossible to express.
 *
 * **The due date is a day, stored as an instant.** A native date input speaks
 * `yyyy-MM-dd`; the column is an `Instant`. `dueDateToInstant` puts it at the
 * end of that day in the browser's zone — see the note there for why midnight
 * would make every task due today overdue by breakfast.
 */

interface FormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  projectId: string;
}

const blank = (status: TaskStatus, projectId: string): FormState => ({
  title: "",
  description: "",
  status,
  priority: "MEDIUM",
  dueDate: "",
  projectId,
});

const fromTask = (task: TaskResponse): FormState => ({
  title: task.title,
  description: task.description ?? "",
  status: task.status,
  priority: task.priority,
  dueDate: dateInputValue(task.dueDate),
  projectId: task.project?.id ?? "",
});

const STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: labelFor.taskStatus(status),
}));

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: labelFor.taskPriority(priority),
}));

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Absent for create, present for edit. */
  task?: TaskResponse;
  /** Pre-selects the column whose "Drop or add" button was pressed. */
  defaultStatus?: TaskStatus;
  /**
   * Locks the project. Inside a project's own tab the answer is not a question,
   * and offering a select that can move the task out of the tab it was created
   * in is a control nobody wants.
   */
  lockedProjectId?: string;
  projects?: readonly ProjectResponse[];
  onSaved: (task: TaskResponse, mode: "created" | "updated") => void;
}

export const TaskFormModal = (props: TaskFormModalProps) => {
  if (!props.open) return null;
  return <TaskForm key={props.task?.id ?? "new"} {...props} />;
};

const TaskForm = ({
  onClose,
  task,
  defaultStatus = "TODO",
  lockedProjectId,
  projects = [],
  onSaved,
}: TaskFormModalProps) => {
  const initial = useMemo(
    () => (task ? fromTask(task) : blank(defaultStatus, lockedProjectId ?? "")),
    [task, defaultStatus, lockedProjectId],
  );

  const [form, setForm] = useState<FormState>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const requestClose = () => {
    if (dirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const submit = async () => {
    setFormError(null);

    const parsed = parseForm(taskCreateSchema, {
      title: form.title,
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: dueDateToInstant(form.dueDate) ?? null,
      projectId: form.projectId || null,
    });

    if (!parsed.ok) {
      setFields(parsed.fields);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      if (task) {
        const saved = await updateTask(task.id, {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          status: parsed.data.status,
          priority: parsed.data.priority,
          dueDate: parsed.data.dueDate ?? null,
          projectId: parsed.data.projectId ?? null,
        });
        toast.success(saved.title + " saved");
        onSaved(saved, "updated");
      } else {
        const created = await createTask(parsed.data);
        toast.success(created.title + " created");
        onSaved(created, "created");
      }
      onClose();
    } catch (error) {
      const { fields: serverFields, message } = fromApiError(error);
      setFields(serverFields);
      setFormError(message);
      toast.error(task ? "Could not save the task" : "Could not create the task", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  /** FR-7.6, scoped to this form. */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={task ? "Edit task" : "New task"}
        description={task ? undefined : "Only a title is required."}
        size="wide"
        footer={
          <>
            <Button onClick={requestClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {task ? "Save changes" : "Create task"}
            </Button>
          </>
        }
      >
        <form
          ref={formRef}
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          noValidate
          className="flex flex-col gap-4"
        >
          {formError && (
            <p
              role="alert"
              className="rounded-md border border-tint-red-line bg-tint-red px-3 py-2 text-sm text-tint-red-ink"
            >
              {formError}
            </p>
          )}

          <Field label="Title" error={fields.title} required>
            {(props) => (
              <Input
                {...props}
                value={form.title}
                data-autofocus
                placeholder="Wire the pairing dialog to the API"
                onChange={(event) => set("title", event.target.value)}
              />
            )}
          </Field>

          <Field label="Description" error={fields.description}>
            {(props) => (
              <TextArea
                {...props}
                rows={3}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
              />
            )}
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Status" error={fields.status}>
              {(props) => (
                <Select
                  {...props}
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(event) => set("status", event.target.value as TaskStatus)}
                />
              )}
            </Field>

            <Field label="Priority" error={fields.priority}>
              {(props) => (
                <Select
                  {...props}
                  options={PRIORITY_OPTIONS}
                  value={form.priority}
                  onChange={(event) => set("priority", event.target.value as TaskPriority)}
                />
              )}
            </Field>

            <Field label="Due" error={fields.dueDate}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => set("dueDate", event.target.value)}
                />
              )}
            </Field>
          </div>

          {!lockedProjectId && (
            /* FR-4.5: "No project" is a real answer, not the absence of one. */
            <Field label="Project" error={fields.projectId}>
              {(props) => (
                <Select
                  {...props}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  placeholder="No project"
                  value={form.projectId}
                  onChange={(event) => set("projectId", event.target.value)}
                />
              )}
            </Field>
          )}

          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        title="Discard your changes?"
        consequence="This form has edits that have not been saved. Closing it now loses them."
        confirmLabel="Discard"
        tone="danger"
      />
    </>
  );
};
