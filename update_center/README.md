# update_center/ — 신규 컨텍스트 산출물 로컬 검토 워크플로 (MVP, 2026-09-06)

2026-08-04 설계 스텁("감지 → 사람 승인 → 샌드박스 → 전후 비교 → 승인 시 반영")의 **사람 승인·전후 비교·버전 기록** 구간을
로컬 파일 기준으로 실제 구현한 것이다. 범위는 **신규 컨텍스트 레이어 산출물(JSON/CSV/GeoJSON)** 이며,
봉인된 레거시 파이프라인(data_processed/ 의 sealed 데이터 재계산·자동 반영)은 이 MVP의 범위 밖이다.

**이것이 아닌 것(정직한 한계):**

- 외부 공공데이터 포털을 자동 감시(폴링)하지 않는다. 로컬에 내려받은 파일의 변경 검토 MVP다.
- 승인해도 `data_processed/` 운영 데이터에는 아무것도 쓰지 않는다. 승인 산출물은 `update_center/managed/` 에만 기록된다
  (스테이징 전용 — 운영 반영은 사람이 별도로 수행).
- 품질검사는 알려진 계약에 대한 구조·좌표·출처 메타데이터 검증이며, 값의 사실 여부를 검증하지 않는다.

## 워크플로 명령

모두 프로젝트 루트(`2026-park-analysis/`)에서 실행한다. Node 내장 모듈만 사용(의존성 없음).

```bash
# 1) 후보 반입 + 품질검사 (파일 또는 디렉터리, .json/.csv/.geojson 만)
node update_center/review_cli.cjs stage <경로> [--as 저장이름.csv] [--label "설명"]
#    --as : 파일명이 달라도 같은 논리 산출물로 비교하려면 표준 이름으로 저장 (단일 파일 반입 시)

# 2) 무결성 재검증 (반입 이후 변경 여부, SHA-256 대조)
node update_center/review_cli.cjs verify <snapshot_id>

# 3) 전후 비교 — 리뷰 리포트 JSON 저장 + 대시보드 갱신
node update_center/review_cli.cjs diff <baseline_id> <candidate_id>

# 4) 결정 (승인은 품질 fail 이면 차단, 무결성 불일치여도 차단)
node update_center/review_cli.cjs approve <snapshot_id> --note "승인 메모"
node update_center/review_cli.cjs reject  <snapshot_id> --note "반려 사유"

# 5) 롤백 — 해당 버전의 현재 내용 해시가 승인 시점 해시와 정확히 일치할 때만 활성 버전 변경
node update_center/review_cli.cjs rollback v001

# 조회
node update_center/review_cli.cjs list
node update_center/review_cli.cjs dashboard   # public/dashboard.html 재생성 (읽기 전용)
```

## 디렉터리 구조

```
update_center/
├── review_cli.cjs        # 워크플로 CLI (이 문서의 모든 명령)
├── staging/<snap_id>/    # 반입 스냅샷: files/ + snapshot.json(파일별 SHA-256, 행수, 품질 이슈)
├── reviews/              # diff_*.json 리뷰 리포트, decisions.jsonl 결정 로그
├── managed/
│   ├── versions/vNNN/    # 승인된 버전(스냅샷 복사본 + 내용 해시)
│   └── state.json        # 활성 버전 포인터 + 승인/롤백 이력
└── public/dashboard.html # 읽기 전용 HTML 대시보드 (로컬 검토 서버에서 /update_center/public/ 로 서빙)
```

대시보드는 상태 표시 전용이다. 기능 버튼이 없고 위의 CLI 명령을 안내한다. 원본 레코드 내용·비밀값은 싣지 않는다
(파일명·행수·해시·품질 이슈 요약만).

## 품질검사 규칙 (2026-09-06, 1차 리뷰 반영판)

파일 상태는 `ok / warn / fail / unsupported` 4단계다. **fail 과 unsupported 는 승인(approve) 불가**이며,
`unsupported` 는 "검사를 통과한 것"이 아니라 알려진 계약에 해당하지 않는 **검토 전용** 상태다.
승인 시점에는 staging 의 snapshot.json(수정 가능한 메타데이터)을 신뢰하지 않고 **파일 내용으로 품질검사를 재실행**해
그 결과로만 판정한다. diff 도 양쪽 스냅샷의 해시·파일 셋 무결성 검증을 통과해야 보고서를 만든다.

