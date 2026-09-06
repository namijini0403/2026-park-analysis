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

-- update_center_meta: 이벤트/버전/감사 어디에도 속하지 않는 운영 상태 key/value.
-- (자동 감시 스케줄 설정, 마지막/다음 스캔 시각, 마지막 스캔 결과 요약 등)
-- 파일 백엔드는 update_center_store.json 의 "meta" 객체가 같은 역할을 한다.
CREATE TABLE IF NOT EXISTS update_center_meta (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- 2026-09-07: 버전 파일 영속화 (Postgres = 진실, 컨테이너 디스크 = 캐시)
-- ---------------------------------------------------------------------------
-- Railway 컨테이너 파일시스템은 재배포마다 초기화되므로, 승인으로 만들어진
-- 불변 버전 디렉터리(data/update_center/versions/vNNN/)의 실제 바이트를 DB 에 둔다.
-- rel_path 는 버전 디렉터리 기준 상대 경로다: "files/x.csv", "previous/x.csv",
-- "manifest.json". 승인 대기 후보(staging)는 version_id = 'staging:<staging_id>'
-- 네임스페이스로 같은 테이블에 보존된다(재배포 후에도 승인 가능하도록).
CREATE TABLE IF NOT EXISTS data_version_files (
  version_id TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content BYTEA NOT NULL,
  PRIMARY KEY (version_id, rel_path)
);

CREATE INDEX IF NOT EXISTS idx_data_version_files_version_id
  ON data_version_files (version_id);

-- 기존 운영 테이블을 그대로 두고 컬럼만 추가한다(재배포 시 자동 마이그레이션).
--   manifest    : 버전 매니페스트 원본(파일 목록/해시/반영 경로) — 조회용 사본.
--                 같은 내용이 data_version_files 의 "manifest.json" 행에도 있다.
--   version_dir : vNNN 디렉터리 이름. 예전에는 snapshot(base64 JSON) 안에만 있어
--                 복원/롤백이 디코드해야 찾을 수 있었다.
ALTER TABLE data_versions ADD COLUMN IF NOT EXISTS manifest JSONB;
ALTER TABLE data_versions ADD COLUMN IF NOT EXISTS version_dir TEXT;

CREATE INDEX IF NOT EXISTS idx_data_versions_version_dir
  ON data_versions (dataset, version_dir);
