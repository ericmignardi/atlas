import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("reports ok when /api/ping answers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    expect(await screen.findByText("ok")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/ping", expect.anything());
  });

  it("reports unreachable when the backend is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    render(<App />);

    expect(await screen.findByText("unreachable")).toBeInTheDocument();
  });
});