| 대상 | 감지 조건 | 검사 |
|---|---|---|
| 공통 | 모든 반입 | UTF-8/BOM 처리, JSON/CSV 파싱, 빈 파일·**행/레코드 0건 fail**(실제 0건인지 수집 실패인지 구분 불가 — 커버리지 증빙 없이 승격 금지), null·스칼라 JSON fail, API 키 의심 문자열 fail, 200MB 상한 |
| 시설 계약 | `latitude`+`longitude`+(`source_record_id` 또는 `facility_name`) 열 | ID 누락 fail·중복 warn, 좌표는 한반도 광역 범위(위 33~39.6, 경 124~132.5 — **도서지역 포함**), **좌표 없음인데 `coordinate_status`/`geocode_status` 미표기면 fail**, `source_url`/`retrieved_at` 누락 warn. ID/이름 열만 있고 좌표 열이 없으면 **불완전 계약 fail**(generic 우회 금지) |
| 지정학교 계약 | `school_name`+`designation_type` | 학교명 fail, 연도 `school_year` 또는 `year`(2000~2100) fail, 출처 `source_url`(평면 CSV) 또는 `source.url`(파이프라인 JSON) 누락 fail. `designation_type` 없는 지정학교 계열은 불완전 계약 fail |
| 컨텍스트 manifest | `data_as_of`+`layers` 객체 | 각 레이어의 `status` 필수 + enum(available/partial/unknown/unavailable) 검사 — `data_processed/context/context_layers_manifest.json` 실계약(schema_version 2) |
| 학교 컨텍스트 요약 | `data_as_of`+`schools` 객체 | v2 의미론: `unknown`/`unavailable` 은 observed/total_count 모두 null(미수집 0건 위장 금지), `partial` 은 observed_count 0 이상 정수 + total_count null(하한 관측치 — 0이어도 전수 0건 아님), `available` 은 두 count 모두 정수·observed≤total. `records` 배열 길이 = observed_count, status enum 검사, `designations` 레이어는 current/historical 배열 계약(count 불요), `gu`·`school_name` 은 문자열 필드 — `school_context_summary.json` 실계약(schema_version 2) |
| GeoJSON | FeatureCollection | feature 구조(type=Feature, geometry 키) 필수 — `{}` 같은 비정형 feature fail, geometry=null 은 properties 의 좌표 결측 상태 표기 필수, Point 좌표 범위 검사, feature 0건 fail |

실측 검증: 메인 파이프라인 최종 산출물 5종(`data_processed/context/`, schema_version 2)을 stage 하면
context_manifest(3레이어)·GeoJSON 2종(유흥 1,534 features·공사 74 features, geometry=null 은 상태 표기 확인)·
school_context_summary(272교)·designation(267건) 계약으로 인식되고 ok 로 통과한다.

## 안전 규칙

- 반입 입력은 워크스페이스 루트(`공공데이터공모전/`) 안의 경로만 허용, 숨김·비밀 파일(`.env` 등) 거부.
- 스냅샷 ID/버전명은 정규식 검증(경로 탈출 차단). 반입 파일은 읽기 전용 표시(best-effort) + SHA-256 대조.
- 테스트 격리: 환경변수 `UPDATE_CENTER_HOME` 로 작업 디렉터리를 바꿀 수 있다.

## 로컬 검토 서버 (scripts/local_review_server.cjs)

키 없이 앱과 AI 해설 폴백을 로컬에서 확인하는 개발자 도구다. 운영 인증/배포 용도가 아니다.

```bash
node scripts/local_review_server.cjs              # http://127.0.0.1:8899 (오프라인 강제)
node scripts/local_review_server.cjs --port 8080  # 포트 지정
node scripts/local_review_server.cjs --live       # (선택) 기존 핸들러의 자체 환경 설정 유지 — 키가 있으면 실호출 발생 가능
```

- **기본은 오프라인 강제**: 기존 `api/ai-explainer-v2.js` 는 require 시점에 상위 `.env` 를 자동 로딩하지만,
  래퍼가 require 전에 통제된 더미 키를 넣어 이 로딩을 차단하고 require 직후 키를 삭제한다.
  → 요청은 핸들러의 기존 retrieval 폴백(근거 chunk 요약)으로 응답하며 **OpenAI 실호출이 발생하지 않는다.**
  추가로 오프라인 모드에서는 localhost 외부로 나가는 `fetch` 를 프로세스 차원에서 차단한다.
  (`AI_EXPLAINER_ENABLED=false` 는 503 "비활성화"만 반환해 데모에 쓸모없음을 확인하고 채택하지 않았다.)
- **정적 서빙 허용목록**: `/index.html`, `/logo.png`, `/assets/`, `/data_processed/`, `/ui-preview/dist/`,
  `/outputs/robust_xai/`, `/update_center/public/`. 그 외(스크립트·pipeline·reports·`.env`·경로 탈출)는 전부 404.
  어휘적 검사에 더해 **realpath 를 해석**해 허용 디렉터리 안의 symlink/junction 이 프로젝트 밖·허용목록 밖
  파일을 노출하는 것도 차단한다. 오프라인 fetch 가드는 **리다이렉트를 따르지 않아**(redirect:error 강제)
  localhost 302 를 통한 목적지 우회도 막는다.
- `GET /__status` 는 모드와 키 존재 여부(불리언)만 보여준다. 키 값은 어떤 경로로도 로그·응답에 남지 않는다.
- API 는 `POST /api/ai-explainer-v2` 만 허용(그 외 메서드 405). 127.0.0.1 전용 바인딩.

## 테스트

```bash
node scripts/tests/test_local_review_server_ops20260906.cjs      # 서버: 차단/서빙/오프라인 폴백/junction/리다이렉트 (49 검증)
node scripts/tests/test_update_center_workflow_ops20260906.cjs   # 워크플로: 전체 사이클 + 리뷰 회귀 + schema v2 (64 검증)
```

워크플로 테스트는 임시 디렉터리에서 stage→diff→reject→approve→rollback 전체 사이클, 품질 실패의 승인 차단,
스냅샷 불변성(변조 감지), 정확한 해시 일치 롤백, 악성 경로 처리, 대시보드의 비밀·원본내용 미노출까지 검증한다.

## 2026-08-04 설계 스텁과의 관계

원래 5단계 설계(감시→품질검사→샌드박스 재분석→전후 비교→버전 기록/승인) 중 이번 MVP가 구현한 것은
품질검사(신규 컨텍스트 계약 한정)·전후 비교·버전 기록/승인/롤백이다. 원본 자동 감시와 sealed 파이프라인의
샌드박스 재분석은 여전히 미구현이며, `pipeline/registry/data_registry.yaml` 연동도 후속 과제로 남는다.
