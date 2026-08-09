# P4: 공공데이터 업데이트 센터 시제품 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공공데이터 3~5종의 변경을 감지(CDC)하고 품질검사·경량 재분석·전후 비교·승인·버전 기록·롤백을 제공하는 승인 기반 업데이트 센터 시제품 + 데이터 소스 위치 추적(메타층). 본선 판정 기준 2 충족: **공공데이터 1종(도서관 표준데이터)의 변경 감지→재분석→승인 반영 전 과정 로그**.

**Architecture:** `data_sources.yaml`(메타층) → `scripts/update_center/scan.mjs`(결정론적 CDC: 해시·스키마 diff·Green/Yellow/Red) → 이벤트를 저장소에 기록 → `server.js` 라우팅 + `api/update-center.js`(이벤트 조회·스캔·승인·롤백 API, AI 해설은 OpenAI 재사용+결정론 폴백) → `update-center.html` 관리 화면. 저장소는 **이중 백엔드**: `DATABASE_URL` 있으면 Railway Postgres(생성 완료, 참조변수 연결됨), 없으면 로컬 JSON 파일(시연·개발용) — 동일 인터페이스.

**Tech Stack:** Node 20 (node:http, node:crypto), `pg`(신규 dependency — devDep 아님, 서버 런타임용), js-yaml(기존), 바닐라 HTML/JS 관리 페이지.

## Global Constraints

- **AI는 해설만, 판단은 코드, 반영은 사람 승인** (제출 문서 원칙). Red 등급은 자동 반영 금지·승인 버튼 비활성
- **봉인값 보호**: `output/sealed_nearest_park_dist.json`의 53개교 실측값은 어떤 자동 재계산도 덮어쓰지 않는다 — 재분석 모듈에 명시적 가드 + 감사 로그
- 직선거리를 도달성으로 승격 금지 (경량 재분석도 등시선 교차 기준, 직선은 참고치)
- 데모 대상 1종 = **전국도서관표준데이터** (P2에서 확보한 keyless JSON API가 실제 CDC 폴링 대상: `https://www.data.go.kr/download/standard.json?publicDataPk=15013109&...` + `columList.json`)
- 관리 API 접근 게이트: 요청 헤더 `x-update-center-token` == `process.env.UPDATE_CENTER_TOKEN || "2026"` (시연용 — 기존 ACCESS_CODE 수준, 문서화)
- `update-center.html`은 `scripts/deploy/build_vercel_static.mjs`의 루트 파일 복사 목록에 등록해야 배포에 포함됨
- 작업 브랜치 `policy-reachability`. index.html은 이번 Phase에서 **수정하지 않는다** (관리 화면은 별도 파일). server.js·신규 파일 수정 후 `node --check` + 기존 게이트 유지
- 저장소 인터페이스(두 백엔드 공통): `recordEvent(e)`, `listEvents(limit)`, `getEvent(id)`, `updateEventStatus(id, status, actor)`, `saveVersion(v)`, `listVersions(dataset)`, `getVersion(id)`, `appendAudit(a)`, `listAudit(limit)`
- 스키마(Postgres DDL과 파일 백엔드 JSON 형상 동일):
  - `data_events(id, dataset, detected_at, kind{content|schema|moved|error}, risk{green|yellow|red}, summary, diff_json, ai_note, status{pending|approved|held|applied|rolled_back}, actor, updated_at)`
  - `data_versions(id, dataset, created_at, content_hash, row_count, snapshot bytea/base64, source_event_id, applied, rolled_back)`
  - `audit_log(id, at, actor, action, dataset, event_id, detail)` — **전 과정 로그 (판정 기준 2)**

---

### Task 1: 저장 계층 (pg + 파일 이중 백엔드)

**Files:**
- Create: `scripts/update_center/store.mjs`, `scripts/update_center/schema.sql`
- Modify: `package.json` (`pg` dependency 추가, `npm install pg`)

**Interfaces:**
- Produces: `createStore()` → 위 9개 메서드를 가진 객체. `DATABASE_URL` 존재 시 pg Pool + 첫 연결에서 `schema.sql`의 `CREATE TABLE IF NOT EXISTS` 실행. 부재 시 `data/update_center_store.json` 파일 백엔드(디렉토리 자동 생성, `.gitignore`에 추가). id는 `crypto.randomUUID()`

