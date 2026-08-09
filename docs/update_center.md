# 업데이트 센터 (Update Center) — P4 시제품 문서

> 검증 완료 2026-08-09 — 아래 "데모 시나리오"의 전 과정(시뮬레이션 스캔 → green
> 이벤트 → AI 해설 → 승인 → 전후 비교 적용 → 버전 기록 → 롤백 → 감사 로그)을
> 로컬 서버(`server.js`, 파일 백엔드)에 대해 curl로 실제 실행하고 결과를 이 문서와
> `.superpowers/sdd/2026-08-09-p4-update-center/task-6-report.md`에 raw 출력으로
> 남겼다.

## 1. 아키텍처

```
data_sources.yaml (메타층)
        │  5개 데이터셋 정의: check.type(json_api/file_head/manual),
        │  포털 URL/PK, search_keywords(위치추적용)
        ▼
scripts/update_center/scan.mjs (CDC 스캐너)
        │  해시·스키마 diff, Green/Yellow/Red 등급 판정,
        │  moved(위치이동) 감지 + 포털 재검색, --simulate-change 시연 훅
        ▼
scripts/update_center/store.mjs (저장소, 이중 백엔드)
        │  DATABASE_URL 있으면 → Railway Postgres
        │    (기본 TLS 인증서 검증 ON, 자가서명 인증서 환경은
        │     PGSSL_NO_VERIFY=1로 명시적 opt-out 필요할 수 있음)
        │  DATABASE_URL 없으면 → 로컬 JSON 파일 (data/update_center_store.json)
        │  11-메서드 공통 인터페이스: recordEvent/listEvents/getEvent/
        │  updateEventStatus/setEventAiNote/saveVersion/listVersions/
        │  getVersion/markVersionRolledBack/appendAudit/listAudit
        ▼
api/update-center.js (서버 API, 8 엔드포인트)
        │  모든 요청에 x-update-center-token 헤더 게이트
        │  (process.env.UPDATE_CENTER_TOKEN, 기본값 "2026")
        │  GET sources/events/audit/versions,
        │  POST scan/approve/hold/rollback
        │  AI 해설(ai_note): OpenAI Responses API
        │  (실패/키없음 시 결정론적 요약 폴백, 항상 "참고용" 명시)
        ▼
/update-center (관리 화면, update-center.html)
        │  소스 테이블, 이벤트 목록(리스크 배지+시뮬레이션 태그),
        │  승인/보류 버튼, 버전 이력, 감사 로그 타임라인
        ▼
scripts/update_center/reanalyze.mjs (경량 재분석)
           libraries 데이터셋 전용: 등시선 기반 iso_/nearest_ 컬럼만
           재계산·패치. JS↔Python 파리티 검증 완료(0/245/245 무변경
           입력 기준 external_shortage 일치). 스냅샷+sha256 무결성
           가드로 롤백, sealedGuard()로 봉인값(수동 검증 실측값) 보호.
```

### 계층별 책임 요약

| 계층 | 파일 | 역할 |
| --- | --- | --- |
| 메타층 | `data_sources.yaml` | 5개 데이터셋(libraries/school_library/parks/schools/redevelopment)의 원천 URL·PK·체크 방식·검색 키워드 정적 정의 |
| CDC 스캐너 | `scripts/update_center/scan.mjs` | 원격 폴링(json_api/file_head), 해시/스키마 diff, Green/Yellow/Red 판정, moved 감지+포털 재검색, `--simulate-change` 시연 |
| 저장소 | `scripts/update_center/store.mjs` | `data_events`/`data_versions`/`audit_log` CRUD, pg/파일 이중 백엔드 |
| API | `api/update-center.js` | 토큰 게이트, 8개 엔드포인트, AI 해설 생성 |
| 관리 화면 | `update-center.html` (서버 루트에서 `/update-center`로 서빙) | 스캔/승인/보류/롤백 UI, localStorage 토큰 입력 |
| 경량 재분석 | `scripts/update_center/reanalyze.mjs` | libraries 전용 재계산+적용+롤백+봉인값 가드 |

