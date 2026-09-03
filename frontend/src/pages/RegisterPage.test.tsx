import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRefreshState, __setAdapter } from "@/lib/apiClient";
import RegisterPage from "@/pages/RegisterPage";
import { useAuthStore } from "@/stores/authStore";

/**
 * FR-8.4: validation failures render at field level, driven by the server's
 * `fields` map — not as a banner. The banner is for what has no field to sit
 * beside, and the difference between the two is the whole requirement.
 *
 * The 400 body here is copied from a live response, so if the server's error
 * shape ever changes this test is where it shows up.
 */

const renderPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: "/", element: <RegisterPage /> }], {
        initialEntries: ["/"],
      })}
    />,
  );

const respondWith = (status: number, data: unknown) =>
  __setAdapter(async (config) => {
    throw new AxiosError("failed", String(status), config, {}, {
      data,
      status,
      statusText: "Error",
      headers: new AxiosHeaders(),
      config,
    } as AxiosResponse);
  });

beforeEach(() => {
  __resetRefreshState();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, status: "anonymous" });
});

afterEach(() => {
  __resetRefreshState();
});

describe("RegisterPage", () => {
  it("puts the server's field errors beside the right inputs", async () => {
    respondWith(400, {
      timestamp: "2026-09-03T10:37:32Z",
      status: 400,
      error: "Validation failed",
      path: "/api/auth/register",
      fields: { email: ["is already registered"] },
    });

    const user = userEvent.setup();
    renderPage();

    // Values the client schema accepts, so the request actually leaves and the
    // server is the one that rejects it. Otherwise this would test Zod twice.
    await user.type(screen.getByLabelText(/^Email/), "taken@atlas.test");
    await user.type(screen.getByLabelText(/^Password/), "long-enough-1");
    await user.type(screen.getByLabelText(/^Confirm password/), "long-enough-1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const message = await screen.findByText("Is already registered");
    // Beside the input, not floating at the top of the form: the error element
    // is the one the email field points at with aria-describedby.
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute(
      "aria-describedby",
      message.getAttribute("id"),
    );
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute("aria-invalid", "true");
  });

  it("validates on the client before it touches the network", async () => {
    // No adapter that succeeds: if the form submitted, this would throw.
    respondWith(500, { status: 500, error: "should not be reached" });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/), "someone@atlas.test");
    await user.type(screen.getByLabelText(/^Password/), "short");
    await user.type(screen.getByLabelText(/^Confirm password/), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Must be at least 10 characters")).toBeInTheDocument();
  });

  it("reports a mismatched confirmation against the confirmation field", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/), "someone@atlas.test");
    await user.type(screen.getByLabelText(/^Password/), "long-enough-1");
    await user.type(screen.getByLabelText(/^Confirm password/), "long-enough-2");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });
});
