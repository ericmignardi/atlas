-- PRD 5.2. The account. Everything else in the schema hangs off this table and
-- cascades from it, so a user delete is a full account delete with no orphans.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(320)  NOT NULL,
    password_hash VARCHAR(60)   NOT NULL,
    display_name  VARCHAR(80),
    roles         VARCHAR(255)  NOT NULL DEFAULT 'ROLE_USER',
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Unique on lower(email), not on email. Emails are stored lowercased and
-- trimmed on write, but the index is what makes "Eric@x.com" and "eric@x.com"
-- the same account even if a future code path forgets to normalise.
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));
