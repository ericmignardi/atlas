import { useEffect, useState } from "react";

type Health = "checking" | "ok" | "unreachable";

/**
 * Walking skeleton. The only job today is to prove the round trip: the Vite dev
 * proxy forwards same-origin /api/... to :8080, so CORS is not involved locally.
 * It will be in production, where the two services sit on different Azure
 * domains — which is why CORS gets configured properly on Day 5.
 */
const App = () => {
  const [api, setApi] = useState<Health>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ping", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { status?: string }) => setApi(body.status === "ok" ? "ok" : "unreachable"))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setApi("unreachable");
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-dvh grid place-items-center p-8">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <p className="text-eyebrow uppercase text-ink-muted">Atlas</p>
        <h1 className="mt-1 text-xl text-ink">Walking skeleton</h1>
        <dl className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <dt className="text-sm text-ink-secondary">GET /api/ping</dt>
          <dd
            className={
              api === "ok"
                ? "text-mono-sm font-mono text-green-600"
                : api === "unreachable"
                  ? "text-mono-sm font-mono text-red-600"
                  : "text-mono-sm font-mono text-ink-muted"
            }
          >
            {api}
          </dd>
        </dl>
      </div>
    </main>
  );
};

export default App;
