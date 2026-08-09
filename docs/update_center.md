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
| 1 | GET | `/api/update-center/sources` | (없음) | `sources[]` — `data_sources.yaml` 전체 + `last_state`(마지막 스캔 상태, 없으면 null; `lastCheckedAt`/`lastStatus` 포함) | 데이터소스 메타 목록 |
| 2 | GET | `/api/update-center/events` | `?limit=` (기본 50, 최대 500) | `events[]` — `id,dataset,detected_at,kind,risk,status,summary,diff_json,ai_note,actor,updated_at` | CDC 이벤트 목록(최신순). `actor`/`updated_at`은 마지막으로 상태를 바꾼 주체·시각(hold/approve/rollback 등) |
| 3 | GET | `/api/update-center/audit` | `?limit=` (기본 100, 최대 500) | `audit[]` — `id,at,actor,action,dataset,event_id,detail` | 감사 로그(최신순) |
| 4 | GET | `/api/update-center/versions` | `?dataset=` (선택), `?limit=` (기본 20, 최대 100) | `versions[]` — `id,dataset,created_at,content_hash,row_count,source_event_id,applied,rolled_back` (목록 응답에는 `snapshot` 제외 — 용량 절감. 롤백은 서버가 `getVersion()`으로 전체 행을 별도 조회) | 버전/스냅샷 이력 |
| 5 | POST | `/api/update-center/scan` | `dataset`(선택, 생략시 전체), `simulate_change_b64`(선택, base64 CSV — 시뮬레이션 모드) | `mode:"scan"\|"simulate"`, `summary`, `events[]`(ai_note 포함), `log[]` | 실 스캔 또는 시뮬레이션 트리거, 이벤트마다 AI 해설 자동 생성(`ai_note_generated` 감사 기록, source=openai\|fallback) |
| 6 | POST | `/api/update-center/approve` | `event_id` | 성공 200: `event,versionId,diff{affected_school_count,external_shortage_before/after,changed_schools}` / 실패: 400(`event_id` 누락) · 404(이벤트 없음) · 409(red·moved·error·이미처리) · 501(시뮬레이션 페이로드 없음·미지원 데이터셋) | 이벤트 승인 → 재분석 → 적용(파일 반영) |
| 7 | POST | `/api/update-center/hold` | `event_id` | 성공 200: `event`(status:"held") / 실패: 400(`event_id` 누락) · 404(이벤트 없음) · 409(이미 처리됨) | 이벤트 보류 처리 |
| 8 | POST | `/api/update-center/rollback` | `version_id` | 성공 200: `versionId, restoredFiles[], version` / 실패: 400(`version_id` 누락 또는 무결성 검증 실패) · 404(버전 없음) · 409(이미 롤백됨) | 스냅샷 sha256 무결성 검증 후 파일 복원, 소스 이벤트(`source_event_id`)가 있으면 이벤트 상태도 `rolled_back`으로 갱신 |

**공통 정책 (Global Constraints)**
- `risk="red"` 또는 `kind∈{"moved","error"}` 이벤트는 승인(자동 반영) 불가 — 409로 거부하고 `approve_rejected` 감사 기록.
- 시뮬레이션 페이로드(`simulateCsvB64`)가 없는 이벤트(실제 원격 변경 감지분)는 승인 시 501 — "시제품 범위 밖" 명시.
- `libraries` 이외 데이터셋은 재분석 모듈이 없어 승인 시 501.
- 이미 롤백된 버전에 다시 `POST /rollback`을 호출하면 409로 거부된다(idempotency guard).
- 모든 mutating 액션(scan/approve/hold/rollback)은 `audit_log`에 기록되며 actor는 웹 UI/API 호출 시 `"web-admin"`.

## 3. 데모 시나리오 (판정 기준 2 — 변경 감지 → 재분석 → 승인 반영 전 과정)

> 아래 시나리오는 `POST /api/update-center/scan`에 `simulate_change_b64`를 curl로
> 직접 넣어 실행한다. 관리 화면(`update-center.html`)에는 시뮬레이션 CSV를 넣는
> 입력창이 의도적으로 없다 — "④ 데이터 소스 현황"의 "검사" 버튼은 항상 실 스캔
> (payload 없는 `POST /scan`)만 트리거한다. 시뮬레이션 경로는 실제 원격
> 콘텐츠가 봇 게이트로 막혀 있는 상황(§4 첫 항목)에서 승인→적용 흐름을 시연하기
> 위한 개발자용 훅으로 설계되었으며, 시연 심사에서는 이 문서의 curl 시퀀스로
> 재현한다.

