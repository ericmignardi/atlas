import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * The controls. Each one is a thin, forwarded wrapper over the native element —
 * no state, no context, no portal. They exist to hold the shared shape (height,
 * radius, border, invalid treatment) in one place, and to keep the native
 * behaviour intact: a native <select> gets the platform's keyboard handling and
 * mobile picker for free, and a hand-rolled one never quite does.
 */

/** Shared with TextArea and Select so the three line up in a form. */
const CONTROL = [
  "w-full bg-surface text-ink border border-line rounded-md",
  "placeholder:text-ink-muted",
  "transition-colors duration-150 ease-enter",
  "hover:border-ink-muted/40",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
  // The red border is what makes an invalid field visible without reading; the
  // message beneath is what makes it understandable. Both are required.
  "aria-[invalid=true]:border-red-600",
].join(" ");

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field, before the text. Search boxes and URL fields want it. */
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(CONTROL, "h-9 px-3 text-sm", mono && "font-mono text-mono-base", className)}
      {...rest}
    />
  );
});

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { rows = 4, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL, "px-3 py-2 text-sm resize-y min-h-[72px]", className)}
      {...rest}
    />
  );
});

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string = string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> {
  options: readonly SelectOption<T>[];
  /** The "no choice yet" row. Omit it and the first option is the default, which is often wrong. */
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(CONTROL, "h-9 pl-3 pr-9 text-sm appearance-none cursor-pointer", className)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
}

/**
 * The checkbox carries its own label rather than living inside a Field, because
 * a checkbox's label sits beside it and is part of its hit target — the vertical
 * label-above-control shape of every other row is wrong here.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, id, ...rest },
  ref,
) {
  return (
    <label
      className={cn("flex cursor-pointer items-start gap-2.5 select-none", className)}
      htmlFor={id}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-line",
          "accent-accent",
          "disabled:cursor-not-allowed disabled:opacity-55",
        )}
        {...rest}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-ink">{label}</span>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
});
