-- PRD 5.4. url is free text, not a URL: a Neon connection string is not one.
CREATE TABLE environments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name           VARCHAR(120) NOT NULL,
    platform       VARCHAR(16)  NOT NULL,
    type           VARCHAR(16)  NOT NULL,
    branch         VARCHAR(200),
    url            VARCHAR(600),
    notes          TEXT,
    -- UNIQUE is what makes the one-to-one real in the database: two
    -- environments cannot both claim the same partner, even if the service
    -- logic has a bug. It is also why pairing must release before it assigns
    -- (FR-3.11). ON DELETE SET NULL so deleting one half unpairs the other
    -- rather than deleting it.
    paired_with_id UUID UNIQUE REFERENCES environments(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_environments_project      ON environments (project_id);
CREATE INDEX ix_environments_project_type ON environments (project_id, type);
CREATE INDEX ix_environments_platform     ON environments (platform);
