# P0: 리브랜딩 + 기반 수리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 제목을 "반경 너머, 정책 도달성으로"로 전면 교체하고, 탐색 중 발견된 잠복 버그 4건(mojibake, 깨진 데이터 경로, CORS 누락, ParkLens 잔재)을 수리한다.

**Architecture:** `index.html` 모놀리스(7,455행)와 `ui-preview` React 앱의 문자열·메타태그 수정. 로직 변경은 mojibake 키 수정, PATHS 경로 1건, CORS 정규식 2건뿐. `ui-preview` 소스 수정 후 반드시 재빌드 + dist 커밋.

**Tech Stack:** 바닐라 HTML/JS (index.html), React 18 + Vite (ui-preview), Node http 서버 (server.js). **테스트 프레임워크 없음** — 검증은 grep 검사 + 빌드 성공 + 로컬 서버 스모크로 한다.

## Global Constraints

- 새 제목 표기는 정확히 **"반경 너머, 정책 도달성으로"** (공백 포함, 쉼표 포함)
- 작업 브랜치 `policy-reachability`에서만 커밋. `main`·`railway-deploy` 직접 커밋 금지
- 줄 번호는 참고용 — 반드시 **문자열 매칭**으로 편집할 것 (편집하며 줄이 밀림)
- `ui-preview/src` 또는 `ui-preview/index.html` 수정 시 `npm --prefix ui-preview run build` 재빌드 후 `ui-preview/dist` 변경분 커밋 필수
- 서사 문구는 제출 문서의 정의를 벗어나지 않는다: "정책 도달성 = 교육자원이 학생에게 도달할 수 있는 구조적 조건(외부 접근성·내부 공급·수요)"
- 작업 디렉토리: `c:\Users\Mijin\Desktop\공공데이터공모전\park-railway-deploy`

---

### Task 1: index.html 리브랜딩 (제목·서사·OG 태그)

**Files:**
- Modify: `index.html` (title :6, 커버 :3017-3039, 패널 :3113-3115, GUIDE_CONTENT :3414-3493, 프린트 :6039, 폴백 :7404-7406)

**Interfaces:**
- Produces: 없음 (문자열 교체만). 이후 태스크는 이 파일의 다른 영역을 수정하므로 충돌 없음.

- [ ] **Step 1: title + OG 메타태그**

`<title>반경 너머, 도달 가능성으로</title>` 을 다음으로 교체:

```html
<title>반경 너머, 정책 도달성으로</title>
<meta property="og:title" content="반경 너머, 정책 도달성으로" />
<meta property="og:description" content="학교별 교육자원 격차를 줄이는 AI 기반 정책 의사결정 지원 시스템" />
<meta property="og:image" content="https://park-analysis-web-production.up.railway.app/logo.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary" />
```

- [ ] **Step 2: 커버 화면 교체** (문자열 매칭, :3017-3039 부근)

| 현재 | 교체 |
|---|---|
| `<p class="app-cover-kicker">Incheon Outdoor Equity</p>` | `<p class="app-cover-kicker">Policy Reachability</p>` |
| `<span>반경 너머,</span><span>도달 가능성으로</span>` (h1 내부) | `<span>반경 너머,</span><span>정책 도달성으로</span>` |
| `도보 네트워크·보행 부담·활동규모 기준을 함께 봅니다.` (app-cover-statement) | `외부 접근성·내부 공급·미래 수요를 함께 봅니다.` |
| `초등학교 야외활동 환경을 공식 공원 존재, 실제 도달 가능성, 보행 부담, 활동규모 기준으로 나누어 진단하고 XAI 우선지원 의사결정을 지원합니다.` | `교육자원이 학생에게 실제로 도달하는 구조적 조건 — 외부 접근성, 내부 공급, 현재·미래 수요 — 을 진단하고 XAI 기반 정책 의사결정을 지원합니다.` |
| `alt="반경 너머, 도달 가능성으로 로고"` | `alt="반경 너머, 정책 도달성으로 로고"` |

app-cover-caption(`도보 접근성, 환경 격차, 미래 수요를 하나의 판단 흐름으로 연결합니다.`)은 유지.

- [ ] **Step 3: 좌측 패널 헤더 교체** (:3113-3115 부근)

| 현재 | 교체 |
|---|---|
| `<p class="eyebrow">Incheon Outdoor Equity</p>` | `<p class="eyebrow">Policy Reachability</p>` |
| `<h1 class="panel-title">반경 너머, 도달 가능성으로</h1>` | `<h1 class="panel-title">반경 너머, 정책 도달성으로</h1>` |
| `<p class="panel-subtitle">도보 네트워크·보행 부담·활동규모 기준을 반영해 학교별 야외활동 환경을 진단합니다.</p>` | `<p class="panel-subtitle">도보 네트워크·보행 부담·활동규모 기준으로 학교별 교육자원의 정책 도달성을 진단합니다.</p>` |

- [ ] **Step 4: GUIDE_CONTENT 객체 교체** (:3414-3493 부근, JS 객체 리터럴)

