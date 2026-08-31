-- PRD 5.3.
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,
    client      VARCHAR(120),
    description TEXT,
    status      VARCHAR(16)  NOT NULL DEFAULT 'IDEA',
    repo_url    VARCHAR(500),
    live_url    VARCHAR(500),
    engagement  VARCHAR(80),
    tech_stack  TEXT[]       NOT NULL DEFAULT '{}',
    is_pinned   BOOLEAN      NOT NULL DEFAULT FALSE,
    started_at  DATE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Slugs are unique per user, not globally: two accounts may both own /atlas.
CREATE UNIQUE INDEX ux_projects_user_slug ON projects (user_id, slug);

-- One index per list query the API will actually run (PRD 5.3). Each is
-- user_id-first because every query is scoped to the owner (FR-1.9).
CREATE INDEX ix_projects_user_status  ON projects (user_id, status);
CREATE INDEX ix_projects_user_pinned  ON projects (user_id, is_pinned);
CREATE INDEX ix_projects_user_updated ON projects (user_id, updated_at DESC);
