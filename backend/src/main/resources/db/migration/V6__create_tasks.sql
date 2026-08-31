-- PRD 5.5. A task belongs to the user, not to the project: deleting a project
-- must not delete work, so project_id is nullable and set null on delete.
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   UUID         REFERENCES projects(id) ON DELETE SET NULL,
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    status       VARCHAR(16)  NOT NULL DEFAULT 'TODO',
    priority     VARCHAR(16)  NOT NULL DEFAULT 'MEDIUM',
    due_date     TIMESTAMPTZ,
    -- Signed, and allowed to go negative: a new task lands on top of its column
    -- by taking min(sort_order) - 1, which needs no renumbering of the rest.
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_tasks_user_status_sort ON tasks (user_id, status, sort_order);
CREATE INDEX ix_tasks_user_due_date    ON tasks (user_id, due_date);
CREATE INDEX ix_tasks_project          ON tasks (project_id);
CREATE INDEX ix_tasks_user_priority    ON tasks (user_id, priority);
