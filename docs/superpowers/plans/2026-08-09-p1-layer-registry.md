# P1: LAYER_REGISTRY 리팩터링 + 표준 데이터 계약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 레이어 정의를 7곳 병렬 하드코딩에서 단일 `LAYER_REGISTRY` 배열로 통합하고(동작 완전 동일), 교육자원 모듈의 표준 데이터 계약(modules/*.yaml + 검증 스크립트)을 신설해 P2 독서 모듈 추가가 "registry 1항목 + yaml 1개"가 되게 한다.

**Architecture:** `index.html` 모놀리스 내부 리팩터링. 정적 DOM(토글 버튼 5개 + 체크박스 5개)을 registry 기반 JS 생성으로 교체, `ui.toggles`/`state.overlays`를 registry에서 파생, `rerenderAll()`/`updateOverlayVisibility()`를 registry 루프로 교체, `loadData()`의 위치 기반 배열 매칭을 이름 기반 객체 로더로 교체. CSS·모듈 계약은 신규 레이어용 메커니즘만 추가하고 기존 5개 레이어의 외관·동작은 1픽셀도 바꾸지 않는다.

**Tech Stack:** 바닐라 JS (index.html 인라인 스크립트), Node 20 (검증 스크립트), js-yaml (devDependency 신규 1개).

## Global Constraints

- **동작 완전 동일(behavior-identical)**: 기존 5개 레이어(isochrone/buffer/parks/redevelopment/candidate)의 토글 라벨·아이콘·색상·기본 OFF 상태·렌더 결과가 리팩터링 전후 동일해야 한다
- 기존 5개 레이어의 CSS 규칙(`.layer-toggle-btn[data-layer="..."]` 쌍)은 **수정 금지** — 신규 레이어용 generic 규칙만 추가
- 체크박스 id(`toggleIsochrone` 등 5개)와 버튼 `data-layer` 값은 기존 문자열 그대로 유지 (다른 코드가 참조)
- 작업 브랜치 `policy-reachability`, 작업 디렉토리 `c:\Users\Mijin\Desktop\공공데이터공모전\park-railway-deploy`
- 줄 번호는 참고용 — 문자열/식별자 매칭으로 편집. UTF-8 한국어 파일: Read/Edit 도구만 사용
- 각 태스크 후 구문 게이트: `node scripts/check_inline_script.mjs` 통과 (Task 1에서 생성)
- 테스트 프레임워크 없음 — 검증은 구문 게이트 + 서버 스모크 + grep. 시각 회귀는 컨트롤러가 최종 리뷰 후 별도 수행

---

### Task 1: 구문 게이트 + LAYER_REGISTRY + DOM 생성 + ui/state 파생

**Files:**
- Create: `scripts/check_inline_script.mjs`
- Modify: `index.html` — ① `const PATHS = {...}` 직후에 registry+생성 코드 삽입, ② `:3094-3098` 정적 버튼 5개 제거, ③ `:3155-3176` `.toggle-list` 정적 행 5개 제거, ④ `ui.toggles` 객체(:3561-3567)와 `state.overlays`의 레이어 키를 registry 파생으로 교체

**Interfaces:**
- Produces: 전역 `LAYER_REGISTRY` (이후 모든 태스크가 사용), `isLayerOn(def)` 헬퍼, `buildLayerControls()` — Task 2가 `def.kind`/`def.overlayKey`/`def.datasetKey`/`def.point`/`def.style`/`def.render`를 사용

- [ ] **Step 1: 구문 게이트 스크립트 생성** — `scripts/check_inline_script.mjs`:

```js
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
let checked = 0;
for (const [, code] of blocks) {
  if (!code.trim()) continue;
  new vm.Script(code, { filename: `inline-script-${checked}` });
  checked += 1;
}
console.log(`OK: ${checked} inline script block(s) parsed without syntax errors`);
```

- [ ] **Step 2: 게이트 기준선 확인** — `node scripts/check_inline_script.mjs` 실행, 현재 상태에서 OK 출력 확인 (실패하면 STOP, BLOCKED 보고)

- [ ] **Step 3: registry 삽입** — `index.html`에서 `const PATHS = {` 객체의 닫는 `};` 바로 다음에 삽입:

