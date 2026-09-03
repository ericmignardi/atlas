import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { describe, expect, it, beforeEach } from "vitest";

import { GuestRoute, ProtectedRoute, type FromLocationState } from "@/routes/guards";
import { useAuthStore } from "@/stores/authStore";

/**
 * The two things a guard has to get right: keep anonymous visitors out, and put
 * them back where they were going once they sign in. The second is the one that
 * quietly stops working — the redirect still happens, the destination is just
 * silently lost, and nobody notices until they bookmark a deep link.
 */

const anonymous = () =>
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, status: "anonymous" });

const authenticated = () =>
  useAuthStore.setState({ accessToken: "token", refreshToken: "r", status: "authenticated" });

/**
 * Renders the location state the guard handed to /login, so the test can read
 * it. Via `useLocation` rather than `window.history`: a memory router keeps its
 * own stack and never touches the browser's.
 */
const LoginProbe = () => {
  const state = useLocation().state as FromLocationState | null;
  return <p>login:{state?.from ?? "none"}</p>;
};

function renderAt(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginProbe /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "/projects", element: <p>projects page</p> }],
      },
      {
        element: <GuestRoute />,
        children: [{ path: "/register", element: <p>register page</p> }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  anonymous();
});

describe("ProtectedRoute", () => {
  it("sends an anonymous visitor to /login", async () => {
    renderAt("/projects");
    expect(await screen.findByText(/^login:/)).toBeInTheDocument();
    expect(screen.queryByText("projects page")).not.toBeInTheDocument();
  });

  it("renders the page for an authenticated user", async () => {
    authenticated();
    renderAt("/projects");
    expect(await screen.findByText("projects page")).toBeInTheDocument();
  });

  it("carries the attempted path so login can return the user to it", async () => {
    renderAt("/projects");
    // Not a query string: the path never reaches the server, never lands in an
    // access log, and cannot be turned into an open redirect from a crafted URL.
    expect(await screen.findByText("login:/projects")).toBeInTheDocument();
  });
});

describe("GuestRoute", () => {
  it("shows the form to an anonymous visitor", async () => {
    renderAt("/register");
    expect(await screen.findByText("register page")).toBeInTheDocument();
  });

  it("bounces a signed-in user off the register page", async () => {
    authenticated();
    renderAt("/register");
    expect(screen.queryByText("register page")).not.toBeInTheDocument();
  });
});
