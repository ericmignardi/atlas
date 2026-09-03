import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { login } from "@/lib/authApi";
import { loginSchema } from "@/schemas/auth";
import { fromApiError, parseForm, type FieldErrors } from "@/schemas/fieldErrors";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "@/pages/AuthShell";
import type { FromLocationState } from "@/routes/guards";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Where ProtectedRoute was sending them before it bounced them here. */
  const destination = (location.state as FromLocationState | null)?.from ?? "/";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = parseForm(loginSchema, {
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.ok) {
      setFields(parsed.fields);
      return;
    }

    setFields({});
    setSubmitting(true);
    try {
      await login(parsed.data);
      // `replace`, so Back from the dashboard does not land on the login form
      // of a session the user is already inside.
      navigate(destination, { replace: true });
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
      title="Sign in"
      subtitle="Your projects, environments, and tasks."
      footer={
        <>
          No account?{" "}
          <Link to="/register" className="text-accent hover:text-accent-hover">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          /**
           * The banner is for what has no field to sit beside. A wrong password
           * returns 401 with one message for both "no such email" and "wrong
           * password" (PRD §6.2), so putting it under the email input would
           * claim more than the server said.
           */
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

        <Field label="Password" error={fields.password} required>
          {(props) => (
            <Input {...props} name="password" type="password" autoComplete="current-password" />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