```js
    // ── 레이어 레지스트리: 지도 레이어의 단일 정의처 ─────────────────────
    // 새 레이어 추가 = 이 배열에 1항목 추가 (+ 데이터 파일을 build_vercel_static.mjs whitelist에 등록)
    // kind: "point"(renderPointMarkers) | "geojson"(renderGeoJsonLayer) | "custom"(renderFnName의 전역 함수가 렌더)
    const LAYER_REGISTRY = [
      {
        id: "isochrone", buttonLabel: "🚶 실제 도보이동 500m", panelLabel: "도보 등시선",
        toggleId: "toggleIsochrone", overlayKey: "isochronePolygons",
        kind: "geojson", datasetKey: "isochrone", defaultOn: false,
        style: { strokeWeight: 2, strokeColor: "#2B6CB0", strokeOpacity: 0.9, fillColor: "#90CDF4", fillOpacity: 0.22 }
      },
      {
        id: "buffer", buttonLabel: "⭕ 직선거리 500m", panelLabel: "직선 버퍼",
        toggleId: "toggleBuffer", overlayKey: "bufferPolygons",
        kind: "geojson", datasetKey: "buffer", defaultOn: false,
        style: { strokeWeight: 2, strokeColor: "#ED8936", strokeOpacity: 0.9, strokeStyle: "dash", fillColor: "#FBD38D", fillOpacity: 0.12 }
      },
      {
        id: "parks", buttonLabel: "🌳 공원·놀이터", panelLabel: "공원·놀이터",
        toggleId: "toggleParks", overlayKey: "parkMarkers",
        kind: "point", datasetKey: "parks", defaultOn: false,
        point: { latKey: "위도", lngKey: "경도", titleKey: "공원명", fallbackTitle: "공원", color: "#2B6CB0" }
      },
      {
        id: "redevelopment", buttonLabel: "🏗️ 재개발", panelLabel: "재개발 구역",
        toggleId: "toggleRedevelopment", overlayKey: "redevelopmentMarkers",
        kind: "custom", renderFnName: "renderRedevelopmentLayer", defaultOn: false
      },
      {
        id: "candidate", buttonLabel: "📍 후보지", panelLabel: "후보지",
        toggleId: "toggleCandidate", overlayKey: "candidateMarkers",
        kind: "custom", renderFnName: null, defaultOn: false
        // 후보지 마커는 rerenderAll()의 renderCandidateMarkers()가 그림 — registry는 가시성만 담당
      }
    ];

    function buildLayerControls() {
      const bar = document.getElementById("layerToggleBar");
      if (bar) {
        bar.innerHTML = "";
        LAYER_REGISTRY.forEach((def) => {
          const btn = document.createElement("button");
          btn.className = "layer-toggle-btn";
          btn.type = "button";
          btn.dataset.layer = def.id;
          btn.textContent = def.buttonLabel;
          if (def.cssColor) btn.style.setProperty("--layer-color", def.cssColor);
          bar.appendChild(btn);
        });
      }
      const list = document.querySelector(".panel-util .toggle-list");
      if (list) {
        list.innerHTML = "";
        LAYER_REGISTRY.forEach((def) => {
          const row = document.createElement("div");
          row.className = "toggle-row";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.id = def.toggleId;
          input.checked = Boolean(def.defaultOn);
          const label = document.createElement("label");
          label.htmlFor = def.toggleId;
          label.textContent = def.panelLabel;
          row.appendChild(input);
          row.appendChild(label);
          list.appendChild(row);
        });
      }
    }
    buildLayerControls();

    function isLayerOn(def) {
      const input = document.getElementById(def.toggleId);
      return Boolean(input && input.checked);
    }
```

주의: `isLayerOn`은 `ui` 객체를 참조하지 않는다 (`ui`는 `const`라 선언 전 참조 시 TDZ ReferenceError — DOM 직접 조회가 동일 요소를 안전하게 반환). `buildLayerControls()` 호출은 registry 정의 직후 1회 — 이 스크립트 블록은 body 하단에서 실행되므로 DOM은 이미 존재한다 (기존 `const ui = { ... document.getElementById ... }`가 같은 방식으로 동작 중임이 근거).

- [ ] **Step 4: 정적 DOM 제거** — ① `#layerToggleBar` 내부의 `<button class="layer-toggle-btn" ...>` 5개 삭제 (컨테이너 `<div class="layer-toggle-bar" id="layerToggleBar" aria-label="지도 레이어 토글">`와 닫는 태그는 유지, 내부만 비움). ② `.panel-util` 안 `<div class="toggle-list">` 내부의 `.toggle-row` 5개 삭제 (컨테이너 유지)

