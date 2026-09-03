import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { checkFormat, PLATFORM_FIELDS, type FormatCheck } from "@/lib/environmentFormat";
import { createEnvironment, updateEnvironment } from "@/lib/environmentsApi";
import { labelFor } from "@/lib/design";
import { environmentCreateSchema } from "@/schemas/environment";
import { fromApiError, parseForm, type FieldErrors } from "@/schemas/fieldErrors";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  ENVIRONMENT_TYPES,
  PLATFORMS,
  type EnvironmentResponse,
  type EnvironmentType,
  type Platform,
  type ProjectResponse,
} from "@/types/api";

/**
 * §7.3 and FR-3.16. One modal for create and edit, on the same reasoning as
 * `ProjectFormModal` — and remounted by key for the same reason, so opening it
 * on a different environment is one render with the right values rather than
 * two with the previous one's.
 *
 * What is different here is that **the platform changes the form**. The `url`
 * column carries a Vercel deployment URL and a Neon connection string, and a
 * field labelled "URL" is unhelpful for one of them. Selecting a platform
 * relabels the field, changes its placeholder, and changes what "Check format"
 * looks for.
 */

interface FormState {
  name: string;
  platform: Platform;
  type: EnvironmentType;
  branch: string;
  url: string;
  notes: string;
  /** Only ever edited on create; FR-3.1 does not allow moving an environment. */
  projectId: string;
}

const blank = (type: EnvironmentType, projectId: string): FormState => ({
  name: "",
  platform: "VERCEL",
  type,
  branch: "",
  url: "",
  notes: "",
  projectId,
});

const fromEnvironment = (environment: EnvironmentResponse): FormState => ({
  projectId: environment.projectId,
  name: environment.name,
  platform: environment.platform,
  type: environment.type,
  branch: environment.branch ?? "",
  url: environment.url ?? "",
  notes: environment.notes ?? "",
});

const PLATFORM_OPTIONS = PLATFORMS.map((platform) => ({
  value: platform,
  label: labelFor.platform(platform),
}));

const TYPE_OPTIONS = ENVIRONMENT_TYPES.map((type) => ({
  value: type,
  label: labelFor.environmentType(type),
}));

interface EnvironmentFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Absent for create, present for edit — the only thing that switches mode. */
  environment?: EnvironmentResponse;
  /** Pre-selects the group whose Add button was pressed. */
  defaultType?: EnvironmentType;
  /**
   * Turns `projectId` from the answer into the default. Passed only by quick add
   * (FR-6.6), which is the one caller that is not already inside a project — the
   * map knows which project it is drawing and does not offer the choice.
   *
   * Create only. FR-3.1 hangs an environment off a project permanently, and a
   * select that quietly reparents one on edit would be a data migration wearing
   * a dropdown.
   */
  projects?: readonly ProjectResponse[];
  onSaved: (environment: EnvironmentResponse, mode: "created" | "updated") => void;
}

export const EnvironmentFormModal = (props: EnvironmentFormModalProps) => {
  if (!props.open) return null;
  return <EnvironmentForm key={props.environment?.id ?? "new"} {...props} />;
};