아래는 2026-08-09에 로컬 서버(`UPDATE_CENTER_TOKEN=testtoken PORT=3921`, 파일 백엔드)에
대해 실제로 실행한 curl 시퀀스와 응답 요약입니다. 대상 데이터셋은 `libraries`(도서관
표준데이터) 1종, 변경 내용은 강화도서관 장서수 `85849 → 85850` (내용 변경, 스키마/행수
동일 → green 등급).

> **참고 (2026-08-10, P5 갱신):** 아래 transcript는 2026-08-09 시점에 캡처된 세션
> 그대로이며(실측 sha256 해시 포함), 당시 baseline `external_shortage=245`를 반영한다.
> Kakao REST 지오코딩 정밀화와 후속 중복 도서관 행 제거를 거친 현재 baseline은
> `external_shortage=251`이다 — 최신 수치와 산출 근거는
> `docs/reading_module_thresholds.md`를 참조할 것. transcript 자체(curl 출력, 해시값)는
> 과거 실행 기록이므로 고치지 않는다.

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
- **적용된 변경이 지도 앱에 즉시 반영되지 않습니다.** 승인이 적용하는 변경은
  리포의 `data_processed/`에 씁니다. 하지만 지도 앱(Vercel 정적 서빙 경로)이
  실제로 서빙하는 사본은 빌드 시점에 스냅샷된 `vercel_public/data_processed/`
  입니다 — 따라서 지도 앱에 실제 반영되는 시점은 다음 빌드/배포부터입니다.
  시연 시 로컬에서는 `npm run build:vercel`을 재실행하면 즉시 반영된 결과를
  확인할 수 있습니다.
- **Railway 파일시스템은 재배포 시 초기화됩니다.** `DATABASE_URL` 미설정 시
  쓰는 파일 백엔드 store(`data/update_center_store.json`,
  `data/update_center_state.json`)와, 승인으로 적용된
  `data_processed/*.csv`는 Railway의 컨테이너 파일시스템에 저장되므로
  재배포(redeploy)마다 초기화되어 휘발됩니다 — 이벤트/버전/감사 로그와 적용된
  데이터를 영구적으로 남기려면 `DATABASE_URL`(Postgres)을 설정해야 합니다
  (store.mjs는 설정 여부에 따라 두 백엔드를 자동 전환하지만, `data_processed/`
  파일 자체의 영속성은 store 백엔드와 별개로 컨테이너 파일시스템에 의존하므로
  Postgres를 쓰더라도 적용된 CSV 파일은 여전히 휘발될 수 있습니다).

## 5. 운영 — 환경 변수

| 변수 | 필수 여부 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 선택 | (없음 → 파일 백엔드) | 설정 시 Railway Postgres 백엔드 사용. `pg` Pool, TLS 기본 검증 ON |
| `PGSSL_NO_VERIFY` | 선택 | (없음 = 검증 ON) | `"1"`로 설정 시 pg 연결의 TLS 인증서 검증을 끔(`rejectUnauthorized:false`). 자가서명 인증서를 쓰는 Railway 관리형 Postgres 등에서 필요할 수 있음 — 명시적 opt-in 필요, 기본은 안전(검증 ON) |
| `UPDATE_CENTER_TOKEN` | 권장 | `"2026"` | `/api/update-center/*` 모든 요청(온보딩 포함)에 필요한 `x-update-center-token` 헤더 값. 데모 등급 게이트(앱의 기존 `ACCESS_CODE`와 동일한 신뢰 수준) — 운영 배포 시 반드시 재설정. 미설정 시 서버가 기동할 때 `console.warn`으로 기본 토큰("2026") 사용 중임을 명시적으로 경고한다. 이 토큰 게이트가 모든 `/api/update-center/*` 엔드포인트(온보딩 포함)의 유일한 방어선이다 — 별도 rate limit은 없음 |
| `OPENAI_API_KEY` | 선택 | (없음 → 결정론적 요약 폴백) | 설정 시 이벤트 AI 해설(`ai_note`)을 OpenAI Responses API로 생성. 미설정/호출 실패 시 diff_json 기반 결정론적 요약으로 자동 대체, 두 경우 모두 "해설은 참고용입니다" 명시 |
| `AI_EXPLAINER_MODEL` | 선택 | `gpt-5.4-mini` | AI 해설 생성에 사용할 모델명 override |
| `PORT` | 선택 | `3000` | `server.js`(update-center의 API/관리 화면을 함께 서빙하는 로컬/Railway 서버)가 리스닝할 포트. Railway 배포 시 플랫폼이 자동 주입 |

