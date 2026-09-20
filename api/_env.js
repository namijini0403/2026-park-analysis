'use strict';
// 로컬 개발용 .env 로더 — 한 곳에서만 키를 읽는다.
//
// 읽는 순서(먼저 읽은 값이 이긴다, 이미 있는 process.env 는 절대 덮어쓰지 않는다):
//   1. 이미 설정된 환경변수(Railway Variables 등 운영 환경)
//   2. 리포(워크트리) 루트 .env
//   3. 워크스페이스 루트 .env (리포 밖 — 키를 리포 안에 두지 않기 위한 기본 위치)
//
// 형식은 KEY=VALUE 한 줄씩. 값의 따옴표는 벗기고, `#` 로 시작하는 줄은 무시한다.
// 값은 로그에 남기지 않는다. 운영(Railway)에서는 .env 파일이 없으므로 아무 일도 하지 않는다.
const fs = require('node:fs');
const path = require('node:path');

const CANDIDATES = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
];

function parseDotenv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadLocalEnv() {
  const loaded = [];
  for (const file of CANDIDATES) {
    let text;
    try {
      if (!fs.existsSync(file)) continue;
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseDotenv(text);
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined || process.env[key] === '') {
        if (value !== '') process.env[key] = value;
      }
    }
    loaded.push(file);
  }
  return loaded;
}

const loadedFiles = loadLocalEnv();

module.exports = { loadLocalEnv, parseDotenv, loadedFiles };
