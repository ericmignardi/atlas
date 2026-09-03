import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { createTag, updateTag } from "@/lib/tagsApi";
import { TAG_PALETTE, TINT_CLASSES, tintForColor } from "@/lib/design";
import { tagCreateSchema } from "@/schemas/tag";
import { fromApiError, parseForm, type FieldErrors } from "@/schemas/fieldErrors";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { TagResponse } from "@/types/api";

/**
 * §7.5. Rename and recolour, and the same modal creates one.
 *
 * The colour is a row of seven swatches rather than a colour input. FR-5.4 and
 * §9.5 define exactly seven recipes; a free colour picker would let someone
 * choose a hex that `tintForColor` does not recognise, and the chip would fall
 * back to neutral with no explanation of why the colour they picked did nothing.
 */

interface TagFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Absent for create. */
  tag?: TagResponse;
  onSaved: (tag: TagResponse) => void;
}

/** Mounted fresh per tag, for the reason spelled out in `ProjectFormModal`. */
export const TagFormModal = (props: TagFormModalProps) => {
  if (!props.open) return null;
  return <TagForm key={props.tag?.id ?? "new"} {...props} />;
};

const TagForm = ({ onClose, tag, onSaved }: TagFormModalProps) => {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState<string>(tag?.color ?? TAG_PALETTE[0].hex);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const colourLabelId = useId();

  const submit = async () => {
    setFormError(null);

    /**
     * The create schema in both modes. The form always carries both fields, and
     * `tagUpdateSchema` makes them optional — which is right for a PATCH built
     * from somewhere else, and wrong here, where a blank name is a mistake the
     * user should be told about rather than a key quietly left out.
     */
    const parsed = parseForm(tagCreateSchema, { name, color });
    if (!parsed.ok) {
      setFields(parsed.fields);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      // FR-5.3: creating a name that exists returns the existing tag with a 200
      // rather than a conflict, so this cannot produce a duplicate.
      const saved = tag ? await updateTag(tag.id, parsed.data) : await createTag(parsed.data);
      toast.success(tag ? `${saved.name} saved` : `${saved.name} created`);
      onSaved(saved);
      onClose();
    } catch (error) {
      const { fields: serverFields, message } = fromApiError(error);
      setFields(serverFields);
      setFormError(message);
      toast.error(tag ? "Could not save that tag" : "Could not create that tag", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  /** FR-7.6, scoped to this form for the same reason as the project one. */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const preview = name.trim().toLowerCase() || "tag";

  return (
    <Modal
      open
      onClose={onClose}
      title={tag ? `Edit ${tag.name}` : "New tag"}
      description="Names are lowercased, and unique across your account."
      footer={
        <>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {tag ? "Save changes" : "Create tag"}
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

        <Field label="Name" error={fields.name} required>
          {(props) => (
            <Input
              {...props}
              value={name}
              data-autofocus
              placeholder="client-work"
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        {/*
          Not a `Field`: that component wires a `<label for>` to a control, and
          a radiogroup is a div — a label pointing at one names nothing. The
          group is labelled by the text instead, which is what the ARIA pattern
          asks for.
        */}
        <div className="flex flex-col gap-1.5">
          <span id={colourLabelId} className="text-xs text-ink-secondary">
            Colour
          </span>
          <div
            role="radiogroup"
            aria-labelledby={colourLabelId}
            className="flex flex-wrap items-center gap-2"
          >
            {TAG_PALETTE.map((entry) => {
              const selected = color.toLowerCase() === entry.hex.toLowerCase();
              return (
                <button
                  key={entry.hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={entry.tint}
                  onClick={() => setColor(entry.hex)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border",
                    "transition-colors duration-150 ease-enter",
                    TINT_CLASSES[entry.tint],
                    selected && "ring-2 ring-accent/40",
                  )}
                >
                  {selected && <Icon name="check" size={14} />}
                </button>
              );
            })}
          </div>
          {fields.color && (
            <p role="alert" className="text-xs text-red-600">
              {fields.color}
            </p>
          )}
        </div>

        {/* The point of a preview is that a colour name means nothing until you
            see the chip it produces. */}
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2">
          <span className="text-xs text-ink-muted">Preview</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
              TINT_CLASSES[tintForColor(color)],
            )}
          >
            {preview}
          </span>
        </div>

        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
};
