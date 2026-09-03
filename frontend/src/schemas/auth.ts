import { z } from "zod";

/**
 * PRD §7.1. The server is authoritative — these exist to fail a form in 0 ms
 * instead of 200, and to keep the submit button honest. Anything that gets past
 * them is still checked again by Bean Validation, and the server's `fields` map
 * is what the inputs actually render on submit (FR-8.4).
 */

const email = z
  .email("Enter a valid email address")
  .max(320, "Must be at most 320 characters")
  .transform((value) => value.trim().toLowerCase());

/**
 * FR-1.12. Three separate checks rather than one regex, because "too short" and
 * "no digit" are different problems and the form should be able to say which.
 */
const password = z
  .string()
  .min(10, "Must be at least 10 characters")
  .max(100, "Must be at most 100 characters")
  .regex(/[A-Za-z]/, "Must contain a letter")
  .regex(/[0-9]/, "Must contain a digit");

export const loginSchema = z.object({
  /** No shape rules on sign-in: an account created under an older policy still has to get in. */
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string().min(1, "Confirm your password"),
    displayName: z
      .string()
      .max(80, "Must be at most 80 characters")
      .transform((value) => value.trim())
      .optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
