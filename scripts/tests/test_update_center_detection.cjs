'use strict';
// Offline integration regression: no production store, source requests, or timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uc_detection_'));
delete process.env.DATABASE_URL;
process.env.UPDATE_CENTER_STORE_PATH = path.join(tmp, 'store.json');
process.env.UPDATE_CENTER_STATE_PATH = path.join(tmp, 'state.json');
process.env.UPDATE_CENTER_SOURCES_PATH = path.join(tmp, 'sources.json');
process.env.UPDATE_CENTER_SCAN_INTERVAL_MIN = '0';
process.env.UPDATE_CENTER_TOKEN = 'isolated-test';
const types = ['file_head', 'json_api', 'page_notice', 'school_zones', 'refresh_pipeline', 'manual'];
fs.writeFileSync(process.env.UPDATE_CENTER_SOURCES_PATH, JSON.stringify({sources: types.map(type => ({
  dataset: type, check: {type, urls: {head: 'https://example.invalid/source'}}
}))}));
const originalFetch = global.fetch;
(async () => {
  const {runScan} = await import('../update_center/scan.mjs');
  const {createStore} = await import('../update_center/store.mjs');
  const store = await createStore();
  // Legacy null-only baselines must no longer restore a false healthy state.
  await store.setMeta('source_scan_state', {file_head: {
    etag: null, lastModified: null, contentLength: null, lastStatus: 'ok'
  }});
  global.fetch = async () => new Response(null, {status: 200});
  let result = await runScan({dataset: 'file_head'});
  assert.equal(result.summary.error, 1);
  assert.equal(result.summary.unchanged, 0);
  assert.equal(result.events[0].diff_json.reason, 'missing_change_validators');
  assert.equal((await store.getMeta('source_scan_state')).file_head.lastStatus, 'error');
  result = await runScan({dataset: 'file_head'});
  assert.equal(result.summary.error, 1, 'persistent failure remains an error');
  assert.equal(result.summary.unchanged, 0);
  assert.equal(result.events.length, 0, 'persistent errors do not flood events');
  global.fetch = async () => new Response(null, {headers: {etag: 'v1'}});
  result = await runScan({dataset: 'file_head'});
  assert.equal(result.summary.baseline, 1, 'first usable validator establishes baseline');
  assert.equal((await store.getMeta('source_scan_state')).file_head.lastStatus, 'ok');
  result = await runScan({dataset: 'file_head'});
  assert.equal(result.summary.unchanged, 1);
  global.fetch = async () => new Response(null, {headers: {etag: 'v2'}});
  result = await runScan({dataset: 'file_head'});
  assert.equal(result.summary.green, 1);
  global.fetch = async () => new Response(null, {status: 405});
  result = await runScan({dataset: 'file_head'});
  assert.equal(result.summary.error, 1);
  assert.equal(result.events[0].diff_json.httpStatus, 405);
  // Verify API output, not just a source-code string.
  const handler = require('../../api/update-center.js');
  let body;
  const res = {setHeader() {}, end(value) {body = JSON.parse(value);}};
  await handler({method: 'GET', url: '/api/update-center/sources', headers: {'x-update-center-token': 'isolated-test'}}, res);
  assert.equal(res.statusCode, 200);
  for (const source of body.sources) assert.equal(source.auto_pollable, source.check.type !== 'manual', source.dataset);
  const notice = await store.recordEvent({dataset: 'page_notice',kind: 'content',risk: 'yellow',status: 'pending',summary: 'observation',diff_json: {observation_only:true}});
  await handler({method: 'POST',url: '/api/update-center/approve',headers: {'x-update-center-token':'isolated-test'},body: {event_id:notice.id,confirm:true}},res);
  assert.equal(res.statusCode,409,'even confirmed observation cannot be approved');
  assert.equal((await store.getEvent(notice.id)).status,'pending');
  console.log('PASS update-center detection: missing validators, legacy state, persistent errors, recovery, HEAD rejection, and API polling modes');
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => {
  global.fetch = originalFetch;
  const base = path.resolve(os.tmpdir());
  if (path.dirname(path.resolve(tmp)) === base && path.basename(tmp).startsWith('uc_detection_')) fs.rmSync(tmp, {recursive: true, force: true});
});
