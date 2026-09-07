# 운영 구현 보고서: 키 독립 로컬 데모 서버 + 컨텍스트 업데이트 검토 워크플로 (2026-09-06)

독립 2번 Claude 구현 결과. 계획서가 아니라 동작하는 코드·테스트·실행 기록이다.

**최신 검증 상태:** 서버 49개·워크플로 **64개** 검사 통과(schema_version 2 회귀 포함). 독립 2차 리뷰에서 1차에 발견된 6개 결함의 수정과 정상 승인·복구 경로 유지를 확인했고(`../../outputs/audit_20260906/operations_review_round2.md`), 이후 최종 컨텍스트 schema_version 2 계약 검사를 반영했다(아래 6절). 본문 초기 구현 기록의 42/40개 수치는 후속 검증 전 수치이며, 마지막 수정 기록을 우선한다. 브라우저의 localhost API 경로와 최종 맥락 데이터 묶음은 앱 담당 작업과 통합 검증해야 한다.

## 산출물 (전부 신규, 기존 파일 수정은 update_center/README.md 재작성 1건뿐)

| 파일 | 내용 |
|---|---|
| `scripts/local_review_server.cjs` | 127.0.0.1 전용 로컬 데모 서버 (Node 내장 모듈만, 의존성 0) |
| `update_center/review_cli.cjs` | stage/verify/diff/approve/reject/rollback/dashboard/list CLI (의존성 0) |
| `update_center/README.md` | 스텁 → 실사용 문서 재작성 (서버 사용법 포함) |
| `scripts/tests/test_local_review_server_ops20260906.cjs` | 서버 테스트 42개 검증 |
| `scripts/tests/test_update_center_workflow_ops20260906.cjs` | 워크플로 테스트 40개 검증 |
| `update_center/{staging,reviews,managed,public}/` | 실데이터 데모 실행으로 생성된 검토 상태 |

## 1. 로컬 검토 서버

실행: `node scripts/local_review_server.cjs [--port 8899] [--live]`

### 오프라인 강제 메커니즘 (기본값, 실제 핸들러 코드를 읽고 검증한 설계)

`api/ai-explainer-v2.js` (다른 에이전트 소유, 무수정) 의 확인된 동작:

1. require 시점에 `loadLocalEnvForDevelopment()` 가 실행되며, `OPENAI_API_KEY` 가 이미 있으면 **즉시 return** 하여 상위 `.env`/`.env.txt` 를 읽지 않는다 (해당 파일 18~46행).
2. 요청 처리 중 `if (!process.env.OPENAI_API_KEY)` 이면 `buildRetrievalFallback()` — 검색된 근거 chunk 요약 기반의 **유용한** 오프라인 해설 — 로 응답한다 (682~684행).
3. `AI_EXPLAINER_ENABLED=false` 는 503 "비활성화" 차단만 반환(651~653행)하므로 **채택하지 않았다** (프롬프트의 "verify implementation" 수행 결과).

래퍼 순서: ① require 전 통제된 더미 키 주입(.env 로딩 차단) → ② require → ③ 더미 키 삭제(폴백 경로 확정) → ④ 심층 방어로 `globalThis.fetch` 를 localhost 외 호스트에 대해 차단. `--live` 는 이 개입 없이 핸들러 자체 환경 설정을 유지한다(향후 키 투입용). 키 값은 어떤 모드에서도 로그·응답에 출력되지 않는다 (`GET /__status` 는 존재 여부 불리언만).

### 정적 서빙 정책

- 허용: `/`(=index.html), `/index.html`, `/logo.png`, `/assets/`, `/data_processed/`, `/ui-preview/dist/`, `/outputs/robust_xai/`, `/update_center/public/` + 확장자 허용목록(웹·데이터 형식만, `.cjs`/`.yaml` 등 코드·설정 제외)
- 차단: `..`·백슬래시·인코딩 우회(`%2e%2e`, `%2f`, `%5c`), 점으로 시작하는 세그먼트(`.env` 등), 허용목록 밖 전체(`api/*.js`, `scripts/`, `pipeline/`, `reports/`, `package.json`, `outputs/robust_xai` 외 outputs). 차단·부재 모두 동일 404(경로 탐지 방지). 정적은 GET/HEAD만, API는 POST/OPTIONS만(그 외 405).
- 해석된 절대경로의 프로젝트 루트 포함 여부를 최종 확인(이중 방어).

