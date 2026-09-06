// scripts/update_center/paths.mjs
// Single place that resolves every filesystem path the update-center touches,
// with environment-variable overrides so tests can point the whole subsystem at
// a temp directory without ever writing to the real repo files.
//
// Overrides (all optional, all absolute paths):
//   UPDATE_CENTER_SOURCES_PATH   -> data_sources.yaml
//   UPDATE_CENTER_MODULES_DIR    -> modules/
//   UPDATE_CENTER_HOME           -> data/update_center/  (staging + versions + active pointer)
//   UPDATE_CENTER_STORE_PATH     -> data/update_center_store.json (file backend)
//   UPDATE_CENTER_STATE_PATH     -> data/update_center_state.json (scanner CDC state)
//   UPDATE_CENTER_APPLY_ROOT     -> repo root used as the base of apply targets
//                                   (data_processed/ and vercel_public/data_processed/)
//   UPDATE_CENTER_INDEX_HTML     -> index.html (read-only; LAYER_REGISTRY snippet context)
//
// Nothing here creates directories as a side effect of import — callers use
// ensureDir() explicitly, so importing this module is always free of writes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.join(__dirname, "..", "..");

function envPath(name, fallback) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return fallback;
  return path.resolve(String(raw));
}

export function sourcesPath() {
  return envPath("UPDATE_CENTER_SOURCES_PATH", path.join(REPO_ROOT, "data_sources.yaml"));
}

export function modulesDir() {
  return envPath("UPDATE_CENTER_MODULES_DIR", path.join(REPO_ROOT, "modules"));
}

export function updateCenterHome() {
  return envPath("UPDATE_CENTER_HOME", path.join(REPO_ROOT, "data", "update_center"));
}

export function stagingDir() {
  return path.join(updateCenterHome(), "staging");
}

export function versionsDir() {
  return path.join(updateCenterHome(), "versions");
}

export function activePointerPath() {
  return path.join(updateCenterHome(), "active.json");
}

export function storeFilePath() {
  return envPath("UPDATE_CENTER_STORE_PATH", path.join(REPO_ROOT, "data", "update_center_store.json"));
}

export function statePath() {
  return envPath("UPDATE_CENTER_STATE_PATH", path.join(REPO_ROOT, "data", "update_center_state.json"));
}

export function applyRoot() {
  return envPath("UPDATE_CENTER_APPLY_ROOT", REPO_ROOT);
}

export function indexHtmlPath() {
  return envPath("UPDATE_CENTER_INDEX_HTML", path.join(REPO_ROOT, "index.html"));
}

/**
 * The directories an approved file is written into. Always includes the repo's
 * own data root; adds vercel_public/ only when that directory already exists,
 * so the map app (static server root) and the AI server read the same bytes
 * without waiting for a rebuild.
 *
 * Returns absolute directory prefixes; a source's local_file is relative to each.
 */
export function applyTargetRoots() {
  const root = applyRoot();
  const roots = [root];
  const vercelPublic = path.join(root, "vercel_public");
  if (fs.existsSync(vercelPublic) && fs.statSync(vercelPublic).isDirectory()) {
    roots.push(vercelPublic);
  }
  return roots;
}

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Reject any relative path that would escape its root (../, absolute paths,
 * drive letters, NUL bytes). Returns the normalised POSIX-style relative path.
 * Throws on anything suspicious — the update-center only ever writes to paths
 * that came out of data_sources.yaml, but those are operator-editable text.
 */
export function assertSafeRelPath(relPath) {
  const raw = String(relPath || "");
  if (!raw) throw new Error("빈 파일 경로는 허용되지 않습니다.");
  if (raw.includes("\0")) throw new Error(`파일 경로에 NUL 바이트가 있습니다: ${raw}`);
  if (path.isAbsolute(raw) || /^[A-Za-z]:/.test(raw)) {
    throw new Error(`절대 경로는 허용되지 않습니다: ${raw}`);
  }
  const normalised = path.normalize(raw).split(path.sep).join("/");
  if (normalised === ".." || normalised.startsWith("../") || normalised.includes("/../")) {
    throw new Error(`상위 디렉터리를 벗어나는 경로는 허용되지 않습니다: ${raw}`);
  }
  return normalised;
}