- [ ] schema.sql 작성 (위 3테이블, snapshot은 `BYTEA`, 인덱스 dataset·detected_at)
- [ ] store.mjs 작성 — 파일 백엔드는 동기 read/write JSON(시제품 규모 OK), snapshot은 base64 문자열
- [ ] 검증 스크립트 실행(임시 node -e): 파일 백엔드로 recordEvent→listEvents→saveVersion→appendAudit 왕복, raw output 기록. DATABASE_URL 없는 환경이므로 pg 경로는 `node --check` + pg 미연결 시 명확한 에러 메시지 확인까지
- [ ] Commit — `P4: update-center store layer (pg + file backends)`

### Task 2: 메타층 + 스캐너 (CDC)

**Files:**
- Create: `data_sources.yaml`, `scripts/update_center/scan.mjs`

**Interfaces:**
- `data_sources.yaml` 5종: libraries(전국도서관표준데이터 — portal_pk 15013109, keyless columList/standard.json URL, search_keywords, license, update_cycle 연간, last_known_hash는 스캔이 갱신), school_library(KESS — kess.kedi.re.kr/post/6670396 xlsx, data.go.kr 15040972), parks / schools / redevelopment(원천 URL이 리포에 기록 안 된 것은 `source_url: "추가 확인 필요"` + search_keywords만 등록 — 위치 추적 대상으로 유효). 각 항목: dataset, local_file, portal_pk/uddi, provider, license, update_cycle, source_url, check{type: json_api|file_head|manual}, search_keywords, notes
- `scan.mjs` CLI: `node scripts/update_center/scan.mjs [--dataset libraries] [--simulate-change <path>]`
  - check.type=json_api(libraries): columList.json 호출→컬럼 스키마 비교(저장된 기대 스키마 vs 응답), standard.json 첫 페이지 totalCount·sha256(정렬 후) 비교
  - check.type=file_head: HEAD 요청 ETag/Last-Modified/Content-Length 비교 (KESS xlsx)
  - check.type=manual: 스캔 시 "수동 확인 필요" 이벤트 없이 skip 카운트만
  - **위치 추적**: HTTP 404/이동 감지 시 `https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=<검색어>` HTML을 가져와 결과 링크 후보 추출(정규식, 시제품 수준) → kind=moved 이벤트에 후보 목록 포함
  - 분류: 스키마 동일+내용 변경→green / 컬럼 추가·개명→yellow / 컬럼 삭제·타입 붕괴·다운로드 실패→red / 이동→moved(red 취급)
  - `--simulate-change <수정된 CSV 경로>`: 원격 대신 로컬 파일을 "새 버전"으로 간주 (데모·테스트용, 이벤트 summary에 [시뮬레이션] 표기)
  - 이벤트는 store로 기록 + 상태 파일(`data/update_center_state.json`, gitignore)에 마지막 해시·스키마 저장
- [ ] 실행 검증: 실제 포털 API 대상 1회 스캔(변경 없음 → 이벤트 0 또는 baseline 기록), `--simulate-change`로 컬럼 추가 CSV → yellow 이벤트, 값만 변경 CSV → green 이벤트, raw output 기록
- [ ] Commit — `P4: data source manifest + CDC scanner with location tracking`

### Task 3: 서버 API + AI 해설

**Files:**
- Create: `api/update-center.js`
- Modify: `server.js` (라우팅: `/api/update-center/` 프리픽스 → 핸들러 위임)

**Interfaces:**
- `GET /api/update-center/events?limit=50` → {events:[...]} / `GET /api/update-center/audit?limit=100` → {audit:[...]} / `POST /api/update-center/scan` {dataset?} → 스캔 실행 결과 / `POST /api/update-center/approve` {event_id} → 재분석·전후비교 실행 후 적용(green/yellow만; red면 409) / `POST /api/update-center/hold` {event_id} / `POST /api/update-center/rollback` {version_id}
- 전부 `x-update-center-token` 검사 (불일치 401). 모든 상태 변화는 `appendAudit`
- AI 해설: 이벤트 생성/승인 시 `OPENAI_API_KEY` 있으면 기존 `api/ai-explainer-v2.js`의 OpenAI 호출 패턴 재사용해 변경 요약 해설 생성(모델·재시도 로직 동일, "해설은 참고용" 고정 문구), 없거나 실패 시 결정론 폴백 문자열(diff 요약 기반). ai_note에 저장
- [ ] `node --check` + 로컬 서버 기동 후 curl로 6개 엔드포인트 왕복(토큰 유/무), raw output 기록
- [ ] Commit — `P4: update-center API endpoints + AI change annotation`

