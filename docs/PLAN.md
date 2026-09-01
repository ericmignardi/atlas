# Atlas — Build Plan

**Window** Monday, August 31 → Friday, September 11, 2026 · 10 business days
**Mode** Manual build. No AI writes code. An LLM is used as a *tutor* — to explain a concept,
review reasoning, or debug an error message — never to produce the implementation.
**Requirements** Every deliverable references requirement IDs from [`PRD.md`](./PRD.md).

> **Note on Monday, September 7:** that is Labour Day in Canada. The plan assumes you work it. If
> you take the day, shift Days 6–10 forward by one and finish Monday, September 14 — the phase
> boundaries are designed so a whole day can move without splitting work.

---

## How to use this document

Each day has the same shape:

- **Objective** — the one sentence that defines the day
- **Tasks** — the ordered work
- **Deliverable** — what exists at the end that did not exist at the start
- **Done when** — observable, testable checks. Not "worked on X" but "X returns 201"
- **Learning notes** — topics to have an LLM teach you before or while you build
- **Commit** — the checkpoint message

If a day runs long, consult the [cut list](#cut-list) rather than working late. The application
must be in a working, committable state at the end of every single day.

### Daily rhythm

| Block | Time | Activity |
|---|---|---|
| Warm-up | 09:00 – 09:30 | Re-read today's phase. Re-read yesterday's code. Write down the first three tasks. |
| Deep work 1 | 09:30 – 12:00 | Hardest task of the day, while fresh |
| Lunch | 12:00 – 13:00 | Away from the desk |
| Deep work 2 | 13:00 – 15:30 | Second block |
| Verify | 15:30 – 16:30 | Run the "Done when" checks. Fix what fails. |
| Close | 16:30 – 17:00 | Commit, push, update this file's progress log, write tomorrow's first task |

Hard stop at 17:00. This is a two-week sprint, not a marathon; tired code on day 4 costs a day
of debugging on day 8.

### Progress log

Fill in as you go. This is the honest record.

| Day | Date | Planned | Actual | Notes |
|---|---|---|---|---|
| 1 | Mon Aug 31 | Foundations + walking skeleton | Done | Boot 4.1.1, not the 3.5.x in §1.3 — Initializr no longer offers 3.5. Starter names, Testcontainers 2.x, and springdoc 3.1.0 follow from that. All Azure work moved to [§10.1](#101-azure-account-and-first-deployment) pending the free account; §1.7 now ends at container images, both of which build and run. See [R-12](#risk-register). |
| 2 | Tue Sep 1 | Persistence | Done | Seven migrations, seven entities, six repositories, 38 green tests. Two deliberate departures from §2.5 and §2.2, both forced by the Boot 4.1.1 / Testcontainers 2.x stack from Day 1: the container is a shared static `@ServiceConnection` bean rather than `@Container` + `@DynamicPropertySource`, and `ProjectTag.equals` compares the two association ids rather than the `@EmbeddedId` — `@MapsId` leaves the key null until flush, so the documented id-only rule collapses a whole `Set` of new join rows into one. Added `flyway-maven-plugin` so the `flyway:info` check is real. BCrypt raised to strength 12 per [PRD §5.2](./PRD.md#52-users). |
| 3 | Wed Sep 2 | Projects + Tags API | | |
| 4 | Thu Sep 3 | Environments + Tasks API | Done | `EnvironmentPairingService`, `EnvironmentService`, `TaskService`, both controllers, and 33 new tests — 142 green. Three departures from §4.1 – §4.5. Pairing writes **both** `paired_with_id` columns and flushes between release and assign: §4.1 assumed the flush ordering was safe, and it is not — Hibernate may emit the assignment before the release inside one flush and hit the UNIQUE constraint. `releasePartner` also clears the inverse `pairedBy` on every object it touches; leaving it stale makes Hibernate refuse the flush when the released row is then deleted. And `needsAttention` partitions on `!due.isBefore(endOfToday)` rather than §4.5's `isAfter(endOfDay)`, so the three buckets are exhaustive at the boundary instead of dropping a task due exactly at midnight. `DevDataSeeder.pair` updated to write both sides too, so the seed matches what the service produces (the assertion in `DevDataSeederTest` moves from 5 rows to 10). |
| 5 | Fri Sep 4 | Spring Security | Done | `JwtService`, `JwtAuthenticationFilter`, `CustomUserDetailsService`, `RefreshTokenService`, `SecurityErrorHandler`, `LoginRateLimiter`, and the five `/api/auth` endpoints — 45 new tests, 187 green. The Day 3 stub in `CurrentUserResolver` is gone; §5.6 needed no service changes because Days 3 and 4 were already written against a `UserPrincipal`. Four departures from §5.2 – §5.5. The key is a `SecretKeySpec("HmacSHA256")` signed with `Jwts.SIG.HS256` rather than `Keys.hmacShaKeyFor` + bare `signWith`, which infers the algorithm from key length and would sign HS512 with the 64-byte secret in `.env` — FR-1.4 says HS256. The `roles` claim is a JSON array, not the comma-separated column value, matching `UserResponse.roles: string[]`. CORS moved out of `WebConfig` into `SecurityConfig` so there is one source of truth, and `@ConfigurationProperties` (`AtlasProperties`) replaced the scattered `@Value`s the §5.2 snippet assumes. Two things §5.3 does not mention and the tests found: rotation needs `noRollbackFor = ApiException.class`, or the reuse-detection revoke is rolled back by the throw that follows it and the attacker keeps the session; and the refresh lookup needs a `JOIN FETCH` on the user, because the lazy proxy dies once rotation's transaction closes. Email is normalised in the DTO canonical constructors rather than in the service — `@Email` rejects the trailing space a form sends, so normalising after validation is too late. An unset `JWT_SECRET` binds as the literal `${JWT_SECRET}`, 13 characters, and fails the 256-bit check: the right outcome, by a different route than §5.2 assumed. |
| 6 | Mon Sep 7 | Frontend foundation | | |
| 7 | Tue Sep 8 | Projects + Tags UI | | |
| 8 | Wed Sep 9 | Environments + Tasks UI | | |
| 9 | Thu Sep 10 | Dashboard, palette, polish | | |
| 10 | Fri Sep 11 | Ship | | |

---

## Repository layout

```
atlas/
├── README.md                  ← copy of docs/README.md, or a pointer to it
├── .gitignore
├── compose.yaml               ← local Postgres
├── docs/
│   ├── README.md  PRD.md  PLAN.md
│   └── img/                   ← screenshots for the README (Day 10)
├── backend/
│   ├── pom.xml
│   ├── mvnw  mvnw.cmd  .mvn/
│   ├── Dockerfile
│   └── src/
│       ├── main/java/com/ericmignardi/atlas/
│       │   ├── AtlasApplication.java
│       │   ├── config/          SecurityConfig, CorsConfig, OpenApiConfig, JacksonConfig
│       │   ├── security/        JwtService, JwtAuthenticationFilter, CurrentUser, UserPrincipal
│       │   ├── common/          ApiException, GlobalExceptionHandler, ErrorResponse, Slugifier
│       │   ├── user/            User, UserRepository, AuthService, AuthController, dto/
│       │   ├── project/         Project, ProjectRepository, ProjectService, ProjectController, dto/
│       │   ├── environment/     Environment, …, EnvironmentPairingService
│       │   ├── task/            Task, …
│       │   ├── tag/             Tag, ProjectTag, …
│       │   └── dashboard/       DashboardService, DashboardController, SearchController
│       ├── main/resources/
│       │   ├── application.yml  application-dev.yml  application-prod.yml
│       │   └── db/migration/    V1__…sql  V2__…sql  …
│       └── test/java/…
└── frontend/
    ├── package.json  vite.config.ts  tsconfig.json  index.html
    └── src/
        ├── main.tsx  App.tsx  router.tsx
        ├── styles/       theme.css (design tokens), index.css
        ├── lib/          apiClient.ts, queryKeys.ts, dates.ts, design.ts
        ├── schemas/      project.ts, environment.ts, task.ts, tag.ts, auth.ts
        ├── stores/       authStore.ts, prefsStore.ts, uiStore.ts
        ├── components/   ui/, shell/, states/
        └── features/     auth/, projects/, environments/, tasks/, tags/, dashboard/
```

**Package by feature, not by layer.** `project/ProjectService.java`, not
`service/ProjectService.java`. It keeps related code together and it is what modern Spring
codebases look like.

---

# Day 1 — Monday, August 31

## Foundations and a walking skeleton

**Objective.** Both applications run locally against a real database, and the production container
images build and run.

> **Deployment is deferred to Day 10.** This plan originally put a hello-world deploy on day one,
> for a good reason: deployment is where side projects die — it gets left to the end, it goes
> wrong, and the repository ends with no live URL. That reason has not gone away. The Azure
> account simply does not exist yet, so everything requiring `az` now sits in
> [Day 10 §10.1](#101-azure-account-and-first-deployment). The cost of the move is stated plainly:
> Day 10 becomes a *first* deployment rather than a re-deploy. See [R-12](#risk-register).
>
> What Day 1 keeps is every part that de-risks the deploy without an account. Both `Dockerfile`s
> are written, both images are built, and the backend image is run against Postgres. When the
> account exists, §10.1 is a push and three `az` commands — not a debugging session.

### 1.1 Prerequisites — install and verify first

| Tool | Version | Verify with |
|---|---|---|
| JDK | **21 (LTS)** — Temurin | `java -version` |
| Maven | 3.9+ (or use the wrapper) | `mvn -v` |
| Node.js | 22 LTS or newer | `node -v` |
| Docker Desktop | current | `docker ps` |
| Git | current | `git --version` |
| Azure CLI | current — **not needed until Day 10** | `az version` |
| IntelliJ IDEA | Community is fine | — |

> **On the Java version.** Java 21 is the right call: it is the LTS that Spring Boot 3.5 targets,
> it is what job postings ask for, and every library and Azure base image supports it. Newer LTS
> releases exist; do not use one here. You want zero friction on the toolchain.

### 1.2 Repository

```bash
cd ~/OneDrive/Documents/Code/atlas
git init
git branch -M main
```

`.gitignore` at the root must cover both applications:

```gitignore
# Java
target/
!.mvn/wrapper/maven-wrapper.jar
*.class

# Node
node_modules/
dist/
dist-ssr/
*.local

# Environment — never commit these
.env
.env.*
!.env.example

# IDE / OS
.idea/
*.iml
.vscode/
.DS_Store
Thumbs.db
```

Create `.env.example` at the root and commit it. Create `.env` and **never** commit it.

### 1.3 Spring Initializr — complete specification

Go to **https://start.spring.io** (or use IntelliJ's *New Project → Spring Boot*, which is the
same generator).

#### Project metadata

| Setting | Value |
|---|---|
| Project | **Maven** |
| Language | **Java** |
| Spring Boot | **3.5.x** — the highest non-SNAPSHOT, non-M/RC version offered |
| Group | `com.ericmignardi` |
| Artifact | `atlas` |
| Name | `atlas` |
| Description | `Atlas — a personal developer portal` |
| Package name | `com.ericmignardi.atlas` |
| Packaging | **Jar** |
| Java | **21** |

Generate into `backend/`, so `backend/pom.xml` sits at that path.

#### Dependencies to select in Initializr

Tick exactly these ten:

| Dependency | Initializr name | Artifact it adds | Why |
|---|---|---|---|
| Web | **Spring Web** | `spring-boot-starter-web` | REST controllers, embedded Tomcat, Jackson |
| Data | **Spring Data JPA** | `spring-boot-starter-data-jpa` | Hibernate, repositories, transactions |
| Security | **Spring Security** | `spring-boot-starter-security` | Filter chain, `PasswordEncoder`, authentication |
| Validation | **Validation** | `spring-boot-starter-validation` | Jakarta Bean Validation (`@NotBlank`, `@Size`) |
| SQL | **PostgreSQL Driver** | `org.postgresql:postgresql` (runtime) | JDBC driver |
| SQL | **Flyway Migration** | `org.flywaydb:flyway-core` | Versioned schema migrations |
| Dev | **Lombok** | `org.projectlombok:lombok` | Removes getter/setter/builder boilerplate |
| Ops | **Spring Boot Actuator** | `spring-boot-starter-actuator` | `/actuator/health` for the Azure probe |
| Dev | **Spring Boot DevTools** | `spring-boot-devtools` | Automatic restart on recompile |
| Testing | **Testcontainers** | `spring-boot-testcontainers`, `org.testcontainers:junit-jupiter` | Real Postgres in integration tests |

**Do not** select: Spring Data JDBC, H2, Spring Session, Thymeleaf, or OAuth2 anything. H2 in
particular is tempting for tests and is the wrong choice here — the schema uses `text[]` and
`uuid`, which H2 does not model faithfully (NFR-3.4).

> **Do not select "Docker Compose Support"** either. It auto-starts `compose.yaml` on every
> application boot, which is convenient until it silently starts a *second* database and you spend
> an hour wondering why your migration ran somewhere else. Start Postgres yourself.

`spring-boot-starter-test` and `spring-boot-starter-web`'s Jackson come in automatically — you do
not select them.

#### Manual `pom.xml` additions

Initializr covers about 80% of what this build needs. The rest goes in by hand. Add these inside
the existing `<dependencies>` element.

**1 · JWT — `jjwt` 0.12.x.** Three artifacts, and the split matters: only `jjwt-api` is compiled
against, the other two are runtime implementations. Getting the scopes wrong is a classic
`ClassNotFoundException` at first login.

```xml
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-api</artifactId>
  <version>${jjwt.version}</version>
</dependency>
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-impl</artifactId>
  <version>${jjwt.version}</version>
  <scope>runtime</scope>
</dependency>
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-jackson</artifactId>
  <version>${jjwt.version}</version>
  <scope>runtime</scope>
</dependency>
```

**2 · `JsonNullable` — correct PATCH semantics.** The most important line in this file. See
[PRD §6.9](./PRD.md#69-patch-semantics--read-this-twice); without it, every partial update
silently wipes the fields the client did not send.

```xml
<dependency>
  <groupId>org.openapitools</groupId>
  <artifactId>jackson-databind-nullable</artifactId>
  <version>0.2.6</version>
</dependency>
```

**3 · OpenAPI / Swagger UI.** Serves `/swagger-ui.html` and `/v3/api-docs` (FR-8.6). The 2.8.x
line is the one built for Spring Boot 3.5 — check
[Maven Central](https://central.sonatype.com/artifact/org.springdoc/springdoc-openapi-starter-webmvc-ui)
for the newest 2.8 patch and use that.

```xml
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
  <version>2.8.6</version>
</dependency>
```

**4 · Flyway's Postgres module.** Since Flyway 10, database support is split out of `flyway-core`
and `flyway-core` alone cannot migrate Postgres. Recent Initializr versions add this for you when
the PostgreSQL driver is also selected — **check your generated `pom.xml` first** and add it only
if it is missing. The version is managed by Spring Boot, so omit `<version>`.

```xml
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

**5 · Test dependencies.** Versions are managed by Spring Boot; only the Testcontainers Postgres
module needs naming, as Initializr adds `junit-jupiter` but not the database module.

```xml
<dependency>
  <groupId>org.springframework.security</groupId>
  <artifactId>spring-security-test</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <scope>test</scope>
</dependency>
```

**6 · Properties block.** Add these next to the `java.version` Initializr generated:

```xml
<properties>
  <java.version>21</java.version>
  <jjwt.version>0.12.6</jjwt.version>
</properties>
```

> **Do not add a `lombok.version` property.** The `spring-boot-starter-parent` already defines
> one, and Boot's managed value is the version it was tested against. Redefining it silently
> overrides that. Reference `${lombok.version}` in the compiler plugin below — the parent supplies
> it.

**7 · The compiler plugin.**

> **Why touch it at all.** Two reasons. Lombok is an annotation processor, and once you declare
> `annotationProcessorPaths` explicitly — or inherit a parent that does — the processor has to be
> listed there or Lombok silently stops generating accessors. And `-parameters` keeps real
> parameter names in the bytecode, which Spring uses to bind `@PathVariable` and `@RequestParam`
> without repeating the name in every annotation.

Replace the `maven-compiler-plugin` block Initializr generated with this:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <annotationProcessorPaths>
      <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>${lombok.version}</version>
      </path>
    </annotationProcessorPaths>
    <compilerArgs>
      <arg>-parameters</arg>
    </compilerArgs>
  </configuration>
</plugin>
```

**8 · JaCoCo — coverage (NFR-3.2).**

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.13</version>
  <executions>
    <execution>
      <goals><goal>prepare-agent</goal></goals>
    </execution>
    <execution>
      <id>report</id>
      <phase>test</phase>
      <goals><goal>report</goal></goals>
    </execution>
  </executions>
</plugin>
```

**Verify the whole thing compiles before writing a single line of application code:**

```bash
cd backend && ./mvnw clean compile
```

### 1.4 Local Postgres

`compose.yaml` at the repository root:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: atlas-db
    environment:
      POSTGRES_USER: atlas
      POSTGRES_PASSWORD: atlas
      POSTGRES_DB: atlas
    ports:
      - "5433:5432"          # 5433 avoids clashing with any local Postgres
    volumes:
      - atlas-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U atlas"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  atlas-data:
```

```bash
docker compose up -d
docker compose ps        # expect "healthy"
```

### 1.5 `application.yml`

`backend/src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: atlas
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5433/atlas}
    username: ${DATABASE_USER:atlas}
    password: ${DATABASE_PASSWORD:atlas}
  jpa:
    hibernate:
      ddl-auto: validate          # Flyway owns the schema. Never "update".
    open-in-view: false           # Turn this off on day one; it hides N+1 problems.
    properties:
      hibernate:
        jdbc.time_zone: UTC
        format_sql: true
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

server:
  port: ${PORT:8080}
  error:
    include-stacktrace: never     # NFR-2.7

management:
  endpoints.web.exposure.include: health,info
  endpoint.health.show-details: when-authorized

atlas:
  jwt:
    secret: ${JWT_SECRET}         # No default. Missing secret must fail startup. NFR-2.2
    access-token-ttl: PT15M
    refresh-token-ttl: P7D
  cors:
    allowed-origin: ${FRONTEND_ORIGIN:http://localhost:5173}

logging:
  level:
    com.ericmignardi.atlas: DEBUG
```

> `open-in-view: false` matters. Left on (the default), Hibernate keeps the session open through
> view rendering, so lazy associations quietly load one query at a time and NFR-1.2 is
> unenforceable. Turning it off now means you find those problems on the day you write the query,
> not on Day 9.

Sanity check the boot: create a temporary `HealthController` returning `{"status":"ok"}` at
`/api/ping`, and permit it in a minimal `SecurityConfig`.

### 1.6 Frontend scaffold

```bash
cd ~/OneDrive/Documents/Code/atlas
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Runtime dependencies — your stated stack plus a router and an HTTP client:

```bash
npm install tailwindcss @tailwindcss/vite \
            lucide-react motion zod zustand \
            react-router axios date-fns clsx
```

Dev dependencies:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
               @testing-library/user-event jsdom \
               prettier eslint-config-prettier
```

| Package | Role |
|---|---|
| `tailwindcss` + `@tailwindcss/vite` | Tailwind v4 — CSS-first, configured through the Vite plugin. There is no `tailwind.config.js` in v4. |
| `lucide-react` | Icons |
| `motion` | Page and list transitions (PRD §9.6) |
| `zod` | Form and response validation, mirroring the server rules |
| `zustand` | Auth state, UI preferences, per-page filters |
| `react-router` | Routing. v7 ships the API from the `react-router` package directly. |
| `axios` | HTTP client — chosen for its interceptors, which is where token refresh lives |
| `date-fns` | Date formatting |
| `clsx` | Conditional class names |

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
});
```

> The dev proxy means the frontend calls same-origin `/api/...` in development, so CORS does not
> exist as a problem locally. It *will* exist in production, where the two services are on
> different Azure domains — which is exactly why CORS gets configured properly on Day 5 rather
> than being discovered on Day 10.

`src/styles/theme.css` holds the design tokens from [PRD §9](./PRD.md#9-uiux-specification). Start
it today with `@import "tailwindcss";` and the colour and type tokens; fill in the rest on Day 6.

### 1.7 Container images

Nothing in this section needs an Azure account. The image *is* the deployable artifact, so
building it today is the part of deployment that can be de-risked early — Day 10 then spends its
time on infrastructure rather than on a Dockerfile.

**Backend.** A multi-stage `backend/Dockerfile`:

```dockerfile
# ── build ──────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# ── run ────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S atlas && adduser -S atlas -G atlas
COPY --from=build /app/target/*.jar app.jar
USER atlas
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

Copying `pom.xml` and resolving dependencies *before* copying `src` is what makes rebuilds fast —
Docker caches that layer until the POM changes.

**Frontend.** Static Web Apps builds from source and needs no image, but `docker-compose.prod.yml`
does — and an nginx image is the escape hatch if Azure ever stops being the answer. A
`frontend/Dockerfile` that builds with Node and serves the static output through nginx, with a
`try_files` SPA fallback so React Router owns the client-side routes.

Vite inlines `VITE_*` variables at **build** time, not run time, so the API base URL is a
`--build-arg`. Changing it needs a rebuild, not a restart.

**Prove both images, not just the build.** A green `docker build` only means the Dockerfile
parses. Run the backend image against the Compose database and call the endpoint through it:

```bash
docker build -t atlas-backend:dev ./backend
docker build -t atlas-frontend:dev ./frontend

docker run -d --name atlas-smoke --network atlas_default -p 18080:8080 \
  -e DATABASE_URL="jdbc:postgresql://db:5432/atlas" \
  -e DATABASE_USER=atlas -e DATABASE_PASSWORD=atlas \
  -e SPRING_PROFILES_ACTIVE=prod -e JWT_SECRET="throwaway-smoke-key" \
  atlas-backend:dev

curl localhost:18080/api/ping        # expect {"status":"ok"}
docker rm -f atlas-smoke
```

That run exercises the production profile, the non-root user, and the container's view of the
database — three of the things most likely to break a first deploy. What is left for Day 10 is
Azure account setup, not application packaging.

### Deliverable

A pushed repository containing a Spring Boot application and a Vite application that both run
locally against Docker Postgres, plus a backend container image that serves `/api/ping` when run.

### Done when

- [x] `./mvnw clean compile` succeeds with all manual POM additions in place
- [x] `docker compose ps` shows `atlas-db` healthy
- [x] `./mvnw spring-boot:run` starts without error and connects to Postgres
- [x] `curl localhost:8080/api/ping` returns `{"status":"ok"}`
- [x] `curl localhost:8080/actuator/health` returns `{"status":"UP"}` with a `db` component
- [x] `npm run dev` serves the Vite app at `localhost:5173`
- [x] The Vite app fetches `/api/ping` through the proxy without a CORS error
- [x] `docker build` succeeds for both `backend/Dockerfile` and `frontend/Dockerfile`
- [x] The backend image runs against the Compose database and returns `{"status":"ok"}`
- [x] `git log` shows at least one commit and the remote is set
- [x] `git ls-files | grep -c "^.env$"` returns `0`

### Learning notes

Ask an LLM to explain, and make sure you can restate each in your own words:

- What each Spring Boot starter actually brings in, and how auto-configuration decides what to wire
- Annotation processing: how Lombok hooks into `javac`, and what it generates
- Why Flyway rather than `ddl-auto: update`
- What `open-in-view` does and why the default is considered a mistake
- Docker layer caching, and why `COPY pom.xml` comes before `COPY src`
- Why the runtime stage drops to a JRE and a non-root user, and what that buys you

### Commit

`chore: scaffold Spring Boot backend and Vite frontend`

---

# Day 2 — Tuesday, September 1

## Persistence: schema, entities, repositories

**Objective.** The full database schema exists as versioned migrations, is mapped by JPA entities
that Hibernate validates on startup, and is reachable through repositories proven by tests.

Implements [PRD §5](./PRD.md#5-data-model).

### 2.1 Flyway migrations

One file per concern, in `backend/src/main/resources/db/migration/`. **Never edit an applied
migration** — Flyway checksums them and will refuse to start if one changes.

| File | Contents |
|---|---|
| `V1__enable_extensions.sql` | `CREATE EXTENSION IF NOT EXISTS pgcrypto;` — for `gen_random_uuid()` |
| `V2__create_users.sql` | `users` + unique index on `lower(email)` (PRD §5.2) |
| `V3__create_refresh_tokens.sql` | `refresh_tokens` (PRD §5.7) |
| `V4__create_projects.sql` | `projects` + four indexes incl. unique `(user_id, slug)` (PRD §5.3) |
| `V5__create_environments.sql` | `environments` + the **unique** `paired_with_id` self-FK (PRD §5.4) |
| `V6__create_tasks.sql` | `tasks` + four indexes (PRD §5.5) |
| `V7__create_tags.sql` | `tags` + `project_tags` join table (PRD §5.6) |

The self-referencing FK is the interesting one:

```sql
CREATE TABLE environments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name           VARCHAR(120) NOT NULL,
    platform       VARCHAR(16)  NOT NULL,
    type           VARCHAR(16)  NOT NULL,
    branch         VARCHAR(200),
    url            VARCHAR(600),
    notes          TEXT,
    paired_with_id UUID UNIQUE REFERENCES environments(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`UNIQUE` on `paired_with_id` is what makes the one-to-one real in the database. Two environments
cannot both claim the same partner — the database refuses it even if the service logic has a bug.
That constraint is your safety net for FR-3.7.

### 2.2 JPA entities

One entity per table, in its feature package.

**Base class** — every entity except the join table shares audit columns:

```java
@MappedSuperclass
@Getter @Setter
public abstract class Auditable {
    @CreatedDate  @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate @Column(nullable = false)
    private Instant updatedAt;
}
```

Enable it with `@EnableJpaAuditing` on a configuration class and `@EntityListeners(AuditingEntityListener.class)`
on each entity.

**Rules that apply to every entity:**

- `@Enumerated(EnumType.STRING)` on every enum field — **never** ordinal (PRD §5.8)
- Every `@ManyToOne` is `fetch = FetchType.LAZY`. The default on `@ManyToOne` is EAGER, which is
  the primary source of N+1 in Spring applications (NFR-1.2)
- `equals`/`hashCode` on the id only, and null-safe. Do **not** use Lombok's `@Data` or
  `@EqualsAndHashCode` on entities — they include every field, which triggers lazy loading inside
  a hash lookup. Use `@Getter`, `@Setter`, and hand-written `equals`/`hashCode`
- `@Column(nullable = false)` mirrors the migration exactly, or `ddl-auto: validate` fails at
  startup — which is the point

**The self-relation on `Environment`:**

```java
@OneToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "paired_with_id", unique = true)
private Environment pairedWith;

@OneToOne(mappedBy = "pairedWith", fetch = FetchType.LAZY)
private Environment pairedBy;
```

Two sides, one column. Only `pairedWith` owns the column and writes to it; `pairedBy` is the
inverse view. Understanding which side owns the foreign key is the whole lesson here.

**Postgres array mapping** for `techStack`:

```java
@JdbcTypeCode(SqlTypes.ARRAY)
@Column(name = "tech_stack", columnDefinition = "text[]")
private List<String> techStack = new ArrayList<>();
```

**`ProjectTag`** uses an `@Embeddable` composite key (`@EmbeddedId`) with `@MapsId` on both
`@ManyToOne` fields.

> **The one entity where "equals on the id only" is wrong.** `@MapsId` does not populate the
> embedded key until flush, so every freshly constructed `ProjectTag` holds `(null, null)` — and
> an id-only `equals` makes them all equal to each other. Add three tags to a project and the
> `Set` keeps one, silently, with no error anywhere. `ProjectTag.equals` therefore compares
> `project.getId()` and `tag.getId()`, which are assigned before the join row is built and never
> change. The rule above still holds everywhere else.

### 2.3 Repositories

One `JpaRepository` per aggregate root. Derived query methods where they read clearly, `@Query`
where they do not.

```java
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    Optional<Project> findByIdAndUserId(UUID id, UUID userId);
    Optional<Project> findBySlugAndUserId(String slug, UUID userId);
    List<Project> findByUserIdAndSlugStartingWith(UUID userId, String slugPrefix);
    long countByUserIdAndIsPinnedTrue(UUID userId);

    @Query("""
        SELECT DISTINCT p FROM Project p
        LEFT JOIN FETCH p.tags t
        LEFT JOIN FETCH t.tag
        WHERE p.user.id = :userId
          AND (:includeArchived = true OR p.status <> 'ARCHIVED')
        ORDER BY p.updatedAt DESC
        """)
    List<Project> findAllForUser(UUID userId, boolean includeArchived);
}
```

Note `findByIdAndUserId` rather than `findById`. **Every** lookup carries the user id. That is
FR-1.9 enforced at the lowest layer, so it cannot be forgotten higher up.

```java
public interface TaskRepository extends JpaRepository<Task, UUID> {
    @Query("SELECT MIN(t.sortOrder) FROM Task t WHERE t.user.id = :userId AND t.status = :status")
    Integer findMinSortOrder(UUID userId, TaskStatus status);   // FR-4.7 — may be null
}
```

### 2.4 Seed data

A `dev`-profile-only `CommandLineRunner` that inserts one user and a realistic dataset —
5 projects, ~18 environments across the three types with several pairs, ~25 tasks spread over the
four statuses with a mix of overdue and upcoming due dates, and 8 tags. It must be **idempotent**:
check whether the demo user exists and return early if it does.

You will look at this data for the next eight days. Make it real — actual project names, actual
branch names, plausible Neon connection strings. Placeholder data makes design decisions harder
and screenshots worse.

### 2.5 Tests

`AbstractIntegrationTest` with a shared, reused Testcontainers Postgres:

```java
@SpringBootTest
@Testcontainers
public abstract class AbstractIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine").withReuse(true);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("atlas.jwt.secret", () -> "test-secret-at-least-256-bits-long-so-hs256-accepts-it");
    }
}
```

Then repository tests: save and reload each entity; confirm cascade delete on
project → environments; confirm set-null on project → tasks; confirm the unique constraint on
`paired_with_id` actually rejects a duplicate.

### Deliverable

Seven migrations, seven entities, six repositories, seed data, and a green integration test suite
running against real Postgres.

### Done when

- [x] `./mvnw flyway:info` lists all seven migrations as applied
- [x] The application starts with `ddl-auto: validate` and no schema mismatch
- [x] `\d+ environments` in psql shows the unique constraint on `paired_with_id`
- [x] Inserting two environments with the same `paired_with_id` fails at the database level
- [x] Deleting a project deletes its environments and nulls its tasks' `project_id`
- [x] `techStack` round-trips a list of strings through `text[]`
- [x] Seed data loads on the `dev` profile and re-running the app does not duplicate it
- [x] `./mvnw test` is green and Testcontainers starts Postgres

### Learning notes

- Flyway versioning and checksums; why an applied migration is immutable
- JPA fetch types; why `@ManyToOne` defaults to EAGER and why that is wrong
- Owning vs inverse side of a bidirectional relationship
- Why entity `equals`/`hashCode` must not include mutable or lazy fields
- `@EmbeddedId` and `@MapsId` for composite keys
- Testcontainers lifecycle and `withReuse` for fast test runs

### Commit

`feat(db): add Flyway migrations, JPA entities, and repositories`

---

# Day 3 — Wednesday, September 2

## Projects and Tags API

**Objective.** Full CRUD for projects and tags over HTTP, with the business rules, validation, and
uniform error handling that the rest of the API will copy.

Implements FR-2.1 – FR-2.14, FR-5.1 – FR-5.9, FR-8.4.

> Today establishes the pattern. Days 4 and 5 repeat it. Spend the time to get the shape right —
> especially the exception handler and the PATCH DTOs — because you will replicate it four times.

### 3.1 Error handling

Build this first; everything else depends on it.

- `ErrorResponse` — the record from [PRD §6.1](./PRD.md#61-conventions)
- `ApiException extends RuntimeException` carrying an `HttpStatus` and a message
- `NotFoundException`, `ConflictException`, `ValidationException` as subclasses
- `GlobalExceptionHandler` annotated `@RestControllerAdvice`, handling:

| Exception | Status | Notes |
|---|---|---|
| `MethodArgumentNotValidException` | 400 | Flatten `BindingResult` into the `fields` map |
| `ConstraintViolationException` | 400 | Same shape, for `@Validated` params |
| `NotFoundException` | 404 | |
| `ConflictException` | 409 | Carries the reason code |
| `AccessDeniedException` | 403 | |
| `AuthenticationException` | 401 | |
| `DataIntegrityViolationException` | 409 | Map to a friendly message; never surface the SQL |
| `Exception` | 500 | Log at ERROR with a correlation id; return a generic message (NFR-2.7) |

The `fields` map must key on the JSON field name so the frontend can attach errors to inputs
without translation (FR-8.4).

### 3.2 DTOs

Three per entity, in a `dto` subpackage:

- `CreateProjectRequest` — plain fields, Bean Validation annotations from
  [PRD §7.2](./PRD.md#72-project)
- `UpdateProjectRequest` — **every field wrapped in `JsonNullable<T>`**, see below
- `ProjectResponse` — a `record`, matching the JSON in PRD §6.3

**Map by hand.** No mapping library. Each response record owns a static factory that builds it
from the entity, and the service calls that on the way out:

```java
public record ProjectResponse(UUID id, String name, String slug, ProjectStatus status, ...) {
    public static ProjectResponse from(Project p) {
        return new ProjectResponse(p.getId(), p.getName(), p.getSlug(), p.getStatus(), ...);
    }
}
```

Twenty lines per entity, no annotation processor, and the compiler already enforces what a
mapping library's "unmapped field" check would: add a component to the record and every call site
fails to compile until you supply it. Requests go the other way in the service — `create` builds
the entity from `CreateProjectRequest`, `update` applies the `JsonNullable` fields onto a loaded
one. The entity never leaves the service layer.

Register the Jackson module, or `JsonNullable` deserialises to null and the whole mechanism fails
silently:

```java
@Configuration
public class JacksonConfig {
    @Bean
    public Module jsonNullableModule() { return new JsonNullableModule(); }
}
```

Apply fields only when present:

```java
request.getName().ifPresent(name -> {
    project.setName(name);
    project.setSlug(slugService.uniqueSlug(name, userId, project.getId()));
});
request.getClient().ifPresent(project::setClient);       // null clears it
request.getStatus().ifPresent(project::setStatus);
```

For fields that are `NOT NULL` in the database (`name`, `status`), reject an explicit `null` with
a 400 rather than letting Hibernate throw.

### 3.3 Slug generation (FR-2.3 – FR-2.5)

```java
public String slugify(String input) {
    return Normalizer.normalize(input, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")          // strip accents
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", "-")     // collapse runs
        .replaceAll("(^-|-$)", "");        // trim
}
```

Uniqueness in **one** query, not a loop of existence checks:

```java
public String uniqueSlug(String name, UUID userId, UUID excludeId) {
    String base = slugify(name);
    Set<String> taken = projectRepository
        .findByUserIdAndSlugStartingWith(userId, base).stream()
        .filter(p -> !p.getId().equals(excludeId))
        .map(Project::getSlug)
        .collect(toSet());

    if (!taken.contains(base)) return base;
    for (int i = 2; ; i++) {
        String candidate = base + "-" + i;
        if (!taken.contains(candidate)) return candidate;
    }
}
```

Handle the edge case where `slugify` returns an empty string (a name of only punctuation) — fall
back to `"project"`.

### 3.4 Tag service (FR-5.3, FR-5.4)

Create-or-return, with the colour cycle:

```java
@Transactional
public Tag findOrCreate(String rawName, UUID userId) {
    String name = rawName.trim().toLowerCase(Locale.ROOT);
    return tagRepository.findByUserIdAndName(userId, name)
        .orElseGet(() -> {
            long count = tagRepository.countByUserId(userId);
            return tagRepository.save(new Tag(name, nextColor(count), userId));
        });
}
```

`nextColor` cycles the seven-entry palette from [PRD §9.5](./PRD.md#95-tag-palette) by
`count % 7`. Under concurrency this can race; catch `DataIntegrityViolationException` and re-read.
Single-user in practice, but worth handling and worth being able to explain.

### 3.5 Controllers

Thin. Bind, delegate, map the response. **No business logic in a controller.**

```java
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectResponse> list(@CurrentUser UserPrincipal user,
                                      @ModelAttribute ProjectFilter filter) {
        return projectService.list(user.getId(), filter);
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(@CurrentUser UserPrincipal user,
                                                  @Valid @RequestBody CreateProjectRequest request) {
        ProjectResponse created = projectService.create(user.getId(), request);
        return ResponseEntity
            .created(URI.create("/api/projects/" + created.id()))
            .body(created);
    }
    // …
}
```

`@CurrentUser` is a custom annotation resolving the authenticated principal — a stub returning the
seed user today, replaced with the real one on Day 5.

### 3.6 Tests

- **Unit** — `ProjectServiceTest` with mocked repositories: slug generation, collision handling,
  archived exclusion, the pin cap
- **Integration** — `ProjectControllerIT` with MockMvc against Testcontainers: every endpoint, the
  full status-code matrix, and the validation error shape
- **The PATCH tests** (PRD §6.9) — for every PATCH endpoint, `{}` changes nothing, and
  `{"field": null}` clears exactly that field. Write these today, while the pattern is fresh.

### Deliverable

Working `/api/projects` and `/api/tags` with slug generation, pin capping, tag create-or-return,
uniform errors, and Swagger UI listing every endpoint.

### Done when

- [x] `POST /api/projects` with `{"name":"Harbourfront Dental"}` returns 201, slug `harbourfront-dental`, `Location` header set
- [x] A second project of the same name gets slug `harbourfront-dental-2`
- [x] `POST` with a blank name returns 400 with `fields.name` populated
- [x] `PATCH` with `{}` leaves every field unchanged — asserted by a test
- [x] `PATCH` with `{"client": null}` clears only `client`
- [x] Renaming regenerates the slug
- [x] `GET /api/projects` excludes archived; `?includeArchived=true` includes them
- [x] `?q=harbour` matches name, client, and description case-insensitively
- [x] Pinning a fifth project returns 409
- [x] `DELETE` returns 204 and a follow-up `GET` returns 404
- [x] `POST /api/tags` with `{"name":"React"}` twice returns the same id, 201 then 200
- [x] The first seven tags get seven different colours
- [x] `/swagger-ui.html` lists every endpoint with schemas
- [x] `./mvnw test` green; JaCoCo shows ≥70% on `ProjectService` and `TagService`

### Learning notes

- `@RestControllerAdvice` and the exception-resolution order
- Why `JsonNullable` is necessary and what Jackson does with an absent key
- Layer boundaries: what belongs in a controller, a service, a repository
- `@Transactional` — propagation, and why read methods take `readOnly = true`
- Entity ↔ DTO mapping by hand: where the mapping belongs, and why the entity never leaves the service
- MockMvc vs `@SpringBootTest` with a real port

### Commit

`feat(api): add projects and tags endpoints with validation and error handling`

---

# Day 4 — Thursday, September 3

## Environments and Tasks API

**Objective.** The two domains with real business logic: environment pairing invariants and task
ordering with server-controlled completion.

Implements FR-3.1 – FR-3.17 and FR-4.1 – FR-4.14.

> The hardest logic in the build. Give the pairing service the morning, when you are freshest.

### 4.1 Environment pairing (FR-3.7 – FR-3.13)

Put this in a dedicated `EnvironmentPairingService`. It is the piece worth being able to talk
through in an interview.

```java
@Transactional
public void pair(UUID environmentId, UUID targetId, UUID userId) {
    Environment a = load(environmentId, userId);
    Environment b = load(targetId, userId);

    if (a.getId().equals(b.getId()))
        throw new ConflictException("PAIR_SELF", "An environment cannot be paired with itself.");
    if (!a.getProject().getId().equals(b.getProject().getId()))
        throw new ConflictException("PAIR_DIFFERENT_PROJECT", "Environments must belong to the same project.");
    if (a.getType() != b.getType())
        throw new ConflictException("PAIR_DIFFERENT_TYPE", "Environments must share the same type.");

    releasePartner(a);          // must happen BEFORE assigning —
    releasePartner(b);          // the unique constraint will reject an overlap otherwise

    a.setPairedWith(b);
    b.setPairedWith(a);

    touchProject(a.getProject());
}
```

**Release before assign** is not a style preference. `paired_with_id` is `UNIQUE`; assigning
before releasing puts two rows in conflict inside the same transaction and Postgres rejects it.
The database is enforcing the invariant, and the service must cooperate with it.

`releasePartner` must clear **both** directions:

```java
private void releasePartner(Environment env) {
    Environment partner = env.getPairedWith();
    if (partner != null) {
        partner.setPairedWith(null);
        env.setPairedWith(null);
    }
    Environment claimedBy = env.getPairedBy();   // someone points at us
    if (claimedBy != null) {
        claimedBy.setPairedWith(null);
    }
}
```

Also wire:
- **Type change breaks the pair** (FR-3.12) — in `update`, if the type changed, call
  `releasePartner` on both sides before saving
- **Delete releases** (FR-3.13) — release before `repository.delete`
- **Touch project** (FR-3.14) — every create, update, and delete bumps `project.updatedAt`

### 4.2 Grouping (FR-3.5, FR-3.6, FR-3.15)

`GroupedEnvironments` shapes the response the UI renders directly, so the frontend does no
pairing arithmetic:

1. Partition by type, in the fixed order Production, Preview, Development
2. Within a type, split into applications and databases using
   `DATABASE_PLATFORMS = EnumSet.of(Platform.NEON)`
3. Applications claim their partners first, producing `rows`
4. Databases with no partner become `orphanDatabases`
5. An application with no partner produces a row with a null `database` — the dashed empty slot

### 4.3 Task ordering (FR-4.7)

```java
Integer min = taskRepository.findMinSortOrder(userId, status);
task.setSortOrder(min == null ? 0 : min - 1);
```

`min` is null for an empty column — handle it, or every first task in a column throws.

### 4.4 Completion stamping (FR-4.6)

```java
private void applyStatus(Task task, TaskStatus next) {
    TaskStatus previous = task.getStatus();
    task.setStatus(next);
    if (next == TaskStatus.DONE && previous != TaskStatus.DONE) {
        task.setCompletedAt(Instant.now());
    } else if (next != TaskStatus.DONE && previous == TaskStatus.DONE) {
        task.setCompletedAt(null);
    }
}
```

`completedAt` is **absent from the update DTO entirely**. That is the cleanest way to guarantee a
client cannot set it.

### 4.5 Needs attention (FR-4.10)

```java
public NeedsAttention needsAttention(UUID userId) {
    Instant now = Instant.now();
    Instant horizon = now.plus(8, ChronoUnit.DAYS);
    List<Task> open = taskRepository.findOpenDueBefore(userId, horizon);

    LocalDate today = LocalDate.now(ZoneId.of("America/Toronto"));
    return new NeedsAttention(
        open.stream().filter(t -> t.getDueDate().isBefore(now)).toList(),
        open.stream().filter(t -> isSameDay(t.getDueDate(), today) && !t.getDueDate().isBefore(now)).toList(),
        open.stream().filter(t -> t.getDueDate().isAfter(endOfDay(today))).toList()
    );
}
```

> **Timezone.** Store everything in UTC; do "is this today?" arithmetic in the user's zone. Fix
> the zone to `America/Toronto` for now and note it as a future per-user setting. Getting this
> wrong makes tasks appear overdue at 8 pm.

### 4.6 Tests

Every pairing invariant gets its own test (NFR-3.3):

| Test | Asserts |
|---|---|
| `pair_sameProjectSameType_succeeds` | both sides reference each other |
| `pair_differentType_returns409` | `PAIR_DIFFERENT_TYPE` |
| `pair_differentProject_returns409` | `PAIR_DIFFERENT_PROJECT` |
| `pair_self_returns409` | `PAIR_SELF` |
| `pair_whenAlreadyPaired_releasesPreviousPartner` | C is unpaired, no dangling reference |
| `changeType_breaksPairOnBothSides` | both sides null |
| `delete_releasesPartner` | partner survives, unpaired |
| `anyWrite_touchesProjectUpdatedAt` | timestamp advanced |

Plus task tests: top-of-column ordering, `completedAt` set and cleared, client-supplied
`completedAt` ignored, overdue boundaries (due yesterday and open → overdue; due yesterday and
done → not overdue), and the three-way needs-attention partition.

### Deliverable

`/api/environments` and `/api/tasks` complete, with every invariant covered by a passing test.

### Done when

- [x] Every row of the table in §4.6 is a passing test
- [x] `GET /api/environments/grouped?projectId=…` returns three groups in the fixed order
- [x] An application with no database partner appears as a row with a null `database`
- [x] An orphan Neon environment appears in `orphanDatabases`
- [x] A new task's `sortOrder` is lower than every other task in that column
- [x] The first task in an empty column does not throw
- [x] `PUT /api/tasks/{id}/move` persists both status and position
- [x] `POST /api/tasks` with `completedAt` in the body ignores it
- [x] `needs-attention` partitions correctly across the three buckets
- [x] A 600-character Neon connection string is accepted in `url`
- [x] Environment writes bump the project's `updatedAt`

### Learning notes

- Self-referencing one-to-one in JPA; owning side and the unique constraint
- Why release-before-assign is required under a unique constraint
- `@Transactional` boundaries and when the flush actually happens
- `Instant` vs `LocalDateTime` vs `ZonedDateTime`, and why you store UTC
- Bidirectional relationship maintenance — why setting one side is not enough

### Commit

`feat(api): add environments with pairing invariants and tasks with ordering`

---

# Day 5 — Friday, September 4

## Spring Security: JWT authentication and ownership

**Objective.** Real authentication, and every existing endpoint scoped to the authenticated user.

Implements FR-1.1 – FR-1.13 and NFR-2.1 – NFR-2.10.

> The headline of this project for a Java employer. Build it by hand and understand every line —
> this is the part you will be asked about.

### 5.1 The domain

- `User` implements nothing special; a separate `UserPrincipal implements UserDetails` adapts it
  for Spring Security. Keeping the entity free of framework interfaces is the cleaner design and
  worth being able to justify.
- `CustomUserDetailsService implements UserDetailsService` — loads by email, throws
  `UsernameNotFoundException`.
- `PasswordEncoder` bean: `new BCryptPasswordEncoder(12)` (NFR-2.1).

### 5.2 `JwtService`

```java
@Service
public class JwtService {

    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(AtlasProperties props) {
        byte[] secret = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {                                   // NFR-2.2
            throw new IllegalStateException(
                "atlas.jwt.secret must be at least 256 bits (32 bytes).");
        }
        this.key = Keys.hmacShaKeyFor(secret);
        this.accessTtl = props.jwt().accessTokenTtl();
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getId().toString())
            .claim("email", user.getEmail())
            .claim("roles", user.getRoles())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(accessTtl)))
            .signWith(key)
            .compact();
    }

    public Optional<Claims> parse(String token) {
        try {
            return Optional.of(Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();      // expired, tampered, or malformed
        }
    }
}
```

Throwing on a short secret at construction means a misconfigured deployment fails at startup, not
at the first login. There is deliberately no default secret.

### 5.3 Refresh tokens (FR-1.5, FR-1.6)

- A cryptographically random 256-bit value, base64url-encoded — **not** a JWT. It is an opaque
  handle; the server owns the state.
- Store the **SHA-256 hash**, never the raw value (PRD §5.7). A database leak then yields nothing
  usable — the same reasoning as password hashing.
- On refresh: hash the presented token, look it up, reject if missing, expired, or revoked, then
  **rotate** — revoke the old row and issue a new one.
- On logout: set `revoked_at`.

### 5.4 `JwtAuthenticationFilter`

`extends OncePerRequestFilter`, registered before `UsernamePasswordAuthenticationFilter`:

1. Read the `Authorization` header; if absent or not `Bearer `, continue the chain untouched
2. Parse and verify; on failure, continue untouched — **do not** throw here. Let the
   authorization layer produce the 401, so one component owns that decision
3. On success, build a `UsernamePasswordAuthenticationToken` and set it on the
   `SecurityContextHolder`

### 5.5 `SecurityConfig`

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final AtlasProperties props;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            // Safe to disable: the API is stateless and token-bearing, so there is no
            // ambient credential for a cross-site request to ride on. NFR-2.5
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/refresh").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(e -> e
                .authenticationEntryPoint(jsonAuthEntryPoint())   // 401 in the standard error shape
                .accessDeniedHandler(jsonAccessDeniedHandler()))  // 403 likewise
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

The custom entry point matters: without it Spring returns an HTML error page, and the frontend's
error handling breaks on the first expired token.

**CORS (NFR-2.4)** — allow exactly `props.cors().allowedOrigin()`, methods
`GET, POST, PATCH, PUT, DELETE, OPTIONS`, headers `Authorization, Content-Type`. No wildcard.
Locally the Vite proxy means this is untested; get it right now anyway, because Day 10 is when it
would otherwise bite.

### 5.6 Retrofitting ownership (FR-1.9)

Go back through Days 3 and 4 and replace the stub principal with the real one:

- `@CurrentUser` resolves `UserPrincipal` from the `SecurityContext`
- Every service method takes the user id and passes it to a `…AndUserId` repository method
- A record belonging to another user throws `NotFoundException` → **404, not 403** — a 403 confirms
  the record exists, which leaks information

Environments have no `user_id` of their own; they are reached through their project, so the
ownership check goes through `project.user.id`.

**Write the cross-user test before you consider this done:** create two users, have user A create
a project, then have user B request it by id and assert 404.

### 5.7 Rate limiting (NFR-2.9)

A simple in-memory `Map<String, Bucket>` keyed by IP, sized at 10 attempts per minute, is
sufficient and honest for a single-instance deployment. Note in a comment that a multi-instance
deployment would need Redis.

### Deliverable

Working registration, login, refresh, and logout, with every domain endpoint requiring a valid
token and scoped to its owner.

### Done when

- [x] `POST /api/auth/register` returns 201 with both tokens
- [x] A duplicate email returns 400 with `fields.email`
- [x] A 6-character password returns 400 with `fields.password`
- [x] `POST /api/auth/login` returns 200 with both tokens
- [x] A wrong password returns 401, message identical to that for an unknown email
- [x] `GET /api/projects` with no header returns 401 **as JSON**, not HTML
- [x] A tampered token returns 401
- [x] An expired token returns 401
- [x] `POST /api/auth/refresh` returns a new access token and rotates the refresh token
- [x] The old refresh token is rejected after rotation
- [x] After logout, the refresh token returns 401
- [x] **User B requesting user A's project returns 404**
- [x] The database stores a BCrypt hash, and no response or log contains a plaintext password
- [x] Starting with `JWT_SECRET` unset fails at startup with a clear message
- [x] The eleventh login attempt in a minute returns 429

### Learning notes

- The Spring Security filter chain — what runs in what order, and where yours slots in
- `Authentication`, `Principal`, `UserDetails`, `SecurityContextHolder`
- Why BCrypt rather than SHA-256, and what the strength parameter costs
- JWT structure: header, payload, signature; why the payload is readable and what that means
- Access vs refresh tokens; why refresh tokens are stored server-side and rotated
- CORS preflight — what triggers an `OPTIONS` request and what must be echoed
- Why CSRF protection is unnecessary for a stateless token API — and when it is very necessary

### Commit

`feat(security): add JWT authentication, BCrypt hashing, and per-user data scoping`

---

# Day 6 — Monday, September 7

## Frontend foundation

**Objective.** A running React application with the design system, routing, authenticated API
access, and the app shell — ready for feature pages.

Implements PRD §9, FR-1 (client side), FR-8.1.

> Labour Day. See the note at the top of this document if you are taking it.

### 6.1 Design tokens

`src/styles/theme.css` — Tailwind v4 is CSS-first, so this file *is* the configuration. There is
no `tailwind.config.js`.

```css
@import "tailwindcss";

@theme {
  --breakpoint-*: initial;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;

  --color-*: initial;
  --color-canvas: #edeff4;
  --color-surface: #ffffff;
  --color-ink: #1c222b;
  --color-accent: #2a61d6;
  /* …the full set from PRD §9.3 */

  --text-*: initial;
  --text-base: 15px;
  --text-base--line-height: 23px;
  /* …the full scale from PRD §9.2 */
}
```

> **Reset each namespace to `initial` first.** That deletes Tailwind's stock palette and type
> scale, so `bg-blue-500` or `text-lg` at the wrong size **fails to compile** rather than shipping
> a token that is not in the system. It is the cheapest possible enforcement of a design system,
> and it is worth pointing out in an interview.

Load Public Sans and JetBrains Mono from Google Fonts in `index.html`.

### 6.2 API client

`src/lib/apiClient.ts` — an axios instance whose interceptors carry all the auth plumbing:

- **Request interceptor** — attach `Authorization: Bearer <accessToken>` from the auth store
- **Response interceptor** — on 401, attempt one refresh, then replay the original request; if the
  refresh fails, clear the store and redirect to `/login`
- **Concurrency guard** — while a refresh is in flight, queue subsequent 401s and replay them all
  against the new token. Without this, five parallel requests trigger five refreshes and four of
  them fail against the rotated token

```ts
let refreshPromise: Promise<string> | null = null;

async function refreshOnce(): Promise<string> {
  refreshPromise ??= doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
```

Also normalise errors into a single `ApiError { status, message, fields }` so every form reads
field errors the same way (FR-8.4).

### 6.3 Zod schemas

`src/schemas/` — one file per domain, mirroring [PRD §7](./PRD.md#7-validation-rules). Derive the
TypeScript types with `z.infer` so there is exactly one source of truth:

```ts
export const projectCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  client: z.string().max(120).optional(),
  techStack: z.array(z.string().min(1).max(40)).max(24).default([]),
  status: z.enum(["IDEA", "ACTIVE", "PAUSED", "SHIPPED", "ARCHIVED"]),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;
```

The client copy is for fast feedback only. The server remains authoritative, and its `fields` map
still drives what the user sees on submit.

### 6.4 Zustand stores

| Store | Holds | Persisted |
|---|---|---|
| `authStore` | user, access token, refresh token, `login`/`logout`/`setTokens` | refresh token only, in `localStorage` |
| `prefsStore` | sidebar collapsed, task view (board/list), project view (grid/list), last quick-add type | yes, `localStorage["atlas.preferences"]` |
| `uiStore` | palette open, active modal, toasts | no |

> **On token storage.** `localStorage` is readable by any script on the page, so an XSS becomes a
> token theft. The stronger design is an httpOnly refresh cookie. For this build, keep the
> **access token in memory only** and the refresh token in `localStorage`, and write a short
> comment in `authStore.ts` explaining the trade-off and what you would change for a production
> system. Being able to articulate that trade-off is worth more in an interview than silently
> picking either one.

### 6.5 Routing

`react-router` v7 with a data router:

| Path | Element | Guard |
|---|---|---|
| `/login` | `LoginPage` | redirect to `/` if authenticated |
| `/register` | `RegisterPage` | same |
| `/` | `DashboardPage` | protected |
| `/projects` | `ProjectsPage` | protected |
| `/projects/:slug` | `ProjectDetailPage` | protected |
| `/tasks` | `TasksPage` | protected |
| `/environments` | `EnvironmentsPage` | protected |
| `/tags` | `TagsPage` | protected |
| `/settings` | `SettingsPage` | protected |
| `*` | `NotFoundPage` | — |

`ProtectedRoute` redirects to `/login` with the attempted path in state, so login returns the user
where they were going. Lazy-load route components with `React.lazy` to satisfy NFR-1.3.

### 6.6 UI primitives

`src/components/ui/` — build these before any feature page, because every page needs them:

`Button` (4 variants × 3 sizes) · `Input` · `TextArea` · `Select` · `Checkbox` · `Field`
(label + error + hint) · `Badge` (+ typed status badges from PRD §9.4) · `Card` · `Panel` ·
`Modal` (focus trap, Escape, focus restore — NFR-4.5) · `ConfirmDialog` (names the object,
states the consequence — FR-8.2) · `Toast` + provider · `Tooltip` · `TagChip` · `Skeleton` ·
`EmptyState` · `ErrorState` · `PageHeader` · `Icon` (a fixed allowlist of Lucide icons, so the
icon set stays a system).

`src/lib/design.ts` maps every enum value to its badge recipe, exactly as PRD §9.4 specifies. One
map, used everywhere — no ad-hoc `status === "ACTIVE" ? "green" : …` scattered through components.

### 6.7 App shell

`Sidebar` — 248/60 px, collapse persisted, auto-collapse below 1024 px, nav counts, pinned
projects, Settings pinned to the bottom (PRD §9.1). `AppLayout` with an `<Outlet />`. Register the
global shortcuts (FR-7.6) with a `useKeyboardShortcuts` hook that ignores events originating in
text inputs (FR-7.7).

### 6.8 Auth pages

Login and Register: Zod validation on the client, server `fields` errors attached to inputs,
loading state on submit, and a redirect that honours the attempted path.

### Deliverable

An application you can register into, log into, and navigate — with the design system, the shell,
and the primitives all in place.

### Done when

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `bg-blue-500` fails to compile, proving the token reset works
- [ ] Registering through the UI creates a user and lands on the dashboard
- [ ] Logging out clears tokens and redirects to `/login`
- [ ] Visiting `/projects` while logged out redirects to `/login`, and logging in returns there
- [ ] An expired access token triggers exactly one refresh, and the original request replays
- [ ] Five parallel requests with an expired token trigger **one** refresh, not five
- [ ] Server validation errors appear beside the right inputs
- [ ] The sidebar collapses, and the state survives a reload
- [ ] `⌘\` toggles the sidebar; typing `\` in a text field does not
- [ ] Below 768 px the width notice appears
- [ ] Fonts render as Public Sans and JetBrains Mono

### Learning notes

- Tailwind v4's CSS-first configuration and what `@theme` does
- Axios interceptors, and the queue pattern for concurrent refreshes
- `z.infer` and deriving types from a schema rather than duplicating them
- Zustand: stores, selectors, `persist`, and avoiding unnecessary re-renders
- react-router v7 data routers, loaders, and route-level code splitting
- Focus traps and what `aria-modal` actually does

### Commit

`feat(web): add design system, routing, API client, and authentication UI`

---

# Day 7 — Tuesday, September 8

## Projects and Tags UI

**Objective.** Projects are fully usable from the browser — list, filter, create, edit, delete,
pin, tag.

Implements FR-2.12 – FR-2.14, FR-5.10, FR-8.1 – FR-8.3.

### 7.1 Data fetching

A `useApi` hook per resource returning `{ data, error, isLoading, refetch }`. Handle the three
states everywhere (FR-8.1) — this is what makes the app feel finished:

- **Loading** — a skeleton with the same geometry as the real content, never a spinner
- **Empty** — distinguish "no projects yet" (with a Create button) from "no projects match your
  filters" (with Clear filters)
- **Error** — plain-language message and a working Retry

> If you want TanStack Query for caching and invalidation, today is the day to add it. It is not
> in your stated stack and the app works fine without it — hand-rolled hooks plus a `refetch()`
> after each mutation is entirely adequate at this scale. Decide once and stay consistent.

### 7.2 Projects list

`PageHeader` with a New project button · search input (debounced 200 ms) · filter selects for
status, client, and tag · sort select · grid/list toggle (persisted) · active filter chips ·
"Showing n of m".

`ProjectCard` — pin toggle revealed on hover, name, client, status badge, truncated description,
environment count chips by type, an overdue badge when relevant, monospace tech-stack chips, tag
chips, and a relative "updated" timestamp.

Filtering happens **client-side** over the fetched list. At this data scale that is the right
call — it is instant, and the endpoints support server-side filters if the data ever grows.

### 7.3 Project form

One modal, used for both create and edit. Fields: name, client, description, status, repo URL,
live URL, engagement, started date, tech stack (`StackInput`), tags (`TagInput`).

- `TagInput` — autocomplete over existing tags, an inline "Create *name*" row, chips removable
  with Backspace (FR-5.10)
- `StackInput` — free text, Enter commits a chip, 24-item cap enforced with a visible counter
- `⌘Enter` submits (FR-7.6), Escape closes with a confirm if the form is dirty

### 7.4 Project detail

Breadcrumb → title with status badge and pin toggle → meta line (client · repo link · started ·
engagement) → actions (Open repo, Edit, and a row menu with Open live site / Pin / Delete) → tech
stack chips → tag chips → tabs.

Tabs are Overview, Environments, and Tasks, with counts, driven by `?tab=` so a tab is
linkable and survives a reload. Cross-fade 200 ms, opacity only — **never** animate height.
Environments and Tasks tabs land as placeholders today and are filled tomorrow.

### 7.5 Tags page

A simple table: name, colour swatch, usage count, created date, and row actions to rename,
recolour, and delete. Deleting confirms with "Remove *tagname* from N projects? The projects
themselves are not deleted."

### Deliverable

Complete project and tag management in the browser.

### Done when

- [ ] The list renders skeletons while loading, never a spinner
- [ ] A fresh account sees "no projects yet" with a Create button
- [ ] Filtering to nothing shows "no matches" with Clear filters
- [ ] Killing the backend shows the error state with a working Retry
- [ ] Creating a project shows it in the list without a manual refresh
- [ ] The slug appears in the response and the detail URL works
- [ ] Editing persists and the card updates
- [ ] Deleting confirms by name, then removes the card
- [ ] Pinning a fifth project shows the 409 message as a toast, not a crash
- [ ] Tag autocomplete suggests existing tags; "Create *name*" adds a new one
- [ ] Grid/list preference survives a reload
- [ ] `?tab=environments` opens that tab directly
- [ ] `⌘Enter` submits the open form
- [ ] Every action produces a success or failure toast

### Learning notes

- Controlled vs uncontrolled inputs, and when each is right
- Debouncing in React, and why the naive version fires on every keystroke
- Optimistic updates and how to roll one back
- `AnimatePresence` in Motion, and why exit animations need it
- Compound components — how `Tabs`/`Tab` share state without prop drilling

### Commit

`feat(web): add project and tag management UI`

---

# Day 8 — Wednesday, September 9

## Environments and Tasks UI

**Objective.** The environment map and the kanban board — the two screens that make this
application distinctive.

Implements FR-3.15 – FR-3.17, FR-4.11 – FR-4.14, NFR-4.6.

### 8.1 Environments section

Consume `/api/environments/grouped` and render it directly — the backend already did the pairing
arithmetic.

Three group cards in the fixed order Production, Preview, Development, each with a 3 px left rail
in its type colour (red / amber / neutral) and a one-line description of what that type means.
Inside, rows of:

```
┌────────────────────┐         ┌────────────────────┐
│ Web (Vercel)       │ ──────  │ Neon main          │
│ main · vercel.app  │         │ main · …neon.tech  │
└────────────────────┘         └────────────────────┘
```

`EnvironmentTile` — name, platform chip (Neon carries the teal database marker), branch pill in
monospace, truncated URL with a copy button, a notes indicator, and a row menu. An application
with no partner renders a **dashed** empty database slot with a "Pair a database" action.

`PairDialog` lists eligible partners only — same project, same type, not itself. Filtering the
list client-side means the invariants are visible in the UI rather than only enforced by a 409;
the server still rejects an ineligible pair, because a UI is not a security boundary.

The environment form adapts to the selected platform (FR-3.16): Neon shows "Connection string"
where Vercel shows "Deployment URL", with matching placeholders. "Check format" validates the
shape and reports pass or fail with the label **"Format only — no connection is attempted"**
(FR-3.17). Do not imply a network call you are not making.

### 8.2 Task board

Four columns, fixed order, neutral headers with a 9 px semantic square and a count.

Drag-and-drop with the **HTML5 API** — `draggable`, `onDragStart`, `onDragOver`, `onDrop`. No
library. It is a genuinely useful thing to have implemented once, and the drag-position
arithmetic is the interesting part:

- Drop target highlights with a dashed accent outline
- The dragged card gets `-1deg` rotation and a shadow
- Compute the new `sortOrder` as the midpoint between the neighbours on either side of the drop
  point; if it lands at the top, use `min - 1`
- Update optimistically, then `PUT /api/tasks/{id}/move`; roll back and toast on failure

**Keyboard equivalent (NFR-4.6).** Drag-and-drop is inaccessible on its own. Every card carries a
status select that performs the same move, so the board is fully operable without a mouse.

The Done column shows only tasks completed in the last 7 days (FR-4.12). Each open column ends
with a dashed "Drop or add" button.

### 8.3 Task list

A sortable table: checkbox, title, project, status, priority, due date, row menu. Sortable by any
column, with filters for project, status, and priority, and a "show completed" toggle. Overdue due
dates render in red with an icon — never colour alone (NFR-4.4).

The board/list preference persists (FR-4.13).

### 8.4 Project tabs

Fill in the Environments and Tasks tabs on the project detail page by reusing these components
with a `projectId` filter. Write them as reusable components from the start rather than porting
them later.

### Deliverable

Both distinctive screens working, with pairing operable from the UI and drag-and-drop persisting.

### Done when

- [ ] Environments render grouped by type in the fixed order
- [ ] A paired app and database appear side by side with a connector
- [ ] An unpaired app shows the dashed empty database slot
- [ ] An orphan Neon environment appears in its group
- [ ] The pair dialog offers only same-project, same-type candidates
- [ ] Pairing updates both tiles without a manual refresh
- [ ] Changing a paired environment's type visibly unpairs both sides
- [ ] The form changes its labels when the platform changes
- [ ] "Check format" states clearly that no connection is attempted
- [ ] Dragging a card between columns persists across a reload
- [ ] Dropping between two cards places it between them, not at the end
- [ ] The status select on a card performs the same move as a drag
- [ ] A failed move rolls back the card and shows a toast
- [ ] The Done column hides tasks completed more than 7 days ago
- [ ] The board is fully operable by keyboard alone
- [ ] The project detail Environments and Tasks tabs work, scoped to that project

### Learning notes

- The HTML5 drag-and-drop API — `dataTransfer`, and why `onDragOver` must call `preventDefault()`
- Fractional ordering: why midpoint `sortOrder` beats reindexing every row
- Optimistic UI and rollback
- Accessible alternatives to drag-and-drop
- CSS Grid for the paired-tile layout

### Commit

`feat(web): add environment map and task board with drag-and-drop`

---

# Day 9 — Thursday, September 10

## Dashboard, command palette, polish

**Objective.** The landing screen, global search, and the accessibility and motion pass that make
the whole thing feel finished.

Implements FR-6.1 – FR-6.6, FR-7.1 – FR-7.7, NFR-4.1 – NFR-4.7.

### 9.1 Dashboard

Header — `<Weekday> <d> <Month> · N projects active` — plus the Quick Add split button.

Four stat tiles: active projects · open tasks with an overdue pill · environments with a
distinct-platform count · tags.

Body grid `1fr / 388px`:

- **Left** — Pinned projects, 2-up cards, with a dashed invitation card in any unused slot
- **Right rail** — "Needs attention": overdue and due-today with a 2 px red left rail, then a
  quieter "Next 7 days" group, then a link to all tasks

Below `lg`, the right rail moves **above** the left column using flex `order` — the urgent
information should not be pushed below the fold on a narrower screen.

A brand-new account shows a single project-creation empty state, not a grid of empty panels
(FR-6.4).

One `GET /api/dashboard` call supplies all of it.

### 9.2 Command palette

640 px, 120 px from the top, entering with an 8 px **downward** translate — the one place motion
comes down the screen.

- `⌘K` / `Ctrl+K` from anywhere, Escape to close
- Debounced 120 ms against `/api/search`
- Groups in fixed order: Projects, Environments, Tasks, then Create actions
- `↑`/`↓` navigate with the list scrolling to keep the selection visible; Enter selects
- The matched substring highlights in amber
- A footer shows the result count and a hint

### 9.3 Quick add

A split button: the body creates the last-used type, the chevron opens a menu of Project /
Environment / Task. `⌘N` triggers it. The last-used type persists in `prefsStore`.

### 9.4 Accessibility pass

Work through NFR-4.1 – NFR-4.7 systematically:

- **Keyboard** — unplug the mouse and use the entire application. Every action must be reachable.
  This is the fastest way to find what is broken
- **Focus** — visible everywhere, using the ring token. Modals trap focus and restore it on close
- **Semantics** — `<nav>`, `<main>`, `<button>` for actions and `<a>` for navigation, `aria-label`
  on icon-only buttons, `aria-live` on toasts, `aria-current` on the active nav item
- **Contrast** — check every text/background pair against 4.5:1 with browser DevTools
- **Colour independence** — every status badge carries a text label (NFR-4.4)
- **Reduced motion** — `@media (prefers-reduced-motion: reduce)` sets every duration to `0.01ms`
- Run Lighthouse and axe DevTools; fix everything they flag

### 9.5 Motion pass

Apply PRD §9.6 consistently: list items enter at 200 ms, modals at 300 ms, the palette at 200 ms,
tab cross-fades at 200 ms opacity-only. Maximum translate 8 px. **Nothing scales.** Anything that
does not match the table gets fixed.

### 9.6 Performance

- Verify route-level code splitting; `npm run build` should emit separate chunks
- Confirm the gzipped bundle is under 350 KB (NFR-1.3)
- Enable `spring.jpa.show-sql` and click through the app, counting queries. Any list endpoint
  issuing a query per row gets an `@EntityGraph` or a `JOIN FETCH` (NFR-1.2)
- Memoise expensive list filtering with `useMemo`

### Deliverable

A complete, polished, accessible application.

### Done when

- [ ] The dashboard loads in one API call
- [ ] All four stat tiles show correct numbers
- [ ] Pinned projects render with dashed cards in empty slots
- [ ] Needs attention partitions correctly into the three groups
- [ ] A new account sees the single empty state
- [ ] Below `lg` the right rail appears above the left column
- [ ] `⌘K` opens the palette from every route
- [ ] The palette returns grouped results and Enter navigates correctly
- [ ] Create actions in the palette open the right forms
- [ ] `⌘N` opens quick add with the last-used type
- [ ] **The entire application is usable with the mouse unplugged**
- [ ] Focus is visible on every interactive element
- [ ] Lighthouse accessibility ≥ 95
- [ ] axe DevTools reports no serious or critical issues
- [ ] `prefers-reduced-motion` disables all animation
- [ ] The gzipped bundle is under 350 KB
- [ ] No list endpoint issues N+1 queries

### Learning notes

- Roving tabindex and managing focus in a listbox
- `aria-live` regions and announcing dynamic content
- WCAG contrast ratios and how they are calculated
- `React.memo`, `useMemo`, `useCallback` — and when they make things *worse*
- Reading a bundle analysis and finding what is large

### Commit

`feat(web): add dashboard, command palette, and accessibility pass`

---

# Day 10 — Friday, September 11

## Ship

**Objective.** Production deployment, automated CI/CD, and a repository that presents well to
someone who has never seen it.

Implements the deployment acceptance criteria in PRD §10.

> **This is the first deployment, not a re-deploy.** The Day 1 walking skeleton was deferred, so
> everything from the Azure account to the live URL happens today. Budget the whole day for
> §10.1–§10.5 and treat the documentation in §10.7 as the part that gets cut if the day runs
> long — a live URL with a thin README beats a polished README and no URL.
>
> Two things make this survivable. Both container images were built and run on Day 1, so the
> application packaging is not in question. And CORS was configured on Day 5, so the one failure
> that only ever appears in production has already been thought about.
>
> If §10.1 is still fighting you at lunch, go to the [cut list](#cut-list) rather than into the
> evening. See [R-12](#risk-register).

### 10.1 Azure account and first deployment

Deferred from Day 1 §1.7. Do this first — everything below depends on the resource group and the
Container App existing.

Sign in and create the resource group:

```bash
az login
az group create --name rg-atlas --location canadacentral
```

> `canadacentral` (Toronto) is the right region — lowest latency from Ancaster, and it keeps data
> in Canada, which is a point worth making in an interview.

Build and push to **GitHub Container Registry** (free, unlike Azure Container Registry, which has
no free tier). The Dockerfile and the image already work; this is the first time the image leaves
the machine:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-github-username> --password-stdin
docker build -t ghcr.io/<user>/atlas-backend:dev ./backend
docker push ghcr.io/<user>/atlas-backend:dev
```

Create the Container Apps environment and deploy:

```bash
az containerapp env create \
  --name atlas-env --resource-group rg-atlas --location canadacentral

az containerapp create \
  --name atlas-backend --resource-group rg-atlas --environment atlas-env \
  --image ghcr.io/<user>/atlas-backend:dev \
  --target-port 8080 --ingress external \
  --min-replicas 0 --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi
```

`--min-replicas 0` is what keeps this inside the free monthly grant: the container scales to zero
when idle and costs nothing. The trade-off is a 10–30 second cold start on the first request
(NFR-1.5) — a real cost, disclosed in the README rather than hidden.

**Get the round trip before adding the database.** The app boots with the Compose-era defaults and
no reachable Postgres, so it will fail its health check — that is expected at this point. What
must work is the ingress:

```bash
curl https://atlas-backend.<region>.azurecontainerapps.io/api/ping    # {"status":"ok"}
```

That single call is the walking skeleton the plan originally wanted on Day 1. Do not move on to
§10.2 until it answers.

**Frontend.** Create a Static Web App (free tier) from the Azure Portal, pointed at the GitHub
repository, with app location `frontend`, output location `dist`. It writes a GitHub Actions
workflow into the repository on your behalf — which is why §10.5 only has to add a path filter to
it rather than write it.

### 10.2 Azure Database for PostgreSQL

```bash
az postgres flexible-server create \
  --resource-group rg-atlas \
  --name atlas-db-<unique-suffix> \
  --location canadacentral \
  --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 \
  --version 16 \
  --admin-user atlasadmin \
  --admin-password "<generate a strong one>" \
  --public-access 0.0.0.0
```

`--tier Burstable --sku-name Standard_B1ms` with 32 GB is the shape covered by the 12-month free
allowance on a new account. **Set a calendar reminder for August 2027** — it starts billing when
the year ends.

Then create the database, and restrict access to Azure services rather than the whole internet:

```bash
az postgres flexible-server db create \
  --resource-group rg-atlas --server-name atlas-db-<suffix> --database-name atlas

az postgres flexible-server firewall-rule create \
  --resource-group rg-atlas --name atlas-db-<suffix> \
  --rule-name allow-azure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

That special 0.0.0.0–0.0.0.0 rule means "Azure services only", not "everyone" — add your own IP as
a separate rule while you are testing, and remove it afterwards.

Flyway runs the migrations automatically on first startup.

### 10.3 Backend secrets and configuration

```bash
az containerapp secret set \
  --name atlas-backend --resource-group rg-atlas \
  --secrets jwt-secret="<openssl rand -base64 48>" \
            db-password="<the admin password>"

az containerapp update \
  --name atlas-backend --resource-group rg-atlas \
  --set-env-vars \
     SPRING_PROFILES_ACTIVE=prod \
     DATABASE_URL="jdbc:postgresql://atlas-db-<suffix>.postgres.database.azure.com:5432/atlas?sslmode=require" \
     DATABASE_USER=atlasadmin \
     DATABASE_PASSWORD=secretref:db-password \
     JWT_SECRET=secretref:jwt-secret \
     FRONTEND_ORIGIN="https://<your-swa>.azurestaticapps.net"
```

`secretref:` keeps the value out of the environment-variable listing and out of any image layer
(NFR-2.10). `sslmode=require` is mandatory — Azure Postgres refuses unencrypted connections.

`application-prod.yml` differs in exactly three ways: `ddl-auto: none`, `DEBUG` logging off, and
`show-details: never` on the health endpoint.

Configure the health probe so Container Apps knows when the app is actually ready:

```bash
az containerapp update --name atlas-backend --resource-group rg-atlas \
  --set-probe-type liveness --set-probe-path /actuator/health
```

### 10.4 Frontend deployment

Set `VITE_API_BASE_URL` to the Container Apps URL as a Static Web Apps application setting. The
production build calls the absolute backend URL, so the Vite dev proxy is out of the picture and
**CORS is live for the first time** — this is where the Day 5 configuration proves itself. If it
fails, the browser console will say so plainly.

### 10.5 GitHub Actions

`.github/workflows/backend.yml`:

```yaml
name: Backend
on:
  push:
    branches: [main]
    paths: ['backend/**', '.github/workflows/backend.yml']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Test
        working-directory: backend
        run: ./mvnw -B verify          # Testcontainers works on GitHub-hosted runners

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/atlas-backend:${{ github.sha }}

      - name: Deploy
        uses: azure/container-apps-deploy-action@v2
        with:
          resourceGroup: rg-atlas
          containerAppName: atlas-backend
          imageToDeploy: ghcr.io/${{ github.repository_owner }}/atlas-backend:${{ github.sha }}
```

Tests run **before** the image is built, so a red build cannot deploy (NFR-3.5). Tagging with the
commit SHA rather than `latest` means every deployment is traceable and rollback is a one-line
change.

Authenticate to Azure with a federated credential (OIDC) rather than a stored service-principal
secret. It is the current recommended practice and it means no long-lived credential sits in
GitHub secrets.

The Static Web Apps workflow was written into the repository by the portal in §10.1; add a
`paths: ['frontend/**']` filter so frontend and backend deploy independently.

### 10.6 Demo account

Seed a demo user in the production database with a realistic dataset — 4 projects, environments
across all three types with several pairs, tasks in every column with a few overdue, and 8 tags.
This is what a recruiter will actually look at. Fifteen minutes spent making the data plausible is
worth more than another feature.

Put the credentials in the README and note that the data resets periodically.

### 10.7 Documentation

- Take screenshots at 1440 px: dashboard, projects list, project detail with the environment map,
  task board, command palette open. Save to `docs/img/`
- Fill in the README's placeholders: live URL, demo credentials, screenshots
- State the cold-start caveat plainly — a recruiter clicking a link that takes 20 seconds needs to
  know why, and explaining it demonstrates you understand the platform
- Copy `docs/README.md` to the repository root, or make the root README a short pointer
- Update the [progress log](#progress-log) in this file with what actually happened

### 10.8 Final QA

Walk every checkbox in [PRD §10](./PRD.md#10-acceptance-criteria) **against production**, not
against localhost. Then:

```bash
git log -p | grep -iE "(password|secret|jwt|api[-_]?key)" | grep -v "example"
```

Anything real in that output means rotating the credential immediately — history rewriting is not
enough once it has been pushed.

### Deliverable

A live application at a public HTTPS URL, an automated pipeline, and a repository that reads well
cold.

### Done when

- [ ] `az group create` and `az containerapp create` have run, and the image is in GHCR
- [ ] `/api/ping` answers on the Container Apps URL — the deferred Day 1 walking skeleton
- [ ] The backend is live on Azure over HTTPS
- [ ] The frontend is live on Azure over HTTPS
- [ ] Registration, login, and every CRUD operation work in production
- [ ] CORS is correct — no console errors
- [ ] Flyway migrated the Azure database on first startup
- [ ] `/actuator/health` returns `UP` in production
- [ ] Pushing to `main` triggers both workflows
- [ ] A deliberately failing test blocks the deployment
- [ ] The demo account logs in and shows realistic data
- [ ] Every acceptance criterion in PRD §10 passes **in production**
- [ ] The README has screenshots, a live URL, and working demo credentials
- [ ] The secret scan is clean
- [ ] Cold-start behaviour is documented rather than hidden

### Learning notes

- Container Apps scale-to-zero: the billing model, and what a cold start costs
- Container Apps revisions, and how traffic splitting enables zero-downtime deploys
- OIDC federated credentials vs service principal secrets
- Why deployments are tagged with a commit SHA, never `latest`
- Azure Postgres SSL requirements and connection pooling on a B1ms instance
- What actually costs money on the Azure free tier, and where the cliffs are

### Commit

`ci: add GitHub Actions pipelines and production Azure deployment`

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | **PATCH silently wipes fields.** Absent and null are indistinguishable in a plain DTO. | High | Severe — data loss | `JsonNullable` from Day 3. Write the `{}`-changes-nothing test for every PATCH endpoint the same day you write the endpoint. |
| R-2 | **Environment pairing leaves dangling references.** Assigning before releasing violates the unique constraint. | High | Corrupt data | Release before assign. One test per invariant (Day 4 §4.6). The database constraint is the backstop. |
| R-3 | **CORS fails in production.** It never appears locally because of the Vite proxy. | High | Frontend cannot reach the API | Configure CORS properly on Day 5. Test the deployed frontend against the deployed backend the moment both exist. |
| R-4 | **Azure Postgres free tier expires** 12 months after creation. | Certain | Billing starts | Calendar reminder for August 2027. Note the alternative (a containerised Postgres) in the README. |
| R-5 | **Cold starts make the demo look broken.** Scale-to-zero costs 10–30 s on first request. | Certain | Poor first impression | Disclose it in the README next to the demo link. Consider `--min-replicas 1` for the week before an interview, and accept the small cost. |
| R-6 | **Time overrun.** Ten days is tight for a manual build. | Medium | Unfinished repository | The [cut list](#cut-list). Reassess at the end of Day 5; if the backend is not complete, cut from the frontend, never from the backend. |
| R-7 | **N+1 queries** appear late and are painful to unpick. | Medium | Slow endpoints | `open-in-view: false` from Day 1 surfaces them immediately. Check SQL logs on Day 9. |
| R-8 | **JWT storage trade-off** — `localStorage` is XSS-exposed. | Medium | Security criticism | Access token in memory, refresh token in `localStorage`, with a comment explaining the trade-off. Be ready to discuss httpOnly cookies. |
| R-9 | **A secret reaches Git history.** | Low | Severe | `.gitignore` on Day 1, `secretref:` in Azure, and the history scan on Day 10. |
| R-10 | **Testcontainers is slow or fails in CI.** | Low | Broken pipeline | `withReuse(true)` locally; GitHub-hosted runners support Docker natively. Verify in CI on Day 1, not Day 10. |
| R-11 | **Scope creep** — the four deferred domains start looking easy. | Medium | Nothing finishes | They are in PRD §11 for a reason. Four polished domains beat eight half-built ones. Revisit after September 11. |
| R-12 | **Deployment is deferred to Day 10.** The Day 1 walking skeleton was dropped because the Azure account did not exist, so the first deploy is also the last day. This is the exact failure mode the original Day 1 was designed to prevent. | High | No live URL — the single worst outcome for a portfolio project | Create the free account **before Day 10**; it is the only prerequisite and it costs nothing. Day 1 still built and ran both images, so the packaging is proven and §10.1 is account setup only. Budget the whole of Day 10 for §10.1–§10.5 and cut §10.7 documentation before cutting the deploy. If the account exists earlier, run §10.1 on any evening — it is a self-contained hour. |

---

## Cut list

Cut in this order if you fall behind. Everything above the line still produces a defensible
portfolio project.

| Order | Cut | Saves | Cost |
|---|---|---|---|
| 1 | Command palette (FR-7.1 – FR-7.5) | ~4 h | A distinctive touch, but not load-bearing |
| 2 | Motion polish — ship with CSS transitions | ~2 h | Feels slightly less refined |
| 3 | Quick-add split button (FR-6.6) | ~1.5 h | One extra click to create |
| 4 | Grid/list and board/list toggles (FR-2.14, FR-4.13) | ~2 h | Pick the better view and ship only that |
| 5 | Tags page — keep the tag input, drop the management screen | ~2 h | Tags are managed inline only |
| 6 | Platform-adaptive environment form (FR-3.16, FR-3.17) | ~2 h | Generic labels instead |
| 7 | Task list view — keep the board only | ~3 h | Board is the better screen anyway |
| ─ | ─── **below this line the project is noticeably weaker** ─── | | |
| 8 | Refresh tokens — access token only, 24 h TTL | ~3 h | Weaker security story, which is the point of the build |
| 9 | Dashboard — redirect `/` to `/projects` | ~4 h | Loses the landing screen |

**Never cut:** authentication, per-user scoping, the environment pairing invariants, the PATCH
tests, Flyway migrations, or the Azure deployment. Those are the reasons this project exists.

---

## Definition of done

The build is complete when:

1. Every acceptance criterion in [PRD §10](./PRD.md#10-acceptance-criteria) passes **in
   production**
2. `./mvnw verify` is green with ≥70% service-layer coverage
3. `npm run build` emits no TypeScript errors and no console warnings
4. Pushing to `main` deploys both applications automatically
5. A stranger can open the live URL, log in with the demo account, and understand what Atlas does
   within thirty seconds
6. The README explains what it is, why the stack was chosen, how to run it, and how it is deployed
7. No secret exists anywhere in the Git history
8. You can explain every architectural decision in this document without notes

---

## After September 11

### Immediate (a day or two)

- Record a 2–3 minute screen capture walking through the app; link it from the README
- Write a short post about the environment pairing model — the self-referencing one-to-one with a
  unique constraint is a genuinely interesting problem and makes good technical writing
- Add the project to your resume and LinkedIn with the live URL

### Post-MVP backlog

From [PRD §11.1](./PRD.md#111-deferred-from-the-prototype), in the order that adds most:

| Feature | Estimate | Why this order |
|---|---|---|
| **Snippets** | 1.5 days | Most useful of the four, and syntax highlighting is a visible win |
| **Journal** | 1 day | Markdown rendering, date grouping — a different UI shape from the CRUD pages |
| **Learning** | 1.5 days | Derived rollup calculations are a good showcase for computed state |
| **Resources** | 0.5 day | Simplest; a good warm-up after a break |

Each follows the same path: Flyway migration → entity → repository → service → controller → DTOs →
UI page. Tags already generalise: add one join table per entity type, shaped exactly like
`project_tags`.

### Stretch

- **Real GitHub integration** — recent commits and open PRs on the project page (1 day)
- **Full-text search** — Postgres `tsvector` with ranking (1 day)
- **Microsoft Entra ID sign-in** alongside JWT — strong Azure story for local employers (1.5 days)
- **Redis caching** on the dashboard endpoint via Azure Cache for Redis (0.5 day)
- **OpenTelemetry** traces into Azure Application Insights (1 day)

---

*Build something you would want to use. Then go and get hired with it.*
