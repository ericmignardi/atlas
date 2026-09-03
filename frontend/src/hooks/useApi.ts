import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, isApiError } from "@/lib/apiClient";

/**
 * FR-8.1's three states, as one hook.
 *
 * Deliberately not TanStack Query. Atlas fetches five resources at a scale where
 * a cache would hold, at most, a few hundred rows; `refetch()` after a mutation
 * is a line of code, and a cache is a second source of truth that has to be
 * invalidated correctly at every call site. The trade is made once, here, rather
 * than argued at each page.
 *
 * What the hook does have to get right is the two things a hand-rolled fetch
 * usually gets wrong:
 *
 * - **Out-of-order responses.** Typing in the search box while a slow request is
 *   in flight means two requests race, and the older one can land last. Each run
 *   gets a sequence number and only the newest is allowed to write state.
 * - **Writing after unmount.** Navigating away mid-request otherwise sets state
 *   on a component that is gone. The same guard covers it.
 */

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  isLoading: boolean;
  /** True while a *subsequent* fetch runs, so a refresh does not blank the page. */
  isRefetching: boolean;
  refetch: () => Promise<void>;
  /**
   * Replaces the cached value without a round trip. A mutation that returns the
   * updated record can put it straight in, so the card updates on the same tick
   * the toast appears.
   */
  setData: (updater: T | ((current: T | undefined) => T)) => void;
}

interface UseApiOptions {
  /** Skip the request entirely — a detail page waiting on a route param, say. */
  enabled?: boolean;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options: UseApiOptions = {},
): ApiState<T> {
  const { enabled = true } = options;

  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefetching, setIsRefetching] = useState(false);

  /**
   * The fetcher is a fresh closure on every render — it has to be, since it
   * closes over the current filters. Held in a ref so `run` can stay stable and
   * the effect below can key on `deps` alone; keying on the function instead
   * would refetch on every keystroke anywhere in the tree.
   */
  const latestFetcher = useRef(fetcher);
  useEffect(() => {
    latestFetcher.current = fetcher;
  });

  const runId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const hasLoaded = useRef(false);

  const run = useCallback(async () => {
    const id = ++runId.current;
    const isFirst = !hasLoaded.current;

    if (isFirst) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

    try {
      const result = await latestFetcher.current();
      // A stale response is not an error and not a result — it is simply the
      // answer to a question nobody is asking any more.
      if (!mounted.current || id !== runId.current) return;
      hasLoaded.current = true;
      setDataState(result);
      setError(undefined);
    } catch (caught) {
      if (!mounted.current || id !== runId.current) return;
      setError(isApiError(caught) ? caught : new ApiError(0, "Something went wrong. Try again."));
    } finally {
      if (mounted.current && id === runId.current) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    // `deps` is the caller's dependency list; `run` is stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const setData = useCallback((updater: T | ((current: T | undefined) => T)) => {
    setDataState((current) =>
      typeof updater === "function" ? (updater as (c: T | undefined) => T)(current) : updater,
    );
  }, []);

  /**
   * `isLoading` is *derived* against `enabled` rather than written to state when
   * the hook is switched off. Setting it in the effect would be a synchronous
   * setState in an effect body — a cascading render, and one React now warns
   * about — for a value that is a pure function of a prop.
   */
  return { data, error, isLoading: enabled && isLoading, isRefetching, refetch: run, setData };
}