## 2. API 명세 (8 엔드포인트)

모든 요청은 헤더 `x-update-center-token: <UPDATE_CENTER_TOKEN>`이 필요합니다. 불일치 시 `401 {"error":"..."}`.

| # | Method | Path | 요청 필드 | 응답 필드(주요) | 설명 |
| - | --- | --- | --- | --- | --- |
| 1 | GET | `/api/update-center/sources` | (없음) | `sources[]` — `data_sources.yaml` 전체 + `last_state`(마지막 스캔 상태, 없으면 null) | 데이터소스 메타 목록 |
| 2 | GET | `/api/update-center/events` | `?limit=` (기본 50) | `events[]` — `id,dataset,detected_at,kind,risk,status,summary,diff_json,ai_note` | CDC 이벤트 목록(최신순) |
| 3 | GET | `/api/update-center/audit` | `?limit=` (기본 100) | `audit[]` — `id,at,actor,action,dataset,event_id,detail` | 감사 로그(최신순) |
| 4 | GET | `/api/update-center/versions` | `?dataset=` (선택) | `versions[]` — `id,dataset,created_at,content_hash,row_count,snapshot(base64),applied,rolled_back` | 버전/스냅샷 이력 |
| 5 | POST | `/api/update-center/scan` | `dataset`(선택, 생략시 전체), `simulate_change_b64`(선택, base64 CSV — 시뮬레이션 모드) | `mode:"scan"\|"simulate"`, `summary`, `events[]`(ai_note 포함), `log[]` | 실 스캔 또는 시뮬레이션 트리거, 이벤트마다 AI 해설 자동 생성 |
| 6 | POST | `/api/update-center/approve` | `event_id` | 성공 200: `event,versionId,diff{affected_school_count,external_shortage_before/after,changed_schools}` / 실패: 409(red·moved·error·이미처리) 또는 501(시뮬레이션 페이로드 없음·미지원 데이터셋) | 이벤트 승인 → 재분석 → 적용(파일 반영) |
| 7 | POST | `/api/update-center/hold` | `event_id` | `event`(status:"held") | 이벤트 보류 처리 |
| 8 | POST | `/api/update-center/rollback` | `version_id` | `versionId, restoredFiles[], version` | 스냅샷 sha256 무결성 검증 후 파일 복원 |

**공통 정책 (Global Constraints)**
- `risk="red"` 또는 `kind∈{"moved","error"}` 이벤트는 승인(자동 반영) 불가 — 409로 거부하고 `approve_rejected` 감사 기록.
- 시뮬레이션 페이로드(`simulateCsvB64`)가 없는 이벤트(실제 원격 변경 감지분)는 승인 시 501 — "시제품 범위 밖" 명시.
- `libraries` 이외 데이터셋은 재분석 모듈이 없어 승인 시 501.
- 모든 mutating 액션(scan/approve/hold/rollback)은 `audit_log`에 기록되며 actor는 웹 UI/API 호출 시 `"web-admin"`.

## 3. 데모 시나리오 (판정 기준 2 — 변경 감지 → 재분석 → 승인 반영 전 과정)

아래는 2026-08-09에 로컬 서버(`UPDATE_CENTER_TOKEN=testtoken PORT=3921`, 파일 백엔드)에
대해 실제로 실행한 curl 시퀀스와 응답 요약입니다. 대상 데이터셋은 `libraries`(도서관
표준데이터) 1종, 변경 내용은 강화도서관 장서수 `85849 → 85850` (내용 변경, 스키마/행수
동일 → green 등급).

### 준비 — 적용 전 파일 해시 기록

```
$ sha256sum data_processed/libraries.csv data_processed/school_library_access.csv
d30d923ac5bec50bbd87ab440d5eb02bca20b9a63806af0caa6d559ec533162c  data_processed/libraries.csv
f5bcd595e493e0bc426793c8663b46fad7345e8dbc22e1170768e81442da0bdc  data_processed/school_library_access.csv
```

