-- PRD 5.6. Tags are per user, lowercased, and reusable across projects.
CREATE TABLE tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    color      CHAR(7)     NOT NULL DEFAULT '#454D5F',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_tags_user_name ON tags (user_id, name);

-- Join table. The composite primary key is the "a project has a tag at most
-- once" rule, enforced by the database rather than by a check in the service.
CREATE TABLE project_tags (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
);

-- The PK already covers project_id-first lookups; this one answers "which
-- projects carry this tag", which is the tag detail page.
CREATE INDEX ix_project_tags_tag ON project_tags (tag_id);