- [ ] **Step 5: ui.toggles 파생 교체** — `ui` 객체 리터럴에서:

```js
      toggles: {
        isochrone: document.getElementById("toggleIsochrone"),
        buffer: document.getElementById("toggleBuffer"),
        parks: document.getElementById("toggleParks"),
        redevelopment: document.getElementById("toggleRedevelopment"),
        candidate: document.getElementById("toggleCandidate") || false
      },
```
→
```js
      toggles: Object.fromEntries(
        LAYER_REGISTRY.map((def) => [def.id, document.getElementById(def.toggleId)])
      ),
```
(기존 `|| false` 가드는 registry가 체크박스를 항상 생성하므로 불필요 — 소비처는 모두 truthy 체크를 함)

- [ ] **Step 6: state.overlays 파생 교체** — `state` 객체의 `overlays` 정의에서 레이어 5개 키(`candidateMarkers/parkMarkers/redevelopmentMarkers/isochronePolygons/bufferPolygons`)를 제거하고:

```js
      overlays: {
        schoolMarkers: [],
        ...Object.fromEntries(LAYER_REGISTRY.map((def) => [def.overlayKey, []]))
      },
```
전제: `LAYER_REGISTRY` 선언이 `state` 선언보다 앞에 있어야 함 (Step 3의 삽입 위치가 PATHS 직후이므로 충족 — PATHS는 state보다 앞). `state` 정의에 `schoolMarkers` 외 다른 비레이어 overlay 키가 있으면 그대로 보존.

- [ ] **Step 7: 구문 게이트 + 스모크**

```powershell
node scripts/check_inline_script.mjs      # OK
npm run build:vercel                       # 성공
# node server.js 기동 후:
# GET / 에 data-layer="isochrone" 등 5개 문자열이 없어야 정상(이제 JS 생성) — 대신 layerToggleBar 컨테이너 존재 확인
```
Expected: 게이트 OK, 빌드 성공. (버튼은 런타임 생성이므로 정적 HTML엔 없음 — 시각 확인은 최종 단계)

- [ ] **Step 8: Commit**

```bash
git add scripts/check_inline_script.mjs index.html
git commit -m "P1: introduce LAYER_REGISTRY, generate layer controls from registry"
```

### Task 2: rerenderAll / updateOverlayVisibility registry 루프화 + 신규 레이어용 CSS 메커니즘

**Files:**
- Modify: `index.html` — `updateOverlayVisibility()`, `rerenderAll()`, CSS `.layer-toggle-btn` 규칙 블록 뒤에 generic 규칙 추가

**Interfaces:**
- Consumes: Task 1의 `LAYER_REGISTRY`, `isLayerOn(def)`
- Produces: registry 루프 기반 렌더/가시성 — P2는 registry 항목 추가만으로 렌더·토글이 동작

- [ ] **Step 1: updateOverlayVisibility 교체** — 함수 본문 전체를:

```js
    function updateOverlayVisibility() {
      LAYER_REGISTRY.forEach((def) => {
        const on = isLayerOn(def);
        (state.overlays[def.overlayKey] || []).forEach((overlay) => overlay.setMap(on ? state.map : null));
      });
      syncLayerToggleButtons();
    }
```

- [ ] **Step 2: rerenderAll 레이어 부분 교체** — `renderSchoolMarkers(); renderCandidateMarkers();` 다음부터 `updateOverlayVisibility();` 직전까지의 레이어 렌더 호출(parks renderPointMarkers / renderRedevelopmentLayer / isochrone·buffer renderGeoJsonLayer 3건)을 다음 루프로 교체. **기존 인라인 스타일·키 값은 이미 Task 1에서 registry로 옮겨졌으므로 여기서는 루프만 남긴다:**

```js
      LAYER_REGISTRY.forEach((def) => {
        if (def.kind === "point") {
          renderPointMarkers(def.overlayKey, state.datasets[def.datasetKey] || [], {
            ...def.point,
            visible: isLayerOn(def)
          });
        } else if (def.kind === "geojson") {
          renderGeoJsonLayer(def.overlayKey, state.datasets[def.datasetKey], def.style, isLayerOn(def));
        } else if (def.kind === "custom" && def.renderFnName && typeof window[def.renderFnName] === "function") {
          window[def.renderFnName]();
        }
      });
```
주의: 함수 선언은 전역 스코프이므로 `window[def.renderFnName]`으로 접근 가능. `rerenderAll` 후반부(updateOverlayVisibility 호출, renderGuSummary, 선택 학교/후보지 패널 복원 로직)는 **수정 금지**.