### Step 1 — 시뮬레이션 변경 스캔 (green 이벤트 + AI 해설)

```
$ curl -s -X POST http://127.0.0.1:3921/api/update-center/scan \
    -H "x-update-center-token: testtoken" -H "Content-Type: application/json" \
    -d '{"dataset":"libraries","simulate_change_b64":"<수정된 libraries.csv의 base64>"}'
```

응답 (핵심 필드만 발췌):
```json
{
  "mode": "simulate",
  "events": [{
    "id": "e4f16525-18b7-4ab5-93d9-e7b979071dc2",
    "dataset": "libraries",
    "kind": "content",
    "risk": "green",
    "status": "pending",
    "summary": "[시뮬레이션] 내용 변경 감지 (스키마 동일, 행수 272 -> 272)",
    "ai_note": "스키마는 동일하고 행수도 272건으로 같지만, 내용이 바뀐 것으로 감지되었습니다. 변경된 데이터에는 도서관 관련 항목들의 위치 정보, 이용 수치, 날짜·시간 구간 같은 값들이 서로 다른 값으로 나타납니다. (해설은 참고용입니다)",
    "diff_json": {
      "simulated": true,
      "addedColumns": [], "removedColumns": [],
      "currentRowCount": 272, "simulatedRowCount": 272,
      "currentContentHash": "6dceb060...", "simulatedContentHash": "497cf07e..."
    }
  }]
}
```
AI 해설(`ai_note`)은 `OPENAI_API_KEY`가 설정된 실제 환경에서 OpenAI Responses API로
생성됨(위 문구는 실제 호출 결과, 결정론적 폴백 아님).

### Step 2 — 승인 (재분석 → 전후 비교 → 적용 → 버전 기록)

```
$ curl -s -X POST http://127.0.0.1:3921/api/update-center/approve \
    -H "x-update-center-token: testtoken" -H "Content-Type: application/json" \
    -d '{"event_id":"e4f16525-18b7-4ab5-93d9-e7b979071dc2"}'
```

응답:
```json
{
  "event": { "status": "applied", "id": "e4f16525-18b7-4ab5-93d9-e7b979071dc2", "ai_note": "... 반영 여부와 승인 판단은 포함되어 있지 않습니다. (해설은 참고용입니다)" },
  "versionId": "263e853f-94a3-47df-b030-1486458f83d2",
  "diff": {
    "affected_school_count": 0,
    "external_shortage_before": 245,
    "external_shortage_after": 245,
    "changed_schools": []
  }
}
```
`affected_school_count: 0`인 이유: 이번 시뮬레이션은 장서수(내용값)만 바꿨고 위치 좌표는
그대로라 등시선 기반 iso_/nearest_ 컬럼(재분석 대상)에 영향이 없음 — 안전한 무영향 반영의
예시. 적용 직후 디스크 확인:
```
$ head -2 data_processed/libraries.csv
도서관명,유형,구,위도,경도,장서수,열람좌석수,평일운영,휴관일,기준일,좌표출처
강화도서관,공공,강화군,37.7488047,126.4831601,85850,241,09:00~22:00,월,2026-04-30,원본
$ sha256sum data_processed/libraries.csv
201283a2c95243b383b6d9c3cca60ddd1e6e2e8056c020f5309c15a41079e800  data_processed/libraries.csv
```
(85849 → 85850, 해시 변경 확인 — 실제 파일에 반영됨.)

### Step 3 — 버전 이력 확인

```
$ curl -s "http://127.0.0.1:3921/api/update-center/versions?dataset=libraries" \
    -H "x-update-center-token: testtoken"
```
→ `versions[0] = { id:"263e853f-...", applied:true, rolled_back:false, content_hash:"07dc738d...", row_count:272 }`

### Step 4 — 롤백 (전후 비교 원복)

