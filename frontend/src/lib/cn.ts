import clsx, { type ClassValue } from "clsx";

/**
 * Conditional class names. Deliberately *not* tailwind-merge: with the token
 * namespaces reset in theme.css there is one spacing scale and one palette, so
 * the conflicts tailwind-merge exists to resolve are conflicts a component
 * should not be creating in the first place. If two classes fight, the variant
 * map is wrong.
 */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
