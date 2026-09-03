import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { register } from "@/lib/authApi";
import { registerSchema } from "@/schemas/auth";
import { fromApiError, parseForm, type FieldErrors } from "@/schemas/fieldErrors";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "@/pages/AuthShell";

const RegisterPage = () => {
  const navigate = useNavigate();

  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();

    const parsed = parseForm(registerSchema, {
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
      // An empty optional field is absent, not "". The server treats a blank
      // display name as null anyway; sending "" just makes the two disagree.
      displayName: displayName || undefined,
    });

    if (!parsed.ok) {
      setFields(parsed.fields);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      // Registration signs the user in — the server returns a full AuthResponse,
      // so making them type the same password again on a login form would be
      // ceremony with no purpose.
      await register(parsed.data);
      navigate("/", { replace: true });
    } catch (error) {
      const { fields: serverFields, message } = fromApiError(error);
      setFields(serverFields);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create an account"
      subtitle="One place for every project you have running."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p
            role="alert"
            className="rounded-md border border-tint-red-line bg-tint-red px-3 py-2 text-sm text-tint-red-ink"
          >
            {formError}
          </p>
        )}

        <Field label="Email" error={fields.email} required>
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Field label="Display name" error={fields.displayName} hint="Optional.">
          {(props) => <Input {...props} name="displayName" autoComplete="name" />}
        </Field>

        <Field
          label="Password"
          error={fields.password}
          hint="At least 10 characters, with a letter and a digit."
          required
        >
          {(props) => (
            <Input {...props} name="password" type="password" autoComplete="new-password" />
          )}
        </Field>

        <Field label="Confirm password" error={fields.confirmPassword} required>
          {(props) => (
            <Input {...props} name="confirmPassword" type="password" autoComplete="new-password" />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