## 6. 온보딩 에이전트 (Onboarding Agent) — P5 시제품

> 검증 완료 2026-08-09 — 이 섹션은 실제 코드(`api/update-center.js`의
> `handlePostOnboarding`/`buildOnboardingProposal`/`checkYamlDraft`,
> `PHILOSOPHY_CHECKLIST`, `update-center.html`의 "⑦ 신규 모듈 제안" 패널)를
> 직접 읽고 처음부터 다시 쓴 것이다 — 이전 버전은 실제 구현과 다른 요청/응답
> 스키마(`natural_language_request`, `onboarding_id`, `checklist_all_approved`,
> `suggested_schema`, `POST /onboarding/approve` 등 실제로는 존재하지 않는
> 필드/엔드포인트)를 서술하고 있었다. 로컬 서버(`server.js`, 파일 백엔드,
> `UPDATE_CENTER_TOKEN=testtoken`, `PORT=3931`)에 대해 `POST /onboarding` →
> `GET /events`(risk 확인) → `POST /approve`(409 거부 확인) →
> `GET /audit`(감사 기록 확인) 왕복을 실제로 실행했다 — raw 응답은 6.5절.

### 6.1 동작 흐름

```
자연어 요청 (요청자)
        │
        ▼
POST /api/update-center/onboarding { request_text }
        │
        ▼
AI 설계안 + YAML 초안 생성 (buildOnboardingProposal)
        │
        ├─ OPENAI_API_KEY 있음 → OpenAI Responses API 호출
        │   (json_schema로 design_summary/yaml_draft/suggested_datasets[]/
        │   philosophy_notes[] 형식 강제) — 파싱 실패·HTTP 실패·필드 형식
        │   불일치 시 아래 폴백으로 전환
        │
        └─ OPENAI_API_KEY 없음 또는 위 호출 실패
            → 결정론적 폴백 (buildFallbackProposal): 모듈 YAML의 모든 필수
              필드가 채워진 완전한 초안을 생성한다("추가 확인 필요" 자리
              표시자 값 포함, design_summary/philosophy_notes 앞에
              "[AI 미사용 폴백]" 표기) — 이 초안은 항상 계약 검사를
              통과하므로 OPENAI_API_KEY 없이도 데모가 성립한다.
        ▼
계약 검사 (checkModuleDoc, scripts/validate_module_contract.mjs 재사용)
        │  yaml_draft를 js-yaml CORE_SCHEMA로 파싱 → 성공 시 checkModuleDoc(doc)로
        │  필수 필드·policy_actions/gap_type_actions enum·타입 검사
        │  (신규 미등록 모듈이므로 LAYER_REGISTRY parity 검사는 생략)
        │  결과: { yaml_parsed, parse_error, failures[], warnings[], passed }
        ▼
철학 체크리스트 (3항목 고정 — 항상 "human 검토 필요")
        │  1. walk_network  — 도달성 지표는 직선이 아닌 도보 네트워크 기준인가
        │  2. target_leakage — 격차 유형·권고에 target leakage 요소가 없는가
        │  3. stigma        — 학교 서열화·낙인 효과를 유발하는 표시가 없는가
        │  AI가 스스로 통과를 선언할 수 없다 — 이 상태를 바꾸는 API는 없다.
        │  AI의 참고 의견은 philosophy_notes로 별도 반환("AI 참고 의견 —
        │  검증되지 않음"으로 UI 표시, 체크리스트 판정과는 무관)
        ▼
이벤트 저장 (kind=onboarding_proposal, risk=계약 검사 결과 기반)
        │  risk = contract_check.passed ? "yellow" : "red"
        │  diff_json = { request_text, design_summary, yaml_draft,
        │                contract_check, philosophy_notes, ai_source }
        ▼
감사 로그 기록 (action=onboarding_proposal_created, detail: source=openai|fallback)
```

