import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useApi } from "@/hooks/useApi";

/**
 * The one thing a hand-rolled fetch hook gets wrong, and the reason this hook
 * exists rather than a `useEffect` per page.
 *
 * Type "at" then "atl" in the search box and two requests are in flight. If the
 * first is slower — which is entirely ordinary, they are different queries
 * against different indexes — it lands *after* the second, and the list shows
 * results for a query the input no longer contains. It is intermittent, it never
 * reproduces on a fast connection, and it looks like a caching bug.
 */

const Harness = ({ token, resolve }: { token: string; resolve: () => Promise<string> }) => {
  const state = useApi(resolve, [token]);
  return <p data-testid="value">{state.isLoading ? "loading" : (state.data ?? "none")}</p>;
};

/** A promise whose settling this test controls, so the race is deterministic. */
function deferred<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

describe("useApi", () => {
  it("ignores a stale response that lands after a newer one", async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const { rerender } = render(<Harness token="at" resolve={() => first.promise} />);

    // The dependency changes, so a second request starts while the first is
    // still open — exactly what the debounced search box produces.
    rerender(<Harness token="atl" resolve={() => second.promise} />);

    second.settle("results for atl");
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("results for atl"));

    // The slow first request now answers a question nobody is asking.
    first.settle("results for at");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId("value")).toHaveTextContent("results for atl");
  });

  it("reports an error and can be retried into a success", async () => {
    let attempt = 0;
    const resolve = () => {
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error("down")) : Promise.resolve("ok");
    };

    const Retrying = () => {
      const state = useApi(resolve, []);
      return (
        <>
          <p data-testid="value">{state.error ? state.error.message : (state.data ?? "…")}</p>
          <button type="button" onClick={() => void state.refetch()}>
            Retry
          </button>
        </>
      );
    };

    const user = userEvent.setup();
    render(<Retrying />);

    // A thrown Error is not an ApiError; the hook normalises it so the error
    // state has something to render either way (FR-8.1).
    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("Something went wrong. Try again."),
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("ok"));
  });
});
