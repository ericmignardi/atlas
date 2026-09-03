import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Four variants, three sizes. That is the whole vocabulary — a fifth variant is
 * a design decision, not a prop, and belongs in a conversation about the system
 * rather than in one component's signature.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent border-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary: "bg-surface text-ink border-line hover:bg-surface-sunken",
  ghost:
    "bg-transparent text-ink-secondary border-transparent hover:bg-surface-sunken hover:text-ink",
  danger: "bg-red-600 text-on-accent border-red-600 hover:bg-red-700 hover:border-red-700",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 gap-1.5 text-xs rounded-sm",
  md: "h-9 px-3.5 gap-2 text-sm rounded-md",
  lg: "h-11 px-5 gap-2 text-base rounded-md",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconAfter?: IconName;
  /**
   * Shows a spinner and disables the button. Separate from `disabled` because
   * the two mean different things to a screen reader: busy is temporary.
   */
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon,
    iconAfter,
    loading = false,
    fullWidth = false,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center border font-medium",
        "transition-colors duration-150 ease-enter",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="spinner" size={ICON_SIZE[size]} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={ICON_SIZE[size]} />
      )}
      {children}
      {iconAfter && !loading && <Icon name={iconAfter} size={ICON_SIZE[size]} />}
    </button>
  );
});

/**
 * A button whose entire content is an icon. Split out rather than made a prop,
 * because it has one requirement an ordinary button does not: a `label`, which
 * is the only thing a screen reader will ever get from it.
 */
interface IconButtonProps extends Omit<ButtonProps, "children" | "icon" | "iconAfter"> {
  icon: IconName;
  label: string;
}

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 w-7 rounded-sm",
  md: "h-9 w-9 rounded-md",
  lg: "h-11 w-11 rounded-md",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "ghost", size = "md", loading = false, className, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      loading={loading}
      aria-label={label}
      title={label}
      className={cn("px-0", ICON_ONLY_SIZES[size], className)}
      {...rest}
    >
      {/* The base button already draws the spinner; a second glyph beside it would just wobble. */}
      {!loading && <Icon name={icon} size={ICON_SIZE[size]} />}
    </Button>
  );
});
