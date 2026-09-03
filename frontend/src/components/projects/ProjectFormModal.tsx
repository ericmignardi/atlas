import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { createProject, updateProject } from "@/lib/projectsApi";
import { dateInputValue } from "@/lib/dates";
import { labelFor } from "@/lib/design";
import { projectCreateSchema, type ProjectPatch } from "@/schemas/project";
import { fromApiError, parseForm, type FieldErrors } from "@/schemas/fieldErrors";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StackInput } from "@/components/projects/StackInput";
import { TagInput } from "@/components/projects/TagInput";
import {
  PROJECT_STATUSES,
  type ProjectResponse,
  type TagResponse,
  type TagSummary,
} from "@/types/api";

/**
 * §7.3. One modal for create and edit, because the two differ in exactly two
 * ways — the title, and which endpoint the submit calls. A second component
 * would be a hundred identical lines that drift apart on the first field added.
 *
 * Fully controlled state rather than `FormData` read off the submitted form,
 * which is how the auth pages do it. Two of the ten fields are not inputs at all
 * — `StackInput` and `TagInput` hold arrays of objects — and the dirty check
 * that guards Escape needs a value to compare on every keystroke, not one that
 * only exists at submit time.
 */

interface FormState {
  name: string;
  client: string;
  description: string;
  status: (typeof PROJECT_STATUSES)[number];
  repoUrl: string;
  liveUrl: string;
  engagement: string;
  startedAt: string;
  techStack: string[];
  tags: TagSummary[];
}

const BLANK: FormState = {
  name: "",
  client: "",
  description: "",
  status: "IDEA",
  repoUrl: "",
  liveUrl: "",
  engagement: "",
  startedAt: "",
  techStack: [],
  tags: [],
};

const fromProject = (project: ProjectResponse): FormState => ({
  name: project.name,
  client: project.client ?? "",
  description: project.description ?? "",
  status: project.status,
  repoUrl: project.repoUrl ?? "",
  liveUrl: project.liveUrl ?? "",
  engagement: project.engagement ?? "",
  startedAt: dateInputValue(project.startedAt),
  techStack: [...project.techStack],
  tags: [...project.tags],
});

const STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({
  value: status,
  label: labelFor.projectStatus(status),
}));

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Absent for create, present for edit — the only thing that switches mode. */
  project?: ProjectResponse;
  tags: readonly TagResponse[];
  /** The saved record, so the caller can update its list without a refetch. */
  onSaved: (project: ProjectResponse, mode: "created" | "updated") => void;
  onTagCreated?: (tag: TagResponse) => void;
}

/**
 * The wrapper exists to do one thing: mount the form fresh, keyed on which
 * record it is editing.
 *
 * The alternative — one long-lived form that copies the project into state in an
 * effect whenever `open` flips — is the standard way to get this wrong. It is a
 * synchronous setState inside an effect, so every open costs a second render
 * pass with the *previous* project's values on screen for a frame, and the
 * effect has to be kept in step with every field added afterwards. Remounting
 * makes `useState(initial)` the whole reset, and React does it in one pass.
 */
export const ProjectFormModal = (props: ProjectFormModalProps) => {
  if (!props.open) return null;
  return <ProjectForm key={props.project?.id ?? "new"} {...props} />;
};

