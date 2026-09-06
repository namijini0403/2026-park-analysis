// 시설 geojson 로딩 Promise 공유 동작 검증 (브라우저 불필요).
// index.html에서 ensureContextFacilitiesLoaded 함수 본문을 추출해 스텁 환경에서 실행한다.
// 실행: node tests/test_context_facility_promise.mjs
//
// 검증 대상 (outputs/audit_20260906/ui_integration_review_final.md P2):
//  1. 로딩 중("loading") 재호출 시 진행 중 Promise를 공유한다 (fetch 1회, 미완 스냅샷 방지)
//  2. 완료 후 호출은 즉시 true
//  3. 실패 시 false + state "failed", 이후 재호출은 재시도한다
//  4. renderSchoolDetail이 "pending"뿐 아니라 "loading"에서도 await하는 게이트를 유지한다
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(source, header) {
  const start = source.indexOf(header);
  assert.ok(start >= 0, `index.html에서 ${header} 를 찾지 못함`);
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return header + source.slice(bodyStart, i + 1);
}

const fnSource = extractFunction(html, "function ensureContextFacilitiesLoaded()");

function makeHarness({ failFetch = false } = {}) {
  const calls = { loadJSON: 0, renderMarkers: 0, updateVisibility: 0 };
  let releaseFetch;
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const env = {
    state: {
      contextFacilitiesLoadState: "pending",
      contextFacilitiesPromise: null,
      datasets: { contextFacilities: { nightlife: null, construction: null } },
    },
    PATHS: { contextFacilitiesNightlife: "n", contextFacilitiesConstruction: "c" },
    loadJSON: async (p) => {
      calls.loadJSON++;
      await fetchGate;
      if (failFetch) throw new Error("simulated download failure");
      return { type: "FeatureCollection", features: [], path: p };
    },
    renderContextFacilityMarkers: () => { calls.renderMarkers++; },
    updateOverlayVisibility: () => { calls.updateVisibility++; },
    console: { warn: () => {} },
  };
  // 주의: new Function에 넣는 문자열은 이 리포의 index.html에서 추출한 자체 코드다
  // (외부/사용자 입력 아님 — import와 동일한 신뢰 경계의 테스트 하네스 용도).
  const factory = new Function(
    "state", "PATHS", "loadJSON", "renderContextFacilityMarkers", "updateOverlayVisibility", "console",
    `${fnSource}\nreturn ensureContextFacilitiesLoaded;`,
  );
  const ensure = factory(env.state, env.PATHS, env.loadJSON, env.renderContextFacilityMarkers,
    env.updateOverlayVisibility, env.console);
  return { ensure, env, calls, releaseFetch: () => releaseFetch() };
}

// 1) 로딩 중 재호출 → Promise 공유, fetch 중복 없음
{
  const { ensure, env, calls, releaseFetch } = makeHarness();
  const first = ensure();
  assert.equal(env.state.contextFacilitiesLoadState, "loading");
  const second = ensure(); // 리포트 열기 시나리오: 이미 loading
  assert.equal(first, second, "loading 중 재호출은 같은 Promise를 반환해야 함");
  releaseFetch();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(calls.loadJSON, 2, "geojson 2종을 각각 1회만 요청해야 함");
  assert.equal(env.state.contextFacilitiesLoadState, "loaded");
  assert.ok(calls.renderMarkers === 1 && calls.updateVisibility === 1);
  // 2) 완료 후 호출은 즉시 true
  assert.equal(await ensure(), true);
  assert.equal(calls.loadJSON, 2, "완료 후에는 재요청하지 않아야 함");
}

// 3) 실패 → false + failed, 이후 재호출은 재시도
{
  const { ensure, env, calls, releaseFetch } = makeHarness({ failFetch: true });
  const p1 = ensure();
  const p2 = ensure();
  assert.equal(p1, p2);
  releaseFetch();
  assert.equal(await p1, false);
  assert.equal(env.state.contextFacilitiesLoadState, "failed");
  assert.equal(env.state.contextFacilitiesPromise, null, "실패 시 Promise를 비워 재시도를 허용해야 함");
  const retry = ensure();
  assert.equal(env.state.contextFacilitiesLoadState, "loading", "실패 후 재호출은 재시도해야 함");
  assert.ok(retry instanceof Promise);
}

// 4) renderSchoolDetail의 await 게이트가 loading 상태도 포함하는지 (소스 계약 검사)
{
  const gate = /state\.contextLoadState === "loaded" && state\.contextFacilitiesLoadState !== "loaded"\)\s*\{\s*await ensureContextFacilitiesLoaded\(\)/;
  assert.ok(gate.test(html), "리포트 생성 전 await 게이트가 pending/loading 모두를 포함해야 함");
}

// 5) payload가 미로딩 시에도 시설 상세 상태(failed/pending)를 담는지 (소스 계약 검사)
{
  assert.ok(html.includes('{ status: facilityDetailsStatus, nightlife: null, construction: null }'),
    "facility_details가 미로딩 원인 status를 담아야 함");
}

console.log("test_context_facility_promise: 5/5 OK");
