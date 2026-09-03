import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * The frame both auth pages sit in. Not the app shell — there is no sidebar to
 * show, no counts to fetch, and nothing to navigate to yet.
 *
 * It is also the one screen deliberately exempt from the 768 px notice: signing
 * in works fine on a narrow window even though the board does not, and locking
 * someone out of the login form for being on a laptop in split-screen would be
 * absurd.
 */
export const AuthShell = ({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) => (
  <main className="grid min-h-dvh place-items-center px-6 py-12">
    <div className="w-full max-w-[400px]">
      <Link to="/" className="mb-6 block text-center text-lg tracking-tight text-ink">
        Atlas
      </Link>

      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </div>

      <p className="mt-4 text-center text-sm text-ink-secondary">{footer}</p>
    </div>
  </main>
);
