<h1 align="center">Atlas</h1>

<p align="center">
  <strong>A personal developer portal that maps where your projects live.</strong>
</p>

<p align="center">
  <a href="#live-demo">Live demo</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#running-locally">Running locally</a> ·
  <a href="#api">API</a> ·
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img alt="Java 21"        src="https://img.shields.io/badge/Java-21-007396?logo=openjdk&logoColor=white">
  <img alt="Spring Boot"    src="https://img.shields.io/badge/Spring%20Boot-3.5-6DB33F?logo=springboot&logoColor=white">
  <img alt="PostgreSQL"     src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="React"          src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript"     src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Azure"          src="https://img.shields.io/badge/Azure-Container%20Apps-0078D4?logo=microsoftazure&logoColor=white">
</p>

---

## What Atlas is

A solo developer running several projects at once loses track of **where things are deployed and
what each deployment is pointed at**. Not the code — the code is in Git and Git is fine. The
problem is everything around it: which Vercel project serves that domain, whether the preview
deployment is talking to production data or its own Neon branch, and which of six environments is
safe to run a migration against. That information lives in browser tabs, three vendor dashboards,
and memory, and it decays.

Atlas is a personal developer portal built around that problem. Its centrepiece is the
**environment map**: for every project, every environment, on every platform, with each
application environment explicitly **paired** to the database environment it points at. Tasks,
tags, and a dashboard wrap around that spine so the portal is worth opening every morning rather
than only when something breaks.

> Built by hand as a portfolio project — no code generation — over ten working days in September
> 2026. The design brief, requirements, and day-by-day build plan are in
> [`docs/PRD.md`](docs/PRD.md) and [`docs/PLAN.md`](docs/PLAN.md).

---

## Live demo

**https://&lt;your-static-web-app&gt;.azurestaticapps.net**

| | |
|---|---|
| **Email** | `demo@atlas.dev` |
| **Password** | `demo-password-1` |

