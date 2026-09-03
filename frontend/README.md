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
| `src/components/projects/`, `src/components/tags/` | Feature components — the card, the toolbar, the two form modals, `TagInput`, `StackInput`. |
| `src/hooks/useApi.ts` | The three states of FR-8.1, plus the stale-response guard. |
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

**Filtering happens in the browser.** `GET /api/projects` is fetched once and narrowed by
`lib/projectFilters.ts` — pure functions over the fetched array. At the scale Atlas is built for
that is instant, it makes every filter change free, and it removes the class of bug where a
filter change races the response to the previous one. The endpoints still support the same
filters server-side, which is where this moves if the data ever grows.

## Testing

Vitest with jsdom and Testing Library. The suite covers the things that are genuinely hard to
verify by hand:

| File | What it protects |
|---|---|
| `lib/apiClient.test.ts` | The refresh interceptor's concurrency guard — five parallel 401s, exactly one refresh. |
| `hooks/useKeyboardShortcuts.test.tsx` | A global shortcut does not fire while a text input has focus. |
| `hooks/useApi.test.tsx` | A slow response that lands after a newer one is discarded, not rendered. |
| `components/ui/Modal.test.tsx` | The focus trap does not steal the caret from a field on every keystroke. |
| `lib/projectFilters.test.ts` | FR-2.7's archived exception and FR-2.8's pinned-first ordering. |
| `components/projects/TagInput.test.tsx` | Autocomplete, the "Create *name*" row, and Backspace-removes-a-chip. |
| `pages/ProjectsPage.test.tsx` | The 409 on a fifth pin rolls the optimistic toggle back. |
| `pages/ProjectDetailPage.test.tsx` | `?tab=` drives the open tab, both directions. |