## 2. update_center 검토 워크플로

명령·규칙 상세는 `update_center/README.md`. 핵심 보장:

- **품질 게이트**: overall_status=fail 스냅샷은 approve 가 코드 1로 거부. 검사 규칙은 실계약 기반 —
  facility(좌표 유효성은 도서 포함 한반도 광역 범위, **좌표 공백 + `coordinate_status`/`geocode_status` 미표기 = fail** 로 "커버리지 공백의 0건 위장" 차단, ID 누락 fail/중복 warn, 출처 메타데이터), designation(학교명·연도·source_url), GeoJSON Point 좌표. 계약 미인식 일반 JSON/CSV 는 `unsupported`(검토 전용)로 승격 차단(1차 리뷰 반영, 4절).
- **불변성**: 반입 파일 SHA-256 을 manifest 에 기록, 읽기 전용 표시(best-effort). `verify` 재해시 대조, 변조 시 verify 코드 2·approve 거부.
- **버전·롤백**: 승인 시 `managed/versions/vNNN/` 복사 + 정렬된 파일해시의 내용해시 기록. `rollback vNNN` 은 현재 내용해시가 승인 시점 해시와 **정확히 일치할 때만** 활성 포인터 변경. 변조된 버전으로의 롤백은 거부됨(테스트 확인).
- **운영 미접촉**: 승인은 `update_center/managed/` 에만 기록. `data_processed/` 에는 어떤 명령도 쓰지 않는다.
- **대시보드**: `update_center/public/dashboard.html` 읽기 전용, 기능 버튼 없음(CLI 명령 안내), 원본 레코드 내용·비밀 미노출(파일명·행수·해시·이슈 요약만), 전 문자열 HTML 이스케이프. "외부 자동 감시 아님, 로컬 파일 검토 MVP" 명시.
- **악성 입력**: 스냅샷 ID `snap_\d{8}T\d{6}_[0-9a-f]{6}`·버전 `v\d{3}` 정규식 검증, 반입 경로는 워크스페이스 루트 내부 한정, 숨김 파일·비허용 확장자·200MB 초과·API 키 의심 문자열(`sk-…`) 반입 거부.

## 3. 실행한 검증 (명령과 실제 결과)

```
node scripts/tests/test_local_review_server_ops20260906.cjs    → 총 42개 검증 통과
node scripts/tests/test_update_center_workflow_ops20260906.cjs → 총 40개 검증 통과
```

서버 42개: 오프라인 초기화 후 `OPENAI_API_KEY === undefined`, api.openai.com fetch 차단, 공개 자산 5경로 200,
차단 16경로(트래버설·인코딩 우회·.env·비공개 코드·비허용 outputs) 전부 404, 메서드 405 3종,
키 없이 Case 전체기준 질문 answerable=true(결정론 경로)·KNN 질문 answerable=true(retrieval 폴백)·오프도메인 차단,
`__status` 불리언만 노출. **전 과정 OpenAI 실호출 0회** (키 삭제 + fetch 가드 이중 보장).

워크플로 40개: 임시 `UPDATE_CENTER_HOME` 에서 stage→diff→reject→approve→rollback 전체 사이클,
백령도 좌표(37.966, 124.63) 통과(섬 배제 bbox 함정 회피), 품질 실패 3유형 검출·승인 차단,
변조 감지(verify/approve 거부)·원복 후 통과, v001/v002 승격, 정확 해시 롤백·변조본 롤백 거부,
악성 ID·워크스페이스 밖 경로·숨김 파일·note 누락 거부, 대시보드 내용 검증.

