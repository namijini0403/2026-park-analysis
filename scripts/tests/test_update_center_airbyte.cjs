'use strict';
// Offline regression for check.type airbyte_catalog (Airbyte 수집 계층 → 판단 계층 입구).
// 검증 항목:
//   [1] 원자료 저장소 미설정 → skipped(판단 보류), 이벤트 없음
//   [2] 저장소는 있으나 해당 pk 수집 이력 없음 → skipped, 이벤트 없음
//   [3] 첫 카탈로그 → baseline (이벤트 없음, 감사 기록)
//   [4] 같은 카탈로그 재검사 → unchanged
//   [5] 수정일·버전명 변경 → yellow content 이벤트 1건, action_required=manual_file_upload, 자동 반영 불가(승인 409)
//   [6] 수집이 max_age 를 넘으면 stale yellow 1회만 (반복 검사에도 중복 생성 없음)
//   [7] raw 테이블 형태(_airbyte_data) 행도 같은 결과로 정규화
//   [8] API: GET /sources 의 airbyte_catalog 필드, GET /airbyte 요약
//   [9] refresh_pipeline: 같은 원인의 실패는 red 이벤트를 반복 생성하지 않는다 (Python ENOENT 회귀)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uc_airbyte_'));
delete process.env.DATABASE_URL;
delete process.env.AIRBYTE_RAW_DATABASE_URL;
delete process.env.AIRBYTE_RAW_FILE;
process.env.UPDATE_CENTER_STORE_PATH = path.join(tmp, 'store.json');
process.env.UPDATE_CENTER_STATE_PATH = path.join(tmp, 'state.json');
process.env.UPDATE_CENTER_SOURCES_PATH = path.join(tmp, 'sources.json');
process.env.UPDATE_CENTER_HOME = path.join(tmp, 'home');
process.env.UPDATE_CENTER_SCAN_INTERVAL_MIN = '0';
process.env.UPDATE_CENTER_TOKEN = 'isolated-test';
process.env.AIRBYTE_RAW_MAX_AGE_HOURS = '72';

const RAW_FILE = path.join(tmp, 'airbyte_raw.json');
fs.writeFileSync(process.env.UPDATE_CENTER_SOURCES_PATH, JSON.stringify({sources: [
  {dataset: 'construction_yeonsu', portal_pk: '15029299', source_url: 'https://www.data.go.kr/data/15029299/fileData.do', never_auto_apply: true,
    check: {type: 'airbyte_catalog', portal_pk: '15029299'}, airbyte: {stream: 'datagokr_catalog', portal_pk: '15029299', signal_only: true}},
  {dataset: 'parks', portal_pk: '15012890', check: {type: 'airbyte_catalog', portal_pk: '15012890'}},
  {dataset: 'libraries', portal_pk: '15013109', check: {type: 'refresh_pipeline', pipeline: 'libraries'}, airbyte: {portal_pk: '15013109'}},
]}));

const iso = (d) => new Date(d).toISOString();
const rec = (over = {}) => ({
  portal_pk: '15029299', catalog_kind: 'fileData', name: '인천광역시 연수구_건축물 착공신고 현황',
  alternateName: '인천광역시 연수구_건축물 착공신고 현황_20260309', url: 'https://www.data.go.kr/data/15029299/fileData.do',
  dateModified: '2026-05-27', encodingFormat: 'CSV', datasetTimeInterval: '연간', collected_at: iso(Date.now() - 3600e3),
  _airbyte_extracted_at: iso(Date.now() - 3600e3), _airbyte_raw_id: 'r1', ...over,
});
const writeRaw = (rows) => fs.writeFileSync(RAW_FILE, JSON.stringify(rows));

