# Airbyte 수집 계층 연결 — 2026-09-28

## 결론

Airbyte(모두의 AI 실험실 개발지원도구, `https://airbyte00023.aitestbed.kr`, 2026-09-18 연장 승인)를 업데이트 센터의
**② 자료 수집·연결 계층**으로 붙였다. 판단 계층(변경 감지 → 품질검사 → 전후 비교 → 담당자 승인 → 버전 → 롤백)은 바꾸지 않았다.

첫 실증 원천은 9/18 점검 권고대로 **정상 수집기와 겹치지 않는 미연결 원천**이다: 공공데이터포털에 등록된 10개 데이터셋의
카탈로그(schema.org Dataset JSON, `https://www.data.go.kr/catalog/{pk}/fileData.json`). 키 없이 200 OK 이고, 지금까지
`file_head`(HEAD 403·비교 헤더 없음)로 확인 실패하던 착공 3종·LOCALDATA 2종과 `manual` 이던 공원·학교·정비사업의 변경 신호를 준다.

원칙: **동기화 성공 ≠ 자료 최신 ≠ 분석 검증 완료.** Airbyte는 원자료 저장소까지만 쓴다. 카탈로그는 메타데이터라 본문 반영은
없고, 파일은 ② 파일 업로드(수동 후보) → 품질검사 → 승인을 그대로 거친다.

## Airbyte 쪽 (실험실 인스턴스, 2026-09-28 완료 항목)

| 항목 | 상태 |
|---|---|
| 커넥터 | Connector Builder 에 `airbyte/source-datagokr-catalog.yaml` 을 YAML 가져오기 → 테스트(연수구 착공 카탈로그 1건 반환) → **조직에 게시**. 이름 `공공데이터포털 카탈로그 (data.go.kr DCAT)` |
| Source | `DATA ROCK · 공공데이터포털 카탈로그 10종` — pk 10개(15029299, 15029300, 15038929, 15045018, 15045017, 15013109, 15040972, 15012890, 15021148, 15055212), `catalog_kind=fileData`. 연결 테스트 통과 |
| Destination | Postgres (앱 운영 DB의 별도 스키마 `airbyte_raw`) — **운영 DB 접속정보 확보 후 생성** |
| Connection | 매일 1회, Full refresh · Append (커서 없음 → 회차별 append, 앱은 pk 별 최신 1건만 읽음) — 위와 함께 |

커넥터는 `portal_pks`(배열)·`catalog_kind`(fileData/standard/openapi)를 사용자 입력으로 받으므로 원천을 늘릴 때 코드가 아니라
Source 설정만 바꾼다.

## 앱 쪽 (park-railway-deploy)

| 파일 | 변경 |
|---|---|
| `scripts/update_center/airbyte_raw.mjs` | 신규. 원자료 저장소 읽기(최종 테이블 → 없으면 `airbyte_internal` raw 테이블 폴백, 컬럼 대소문자 정규화), `summarizeAirbyteRaw()`, `checkAirbyteCatalog()` |
| `scripts/update_center/scan.mjs` | `check.type: airbyte_catalog` 분기 추가 |
| `scripts/update_center/pipeline.mjs` | 같은 원인의 실패(예: `spawn python ENOENT`)는 red 이벤트를 반복 생성하지 않음. Python 없음은 "확인 보류"로 문구 구분 |
| `scripts/update_center/coverage.mjs` | 자동화 범위 `airbyte_catalog_signal` + 설명 |
| `api/update-center.js` | `GET /sources` 에 `airbyte_catalog`(pk·최신 카탈로그)·`airbyte` 요약, 신규 `GET /airbyte`, 관측 신호 승인 거부 문구 |
| `update-center.html` | 머리말(수집은 기계, 반영은 사람), ⑨ Airbyte 수집 계층 패널, 소스 표의 카탈로그 수정일 표시, 상태 칩(확인 불가·판단 보류 / Airbyte 카탈로그 확인·원자료 미검증) |
| `data_sources.yaml` | 8개 원천 `airbyte_catalog` 전환(parks·schools·redevelopment·nightlife×2·construction×3), libraries·school_library 에 보조 신호 블록 |
| `scripts/tests/test_update_center_airbyte.cjs` | 회귀 9종(skipped/baseline/unchanged/yellow/stale/raw 정규화/API/승인 차단/pipeline 중복 차단). `npm run test:update-center` 에 포함 |

### check.type airbyte_catalog 의 상태 규칙

| 상황 | 결과 |
|---|---|
| `AIRBYTE_RAW_DATABASE_URL`/`DATABASE_URL` 없음 | `skipped` — 확인 불가·판단 보류. 이벤트 없음 |
| 저장소에 해당 pk 행 없음(첫 동기화 전) | `skipped` |
| 첫 카탈로그 | `baseline` (감사 기록) |
| 수정일·버전명·형식·URL·갱신주기 동일 | `unchanged` |
| 위 항목 변경 | `yellow` content 이벤트, `action_required=manual_file_upload`, `observation_only=true` → 승인 409 |
| 마지막 수집이 `AIRBYTE_RAW_MAX_AGE_HOURS`(기본 72) 초과 | `stale` yellow 1회(중복 생성 없음) |
| 저장소 읽기 실패 | 상태 `error` + 감사 1회, red 이벤트 없음(수집 계층 장애 ≠ 자료 문제) |

### 환경변수 (Railway Variables)

- `AIRBYTE_RAW_DATABASE_URL` (없으면 `DATABASE_URL`) — Airbyte destination 이 쓰는 DB
- `AIRBYTE_RAW_SCHEMA` 기본 `airbyte_raw`, `AIRBYTE_RAW_STREAM` 기본 `datagokr_catalog`
- `AIRBYTE_RAW_MAX_AGE_HOURS` 기본 72
- 테스트용 `AIRBYTE_RAW_FILE` (JSON 배열) — 운영에서는 설정하지 않는다

## 남은 한계 (정직하게)

- 카탈로그는 메타데이터다. 파일 본문이 바뀌었는데 포털 카탈로그 수정일이 그대로면 감지하지 못한다. 반대로 카탈로그만 갱신되는 경우도 있다.
- 표준데이터(공원·학교·도서관)의 카탈로그는 전국 통합 항목이라 `alternateName` 이 다른 지자체 이름으로 바뀔 수 있다. 인천 부분만의 변경을 뜻하지 않는다.
- Airbyte 가 원천 접근 권한을 대신하지 않는다. 인증키 API·봇 게이트 원천은 별도 활용신청·공식 API 전환이 필요하다.
- 운영 배포 환경(Railpack node)에 Python 이 없어 `refresh_pipeline` 3종은 여전히 자동 수집 불가다. 이번 수정은 그 실패가 12시간마다 red 이벤트로 쌓이는 것을 막고 사유를 "Python 없음·확인 보류"로 드러낸 것이지, 수집을 복구한 것이 아니다. 복구는 배포 이미지에 Python·requirements 포함이 필요하다.
- 운영 DB 한 계정을 Airbyte destination 과 앱이 공유한다(스키마만 분리). 별도 쓰기 전용 계정은 후속 과제다.