실데이터 데모(프로덕션 update_center/, 진행 보고서에 스냅샷 ID·해시 기록):
공식 원자료 140건 기준본 → 971건 지오코딩본 diff(+831행) → v001/v002 승인 → v001 롤백·v002 재활성화 →
지정학교 73건 스냅샷 검토 대기. 대시보드가 서버 경유 200 + 내용 확인됨:

```
node -e "…createAppServer…"  → dashboard via server: 200 content-ok no-secret: true
```

## 4. 1차 리뷰 반영 수정 상세 (2026-09-06 2차 커밋분)

`outputs/audit_20260906/operations_review_round1.md` 의 재현된 결함 6건을 전부 수정하고 회귀 테스트를 추가했다.

**review_cli.cjs**
- `revalidateSnapshotContent()` 신설: approve 는 해시 검증 후 **staged 파일 내용으로 analyzeFile 을 재실행**하고
  그 결과(fail/unsupported)면 거부한다. staging/snapshot.json 의 overall_status 는 판정 근거로 쓰지 않으며,
  승인 이력에는 재검사 결과가 `revalidated_on_approve: true` 로 기록된다.
- `verifySnapshotHashes()` 가 manifest 파일 목록 밖의 추가 파일(`unexpected_extra_file`)도 위반으로 검출.
- `cmdDiff()` 는 baseline/candidate 양쪽 무결성 검증을 통과해야 보고서를 생성(보고서에 `integrity_verified` 기록).
- 상태 4단계화(ok/warn/fail/unsupported): null·스칼라 JSON, 레코드/행/feature 0건, 불완전 계약(시설 계열인데 좌표 열
  없음, 지정 계열인데 designation_type 없음)은 fail. 미인식 계약은 unsupported 로 스냅샷은 남되 승인 불가.
- GeoJSON: feature 구조(type=Feature, geometry 키) 검사, geometry=null 은 properties 결측 상태 표기 필수.
- 실계약 추가: 지정학교 `school_year`/`year` 및 `source.url`/`source_url` 병존 지원, `context_layers_manifest.json`
  (레이어별 status 필수), `school_context_summary.json`(count=null + status=available → fail) 계약 검사.

**local_review_server.cjs**
- `resolveStaticFile()` 이 어휘 검사 후 `fs.realpathSync.native` 로 실제 경로를 해석해 프로젝트 루트 포함,
  허용목록, 숨김 세그먼트, 확장자를 **실경로 기준으로 재검사** — junction/symlink 탈출 차단.
- 오프라인 fetch 가드가 비-loopback 차단에 더해 `redirect:"error"` 를 마지막에 강제(호출자 init 으로 무력화 불가),
  `[::1]` 호스트 표기 인정.

**재검증(실행 결과)**
```
node scripts/tests/test_local_review_server_ops20260906.cjs    → 총 49개 검증 통과
node scripts/tests/test_update_center_workflow_ops20260906.cjs → 총 56개 검증 통과
node update_center/review_cli.cjs stage data_processed/context → snap_20260906T023448_51630b, overall ok
  (context_manifest 3레이어 / school_context_summary 272교 / designation 73건 — 실제 builder 산출물 계약 인식)
```
회귀 테스트는 리뷰 fixture 시나리오를 격리 재현한다: manifest 위조 승인 시도, null/스칼라/빈배열/부분CSV/
`features:[{}]`, junction 2종(프로젝트 밖·프로젝트 내 비허용 디렉터리), localhost 302→127.0.0.2 (대상 호출 0회 확인),
변조 스냅샷 diff 차단. 리뷰어의 `operations_fixture_results.json` 은 루트 소유이므로 덮어쓰지 않았고,
루트의 fixture 재실행으로 최종 교차 검증하면 된다.

**리뷰 6번(브라우저 발 호스팅 API 호출)**: 서버 오프라인 모드는 서버 프로세스만 통제한다. index.html/React 가
호스팅 API URL 을 우선 선택하면 브라우저가 직접 호출하므로, 메인 담당의 same-origin 수정 완료가 로컬 무호출
보장의 선행 조건임을 진행 보고서에 통합 요구사항으로 명시했다.

