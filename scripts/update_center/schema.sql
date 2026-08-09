-- P4 update-center storage schema (Postgres backend)
-- Mirrors the JSON shape used by the file backend in store.mjs.
-- snapshot is BYTEA here; the file backend stores the equivalent bytes as a base64 string.
-- store.mjs maps BYTEA <-> base64 at the interface boundary so callers always see base64.

CREATE TABLE IF NOT EXISTS data_events (
  id TEXT PRIMARY KEY,
  dataset TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,            -- content | schema | moved | error | onboarding_proposal
  risk TEXT NOT NULL,            -- green | yellow | red
  summary TEXT,
  diff_json JSONB,
  ai_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | held | applied | rolled_back
  actor TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_events_dataset_detected_at
  ON data_events (dataset, detected_at);

CREATE TABLE IF NOT EXISTS data_versions (
  id TEXT PRIMARY KEY,
  dataset TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT,
  row_count INTEGER,
  snapshot BYTEA,
  source_event_id TEXT,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  rolled_back BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_data_versions_dataset_created_at
  ON data_versions (dataset, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  actor TEXT,
  action TEXT NOT NULL,
  dataset TEXT,
  event_id TEXT,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_at
  ON audit_log (at);