(async () => {
  const {runScan} = await import('../update_center/scan.mjs');
  const {createStore} = await import('../update_center/store.mjs');
  const {latestByPortalPk, normalizeCatalogRow} = await import('../update_center/airbyte_raw.mjs');
  const store = await createStore();

  // [1] 미설정 → skipped
  let result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.skipped, 1, '[1] unconfigured raw store is skipped');
  assert.equal(result.events.length, 0);
  let state = await store.getMeta('source_scan_state');
  assert.equal(state.construction_yeonsu.lastStatus, 'skipped');
  assert.match(state.construction_yeonsu.skipReason, /미설정/);

  // [2] 이력 없음 → skipped
  process.env.AIRBYTE_RAW_FILE = RAW_FILE;
  writeRaw([rec({portal_pk: '99999999'})]);
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.skipped, 1, '[2] no rows for pk is skipped');
  assert.equal(result.events.length, 0);

  // [3] baseline
  writeRaw([rec()]);
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.baseline, 1, '[3] first catalog is a baseline');
  assert.equal(result.events.length, 0);
  state = await store.getMeta('source_scan_state');
  assert.equal(state.construction_yeonsu.lastStatus, 'ok');
  assert.equal(state.construction_yeonsu.catalog.dateModified, '2026-05-27');
  const audit = await store.listAudit(20);
  assert.ok(audit.some((a) => a.action === 'baseline_recorded' && a.dataset === 'construction_yeonsu'), '[3] baseline audit');

  // [4] unchanged (여러 회차 append 되어도 최신 1건만 본다)
  writeRaw([rec({_airbyte_extracted_at: iso(Date.now() - 7200e3), _airbyte_raw_id: 'r0'}), rec()]);
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.unchanged, 1, '[4] identical catalog is unchanged');

  // [5] 변경 → yellow, 승인 불가
  writeRaw([rec(), rec({dateModified: '2026-09-01', alternateName: '인천광역시 연수구_건축물 착공신고 현황_20260811', _airbyte_extracted_at: iso(Date.now() - 600e3), _airbyte_raw_id: 'r2'})]);
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.yellow, 1, '[5] catalog change is yellow');
  assert.equal(result.events.length, 1);
  const ev = result.events[0];
  assert.equal(ev.kind, 'content');
  assert.equal(ev.risk, 'yellow');
  assert.equal(ev.diff_json.action_required, 'manual_file_upload');
  assert.equal(ev.diff_json.prev.dateModified, '2026-05-27');
  assert.equal(ev.diff_json.next.dateModified, '2026-09-01');
  assert.match(ev.summary, /수정일 2026-05-27 → 2026-09-01/);
  assert.match(ev.summary, /파일 업로드/);
  const handler = require('../../api/update-center.js');
  let body;
  const res = {setHeader() {}, end(value) {body = JSON.parse(value);}};
  await handler({method: 'POST', url: '/api/update-center/approve', headers: {'x-update-center-token': 'isolated-test'}, body: {event_id: ev.id, confirm: true}}, res);
  assert.equal(res.statusCode, 409, '[5] catalog signal cannot be approved into data');
  assert.equal((await store.getEvent(ev.id)).status, 'pending');
  // 변경 후 재검사는 unchanged
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.unchanged, 1, '[5] state advanced to new catalog');

  // [6] stale → yellow 1회
  writeRaw([rec({dateModified: '2026-09-01', alternateName: '인천광역시 연수구_건축물 착공신고 현황_20260811', _airbyte_extracted_at: iso(Date.now() - 100 * 3600e3), _airbyte_raw_id: 'r3'})]);
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.yellow, 1, '[6] stale sync is reported once');
  assert.equal(result.events[0].kind, 'stale');
  result = await runScan({dataset: 'construction_yeonsu'});
  assert.equal(result.summary.unchanged, 1, '[6] stale is not repeated');
  assert.equal(result.events.length, 0);

  // [7] raw 테이블 형태
  const rawRows = [{_airbyte_raw_id: 'x', _airbyte_extracted_at: iso(Date.now()), _airbyte_data: JSON.stringify(rec({portal_pk: '15012890', name: '전국도시공원정보표준데이터', dateModified: '2026-06-22'}))}];
  const latest = latestByPortalPk(rawRows);
  assert.equal(latest.get('15012890').dateModified, '2026-06-22', '[7] raw jsonb rows normalize');
  assert.equal(normalizeCatalogRow({portal_pk: 1, datemodified: '2026-01-01'}).dateModified, '2026-01-01', '[7] lowercase columns normalize');
  writeRaw(rawRows);
  result = await runScan({dataset: 'parks'});
  assert.equal(result.summary.baseline, 1, '[7] parks baseline from raw rows');

  // [8] API
  await handler({method: 'GET', url: '/api/update-center/sources', headers: {'x-update-center-token': 'isolated-test'}}, res);
  assert.equal(res.statusCode, 200);
  const parksSrc = body.sources.find((s) => s.dataset === 'parks');
  assert.equal(parksSrc.auto_pollable, true, '[8] airbyte_catalog is auto pollable');
  assert.equal(parksSrc.airbyte_catalog.portal_pk, '15012890');
  assert.equal(parksSrc.airbyte_catalog.latest.dateModified, '2026-06-22');
  assert.ok(body.airbyte && body.airbyte.configured === true);
  await handler({method: 'GET', url: '/api/update-center/airbyte', headers: {'x-update-center-token': 'isolated-test'}}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.distinct_pks, 1);
  assert.ok(body.sources.some((s) => s.dataset === 'libraries' && s.portal_pk === '15013109'), '[8] non-airbyte check types with portal_pk are listed too');
  assert.match(body.layer.rule, /동기화 성공/);

  // [9] refresh_pipeline 실패 중복 방지 (Python ENOENT)
  const {checkPipeline} = await import('../update_center/pipeline.mjs');
  const enoent = async () => {const e = new Error('spawn python ENOENT'); throw e;};
  const entry = {dataset: 'libraries', check: {type: 'refresh_pipeline', pipeline: 'libraries'}};
  const st = {};
  let r1 = await checkPipeline(entry, st, store, {collect: enoent});
  assert.equal(r1.outcome, 'error', '[9] first failure is an event');
  assert.match(r1.event.summary, /Python 없음/);
  assert.equal(r1.event.diff_json.python_missing, true);
  assert.equal(st.libraries.python_missing, true);
  let r2 = await checkPipeline(entry, st, store, {collect: enoent});
  assert.equal(r2.outcome, 'error-unchanged', '[9] repeated identical failure creates no new event');
  const other = async () => {throw new Error('network down');};
  let r3 = await checkPipeline(entry, st, store, {collect: other});
  assert.equal(r3.outcome, 'error', '[9] a different failure is a new event');
  assert.doesNotMatch(r3.event.summary, /Python/);

  // [11] 스캔 상태는 store 가 진실 — 상태 파일이 사라져도(재배포) /sources 가 마지막 검사 결과를 보여준다
  if (fs.existsSync(process.env.UPDATE_CENTER_STATE_PATH)) fs.unlinkSync(process.env.UPDATE_CENTER_STATE_PATH);
  await handler({method: 'GET', url: '/api/update-center/sources', headers: {'x-update-center-token': 'isolated-test'}}, res);
  assert.equal(res.statusCode, 200);
  const cy = body.sources.find((s) => s.dataset === 'construction_yeonsu');
  assert.ok(cy.last_state && cy.last_state.lastStatus === 'ok', '[11] last_state survives state-file loss (read from store meta)');

  // [10] 관리 화면 인라인 스크립트 구문 검사 (따옴표 하나가 화면 전체를 멈추는 회귀 방지)
  const html = fs.readFileSync(path.join(__dirname, '../../update-center.html'), 'utf8');
  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(inline.length >= 1, '[10] inline script present');
  for (const s of inline) new Function(s); // SyntaxError 면 여기서 throw

  console.log('PASS update-center airbyte_catalog: skipped/baseline/unchanged/yellow/stale/raw-normalize/API + pipeline ENOENT dedup + update-center.html syntax + state-from-store');
})().catch((error) => {console.error(error); process.exitCode = 1;}).finally(() => {
  const base = path.resolve(os.tmpdir());
  if (path.dirname(path.resolve(tmp)) === base && path.basename(tmp).startsWith('uc_airbyte_')) fs.rmSync(tmp, {recursive: true, force: true});
});