| 현재 | 교체 |
|---|---|
| `title: "반경 너머, 도달 가능성으로",` | `title: "반경 너머, 정책 도달성으로",` |
| subtitle의 `...환경을 진단하고 견고한 후보지와 SHAP 진단을 제안합니다.` (전문 유지) | 문장 앞부분 유지, `진단하고` → `정책 도달성 관점에서 진단하고` |
| thesis: `"단순 지도앱이 아니라,\n학교 주변 환경을 도달 가능성 기준으로 분석하고\n정책 판단의 근거를 연결하는 의사결정 시스템입니다."` | `"단순 지도앱이 아니라,\n교육자원의 정책 도달성을 진단하고\n정책 판단의 근거를 연결하는 AI 기반 의사결정 시스템입니다."` |
| `principle: "반경 너머의 도달 가능성을 기준으로 판단합니다.",` | `principle: "반경 너머의 정책 도달성을 기준으로 판단합니다.",` |
| `title: "반경 너머 도달 가능성",` (원칙 카드) | `title: "반경 너머 정책 도달성",` |

- [ ] **Step 5: ParkLens 잔재 제거**

| 위치(참고) | 현재 | 교체 |
|---|---|---|
| :6039 | `document.title = "ParkLens - 활용 가이드";` | `document.title = "반경 너머, 정책 도달성으로 - 활용 가이드";` |
| :7404 | `return row.학교명 \|\| row.schoolName \|\| row.school_name \|\| "ParkLens";` | `... \|\| "반경 너머";` |
| :7406 | `return "ParkLens";` | `return "반경 너머";` |

- [ ] **Step 6: 검증 grep**