## 6. 최종 컨텍스트 schema_version 2 계약 반영 (2026-09-06 3차)

메인 빌더의 최종 산출물(manifest `schema_version: 2`)에 맞춰 `checkSchoolContextSummary` 를 v2 의미론으로
교체하고 status enum 검사를 추가했다. 레거시 `count` 필드 검사는 실데이터·테스트 어디에서도 더 이상 쓰이지
않아 제거했다(기존 테스트는 v2 픽스처로 이관).

**v2 시설 레이어(observed_count/total_count) 상태별 규칙 — 위반은 전부 fail:**

- `unknown`/`unavailable`: 두 count 모두 null (미수집을 0으로 표기 금지)
- `partial`: observed_count 는 0 이상 정수(하한 관측치 — 0이어도 "완전 0건" 주장 아님), total_count 는 null
- `available`(전수 주장): 두 count 모두 0 이상 정수이고 observed ≤ total
- 공통: `records` 배열이 있으면 길이 = observed_count, status 는 enum(available/partial/unknown/unavailable) 안,
  음수·비정수·문자열 count 거부, `designations` 레이어는 current/historical 배열 계약(시설 count 요구 안 함),
  `gu`/`school_name` 은 문자열 필드로 레이어 검사에서 제외. 알려진 형태가 아닌 레이어 객체는 fail.

**검증 결과(실행):**

```
node scripts/tests/test_update_center_workflow_ops20260906.cjs → 총 64개 검증 통과
  (v2 정상/위반 8종 픽스처 + 실제 data_processed/context 5개 파일 ok 회귀 포함; 서버 코드는 무변경이라 서버 스위트는 재실행 불필요)
node update_center/review_cli.cjs stage data_processed/context --label "schema_version 2 최종 산출물(검토 후보, 미승격)"
  → snap_20260906T024623_21e066, overall ok:
     context_layers_manifest.json  3레이어  (nightlife 1,534건 중 좌표 1,222 / construction 74건 중 좌표 추정 15)
     facilities_nightlife.geojson  1,534 features (geometry=null 312건 모두 coordinate_status 표기 확인)
     facilities_construction.geojson  74 features (geometry=null 59건 상태 표기 확인)
     school_context_summary.json   272교 (nightlife 전교 partial, construction 연수구 34교 partial·나머지 unknown)
     school_designations.json      267건 (요약 기준 지정 이력 보유 학교 102교)
node update_center/review_cli.cjs diff snap_20260906T023448_51630b snap_20260906T024623_21e066
  → v1 대비: GeoJSON 2종 추가, manifest·요약·지정학교 변경(지정학교 73→267건), 무결성 검증 후 보고서 생성
```

v2 후보는 **staging 에만 있으며 승격(approve)하지 않았다** — 운영 반영 판단은 사람 몫이다. `data_processed/` 는
읽기만 했고 무수정이며, 대시보드는 실제 파일 메타데이터(파일명·행수·해시·이슈)로 재생성됐다.

## 7. 경계·한계 (정직 고지)

- 이 서버는 개발자 도구다. 인증·요율제한·TLS 없음 — 127.0.0.1 바인딩이 유일한 접근 통제이며 운영 배포에 쓰면 안 된다.
- update_center 는 로컬 파일 변경 검토 MVP다. 외부 포털 자동 감시·sealed 파이프라인 샌드박스 재분석은 미구현(README 에 동일 고지).
- 계약이 인식되지 않는 일반 JSON/CSV 는 `unsupported`(검토 전용) 상태로 승격이 차단된다. 새 레이어 계약이 생기면 `review_cli.cjs` 의 검사 함수에 스키마를 추가해야 한다.
- `--live` 모드는 이번 세션에서 실행하지 않았고 안전성이 검증된 바 없다. 실제 키·모델 응답·공급자 오류 동작은 키 연결 후 별도 검증해야 한다.
- 다른 에이전트 파일 무수정, 커밋/푸시/배포 없음, `.env` 내용 미열람, 비밀 미출력.