### 6.2 API 명세 (POST /api/update-center/onboarding)

다른 모든 `/api/update-center/*` 엔드포인트와 동일하게 헤더
`x-update-center-token: <UPDATE_CENTER_TOKEN>`이 필요하다.

#### 요청

```json
{ "request_text": "string (필수, 10~2000자)" }
```

`request_text` 외 다른 요청 필드는 없다. 10자 미만이거나 2000자 초과면 400.

#### 응답 (200 OK) — 실제 응답 필드

```json
{
  "event_id": "uuid",
  "dataset": "onboarding:<slug>",
  "request_text": "string (요청 에코)",
  "design_summary": "string",
  "yaml_draft": "string — 표준 모듈 YAML 계약 필드를 갖춘 YAML 초안 텍스트",
  "suggested_datasets": ["string", "..."],
  "philosophy_notes": ["string", "..."],
  "philosophy_checklist": [
    { "id": "walk_network", "text": "도달성 지표는 직선이 아닌 도보 네트워크 기준인가", "status": "human 검토 필요" },
    { "id": "target_leakage", "text": "격차 유형·권고에 target leakage 요소가 없는가", "status": "human 검토 필요" },
    { "id": "stigma", "text": "학교 서열화·낙인 효과를 유발하는 표시가 없는가", "status": "human 검토 필요" }
  ],
  "contract_check": {
    "yaml_parsed": true,
    "parse_error": null,
    "failures": [],
    "warnings": [],
    "passed": true
  },
  "ai_source": "openai",
  "notice": "이 제안은 저장만 되며 승인·파일 생성 전까지 운영에 반영되지 않습니다."
}
```

**필드 설명:**
- `event_id`: 저장된 `data_events` 행의 id(`GET /events`·`GET /audit`으로 조회 가능)
- `dataset`: `onboarding:<slug>` 형태. `slug`는 `request_text`의 sha1 해시 앞 8자리(`onboardingSlug()`) — 아직 등록되지 않은 신규 모듈이므로 실제 데이터셋 키가 아니라 추적용 placeholder
- `design_summary`: 설계 요약(AI 생성 또는 폴백)
- `yaml_draft`: 표준 모듈 YAML 문서 텍스트. `module`/`resource_type`/`location{file,lat_key,lng_key,name_key}`/`external_supply[]`/`demand_unit`/`policy_actions[]`/`reference_date`/`source[]`/`layer{id,button_label,panel_label,color}`를 채우며, 실값을 모르면 정확히 `"추가 확인 필요"` 문자열을 쓴다. 사람이 검토 후 `modules/*.yaml`로 복사한다.
- `suggested_datasets`: 포털에서 검색할 키워드 제안(실제 포털 검색 API 미연동). 폴백 경로는 `request_text` 토큰화(불용어 제거, 최대 5개) 결과, OpenAI 경로는 모델이 직접 제안. 서버가 문자열이 아닌 원소는 걸러낸다.
- `philosophy_notes`: **AI 참고 의견 — 검증되지 않음**. `philosophy_checklist`의 최종 판정이 아니다. 서버가 문자열이 아닌 원소는 걸러낸다.
- `philosophy_checklist`: 3항목 고정, `status`는 항상 `"human 검토 필요"`(이 상태를 바꾸는 엔드포인트는 없다 — 6.3 참고)
- `contract_check`: `checkModuleDoc()` 기계 검사 결과. `yaml_parsed=false`면 `parse_error`에 파싱 오류 메시지, 그 외에는 `contract_check.failures`(치명적 위반, 문자열 배열)·`warnings`·`passed`(`failures`가 비어 있으면 true)
- `ai_source`: `"openai"`(OpenAI Responses API 호출 성공) 또는 `"fallback"`(키 없음, 또는 호출/파싱/필드 검증 실패)
- `notice`: 고정 문구 — 승인·파일 생성 전까지 운영 미반영

#### 에러 응답

**400 Bad Request** — `request_text` 길이 위반
```json
{ "error": "request_text는 10~2000자여야 합니다 (현재 <n>자)." }
```

**401 Unauthorized** — 토큰 불일치(다른 모든 엔드포인트와 동일한 게이트)
```json
{ "error": "인증 실패 — x-update-center-token 헤더가 올바르지 않습니다." }
```

