import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface FieldProps {
  label: string;
  /** The server's message for this field, or the client's. Either way it renders here (FR-8.4). */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /**
   * Render-prop rather than plain children, so the label, the error, and the
   * control cannot get out of sync: the control is *handed* the ids it must
   * carry, instead of being trusted to declare them.
   */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
  }) => ReactNode;
}

/**
 * Label, control, error, hint — the four parts of a form row, wired together.
 *
 * The wiring is the reason this exists. `aria-describedby` has to point at the
 * error when there is one and the hint when there is not, `aria-invalid` has to
 * appear and disappear with the error, and the label's `htmlFor` has to match an
 * id that is unique across every instance on the page. Done by hand at thirty
 * call sites, at least one of them is wrong.
 */
export const Field = ({
  label,
  error,
  hint,
  required = false,
  className,
  children,
}: FieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs text-ink-secondary">
        {label}
        {required && (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        /* Polite, not assertive: the message appears as the user leaves the
           field or submits, and interrupting them mid-keystroke is worse. */
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
};