```powershell
Select-String -Path index.html -Pattern "도달 가능성으로","ParkLens" -Encoding utf8
```
Expected: **0건** (단, "도달 가능성" 단독 서술 문구가 본문 설명 텍스트에 남는 것은 허용 — 제목 계열 문자열 "도달 가능성으로"와 "ParkLens"만 0건이면 통과)

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "P0: rebrand index.html to '반경 너머, 정책 도달성으로' + OG tags"
```

### Task 2: ui-preview 리브랜딩 + 재빌드

**Files:**
- Modify: `ui-preview/index.html:6`, `ui-preview/src/LandingPage.tsx` (:145, :151, :172-173, :175-177)
- Regenerate: `ui-preview/dist/**` (빌드 산출물, 커밋 대상)

**Interfaces:**
- Consumes: 없음
- Produces: 갱신된 `ui-preview/dist` — Task 6 스모크가 이 산출물을 검증

- [ ] **Step 1: ui-preview/index.html title 교체**

`<title>반경 너머, 도달 가능성으로</title>` → `<title>반경 너머, 정책 도달성으로</title>`

- [ ] **Step 2: LandingPage.tsx 교체**

| 현재 | 교체 |
|---|---|
| `alt="ParkLens"` | `alt="반경 너머, 정책 도달성으로"` |
| `<p className="text-base font-bold text-white">반경 너머, 도달 가능성으로</p>` | `...>반경 너머, 정책 도달성으로</p>` |
| `<span className="block">반경 너머,</span>` + `<span className="block">도달 가능성으로</span>` | 두 번째 span → `<span className="block">정책 도달성으로</span>` |
| 설명 단락 `...초등학교 야외활동 환경을 진단하고, 견고한 후보지와 SHAP 후보 진단을 제안합니다.` | `진단하고,` 앞에 `정책 도달성 관점에서 ` 삽입 (나머지 유지) |

- [ ] **Step 3: 재빌드**

```powershell
npm --prefix ui-preview run build
```
Expected: 빌드 성공, `ui-preview/dist/index.html` title 갱신, `dist/assets/index-*.js` 해시 변경

- [ ] **Step 4: 검증 grep**

```powershell
Select-String -Path ui-preview/dist/index.html -Pattern "정책 도달성으로" -Encoding utf8
Select-String -Path ui-preview/src/LandingPage.tsx -Pattern "도달 가능성으로","ParkLens" -Encoding utf8
```
Expected: 첫 번째 1건 이상, 두 번째 0건

- [ ] **Step 5: Commit** (구 해시 번들 삭제 포함 — `git add -A ui-preview/dist`)

```bash
git add ui-preview/index.html ui-preview/src/LandingPage.tsx
git add -A ui-preview/dist
git commit -m "P0: rebrand ui-preview landing + rebuild dist"
```

### Task 3: mojibake 좌표 키 수정

**Files:**
- Modify: `index.html` (:3853, :4686-4687, :5451-5452 부근 — 문자열 매칭 필수)

**Interfaces:**
- Consumes/Produces: 없음 (키 문자열 수정)

배경: `위도`/`경도`가 CP949↔UTF-8 왕복으로 깨진 `"?꾨룄"`/`"寃쎈룄"` 리터럴 4곳. 그중 :3853(학교 마커)과 :5451(school_internal 후보 좌표)은 정상 키 폴백이 없어 실좌표 조회가 실패하는 경로다.

- [ ] **Step 1: 4곳 수정** — 파일에서 `?꾨룄` 와 `寃쎈룄` 를 전부 찾아(각 4회 내외 예상), 해당 표현식을 다음 규칙으로 교체:
  - `row["?꾨룄"] !== undefined ? "?꾨룄" : "lat"` → `row["위도"] !== undefined ? "위도" : "lat"` (경도/lng 동일 패턴)
  - `Number(row["위도"] ?? row["?꾨룄"])` → `Number(row["위도"])` (이미 정상 키가 앞에 있으므로 깨진 폴백만 제거)
  - `schoolRow["?꾨룄"]` 계열 → `schoolRow["위도"]` (경도 동일)

- [ ] **Step 2: 검증**

```powershell
Select-String -Path index.html -Pattern "\?꾨룄|寃쎈룄" -Encoding utf8
```
Expected: 0건

- [ ] **Step 3: 동작 확인** — Task 6 스모크에서 학교 마커 렌더로 최종 확인 (이 단계에서는 grep만)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "P0: fix mojibake 위도/경도 keys in coordinate lookups"
```

### Task 4: candidatePanelExamples 경로 수정

**Files:**
- Copy: `data/app_examples/candidate_panel_examples.json` → `data_processed/candidate_panel_examples.json`
- Modify: `index.html` PATHS 객체 (:3223 부근), `scripts/deploy/build_vercel_static.mjs` (:14-30 requiredDataFiles)

**Interfaces:**
- Produces: `data_processed/candidate_panel_examples.json` — 배포 산출물에 포함됨

배경: PATHS가 `./data/examples/candidate_panel_examples.json`을 가리키나 실제 파일은 `data/app_examples/`에 있고 `data/`는 배포에 복사되지 않아 항상 404 → 하드코딩 폴백 사용 중.

- [ ] **Step 1: 파일 존재 확인 후 복사**

```powershell
Test-Path "data/app_examples/candidate_panel_examples.json"   # True 확인
Copy-Item "data/app_examples/candidate_panel_examples.json" "data_processed/candidate_panel_examples.json"
```
파일이 없으면: `Get-ChildItem -Recurse -Filter candidate_panel_examples.json`로 탐색. 그래도 없으면 이 태스크는 PATHS 항목과 해당 fetch 사용처의 폴백 의존을 그대로 두고 **중단 후 보고** (폴백이 이미 동작 중이므로 무해).

- [ ] **Step 2: PATHS 수정**

`candidatePanelExamples: "./data/examples/candidate_panel_examples.json"` → `candidatePanelExamples: "./data_processed/candidate_panel_examples.json"`

- [ ] **Step 3: requiredDataFiles에 추가** — `scripts/deploy/build_vercel_static.mjs`의 `requiredDataFiles` 배열에 `"candidate_panel_examples.json"` 항목 추가 (기존 항목과 같은 형식으로)

- [ ] **Step 4: Commit**

```bash
git add data_processed/candidate_panel_examples.json index.html scripts/deploy/build_vercel_static.mjs
git commit -m "P0: fix candidate panel examples path, ship file in deploy"
```

### Task 5: CORS에 Railway 도메인 추가

**Files:**
- Modify: `api/ai-explainer-v2.js` (:11-16 ALLOWED_ORIGIN_PATTERNS)

- [ ] **Step 1: 패턴 2개 추가** — 배열 끝에:

```js
/^https:\/\/park-analysis-web-production\.up\.railway\.app$/,
/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/,
```

- [ ] **Step 2: 구문 검증**

```powershell
node --check api/ai-explainer-v2.js
```
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add api/ai-explainer-v2.js
git commit -m "P0: allow Railway origins in AI explainer CORS"
```

### Task 6: 문서 갱신 + 전체 빌드·스모크

**Files:**
- Modify: `CONTEXT.md` (:1 제목, :424 타이틀 항목)
- Verify: `npm run build:vercel` + `node server.js` 스모크

- [ ] **Step 1: CONTEXT.md 갱신** — `# 반경 너머, 도달 가능성으로` → `# 반경 너머, 정책 도달성으로`, `- 타이틀: "반경 너머, 도달 가능성으로"` → `- 타이틀: "반경 너머, 정책 도달성으로"` (그 외 본문 서술은 건드리지 않음)

- [ ] **Step 2: 전체 빌드**

```powershell
npm run build:vercel
```
Expected: 성공. `vercel_public/index.html`에 새 title, `vercel_public/data_processed/candidate_panel_examples.json` 존재

- [ ] **Step 3: 서버 스모크**

```powershell
# 백그라운드로 서버 기동 후:
Invoke-WebRequest http://localhost:3000/ -UseBasicParsing | Select-Object -ExpandProperty Content | Select-String "정책 도달성으로"   # 1건 이상
Invoke-WebRequest http://localhost:3000/data_processed/candidate_panel_examples.json -UseBasicParsing | Select-Object -ExpandProperty StatusCode   # 200
Invoke-WebRequest http://localhost:3000/ui-preview/dist/index.html -UseBasicParsing | Select-Object -ExpandProperty Content | Select-String "정책 도달성으로"   # 1건 이상
```

- [ ] **Step 4: Commit**

```bash
git add CONTEXT.md
git commit -m "P0: update CONTEXT.md title references"
```