### 6.3 원칙 (Principles)

1. **승인 전 운영 미반영, 그리고 애초에 승인 대상이 아니다.** `POST /onboarding`은 `data_events`에 `status="pending"`으로 저장만 한다. 이 이벤트의 `event_id`로 `POST /api/update-center/approve`를 호출하면 **`kind`가 `onboarding_proposal`이라는 이유만으로 항상 409**로 거부된다(risk가 yellow든 red든 무관): `{"error":"온보딩 제안은 승인 대상이 아닙니다 — YAML 초안을 복사해 사람이 modules/ 파일을 생성합니다"}`, 감사 로그에 `action=approve_rejected_onboarding` 기록. 관리 화면(⑦ 패널이 아니라 ② 이벤트 목록 쪽)에서도 온보딩 행을 선택하면 승인 버튼이 항상 비활성이고(같은 문구가 툴팁으로 뜬다), risk 배지 옆에 별도 "온보딩" 배지(indigo)가 함께 표시된다. 실제 파일 생성은 사람이 `yaml_draft`를 복사해 `modules/*.yaml`에 붙여넣는 수작업이다 — `POST /onboarding`은 `modules/`, `data_processed/`, `data_sources.yaml` 중 어느 것도 쓰지 않는다.

2. **철학 체크리스트는 절대 "통과"로 바뀌지 않는다.** 세 항목은 응답마다 매번 새로 `status: "human 검토 필요"`로 생성되며, 이를 다른 상태로 바꾸는 API는 존재하지 않는다(`POST /api/update-center/onboarding/approve`, `checklist_all_approved` 필드는 실제로 구현되어 있지 않다). AI가 스스로 체크리스트를 통과시켰다고 선언할 수 없다는 원칙을 코드 구조로 강제한 것이다.

3. **리스크 등급은 계약 검사 결과를 그대로 반영한다.** 저장되는 이벤트의 `risk`는 고정 `yellow`가 아니라 `contract_check.passed`가 참이면 `yellow`, 거짓이면 `red`다 — 계약 검사를 통과하지 못한 초안이 목록에서 실제보다 낮은 리스크로 보이지 않도록 하기 위함이다.

4. **계약 검사는 `checkModuleDoc()`을 그대로 재사용한다.** `scripts/validate_module_contract.mjs`가 `modules/*.yaml`을 검사할 때 쓰는 것과 동일한 함수다 — 필수 필드 누락, `policy_actions`/`gap_type_actions` 값이 7-action enum(`internal_investment`/`external_supply_new`/`institution_link`/`mobile_service`/`access_route_improvement`/`shared_hub`/`maintain_monitor`) 밖인 경우, `external_supply[]`/`source[]` 항목의 `metric`/`source`/`name`/`provider` 누락 등을 잡는다. 위반은 모두 `contract_check.failures`에 문자열로 담긴다(신규 모듈이라 LAYER_REGISTRY parity 검사는 생략).

### 6.4 한계 (Limitations)

- **`suggested_datasets`는 검색 키워드 제안일 뿐** — 공공데이터포털 검색 API와 미연동. 사용자 또는 운영팀이 직접 포털에서 키워드로 검색해 URL을 찾아야 한다.
- **`yaml_draft`는 human 검토가 필수** — `checkModuleDoc()`은 필드 유형·enum·필수값 존재 여부만 기계적으로 검사한다. 실제 원천 데이터가 존재하는지, 컬럼명이 진짜인지는 검증하지 않는다(`location.file`이 `"추가 확인 필요"`가 아닌 실제 경로면 `existsSync`로 파일 존재만 확인).
- **rate limit이 없다** — `/onboarding`을 포함한 모든 `/api/update-center/*` 엔드포인트는 `x-update-center-token` 토큰 게이트가 유일한 방어선이다(§5 환경변수 표 참고). 반복 호출을 막는 별도 제한은 없다(데모 등급).
- **파일 생성은 자동화되지 않음** — 사람이 `yaml_draft`를 복사해 `modules/*.yaml`을 만들고 `data_sources.yaml`에 필요한 항목을 직접 추가해야 한다.

### 6.5 실측 응답 예시(2026-08-09)

