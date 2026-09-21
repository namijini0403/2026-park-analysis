'use strict';
// Offline regression for check.type keyed_json_api (KoreaConnect-style header-key APIs).
// Covers: key missing => deferred (skipped, no event, no network call); key present =>
// header sent, page_param honoured, schema inferred from rows, baseline/unchanged;
// HTTP 200 + error body => red error event; content change => candidate staged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uc_keyed_'));
delete process.env.DATABASE_URL;
delete process.env.KC_TEST_KEY;
process.env.UPDATE_CENTER_STORE_PATH = path.join(tmp, 'store.json');
process.env.UPDATE_CENTER_STATE_PATH = path.join(tmp, 'state.json');
process.env.UPDATE_CENTER_SOURCES_PATH = path.join(tmp, 'sources.json');
process.env.UPDATE_CENTER_HOME = path.join(tmp, 'home');
process.env.UPDATE_CENTER_APPLY_ROOT = path.join(tmp, 'apply');
process.env.UPDATE_CENTER_SCAN_INTERVAL_MIN = '0';
process.env.UPDATE_CENTER_TOKEN = 'isolated-test';
const DATA_URL = 'https://api.example.invalid/01/1/PDP/SAFETY/svc/op?pageNo=1&numOfRows=2&returnType=JSON';
fs.writeFileSync(process.env.UPDATE_CENTER_SOURCES_PATH, JSON.stringify({sources: [{
  dataset: 'kc_test',
  local_file: 'data/context_sources/koreaconnect/kc_test.csv',
  check: {
    type: 'keyed_json_api',
    auth: {header: 'api_user_key_id', env: 'KC_TEST_KEY'},
    page_param: 'pageNo',
    urls: {data: DATA_URL},
  },
  never_auto_apply: true,
}, {
  dataset: 'kc_bad_auth',
  check: {type: 'keyed_json_api', auth: {header: 'api_user_key_id'}, urls: {data: DATA_URL}},
}]}));
const originalFetch = global.fetch;
const calls = [];
function pagedFetch(items, {error} = {}) {
  return async (url, opts = {}) => {
    calls.push({url: String(url), headers: opts.headers || {}});
    if (error) return new Response(JSON.stringify({header: error, body: {items: [], totalCount: 0}}), {status: 200});
    const u = new URL(url);
    const pageNo = Number(u.searchParams.get('pageNo') || 1);
    const per = Number(u.searchParams.get('numOfRows') || 2);
    const slice = items.slice((pageNo - 1) * per, pageNo * per);
    return new Response(JSON.stringify({
      header: {resultCode: '00', resultMsg: 'NORMAL SERVICE'},
      body: {items: slice, totalCount: items.length, pageNo, numOfRows: per},
    }), {status: 200});
  };
}
const ITEMS = [
  {rideSn: '1', pfctNm: '가공원 놀이터', rideLctn: '인천 A', rgnCd: '28'},
  {rideSn: '2', pfctNm: '나공원 놀이터', rideLctn: '인천 B', rgnCd: '28'},
  {rideSn: '3', pfctNm: '다공원 놀이터', rideLctn: '인천 C', rgnCd: '28'},
];
(async () => {
  const {runScan} = await import('../update_center/scan.mjs');
  const {createStore} = await import('../update_center/store.mjs');
  const {extractRows, extractTotalCount, detectApiError} = await import('../update_center/candidate.mjs');
  const store = await createStore();

  // 0. Response shapes observed live on api.koreaconnect.kr (2026-09-20).
  const shapeRide = {response: {header: {resultCode: '00', resultMsg: 'NORMAL SERVICE'}, body: {recordCountPerPage: 2, pageIndex: 1, totalPageCnt: 1, totalCnt: 5, items: [{rideSn: '1'}]}}};
  const shapeLocaldata = {response: {header: {resultCode: '00'}, body: {dataType: 'JSON', items: [{BPLC_NM: 'x'}], numOfRows: 2, pageNo: 1, totalCount: 812}}};
  const shapeKoroad = {resultCode: '00', resultMsg: 'NORMAL_CODE', items: {item: [{afos_fid: 1}, {afos_fid: 2}]}, totalCount: 7, numOfRows: 2, pageNo: 1};
  const shapeKoroadNoData = {resultCode: '03', resultMsg: 'NODATA_ERROR', items: {item: []}, totalCount: 0};
  const shapeGatewayError = {errorCode: 'AGW-E40102', errorMessage: '유효하지 않은 이용자 서비스 키'};
  assert.equal(extractRows(shapeRide).length, 1); assert.equal(extractTotalCount(shapeRide, null), 5, 'totalCnt honoured');
  assert.equal(extractRows(shapeLocaldata).length, 1); assert.equal(extractTotalCount(shapeLocaldata, null), 812);
  assert.equal(extractRows(shapeKoroad).length, 2); assert.equal(extractTotalCount(shapeKoroad, null), 7, 'flat items.item honoured');
  assert.equal(detectApiError(shapeRide), null); assert.equal(detectApiError(shapeKoroad), null);
  assert.equal(detectApiError(shapeKoroadNoData).code, '03', 'NODATA is surfaced, not silently empty');
  assert.equal(detectApiError(shapeGatewayError), null, 'gateway error bodies come with non-200 status and are handled there');

  // 1. Key missing: deferred, no event, no network.
  global.fetch = async () => { throw new Error('network must not be called without a key'); };
  let result = await runScan({dataset: 'kc_test'});
  assert.equal(result.summary.skipped, 1, 'missing key is skipped (judgment deferred)');
  assert.equal(result.summary.error, 0);
  assert.equal(result.events.length, 0, 'missing key never becomes a red event');
  let state = await store.getMeta('source_scan_state');
  assert.equal(state.kc_test.lastStatus, 'key_missing');
  assert.equal(state.kc_test.keyEnv, 'KC_TEST_KEY');

  // 2. Incomplete auth config is an explicit error, not silently keyless.
  result = await runScan({dataset: 'kc_bad_auth'});
  assert.equal(result.summary.error, 1);
  assert.match(result.events[0].summary, /check\.auth/);

  // 3. Key present: header sent on every page, pageNo used, schema inferred from rows.
  process.env.KC_TEST_KEY = 'test-key-123';
  global.fetch = pagedFetch(ITEMS);
  result = await runScan({dataset: 'kc_test'});
  assert.equal(result.summary.baseline, 1, 'first keyed scan records a baseline');
  assert.ok(calls.length >= 2, 'totalCount 3 with numOfRows 2 needs a second page');
  assert.ok(calls.every(c => c.headers.api_user_key_id === 'test-key-123'), 'api_user_key_id header on every call');
  assert.ok(calls.some(c => new URL(c.url).searchParams.get('pageNo') === '2'), 'page_param pageNo is used for paging');
  assert.ok(calls.every(c => !new URL(c.url).searchParams.has('page')), 'generic "page" param must not leak in');
  state = await store.getMeta('source_scan_state');
  assert.deepEqual(state.kc_test.schema, ['pfctNm', 'rgnCd', 'rideLctn', 'rideSn']);
  assert.equal(state.kc_test.totalCount, 3);
  assert.equal(JSON.stringify(state).includes('test-key-123'), false, 'key value is never persisted');

  // 4. Same content => unchanged.
  result = await runScan({dataset: 'kc_test'});
  assert.equal(result.summary.unchanged, 1);

  // 5. HTTP 200 + gateway error body => red error event carrying the code.
  global.fetch = pagedFetch(ITEMS, {error: {resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'}});
  result = await runScan({dataset: 'kc_test'});
  assert.equal(result.summary.error, 1);
  assert.equal(result.events[0].risk, 'red');
  assert.equal(result.events[0].diff_json.apiError.code, '30');
  assert.match(result.events[0].summary, /SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);

  // 6. Content change => content event with a staged candidate (passthrough adapter).
  global.fetch = pagedFetch([...ITEMS, {rideSn: '4', pfctNm: '라공원 놀이터', rideLctn: '인천 D', rgnCd: '28'}]);
  result = await runScan({dataset: 'kc_test'});
  const ev = result.events[0];
  assert.ok(ev, 'content change produces an event');
  assert.equal(ev.kind, 'content');
  assert.ok(ev.diff_json.candidate, 'candidate collection attempted');
  assert.equal(ev.diff_json.candidate.ok, true, `candidate staged: ${ev.diff_json.candidate.error || ''}`);
  assert.equal(ev.diff_json.candidate.fetch_meta ? ev.diff_json.candidate.fetch_meta.record_count : 4, 4);
  const persisted = JSON.stringify(await store.getMeta('source_scan_state')) + JSON.stringify(result.events);
  assert.equal(persisted.includes('test-key-123'), false, 'key value never reaches events/state');

  // 7. HTTP 200 carrying an HTML/text error page (gateway or network/IP restriction):
  //    red, and the event must carry the real body so an operator can read the cause.
  global.fetch = async () => new Response('<br>\r\n<br><b>Warning</b>: not allowed from this address', {
    status: 200, headers: {'content-type': 'text/html'},
  });
  result = await runScan({dataset: 'kc_test'});
  assert.equal(result.summary.error, 1);
  assert.match(result.events[0].summary, /JSON 이 아님/, 'HTML body is named as such, not a cryptic parse error');
  assert.match(result.events[0].diff_json.responseSnippet, /not allowed from this address/);
  assert.equal(result.events[0].diff_json.contentType, 'text/html');

  global.fetch = originalFetch;
  console.log('test_update_center_keyed_api: ok');
})().catch((err) => { global.fetch = originalFetch; console.error(err); process.exit(1); });