- [ ] **Step 3: 신규 레이어용 generic CSS 추가** — CSS에서 마지막 `.layer-toggle-btn[data-layer=...]` 규칙 뒤에 추가 (기존 규칙 수정 금지):

```css
    /* 신규 레이어(LAYER_REGISTRY에서 cssColor 지정)용 generic 색상 — 기존 5개 레이어는 위의 전용 규칙 사용 */
    .layer-toggle-btn[style*="--layer-color"] {
      border-color: var(--layer-color);
      color: var(--layer-color);
    }
    .layer-toggle-btn.is-on[style*="--layer-color"] {
      background: var(--layer-color);
      border-color: var(--layer-color);
      color: #ffffff;
    }
```

- [ ] **Step 4: 구문 게이트 + 스모크** — `node scripts/check_inline_script.mjs` OK, `npm run build:vercel` 성공

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "P1: drive layer rendering/visibility from LAYER_REGISTRY"
```

### Task 3: loadData 이름 기반 로더 교체

**Files:**
- Modify: `index.html` — `loadData()`의 `Promise.all` 구조분해 블록

**Interfaces:**
- Consumes: 기존 `loadCSV/loadJSON/loadGeoJSON/loadCandidateExamples`, `PATHS`
- Produces: `datasetLoaders` 객체 — P2는 여기에 `libraries: () => loadCSV(PATHS.libraries)` 한 줄 추가로 데이터 로드

- [ ] **Step 1: 교체** — `loadData()` 안의 15항목 구조분해 배열 + `Promise.all([...])` 를 다음으로 교체 (이후의 `state.datasets.* = ...` 대입문들은 변수명이 동일하므로 **수정 불필요** — 구조분해만 객체에서 하도록 바꾼다):

```js
      const datasetLoaders = {
        schoolPriority: () => loadCSV(PATHS.schools),
        schoolCoords: () => loadCSV(PATHS.schoolCoords),
        studentTrend: () => loadCSV(PATHS.studentTrend),
        nearestPark: () => loadCSV(PATHS.nearestPark),
        beneficiaryForecast: () => loadCSV(PATHS.beneficiaryForecast),
        similarSchools: () => loadCSV(PATHS.similarSchools),
        candidateBarrierRoutes: () => loadJSON(PATHS.candidateBarrierRoutes),
        robustRecommendations: () => loadJSON(PATHS.robustRecommendations),
        candidatePanelExamples: () => loadCandidateExamples(),
        guSummary: () => loadCSV(PATHS.guSummary),
        parks: () => loadCSV(PATHS.parks),
        isochrone: () => loadGeoJSON(PATHS.isochrone),
        buffer: () => loadGeoJSON(PATHS.buffer),
        redevelopment: () => loadCSV(PATHS.redevelopment),
        largeApt: () => loadCSV(PATHS.largeApt)
      };
      const loadedEntries = await Promise.all(
        Object.entries(datasetLoaders).map(async ([key, loader]) => [key, await loader()])
      );
      const {
        schoolPriority,
        schoolCoords,
        studentTrend,
        nearestPark,
        beneficiaryForecast,
        similarSchools,
        candidateBarrierRoutes,
        robustRecommendations,
        candidatePanelExamples,
        guSummary,
        parks,
        isochrone,
        buffer,
        redevelopment,
        largeApt
      } = Object.fromEntries(loadedEntries);
```

- [ ] **Step 2: 구문 게이트** — `node scripts/check_inline_script.mjs` OK

- [ ] **Step 3: 서버 스모크** — 빌드 후 `node server.js` 기동, `GET /` 200 + `GET /data_processed/parks.csv` 200 확인, 서버 종료

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "P1: name-based dataset loader map in loadData"
```

### Task 4: 표준 데이터 계약 — modules/ + 검증 스크립트

**Files:**
- Create: `modules/CONTRACT.md`, `modules/park.yaml`, `scripts/validate_module_contract.mjs`
- Modify: `package.json` — devDependency `js-yaml` + script `validate:modules`

**Interfaces:**
- Produces: 계약 스키마(필수/선택 필드)와 검증 커맨드 `npm run validate:modules` — P2의 `modules/reading.yaml`, P5 온보딩 에이전트 출력이 이 계약을 따름. 정책 행동 7유형 enum은 P3 규칙 엔진이 재사용