const ProjectForm = ({ onClose, project, tags, onSaved, onTagCreated }: ProjectFormModalProps) => {
  const initial = useMemo(() => (project ? fromProject(project) : BLANK), [project]);

  const [form, setForm] = useState<FormState>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /**
   * Compared by value rather than tracked with a flag, so typing a character and
   * deleting it again leaves the form clean and Escape closes without a prompt.
   * JSON is adequate here: every field is a primitive, an array of primitives,
   * or an array of tag objects whose key order comes from the same mapper.
   */
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const requestClose = () => {
    if (dirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const submit = async () => {
    setFormError(null);

    /**
     * Validated against the *create* schema in both modes: that is where the
     * real rules live, and the form always carries a complete set of values
     * whether or not the record already exists.
     */
    const parsed = parseForm(projectCreateSchema, {
      name: form.name,
      client: form.client.trim() || undefined,
      description: form.description.trim() || undefined,
      status: form.status,
      repoUrl: form.repoUrl.trim() || undefined,
      liveUrl: form.liveUrl.trim() || undefined,
      engagement: form.engagement.trim() || undefined,
      techStack: form.techStack,
      startedAt: form.startedAt || undefined,
      tagIds: form.tags.map((tag) => tag.id),
    });

    if (!parsed.ok) {
      setFields(parsed.fields);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      if (project) {
        // An emptied input is an instruction to clear the column, so it goes as
        // an explicit null. `undefined` would drop the key, and the old value
        // would survive a save the user watched succeed.
        const patch: ProjectPatch = {
          name: parsed.data.name,
          client: parsed.data.client ?? null,
          description: parsed.data.description ?? null,
          status: parsed.data.status,
          repoUrl: parsed.data.repoUrl ?? null,
          liveUrl: parsed.data.liveUrl ?? null,
          engagement: parsed.data.engagement ?? null,
          techStack: parsed.data.techStack,
          startedAt: parsed.data.startedAt ?? null,
          tagIds: parsed.data.tagIds,
        };
        const saved = await updateProject(project.id, patch);
        toast.success(`${saved.name} saved`);
        onSaved(saved, "updated");
      } else {
        const created = await createProject(parsed.data);
        toast.success(`${created.name} created`);
        onSaved(created, "created");
      }
      onClose();
    } catch (error) {
      const { fields: serverFields, message } = fromApiError(error);
      setFields(serverFields);
      setFormError(message);
      toast.error(project ? "Could not save the project" : "Could not create the project", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  /**
   * FR-7.6. Scoped to the form rather than registered globally: ⌘Enter means
   * "submit the thing I am typing in", and a global binding would fire for a
   * form that is not open. `requestSubmit` rather than `submit()`, so the native
   * submit event — and therefore the handler above — actually runs.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  /* Zod reports a per-item failure as `techStack.3`, which no row is listening
     for; show whichever came first rather than swallowing it silently. */
  const stackError =
    fields.techStack ?? Object.entries(fields).find(([key]) => key.startsWith("techStack."))?.[1];

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={project ? `Edit ${project.name}` : "New project"}
        description={project ? undefined : "Only a name is required. Everything else can wait."}
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
              {project ? "Save changes" : "Create project"}
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" error={fields.name} required>
              {(props) => (
                <Input
                  {...props}
                  value={form.name}
                  data-autofocus
                  onChange={(event) => set("name", event.target.value)}
                />
              )}
            </Field>

            <Field label="Client" error={fields.client} hint="Who it is for, if anyone.">
              {(props) => (
                <Input
                  {...props}
                  value={form.client}
                  onChange={(event) => set("client", event.target.value)}
                />
              )}
            </Field>
          </div>

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
                  onChange={(event) => set("status", event.target.value as FormState["status"])}
                />
              )}
            </Field>

            <Field label="Engagement" error={fields.engagement} hint="Retainer, fixed price…">
              {(props) => (
                <Input
                  {...props}
                  value={form.engagement}
                  onChange={(event) => set("engagement", event.target.value)}
                />
              )}
            </Field>

            <Field label="Started" error={fields.startedAt}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.startedAt}
                  onChange={(event) => set("startedAt", event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Repository" error={fields.repoUrl}>
              {(props) => (
                <Input
                  {...props}
                  mono
                  inputMode="url"
                  placeholder="https://github.com/…"
                  value={form.repoUrl}
                  onChange={(event) => set("repoUrl", event.target.value)}
                />
              )}
            </Field>

            <Field label="Live site" error={fields.liveUrl}>
              {(props) => (
                <Input
                  {...props}
                  mono
                  inputMode="url"
                  placeholder="https://…"
                  value={form.liveUrl}
                  onChange={(event) => set("liveUrl", event.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="Tech stack" error={stackError}>
            {(props) => (
              <StackInput
                {...props}
                value={form.techStack}
                onChange={(items) => set("techStack", items)}
              />
            )}
          </Field>

          <Field label="Tags" error={fields.tagIds}>
            {(props) => (
              <TagInput
                {...props}
                value={form.tags}
                onChange={(next) => set("tags", next)}
                available={tags}
                onCreated={onTagCreated}
              />
            )}
          </Field>

          {/* The keyboard hint belongs beside the thing it operates, not in a
              help page nobody opens. */}
          <p className="text-xs text-ink-muted">
            Press{" "}
            <kbd className="rounded-sm border border-line bg-surface-sunken px-1 font-mono text-mono-sm">
              ⌘
            </kbd>{" "}
            <kbd className="rounded-sm border border-line bg-surface-sunken px-1 font-mono text-mono-sm">
              Enter
            </kbd>{" "}
            to save.
          </p>

          {/* Enter inside a single-line input submits a form only if the form has
              a submit button, and every visible button here is in the footer,
              outside it. */}
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