로컬 서버(`server.js`, 파일 백엔드, `UPDATE_CENTER_TOKEN=testtoken`, `PORT=3931`)에 대해
실제로 실행한 raw 왕복. 시크릿(토큰/API 키) 미포함 확인 완료.

**폴백 경로를 강제한 방법** — `OPENAI_API_KEY`를 빈 문자열로 설정하는 것만으로는 폴백이
강제되지 않는다: `server.js`가 먼저 require하는 `api/ai-explainer-v2.js`의
`loadLocalEnvForDevelopment()`가 require 시점에 `process.env.OPENAI_API_KEY`가
falsy면 리포 상위 폴더의 `.env` 파일을 찾아 다시 채워 넣기 때문이다(개발 편의
기능). `.env` 파일은 건드리지 않고, `OPENAI_API_KEY`를 의도적으로 무효한 값
(`sk-forced-invalid-for-fallback-verification-...`)으로 설정해 OpenAI 호출이
실제로 401로 실패하는 경로를 재현했다 — `loadLocalEnvForDevelopment()`의
`if (process.env.OPENAI_API_KEY) return;` 가드가 이미 값이 있다고 보고 `.env`
재적재를 건너뛰므로 무효값이 그대로 살아남는다. 이는 "OPENAI_API_KEY 없거나
실패 시" 중 "호출 실패" 분기를 코드 그대로 재현한 것이다.

#### Step 1 — POST /onboarding (실제로 실패한 OpenAI 호출 → 폴백)

```
$ curl -s -X POST http://127.0.0.1:3931/api/update-center/onboarding \
    -H "x-update-center-token: testtoken" -H "Content-Type: application/json; charset=utf-8" \
    -d '{"request_text":"관내 체육시설(공공 체육관·운동장) 접근 격차도 분석하고 싶어요. 도보로 얼마나 걸리는지 기준으로 부족 지역을 찾고 싶습니다."}'
```

응답 (200, 전체 raw):
```json
{
  "event_id": "46c9cd5a-3e12-42dc-9443-f4f2aee41fd2",
  "dataset": "onboarding:new_module_59c71b4e",
  "request_text": "관내 체육시설(공공 체육관·운동장) 접근 격차도 분석하고 싶어요. 도보로 얼마나 걸리는지 기준으로 부족 지역을 찾고 싶습니다.",
  "design_summary": "[AI 미사용 폴백] \"관내 체육시설(공공 체육관·운동장) 접근 격차도 분석하고 싶어요. 도보로 얼마나 걸리는지 기준으로 부족 지역...\" 요청에 대한 자동 초안입니다. 자원 종류·데이터 출처·지표는 모두 \"추가 확인 필요\"로 채워졌으며, 담당자가 실제 값으로 채워 넣어야 합니다. policy_actions는 임시로 access_route_improvement·maintain_monitor를 지정했으니 실제 정책 방향에 맞게 재검토가 필요합니다. layer.id도 임시 slug(new_module_59c71b4e)이므로 실제 등록 시 사람이 최종 id를 정해야 합니다.",
  "yaml_draft": "module: new_module_59c71b4e\nresource_type: '추가 확인 필요 — 요청 원문: 관내 체육시설(공공 체육관·운동장) 접근 격차도 분석하고 싶어요. 도보로 얼마나 걸리는지 기준으로 부족 지역을 찾고 싶습니다.'\nlocation:\n  file: 추가 확인 필요\n  lat_key: 추가 확인 필요\n  lng_key: 추가 확인 필요\n  name_key: 추가 확인 필요\nexternal_supply:\n  - metric: 추가 확인 필요\n    source: 추가 확인 필요\ndemand_unit: 추가 확인 필요\npolicy_actions:\n  - access_route_improvement\n  - maintain_monitor\nreference_date: 2026-08-09\nsource:\n  - name: 추가 확인 필요\n    provider: 추가 확인 필요\nlayer:\n  id: new_module_59c71b4e\n  button_label: 추가 확인 필요\n  panel_label: 추가 확인 필요\n  color: '#6B7280'\n",
  "suggested_datasets": ["관내", "체육시설", "공공", "체육관", "운동장"],
  "philosophy_notes": [
    "[AI 미사용 폴백] 도보 네트워크 기준 도달성 지표를 확보할 수 있는 원천 데이터인지 사람이 직접 확인해야 합니다.",
    "[AI 미사용 폴백] 격차 유형·권고 로직에 결과를 미리 아는 변수(target leakage)가 섞이지 않는지 사람이 직접 확인해야 합니다.",
    "[AI 미사용 폴백] 이 제안의 표시 방식이 학교 서열화나 낙인 효과로 이어지지 않는지 사람이 직접 확인해야 합니다."
  ],
  "philosophy_checklist": [
    { "id": "walk_network", "text": "도달성 지표는 직선이 아닌 도보 네트워크 기준인가", "status": "human 검토 필요" },
    { "id": "target_leakage", "text": "격차 유형·권고에 target leakage 요소가 없는가", "status": "human 검토 필요" },
    { "id": "stigma", "text": "학교 서열화·낙인 효과를 유발하는 표시가 없는가", "status": "human 검토 필요" }
  ],
  "contract_check": { "yaml_parsed": true, "parse_error": null, "failures": [], "warnings": [], "passed": true },
  "ai_source": "fallback",
  "notice": "이 제안은 저장만 되며 승인·파일 생성 전까지 운영에 반영되지 않습니다."
}
```