- [ ] **Step 1: 계약 문서** — `modules/CONTRACT.md`:

```markdown
# 교육자원 모듈 표준 데이터 계약 v1

제출 문서 근거: "모든 교육자원 모듈은 표준 데이터 계약을 따른다. 자원 유형·위치(또는 서비스 권역)·서비스 용량·이용 대상·운영시간·학교 내부 공급·외부 공급·수요 단위·접근·운영 제약·가능한 정책대안·데이터 기준일과 출처를 필수·선택 필드로 정의하며, 이 계약을 충족하는 데이터만 모듈로 온보딩된다."

## 필수 필드
| 필드 | 타입 | 설명 |
|---|---|---|
| `module` | string | 모듈 id (영문 소문자) |
| `resource_type` | string | 자원 유형 |
| `location` | object | `file`(데이터 파일 경로), `lat_key`, `lng_key`, `name_key` |
| `external_supply` | list | 외부 공급 지표: `{ metric, source }` |
| `demand_unit` | string | 수요 단위 (예: 학생 수) |
| `policy_actions` | list | 아래 7유형 enum의 부분집합 |
| `reference_date` | string | 데이터 기준일 (YYYY-MM-DD 또는 YYYY-MM) |
| `source` | list | 출처: `{ name, provider, license }` |
| `layer` | object | 지도 레이어: `id`, `button_label`, `panel_label`, `color` |

## 선택 필드
`internal_supply`(학교 내부 공급 지표 list), `capacity`(서비스 용량), `target_users`(이용 대상), `operating_hours`(운영시간), `constraints`(접근·운영 제약 list), `notes`

## 정책 행동 7유형 enum (P3 규칙 엔진과 공유)
`internal_investment`(학교 내부 직접투자) / `external_supply_new`(외부 신규 공급) / `institution_link`(기관 연계) / `mobile_service`(이동형·순회 서비스) / `access_route_improvement`(접근경로·안전환경 개선) / `shared_hub`(권역 공동활용·거점화) / `maintain_monitor`(유지·모니터링)

## 규칙
- 미확보 항목은 값 대신 문자열 `"추가 확인 필요"` 를 넣는다 (검증 통과, UI에 그대로 표기)
- 검증: `npm run validate:modules`
```

- [ ] **Step 2: park.yaml (기존 모듈 소급 기술)** — `modules/park.yaml`:

```yaml
module: park
resource_type: 도시공원·놀이터 (야외활동 환경)
location:
  file: data_processed/parks.csv
  lat_key: 위도
  lng_key: 경도
  name_key: 공원명
external_supply:
  - metric: iso_functional_park_count
    source: data_processed/school_priority_with_functional_park_layer.csv
  - metric: nearest_functional_park_dist_m
    source: data_processed/school_nearest_park.csv
  - metric: display_green_ratio
    source: data_processed/school_priority_with_functional_park_layer.csv
internal_supply: 추가 확인 필요
capacity: park_function_class (playground_like <1,500㎡ / small_child_park / mid_activity_park / neighborhood_park_scale ≥10,000㎡)
target_users: 초등학생 (인천 272개교)
operating_hours: 상시 개방
demand_unit: 예측 수혜 학생 수 (predicted_beneficiaries)
constraints:
  - 보행부담(주요도로 횡단·대형 교차로)은 점수 흡수 금지 — 필터·태그로만 표시
  - 재개발 구역은 필터로만 처리
policy_actions:
  - external_supply_new
  - access_route_improvement
  - maintain_monitor
reference_date: 2026-04
source:
  - name: 인천광역시 도시공원 현황
    provider: 인천광역시
    license: 공공누리 (확인 필요 시 "추가 확인 필요")
layer:
  id: parks
  button_label: "🌳 공원·놀이터"
  panel_label: 공원·놀이터
  color: "#2B6CB0"
```

- [ ] **Step 3: 검증 스크립트** — `scripts/validate_module_contract.mjs`:

```js
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULES_DIR = join(ROOT, "modules");
const REQUIRED = ["module", "resource_type", "location", "external_supply", "demand_unit", "policy_actions", "reference_date", "source", "layer"];
const LOCATION_KEYS = ["file", "lat_key", "lng_key", "name_key"];
const LAYER_KEYS = ["id", "button_label", "panel_label", "color"];
const POLICY_ACTION_ENUM = new Set([
  "internal_investment", "external_supply_new", "institution_link", "mobile_service",
  "access_route_improvement", "shared_hub", "maintain_monitor"
]);

let failures = 0;
const fail = (file, msg) => { failures += 1; console.error(`  FAIL [${file}] ${msg}`); };

const files = readdirSync(MODULES_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
if (!files.length) { console.error("modules/*.yaml 파일이 없습니다"); process.exit(1); }

for (const file of files) {
  console.log(`검사: modules/${file}`);
  // js-yaml@4의 load는 안전 로더(구 safeLoad)이며, CORE_SCHEMA로 명시해 임의 타입 생성을 차단
  const doc = yaml.load(readFileSync(join(MODULES_DIR, file), "utf8"), { schema: yaml.CORE_SCHEMA });
  for (const key of REQUIRED) {
    if (doc?.[key] === undefined || doc[key] === null) fail(file, `필수 필드 누락: ${key}`);
  }
  if (doc?.location && typeof doc.location === "object") {
    for (const k of LOCATION_KEYS) if (!doc.location[k]) fail(file, `location.${k} 누락`);
    if (doc.location.file && doc.location.file !== "추가 확인 필요") {
      try { readFileSync(join(ROOT, doc.location.file)); }
      catch { fail(file, `location.file 경로가 존재하지 않음: ${doc.location.file}`); }
    }
  }
  if (doc?.layer && typeof doc.layer === "object") {
    for (const k of LAYER_KEYS) if (!doc.layer[k]) fail(file, `layer.${k} 누락`);
  }
  if (Array.isArray(doc?.policy_actions)) {
    for (const action of doc.policy_actions) {
      if (!POLICY_ACTION_ENUM.has(action)) fail(file, `policy_actions에 enum 밖 값: ${action}`);
    }
    if (!doc.policy_actions.length) fail(file, "policy_actions가 비어 있음");
  }
  if (Array.isArray(doc?.external_supply)) {
    doc.external_supply.forEach((row, i) => {
      if (!row?.metric || !row?.source) fail(file, `external_supply[${i}]에 metric/source 누락`);
    });
  }
}

if (failures) { console.error(`\n계약 검증 실패: ${failures}건`); process.exit(1); }
console.log(`\n계약 검증 통과: ${files.length}개 모듈`);
```

- [ ] **Step 4: package.json** — `npm install --save-dev js-yaml` 실행 후, `scripts`에 `"validate:modules": "node scripts/validate_module_contract.mjs"` 추가

- [ ] **Step 5: 검증 실행** — `npm run validate:modules` → `계약 검증 통과: 1개 모듈` 확인. 실패 케이스 확인: park.yaml에서 `demand_unit` 줄을 임시 제거 → 실행 → FAIL 1건 확인 → 원복 → 재실행 통과 (이 왕복을 보고서에 기록)

- [ ] **Step 6: Commit**

```bash
git add modules/ scripts/validate_module_contract.mjs package.json package-lock.json
git commit -m "P1: standard data contract for resource modules + validator"
```

### Task 5: meta description + 전체 빌드·스모크

**Files:**
- Modify: `index.html` head — P0 이월 항목
- Verify: 전체 빌드 + 서버 스모크

- [ ] **Step 1: meta description 추가** — `<meta property="og:title"` 줄 바로 위에:

```html
<meta name="description" content="학교별 교육자원 격차를 줄이는 AI 기반 정책 의사결정 지원 시스템" />
```

- [ ] **Step 2: 전체 검증** (raw output을 보고서에 붙일 것)

```powershell
node scripts/check_inline_script.mjs      # OK
npm run validate:modules                   # 통과
npm run build:vercel                       # 성공
# node server.js 백그라운드 기동 후:
(Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).StatusCode                     # 200
[regex]::Matches((Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).Content, "layerToggleBar").Count   # ≥1
(Invoke-WebRequest http://localhost:3000/data_processed/parks.csv -UseBasicParsing).StatusCode   # 200
# Stop-Process로 서버 종료 + 포트 3000 해제 확인
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "P1: add meta description (P0 carry-over)"
```

---

## 완료 기준 (컨트롤러 확인)

1. 5개 태스크 리뷰 클린
2. 최종 브랜치 리뷰 (P1 범위)
3. **시각 회귀 확인 (컨트롤러 직접)**: 로컬 서버에서 지도 로드 → 레이어 토글 5개 존재·라벨 동일 → 각 토글 on/off 동작 → Case/접근성 필터 정상 → 학교 클릭 상세 패널 정상. 스크린샷 확보