```
$ curl -s -X POST http://127.0.0.1:3921/api/update-center/rollback \
    -H "x-update-center-token: testtoken" -H "Content-Type: application/json" \
    -d '{"version_id":"263e853f-94a3-47df-b030-1486458f83d2"}'
```
응답: `{"versionId":"263e853f-...","restoredFiles":["data_processed/libraries.csv","data_processed/school_library_access.csv"],"version":{"rolled_back":true,...}}`

롤백 후 해시 재확인 — Step 준비 단계와 정확히 일치(byte-exact 복원):
```
$ sha256sum data_processed/libraries.csv data_processed/school_library_access.csv
d30d923ac5bec50bbd87ab440d5eb02bca20b9a63806af0caa6d559ec533162c  data_processed/libraries.csv
f5bcd595e493e0bc426793c8663b46fad7345e8dbc22e1170768e81442da0bdc  data_processed/school_library_access.csv
```

### Step 5 — 감사 로그 전체 확인

```
$ curl -s "http://127.0.0.1:3921/api/update-center/audit?limit=10" \
    -H "x-update-center-token: testtoken"
```
시간순(오래된 순) 정리:
```
05:29:42.437Z  web-admin  simulate_scan       [시뮬레이션] 내용 변경 감지 (스키마 동일, 행수 272 -> 272)
05:30:02.113Z  web-admin  approve              승인 — 시뮬레이션 CSV 재분석 후 적용 시작 (risk=green)
05:30:02.131Z  web-admin  sealed_guard_check    봉인값 보호 대상 0건(도서관 재분석은 봉인값과 무관)
05:30:02.542Z  web-admin  snapshot_saved        적용 전 스냅샷 저장 (version=263e853f-..., sha256=07dc738d..., row_count=272)
05:30:02.567Z  web-admin  files_applied         libraries.csv 교체 + iso_/nearest_ 컬럼 갱신 완료 (영향 학교 0건, external_shortage 245->245).
                                                 격차 유형 재산출은 Python 파이프라인 재실행 필요: build_library_layer.py → apply_reading_gap_types.py → build_policy_cards.py
05:30:02.621Z  web-admin  applied               적용 완료 — versionId=263e853f-..., 영향 학교 0건
05:30:26.728Z  web-admin  rollback              버전 263e853f-... 롤백 완료 (무결성 검증 통과, sha256=07dc738d...) — 복원 파일: libraries.csv, school_library_access.csv
```
전체 원본 raw 출력은 `.superpowers/sdd/2026-08-09-p4-update-center/task-6-report.md`에 첨부.

## 4. 한계 (정직하게 — 시제품 범위)

- **실원격 반영은 시뮬레이션 페이로드가 필요합니다.** `libraries` 데이터셋의
  실제 원격 콘텐츠 엔드포인트(`standard.json`)는 공공데이터포털의 봇 게이트로
  자동화된 요청(curl/fetch)에 404를 반환합니다 — HTML 페이지와
  `columList.json`(스키마)은 정상 응답하지만 콘텐츠 자체는 자동 수집이 막혀
  있습니다. 따라서 실제 콘텐츠 변경(green/yellow diff)을 자동으로 가져와
  반영하는 경로는 이 시제품에 없고, `--simulate-change`/`simulate_change_b64`로
  변경 페이로드를 직접 주입해야 승인→적용 흐름을 시연할 수 있습니다. moved(위치
  이동) 감지와 포털 재검색 후보 제시는 실제 라이브 엔드포인트로 검증되었습니다.
- **격차유형·정책카드 재산출은 수동입니다.** `reanalyze.mjs`는 등시선 기반
  `iso_/nearest_` 컬럼만 재계산합니다. `reading_gap_type`, `external_shortage`,
  `internal_shortage`, `demand_high`, `reading_gap_reason` 등 파생 컬럼은
  건드리지 않습니다 — 최신 반영하려면 다음 순서로 Python 파이프라인을 수동
  재실행해야 합니다:
  ```
  scripts/reading_module/build_library_layer.py
    → scripts/reading_module/apply_reading_gap_types.py
    → scripts/reading_module/build_policy_cards.py
  ```