const EnvironmentForm = ({
  onClose,
  projectId,
  environment,
  defaultType = "PRODUCTION",
  projects,
  onSaved,
}: EnvironmentFormModalProps) => {
  const initial = useMemo(
    () => (environment ? fromEnvironment(environment) : blank(defaultType, projectId)),
    [environment, defaultType, projectId],
  );

  const [form, setForm] = useState<FormState>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [format, setFormat] = useState<FormatCheck | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const copy = PLATFORM_FIELDS[form.platform];
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /**
   * FR-3.12 is a server invariant, and the form's job is to say so *before* the
   * save rather than after: changing the type of a paired environment releases
   * the pairing on both sides, and finding that out from a tile that quietly
   * lost its partner is how a user stops trusting the screen.
   */
  const breaksPairing =
    environment !== undefined && environment.pairedWith !== null && form.type !== environment.type;

  const requestClose = () => {
    if (dirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const submit = async () => {
    setFormError(null);

    const parsed = parseForm(environmentCreateSchema, {
      projectId: form.projectId,
      name: form.name,
      platform: form.platform,
      type: form.type,
      branch: form.branch.trim() || undefined,
      url: form.url.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });

    if (!parsed.ok) {
      setFields(parsed.fields);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      if (environment) {
        // An emptied input clears the column, so it goes as an explicit null;
        // `undefined` would drop the key and the old value would survive a save
        // the user watched succeed (§6.9).
        const saved = await updateEnvironment(environment.id, {
          name: parsed.data.name,
          platform: parsed.data.platform,
          type: parsed.data.type,
          branch: parsed.data.branch ?? null,
          url: parsed.data.url ?? null,
          notes: parsed.data.notes ?? null,
        });
        toast.success(saved.name + " saved");
        onSaved(saved, "updated");
      } else {
        const created = await createEnvironment(parsed.data);
        toast.success(created.name + " created");
        onSaved(created, "created");
      }
      onClose();
    } catch (error) {
      const { fields: serverFields, message } = fromApiError(error);
      setFields(serverFields);
      setFormError(message);
      toast.error(
        environment ? "Could not save the environment" : "Could not create the environment",
        message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  /** FR-7.6, scoped to this form — see `ProjectFormModal` for why not globally. */
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
        title={environment ? "Edit " + environment.name : "New environment"}
        description={
          environment ? undefined : "A deployment target: where something of yours actually runs."
        }
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
              {environment ? "Save changes" : "Create environment"}
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

          {/* Only when the caller could not answer it already. */}
          {!environment && projects && (
            <Field label="Project" error={fields.projectId} required>
              {(props) => (
                <Select
                  {...props}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  value={form.projectId}
                  onChange={(event) => set("projectId", event.target.value)}
                />
              )}
            </Field>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Name" error={fields.name} required>
              {(props) => (
                <Input
                  {...props}
                  value={form.name}
                  data-autofocus
                  placeholder="Web (Vercel)"
                  onChange={(event) => set("name", event.target.value)}
                />
              )}
            </Field>

            <Field
              label="Platform"
              error={fields.platform}
              hint={form.platform === "NEON" ? "Neon rows count as databases." : undefined}
            >
              {(props) => (
                <Select
                  {...props}
                  options={PLATFORM_OPTIONS}
                  value={form.platform}
                  onChange={(event) => {
                    set("platform", event.target.value as Platform);
                    // The old verdict answered a different format question.
                    setFormat(null);
                  }}
                />
              )}
            </Field>

            <Field label="Type" error={fields.type}>
              {(props) => (
                <Select
                  {...props}
                  options={TYPE_OPTIONS}
                  value={form.type}
                  onChange={(event) => set("type", event.target.value as EnvironmentType)}
                />
              )}
            </Field>
          </div>

          {breaksPairing && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-tint-amber-line bg-tint-amber px-3 py-2 text-sm text-tint-amber-ink"
            >
              <Icon name="warning" size={15} />
              {environment?.name} is paired with {environment?.pairedWith?.name}. Two environments
              can only be paired when they share a type, so saving this releases the pairing on both
              sides.
            </p>
          )}

          <Field label="Branch" error={fields.branch}>
            {(props) => (
              <Input
                {...props}
                mono
                placeholder={copy.branchPlaceholder}
                value={form.branch}
                onChange={(event) => set("branch", event.target.value)}
              />
            )}
          </Field>

          {/* FR-3.16: the label, the placeholder, and the hint all come from the
              selected platform. */}
          <Field label={copy.urlLabel} error={fields.url} hint={copy.urlHint}>
            {(props) => (
              <Input
                {...props}
                mono
                placeholder={copy.urlPlaceholder}
                value={form.url}
                onChange={(event) => {
                  set("url", event.target.value);
                  setFormat(null);
                }}
              />
            )}
          </Field>

          {/*
            FR-3.17. The disclaimer is not hedging and it is not decoration: a
            pass here means the string is *shaped* like one and nothing more.
            Saying "no connection is attempted" in as many words is the whole
            difference between a useful check and one that gets read as "the
            database is up" the first time it matters.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon="check"
              onClick={() => setFormat(checkFormat(form.platform, form.url))}
            >
              Check format
            </Button>
            <span className="text-xs text-ink-muted">
              Format only — no connection is attempted.
            </span>

            {format && (
              <p
                role="status"
                className={cn(
                  "flex w-full items-start gap-1.5 rounded-md border px-3 py-2 text-sm",
                  format.ok
                    ? "border-tint-green-line bg-tint-green text-tint-green-ink"
                    : "border-tint-amber-line bg-tint-amber text-tint-amber-ink",
                )}
              >
                <Icon name={format.ok ? "success" : "warning"} size={15} />
                {format.message}
              </p>
            )}
          </div>

          <Field label="Notes" error={fields.notes}>
            {(props) => (
              <TextArea
                {...props}
                rows={3}
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
              />
            )}
          </Field>

          {/* Enter inside a single-line input submits only if the form has a
              submit button, and every visible one is in the footer, outside it. */}
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
