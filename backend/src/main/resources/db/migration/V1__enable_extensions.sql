-- gen_random_uuid() lives in pgcrypto on Postgres 12 and is built in from 13
-- onwards. Creating the extension is harmless on 16 and keeps the migration
-- honest about what the DEFAULT on every primary key depends on.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
