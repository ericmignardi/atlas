# Atlas — frontend

React 19 · TypeScript · Vite · Tailwind v4 · Zustand · react-router · Zod · axios

```bash
npm install
npm run dev      # http://localhost:5173, /api proxied to :8080
npm run build    # tsc -b && vite build
npm run test     # vitest
npm run lint
```

The dev server proxies `/api` to `http://localhost:8080`, so the browser sees one origin and CORS
is not involved locally. It is in production, where the two services sit on different domains —
which is why the backend configures CORS explicitly rather than relying on the proxy.

## Layout

| Path | What lives there |
|---|---|
| `src/styles/theme.css` | The design system. Tailwind v4 is CSS-first, so this file *is* the configuration — there is no `tailwind.config.js`. |
| `src/lib/apiClient.ts` | The axios instance, the refresh interceptor, and `ApiError`. |
| `src/lib/design.ts` | Every enum value's label and colour recipe, in one map. |
| `src/schemas/` | Zod schemas mirroring the server's validation rules; types come from `z.infer`. |
| `src/stores/` | Zustand: `authStore`, `prefsStore`, `uiStore`. |
| `src/components/ui/` | The primitives. Built before any feature page, because every page needs them. |
| `src/components/layout/` | Sidebar, app shell, auth gate, width notice. |
| `src/routes/` | The route table and the two guards. |
| `src/pages/` | One module per route, each with a default export (`React.lazy` requires one). |

## Three things worth knowing

**The token namespaces are reset to `initial`.** `theme.css` deletes Tailwind's stock palette,
type scale, breakpoints, and shadows before declaring Atlas's own. `bg-blue-500` and a 18px
`text-lg` therefore generate no CSS at all — a class outside the system fails visibly instead of
shipping a colour nobody chose. It is the cheapest enforcement of a design system there is.

**The access token never touches storage.** It lives in memory; only the refresh token is
persisted, to `localStorage`. `authStore.ts` carries the full reasoning and what would change for
a production system — the short version is that an httpOnly refresh cookie is stronger, and this
build is explicit about the trade-off rather than silent about it.

**One refresh, however many requests.** When an access token expires with several requests in
flight, every one of them gets a 401 at the same moment. The server rotates refresh tokens, so
five independent refresh attempts means one success and four failures against a revoked token —
and the user is signed out mid-session. `apiClient.ts` shares a single in-flight promise; the
tests in `apiClient.test.ts` fire five parallel requests and assert exactly one refresh.

## Testing

Vitest with jsdom and Testing Library. The suite covers the two things that are genuinely hard to
verify by hand: the refresh interceptor's concurrency guard, and the rule that a global shortcut
does not fire while a text input has focus.