### Task 4: 경량 재분석 + 전후 비교 + 봉인값 가드

**Files:**
- Create: `scripts/update_center/reanalyze.mjs`

**Interfaces:**
- `reanalyzeLibraries(newCsvText)` → 새 libraries CSV로 학교별 `iso_library_count`/`iso_public_library_count`/최근접(euclid 참고치) 재계산(JS: geojson 등시선 point-in-polygon + haversine, P2 Python 로직과 동일 규칙) → 현행 `school_library_access.csv` 대비 diff: {영향 학교 수, external_shortage 변화 수, 상세 목록 상위 20}
- approve 흐름(Task 3에서 호출): 현행 파일 snapshot을 data_versions에 저장 → 새 CSV로 `data_processed/libraries.csv` 교체 + `school_library_access.csv`의 iso 컬럼 갱신 → applied 기록. **주의: reading_gap_type 등 파생 컬럼은 갱신하지 않고 이벤트 detail에 "격차 유형 재산출은 Python 파이프라인 재실행 필요(문서화된 순서)" 명시** (전체 파이프라인 자동화는 로드맵 — 문서와 일치)
- rollback: snapshot 복원 + rolled_back 기록
- **봉인값 가드**: dataset이 parks 계열일 때 `output/sealed_nearest_park_dist.json`의 학교는 갱신 대상에서 제외하고 감사 로그에 "봉인값 보호 N건 제외" 기록. libraries 재분석은 봉인값과 무관함을 코드 주석+문서에 명시
- [ ] 검증: `--simulate-change`로 도서관 1곳 좌표 이동 CSV → approve → diff에 영향 학교 반영 → 파일 교체 확인 → rollback → 원상 복구(해시 일치) — **전 과정이 audit_log에 남는지 확인** (판정 기준 2 데모 시나리오), raw output 기록
- [ ] Commit — `P4: lightweight reanalysis + before/after diff + sealed-value guard`

### Task 5: 관리 화면

**Files:**
- Create: `update-center.html` (독립 정적 페이지, 다크 테마 — 기존 앱 스타일 톤 참조)
- Modify: `server.js` (GET /update-center → update-center.html 서빙), `scripts/deploy/build_vercel_static.mjs` (루트 복사 목록에 추가)

- [ ] 화면 구성: 토큰 입력(로컬스토리지 저장) → ① 데이터 소스 현황 표(data_sources.yaml 내용 + 마지막 스캔) ② "지금 검사" 버튼(전체/개별) ③ 이벤트 목록(risk 색상 배지 green/yellow/red·moved, [시뮬레이션] 표기, AI 해설 접기) ④ 이벤트 상세: diff 요약·전후 비교(영향 학교 수)·승인/보류 버튼(red는 승인 비활성+사유) ⑤ 버전 기록·롤백 ⑥ 감사 로그 타임라인. fetch는 전부 `x-update-center-token` 헤더
- [ ] 검증: 서버 기동→화면 로드→시뮬레이션 이벤트 승인→감사 로그 확인 (curl+DOM 확인, 시각 검증은 컨트롤러)
- [ ] Commit — `P4: update-center admin page`

### Task 6: 통합 스모크 + 문서

**Files:**
- Create: `docs/update_center.md` (아키텍처·API·데모 시나리오·한계: 시제품 범위, Python 파이프라인 재실행은 수동, 이중 백엔드 설명)
- 게이트 일괄 + E2E 데모 재실행 로그 첨부

- [ ] check_inline_script(index.html 무변경 확인용), validate:modules, build:vercel(update-center.html 포함 확인), node --check(server.js, api/update-center.js), 서버 스모크(GET /update-center 200 + API 왕복), E2E 데모(시뮬레이션 변경→green 이벤트→승인→적용→롤백, audit 전체 출력)
- [ ] Commit — `P4: update-center docs + integration smoke`

## 완료 기준 (컨트롤러)

1. 태스크 리뷰 클린 + 최종 브랜치 리뷰
2. 컨트롤러 시각 검증: /update-center 화면에서 스캔→이벤트→승인→감사 로그 흐름 스크린샷
3. 판정 기준 2: 도서관 데이터 1종의 변경 감지→재분석→승인 반영 전 과정 audit_log 데모 확보