폴백임에도 `contract_check.passed=true`(계약 검사 통과) → 이벤트는 `risk="yellow"`로
저장됨(`GET /events`로 확인).

#### Step 2 — 승인 시도 → 409 거부 확인 (POST /approve)

```
$ curl -s -X POST http://127.0.0.1:3931/api/update-center/approve \
    -H "x-update-center-token: testtoken" -H "Content-Type: application/json; charset=utf-8" \
    -d '{"event_id":"46c9cd5a-3e12-42dc-9443-f4f2aee41fd2"}'
```
응답 (409):
```json
{
  "error": "온보딩 제안은 승인 대상이 아닙니다 — YAML 초안을 복사해 사람이 modules/ 파일을 생성합니다",
  "event": { "id": "46c9cd5a-3e12-42dc-9443-f4f2aee41fd2", "kind": "onboarding_proposal", "risk": "yellow", "status": "pending" }
}
```

#### Step 3 — 감사 로그 확인 (GET /audit)

```
onboarding_proposal_created  | 온보딩 제안 생성 — source=fallback
approve_rejected_onboarding  | 승인 거부 — 온보딩 제안은 승인 대상이 아님(YAML 초안을 복사해 사람이 modules/ 파일을 생성)
```

## 7. 검증 이력

- 2026-08-09: Task 1~5 각 태스크 리뷰 클린(파일별 raw 검증 로그는
  `.superpowers/sdd/2026-08-09-p4-update-center/task-{1..5}-report.md` 참고).
- 2026-08-09: Task 6 (본 문서 앞 섹션) — 게이트 일괄(check_inline_script, validate:modules,
  build:vercel, node --check ×5, store.mjs --selftest, 서버 스모크) + 위 3절의
  E2E 데모(시뮬레이션 변경 → green 이벤트 → AI 해설 → 승인 → 적용 → 버전 기록 →
  롤백 → 감사 로그) 전 과정을 실제로 실행하고 raw 출력을 확보. 상세 로그는
  `.superpowers/sdd/2026-08-09-p4-update-center/task-6-report.md`.
- 2026-08-09: P5 Task 3 (본 섹션 추가) — 온보딩 에이전트 문서 + 게이트 일괄 + 서버 스모크(온보딩 왕복 포함).
- 2026-08-09: P5 최종 전체 브랜치 리뷰 후속 조치 — §6 온보딩 문서를 실제 코드
  (`api/update-center.js`, `update-center.html`)를 처음부터 다시 읽고 전면
  재작성(구버전은 실제와 다른 요청/응답 스키마를 서술하고 있었음). 승인 경로에
  온보딩 전용 409 거부 분기, risk 등급을 계약 검사 결과 기반(yellow/red)으로
  전환, 리스크 배지와 온보딩 배지를 함께 표시하도록 UI 수정, AI 참고 의견
  라벨링, 문자열 배열 방어 필터 추가. 게이트 일괄(`node --check` ×2, 인라인
  스크립트 vm 파싱, `validate:modules`, `build:vercel`, `store.mjs
  --selftest`) + 실제 서버 왕복(온보딩 폴백 강제 → risk 확인 → 승인 시도 409 →
  감사 로그 확인)을 실행하고 raw 출력을 위 6.5절에 남겼다.
