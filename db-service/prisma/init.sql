-- Survey DB Service — initial schema
-- Run with: psql -h 127.0.0.1 -U postgres -d dynamic_survey_db -f prisma/init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE "SurveyStatus"    AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'EDIT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Surveys
CREATE TABLE IF NOT EXISTS surveys (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(500)    NOT NULL DEFAULT 'Untitled Survey',
  description TEXT,
  status      "SurveyStatus"  NOT NULL DEFAULT 'DRAFT',
  language    VARCHAR(10)     NOT NULL DEFAULT 'en',
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Snapshot versions
CREATE TABLE IF NOT EXISTS survey_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id      UUID        NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  version_number INTEGER     NOT NULL,
  label          TEXT,
  snapshot       JSONB       NOT NULL,
  created_by     UUID        NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (survey_id, version_number)
);

-- Share links
CREATE TABLE IF NOT EXISTS survey_shares (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id   UUID              NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  share_token VARCHAR(128)      UNIQUE NOT NULL,
  permission  "SharePermission" NOT NULL DEFAULT 'VIEW',
  created_by  UUID              NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN           NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Collaborators
CREATE TABLE IF NOT EXISTS survey_collaborators (
  survey_id  UUID              NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id    UUID              NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  permission "SharePermission" NOT NULL DEFAULT 'VIEW',
  invited_by UUID              NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (survey_id, user_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_surveys_owner        ON surveys(owner_id);
CREATE INDEX IF NOT EXISTS idx_versions_survey      ON survey_versions(survey_id);
CREATE INDEX IF NOT EXISTS idx_shares_token         ON survey_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_survey        ON survey_shares(survey_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user   ON survey_collaborators(user_id);

SELECT 'All tables created successfully.' AS result;