- **파일 백엔드 쓰기는 비원자적입니다.** `DATABASE_URL` 미설정 시 사용하는
  로컬 JSON 파일 백엔드(`data/update_center_store.json`,
  `data/update_center_state.json`)는 temp 파일 작성 후 rename하는 원자적
  쓰기를 하지 않습니다. 프로세스가 쓰기 도중 죽으면 파일이 손상될 수 있습니다
  (시제품 규모에서 용인된 트레이드오프, Task 1 결정 사항).
- **스케줄러가 없습니다.** 스캔은 수동 CLI(`node scripts/update_center/scan.mjs`)
  또는 관리 화면의 "스캔" 버튼(→ `POST /scan`)으로만 트리거됩니다. cron이나
  자동 주기 실행은 구현되어 있지 않습니다.
- **`file_head` 체크는 프록시 신호입니다.** `school_library` 데이터셋은 실제
  다운로드 URL이 세션/토큰 필요로 리포에 고정되어 있지 않아, 게시물 페이지
  자체의 HTTP 헤더(ETag/Last-Modified/Content-Length)를 변경 감지용 대리
  신호로 사용합니다 — 페이지 레이아웃이 바뀌어도 헤더가 바뀌면 오탐 가능성이
  있습니다.
- **`libraries` 이외 데이터셋(parks/schools/redevelopment)은 재분석 모듈이
  없습니다.** `check.type: manual`로 등록만 되어 있고(스캔 시 skip, 이벤트
  없음), 승인 시도 시 501로 명시적으로 거부됩니다.

## 5. 운영 — 환경 변수

| 변수 | 필수 여부 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 선택 | (없음 → 파일 백엔드) | 설정 시 Railway Postgres 백엔드 사용. `pg` Pool, TLS 기본 검증 ON |
| `PGSSL_NO_VERIFY` | 선택 | (없음 = 검증 ON) | `"1"`로 설정 시 pg 연결의 TLS 인증서 검증을 끔(`rejectUnauthorized:false`). 자가서명 인증서를 쓰는 Railway 관리형 Postgres 등에서 필요할 수 있음 — 명시적 opt-in 필요, 기본은 안전(검증 ON) |
| `UPDATE_CENTER_TOKEN` | 권장 | `"2026"` | `/api/update-center/*` 모든 요청에 필요한 `x-update-center-token` 헤더 값. 데모 등급 게이트(앱의 기존 `ACCESS_CODE`와 동일한 신뢰 수준) — 운영 배포 시 반드시 재설정 |
| `OPENAI_API_KEY` | 선택 | (없음 → 결정론적 요약 폴백) | 설정 시 이벤트 AI 해설(`ai_note`)을 OpenAI Responses API로 생성. 미설정/호출 실패 시 diff_json 기반 결정론적 요약으로 자동 대체, 두 경우 모두 "해설은 참고용입니다" 명시 |
| `AI_EXPLAINER_MODEL` | 선택 | `gpt-5.4-mini` | AI 해설 생성에 사용할 모델명 override |

## 6. 검증 이력

- 2026-08-09: Task 1~5 각 태스크 리뷰 클린(파일별 raw 검증 로그는
  `.superpowers/sdd/2026-08-09-p4-update-center/task-{1..5}-report.md` 참고).
- 2026-08-09: 본 문서(Task 6) — 게이트 일괄(check_inline_script, validate:modules,
  build:vercel, node --check ×5, store.mjs --selftest, 서버 스모크) + 위 3절의
  E2E 데모(시뮬레이션 변경 → green 이벤트 → AI 해설 → 승인 → 적용 → 버전 기록 →
  롤백 → 감사 로그) 전 과정을 실제로 실행하고 raw 출력을 확보. 상세 로그는
  `.superpowers/sdd/2026-08-09-p4-update-center/task-6-report.md`.