> **First load takes 10–30 seconds.** The backend runs on Azure Container Apps with
> `min-replicas: 0`, so it scales to zero when idle and costs nothing to host. The first request
> after a quiet period wakes the container. Everything after that is fast. This is a deliberate
> trade-off for a free-tier deployment, not a bug — see [Deployment](#deployment).

Demo data resets periodically.

---

## Screenshots

<!-- Capture at 1440px wide. See docs/PLAN.md Day 10 §10.7. -->

|  |  |
|---|---|
| ![Dashboard](./img/dashboard.png)<br>**Dashboard** — stats, pinned projects, and what needs attention today | ![Environment map](./img/environments.png)<br>**Environment map** — apps paired with the databases they point at |
| ![Task board](./img/board.png)<br>**Task board** — four columns, drag-and-drop, keyboard-operable | ![Command palette](./img/palette.png)<br>**Command palette** — ⌘K from anywhere |

---

## Features

### Projects
Full lifecycle from `IDEA` to `ARCHIVED`, with automatic slug generation (uniqueness handled by
appending `-2`, `-3`, … per user), client attribution, a monospace tech-stack chip list, repo and
live links, and pinning — capped at four, so the dashboard stays a summary rather than a second
list. Archived projects drop out of every default view without being deleted. Filter by status,
client, or tag; search across name, client, and description.

### Environments — the centrepiece
Every project holds environments grouped into Production, Preview, and Development. Each carries
its platform (Vercel, Neon, Local, Other), branch, URL or connection string, and free-text notes.

The interesting part is **pairing**: an application environment is explicitly linked to the
database environment it points at, and the two render side by side. Modelled as a
self-referencing one-to-one with a `UNIQUE` constraint on the foreign key, which makes a set of
invariants enforceable rather than aspirational:

- An environment has at most one partner, and the relationship is always symmetric
- Partners must share the same project **and** the same type
- Pairing over an existing partnership releases the old partner first — no dangling references
- Changing an environment's type breaks the pairing on both sides
- Deleting an environment releases its partner before the row goes

Each of those has a dedicated test. The unique constraint is the backstop if the service logic is
ever wrong.

### Tasks
A kanban board with four columns and HTML5 drag-and-drop, plus a sortable list view. New tasks
land at the **top** of their column, not the bottom. Completion timestamps are set by the server
on the transition into `DONE` and cleared on the way out — never accepted from the client. Overdue
detection feeds the dashboard's "Needs attention" rail, partitioned into overdue, due today, and
the next seven days. Every drag has a keyboard equivalent.

### Tags
Shared across entities through join tables, created on demand — asking for a tag that already
exists returns the existing one rather than duplicating it. Names are normalised to lowercase, and
new tags cycle a fixed seven-colour palette so a tag set stays visually distinguishable.

### Throughout
`⌘K` command palette searching every entity type · keyboard shortcuts for every primary action ·
skeleton loading states with matched geometry (no spinners) · empty states that distinguish
"nothing yet" from "nothing matches your filters" · field-level validation errors driven by the
server · confirmation on every destructive action.

---

## Tech stack

### Backend

| Choice | Why |
|---|---|
| **Java 21 (LTS)** | The LTS that Spring Boot 3.5 targets and that employers ask for. Records, pattern matching, and text blocks all earn their place in this codebase. |
| **Spring Boot 3.5** | Layered controller → service → repository, with business logic in the service layer rather than smeared across controllers. |
| **Spring Security** | Configured by hand, not scaffolded: BCrypt (strength 12), a custom JWT filter, stateless sessions, and ownership enforced in the service layer. |
| **Spring Data JPA / Hibernate** | Non-trivial modelling — enums as strings, a many-to-many through a join entity, and a self-referencing one-to-one with a unique constraint. `open-in-view` is off so N+1 problems surface immediately. |
| **PostgreSQL 16** | Native `uuid` and `text[]` support, both of which this schema uses. |
| **Flyway** | Every schema change is a versioned, reviewable migration. `ddl-auto` is `validate` in development and `none` in production. |
| **JsonNullable** | Correct `PATCH` semantics — see [the note below](#a-note-on-patch). |
| **Testcontainers** | Integration tests run against real Postgres. H2 does not model `text[]` or `uuid` faithfully enough to trust. |

### Frontend

| Choice | Why |
|---|---|
| **React 19 + TypeScript** | Strict mode. Types are derived from Zod schemas rather than duplicated. |
| **Vite** | Fast dev server, and a dev proxy that removes CORS from the local loop. |
| **Tailwind CSS v4** | CSS-first configuration. Every token namespace is reset to `initial`, so an off-system value like `bg-blue-500` **fails to compile** rather than silently shipping. |
| **Zustand** | Auth state, persisted UI preferences, and per-page filters, without the ceremony. |
| **Zod** | One schema per domain, mirroring the server rules, with TypeScript types inferred from it. |
| **Motion** | Page and list transitions. Maximum 8 px of translate, nothing scales, all of it suppressed under `prefers-reduced-motion`. |
| **Lucide** | A fixed icon allowlist, so the icon set stays a system. |

### Infrastructure

Azure Container Apps (backend, scale-to-zero) · Azure Static Web Apps (frontend) · Azure Database
for PostgreSQL Flexible Server · GitHub Container Registry · GitHub Actions.

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │          Browser             │
                         └──────────────┬───────────────┘
                                        │ HTTPS
                         ┌──────────────▼───────────────┐
                         │  Azure Static Web Apps        │
                         │  React · Vite · TypeScript    │
                         │  (free tier, global CDN)      │
                         └──────────────┬───────────────┘
                                        │ HTTPS + Bearer JWT
                                        │ (CORS: single allowed origin)
                         ┌──────────────▼───────────────┐
                         │  Azure Container Apps         │
                         │  Spring Boot 3.5 · Java 21    │
                         │  min-replicas 0 (scale to 0)  │
                         │                               │
                         │  JwtAuthenticationFilter      │
                         │            ↓                  │
                         │  Controller → Service → Repo  │
                         └──────────────┬───────────────┘
                                        │ JDBC (sslmode=require)
                         ┌──────────────▼───────────────┐
                         │  Azure Database for           │
                         │  PostgreSQL Flexible Server   │
                         │  B1ms · Flyway-migrated       │
                         └──────────────────────────────┘
```

### Authentication flow

```
  register / login  ──▶  BCrypt verify  ──▶  access JWT (15 min, in memory)
                                         └▶  refresh token (7 days, SHA-256 hashed in the database)

  every request     ──▶  JwtAuthenticationFilter  ──▶  SecurityContext  ──▶  service scopes
                                                                             every query to the
                                                                             authenticated user

  401 on expiry     ──▶  single refresh (concurrent 401s queue behind it)
                    ──▶  rotate: old token revoked, new one issued
                    ──▶  original request replays
```

Requesting another user's record returns **404, not 403** — a 403 would confirm the record exists.

### A note on PATCH

`PATCH` is a partial update, which means three distinct client intentions have to be
distinguishable:

| Request body | Meaning |
|---|---|
| `{}` | change nothing |
| `{"client": "Acme"}` | set it |
| `{"client": null}` | **clear** it |

A plain `String` field cannot express that — an absent key and an explicit `null` both arrive as
Java `null`, so "leave it alone" and "clear it" collapse into the same thing and the field gets
silently wiped on every partial update. Atlas wraps every optional update field in
`JsonNullable<T>` and applies it only when present:

```java
request.getClient().ifPresent(project::setClient);   // absent → untouched; null → cleared
```

Every `PATCH` endpoint has a test asserting that an empty body changes nothing.

---

## Running locally

### Prerequisites

| Tool | Version |
|---|---|
| JDK | 21 (Temurin recommended) |
| Node.js | 22 LTS or newer |
| Docker Desktop | current |

### 1 · Database

```bash
git clone https://github.com/<user>/atlas.git
cd atlas
docker compose up -d
docker compose ps          # wait for "healthy"
```

Postgres listens on **5433**, so it will not collide with a local install on 5432.

### 2 · Backend

```bash
cd backend
export JWT_SECRET="a-development-secret-at-least-32-bytes-long-for-hs256"
./mvnw spring-boot:run
```

On Windows PowerShell: `$env:JWT_SECRET = "..."`.

Flyway runs the migrations on first start. The `dev` profile seeds a demo user and a realistic
dataset — running it again will not duplicate anything.

- API — http://localhost:8080/api
- Swagger UI — http://localhost:8080/swagger-ui.html
- Health — http://localhost:8080/actuator/health

> There is deliberately no default `JWT_SECRET`. A missing or too-short secret fails startup with
> a clear message rather than falling back to something insecure.

### 3 · Frontend

```bash
cd frontend
npm install
npm run dev
```

http://localhost:5173. The Vite dev server proxies `/api` to port 8080, so CORS is not part of the
local loop.

### Environment variables

**Backend**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | **yes** | *none — startup fails* | HS256 signing key, minimum 256 bits |
| `DATABASE_URL` | no | `jdbc:postgresql://localhost:5433/atlas` | JDBC URL |
| `DATABASE_USER` | no | `atlas` | |
| `DATABASE_PASSWORD` | no | `atlas` | |
| `FRONTEND_ORIGIN` | no | `http://localhost:5173` | The single allowed CORS origin |
| `SPRING_PROFILES_ACTIVE` | no | `default` | `dev` seeds data; `prod` for deployment |
| `PORT` | no | `8080` | |

**Frontend**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | no | `/api` (proxied) | Absolute backend URL in production |

Copy `.env.example` to `.env` and fill it in. `.env` is gitignored and must stay that way.

---

## Testing

```bash
cd backend && ./mvnw verify          # unit + integration; JaCoCo report in target/site/jacoco
cd frontend && npm test              # Vitest + Testing Library
```

Backend integration tests start a real PostgreSQL container through Testcontainers, so Docker must
be running. Coverage of the service layer is held at 70% or above.

Test coverage concentrates where the logic actually lives:

- **Environment pairing** — one test per invariant: same-project, same-type, no self-pairing,
  displacement of an existing partner, type-change breaking the pair, and delete releasing the
  partner
- **PATCH semantics** — for every endpoint, an empty body changes nothing and an explicit `null`
  clears exactly one field
- **Task rules** — top-of-column ordering, completion stamping and clearing, client-supplied
  `completedAt` ignored, and overdue boundary conditions
- **Ownership** — user B requesting user A's record receives 404
- **Slug generation** — collision handling and regeneration on rename

---

## API

Base path `/api`. Every endpoint except `/api/auth/**` and the operational paths requires
`Authorization: Bearer <accessToken>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` | Authentication |
| `GET` | `/auth/me` | Current user |
| `GET` `POST` | `/projects` | List (filter by `status`, `tag`, `q`, `includeArchived`) · create |
| `GET` `PATCH` `DELETE` | `/projects/{id}` | Read · partial update · delete |
| `GET` | `/projects/slug/{slug}` | Read by slug |
| `POST` `DELETE` | `/projects/{id}/pin` | Pin · unpin (max 4) |
| `GET` `POST` | `/environments` | List by project · create |
| `GET` | `/environments/grouped` | Grouped by type with pairs resolved |
| `GET` `PATCH` `DELETE` | `/environments/{id}` | Read · update · delete |
| `PUT` `DELETE` | `/environments/{id}/pair` | Pair with a target · unpair |
| `GET` `POST` | `/tasks` | List (filter by `projectId`, `status`, `priority`) · create |
| `GET` | `/tasks/board` · `/tasks/needs-attention` | Board columns · the three attention buckets |
| `GET` `PATCH` `DELETE` | `/tasks/{id}` | Read · update · delete |
| `PUT` | `/tasks/{id}/move` | Change status and position in one call |
| `GET` `POST` | `/tags` | List with usage counts · create-or-return |
| `PATCH` `DELETE` | `/tags/{id}` | Rename/recolour · delete |
| `GET` | `/dashboard` · `/search?q=` | Dashboard payload · cross-entity search |

Full request and response schemas: **`/swagger-ui.html`**, or
[`docs/PRD.md` §6](docs/PRD.md#6-api-contract).

Errors share one shape:

```json
{
  "timestamp": "2026-09-11T14:03:00Z",
  "status": 400,
  "error": "Validation failed",
  "path": "/api/projects",
  "fields": { "name": ["must not be blank"] }
}
```

`fields` appears only on `400`, and keys on the JSON field name so the frontend can attach each
message to its input without translation.

---

## Deployment

Both applications deploy automatically from `main` through GitHub Actions.

| Component | Service | Tier |
|---|---|---|
| Backend | Azure Container Apps | Free monthly grant, `min-replicas: 0` |
| Frontend | Azure Static Web Apps | Free — includes SSL and a custom domain |
| Database | Azure Database for PostgreSQL Flexible Server | B1ms, 32 GB — free for 12 months on a new account |
| Images | GitHub Container Registry | Free for public images |
| CI/CD | GitHub Actions | Free for public repositories |

Region is `canadacentral` (Toronto) — lowest latency locally, and data stays in Canada.

The pipeline runs tests **before** building the image, so a failing test cannot deploy. Images are
tagged with the commit SHA rather than `latest`, which makes every deployment traceable and
rollback a one-line change. Azure authentication uses an OIDC federated credential, so no
long-lived service-principal secret is stored in GitHub.

Secrets reach the container through Container Apps secret references — never a committed file,
never a baked image layer.

### Free-tier trade-offs, stated plainly

- **Cold starts.** `min-replicas: 0` means the container sleeps when idle. First request after a
  quiet period: 10–30 seconds. Setting `min-replicas: 1` removes it at a small monthly cost.
- **The Postgres clock.** The free Flexible Server allowance runs 12 months from creation. After
  that it bills, or moves to a containerised Postgres alongside the app.
- **One replica.** Rate limiting is in-memory, which is correct for a single instance. Scaling
  horizontally would need Redis.

---

## Project structure

```
atlas/
├── docs/                      README · PRD · PLAN · screenshots
├── compose.yaml               local Postgres
├── backend/
│   ├── pom.xml  Dockerfile
│   └── src/main/
│       ├── java/com/ericmignardi/atlas/
│       │   ├── config/        security, CORS, OpenAPI, Jackson
│       │   ├── security/      JwtService, JwtAuthenticationFilter, UserPrincipal
│       │   ├── common/        exceptions, GlobalExceptionHandler, Slugifier
│       │   ├── user/  project/  environment/  task/  tag/  dashboard/
│       │   └──                each: entity · repository · service · controller · dto
│       └── resources/db/migration/    V1…V7 Flyway migrations
└── frontend/
    └── src/
        ├── styles/            design tokens
        ├── lib/               API client, design map, dates
        ├── schemas/           Zod schemas (types inferred from these)
        ├── stores/            Zustand
        ├── components/        ui/ · shell/ · states/
        └── features/          auth · projects · environments · tasks · tags · dashboard
```

Packages are organised **by feature, not by layer** — `project/ProjectService.java`, not
`service/ProjectService.java`.

---

## Design notes

A few decisions worth explaining, since they are the ones that get asked about:

**The unique constraint carries the invariant.** `environments.paired_with_id` is `UNIQUE`, so two
environments cannot both claim the same partner even if the service logic has a bug. It is also
why pairing must *release before it assigns* — assigning first puts two rows in conflict inside
the same transaction and Postgres rejects it. The database is a participant in the domain model,
not just a store.

**404 rather than 403 for another user's record.** A 403 confirms the record exists. Returning 404
means an attacker cannot enumerate ids.

**Refresh tokens are opaque and hashed.** They are random 256-bit values, not JWTs, and only their
SHA-256 hash is stored — the same reasoning as password hashing. A database leak yields nothing
usable. Each refresh rotates the token and revokes the old one.

**The access token lives in memory, the refresh token in `localStorage`.** `localStorage` is
readable by any script on the page, so an XSS becomes token theft. An httpOnly refresh cookie is
the stronger design, and would be the choice for a system holding real user data. This split is a
deliberate middle ground for a portfolio deployment, documented rather than hidden.

**CSRF protection is disabled — correctly.** The API is stateless and token-bearing, so there is
no ambient credential for a cross-site request to ride on. That reasoning is written into the
security configuration, because "disabled CSRF" without a justification is a finding.

**`open-in-view` is off.** Left on (the Spring default), Hibernate keeps the session open through
view rendering and lazy associations quietly load one query at a time. Turning it off makes N+1
problems fail loudly on the day the query is written.

**Design tokens are enforced by the compiler.** Resetting Tailwind's namespaces to `initial` means
an off-system value does not compile. It is the cheapest possible way to keep a design system
honest.

---

## Status and roadmap

**Shipped** — authentication · projects · environments with pairing · tasks with a kanban board ·
tags · dashboard · command palette · Azure deployment with CI/CD.

**Deferred, and designed for** — the schema and layering accept these without rework:

| | |
|---|---|
| Snippets | Code library with syntax highlighting and faceted filtering |
| Journal | Markdown dev log, date-grouped |
| Learning | Goals and courses with derived progress rollups |
| Resources | Bookmarked links with read/unread state |

**Under consideration** — real GitHub integration (recent commits and open PRs per project) ·
Postgres full-text search with ranking · Microsoft Entra ID sign-in alongside JWT · dark theme.

---

## Author

**Eric Mignardi** — Ancaster, Ontario
[GitHub](https://github.com/<user>) · [LinkedIn](https://linkedin.com/in/<user>)

Built by hand in ten working days, September 2026. The requirements and the day-by-day plan are
in [`docs/PRD.md`](docs/PRD.md) and [`docs/PLAN.md`](docs/PLAN.md).

## Licence

MIT
