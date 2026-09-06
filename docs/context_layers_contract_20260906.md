# 학교 맥락 레이어 데이터 계약 v2 (2026-09-06)

학교 지정·지원 프로그램(연구·선도, AI중점, 디지털튜터, 교육복지우선지원, 다문화교육)과
학교 주변 시설 맥락(유흥·단란주점 인허가, 공사장 행정기록)을 운영 앱에 "참고 맥락 정보"로
제공하는 계약입니다.
v1 대비: 실데이터 통합, 독립 검토(outputs/audit_20260906/context_review_round1.md) 결함 수정 반영.
v2.1(2026-09-06 확장): 지정 명단 3종→6종, 공사기록 연수구→연수·계양·미추홀구,
좌표 미확보 레코드의 Kakao Local API 주소 지오코딩 보강 — 아래 §좌표 출처 구분 참조.

핵심 원칙:

1. **맥락 정보이지 판정이 아님.** 자동 안전 등급·지원 자격·법령 위반 판정에 사용하지 않는다.
   학교환경위생정화구역(50m/200m) 등 법정 경계 판단을 학교 중심점 직선거리로 대신하지 않는다.
2. **미수집·미관측 ≠ 0건.** 좌표 부분 확보 레이어의 학교별 수치는 `observed_count`(하한 관측치)이고
   `total_count`는 항상 null. 미수집 구·미수집 레이어·좌표 미상 학교는 `status:"unknown"` + null.
3. **출처 없는 사실 금지.** 레코드에 출처 URL(http/https만)·발행일·수집일. 지정 사실만으로
   예산을 추론하지 않음(`financial_support_amount`는 원문에 금액이 명시된 명단에서만 값을 가짐).
   LOCALDATA 스냅샷 기준일은 독립 확인 전 null 유지(수집일과 구분).
4. **기존 데이터 불변.** 신규 산출물은 `data_processed/context/` 아래에만 생성.
5. **직선거리 ≠ 도보 경로.** WGS84 하버사인, 반경 500m 경계 포함(<=).
5-1. **추정 좌표 ≠ 실측 좌표.** 지오코딩·주소기반 추정 좌표는 `coordinate_status`/`coordinate_source`로
   원천 좌표와 구분해 보존하고, 현장 실측 좌표라고 표기하지 않는다. 번지 없는 주소에
   법정동 중심점 같은 저해상도 좌표를 부여하지 않는다(미해결로 남긴다).
6. **기간 추정 명시.** 지정 명단은 학년도만 확인됨 → `period_basis:"school_year_only"`,
   시작·종료일 null, 상태(current/expired/upcoming)는 학년도(3/1~익년 2월 말) 추정임을 표시.
7. **결정론.** 시계·난수 미사용, JSON 키 정렬, 동일 입력 → 바이트 동일 출력.
   날짜는 실존 달력일만 수용(2026-02-31 등 거절), `--as-of`도 검증.
8. **좌표 유효 범위는 광역.** lat 36.0~39.0 / lng 124.0~128.0 (백령·대청·연평 포함,
   실제 272개교 좌표 전수 포함을 테스트로 고정). 도시 bbox로 도서를 거절하지 않는다.

## 입력 (`data/context_sources/`, 자체 포함 사본 — 상세는 그 폴더 README)

| 어댑터 | 입력 | 실측 규모 |
|---|---|---|
| designations | school_designations_2026 / school_ai_focus_2026 / school_digital_tutor_2025 / school_edu_welfare_2026 / school_edu_welfare_2025 / school_multicultural_2026 (.csv) | 804건 (초등 매칭 176교, unmatched 0) |
| nightlife | incheon_nightlife_geocoded.csv | 1,534건 영업/정상, 좌표 1,532건(원천 1,222 + Kakao 310), 미해결 2건 |
| construction | construction_geocoded_exact / _yeonsu_kakao / _gyeyang / _michuhol (.csv) | 연수 74 · 계양 1,684 · 미추홀 1,971 = 3,729건, 좌표 3,521건 |

지정 명단 원문(xlsx/hwpx)은 `data/context_sources/raw/` 에 해시와 함께 보관하고
`raw/designation_raw_manifest.json` 이 url·제목·발행일·수집일·sha256을 남긴다.
확보·파싱하지 못한 사업은 `data/context_sources/designation_sources_backlog.md` 에만 남기고
산출물에는 **반영하지 않는다**(추측 명단 생성 금지).

### 좌표 출처 구분 (`coordinate_status`)

| 값 | 의미 |
|---|---|
| `official_coordinate` | 원천(LOCALDATA) 좌표. EPSG:5174 → EPSG:4326 변환 |
| `estimated_from_exact_parcel_address` | 소상공인 상가주소 동일 지번 정확일치 기반 추정(연수구 15건) |
| `geocoded_kakao_road` | Kakao Local API 도로명 주소 매칭 추정 |
| `geocoded_kakao_jibun` | Kakao Local API 지번 주소 매칭 추정(공사기록은 본번·부번·산 여부까지 정확 일치 시에만) |
| `geocoded_kakao_keyword` | Kakao Local API 장소 키워드 매칭 추정(같은 구 + 같은 법정동/도로명 확인 시에만) |
| `unresolved` | 좌표 미확보. 공간 집계에서 제외하며 **0건이 아님** |

`coordinate_source`는 `kakao_local_api:<mode>` 형식으로 어떤 질의가 좌표를 만들었는지 남긴다.
지오코딩 수용 규칙(인천 한정·구 일치·후보 산포 100m 이하 등)은 운영 가이드에 정리.

## 산출물 (`data_processed/context/`)

### 1. `context_layers_manifest.json` (schema_version 2)

`layers` 키: `school_designations`, `nightlife_permits`, `construction_records`.
공통 필드: `status`(`available`|`partial`|`unavailable`), `status_label_ko`, `sources[]`.
- `nightlife_permits`: `record_count` 1534, `active_record_count` 1534, `located_record_count` 1532,
  `unlocated_record_count` 2, `coverage_regions:["인천광역시 전역(인허가 관할 기준)"]`,
  `coordinate_provenance`(coordinate_status별 건수), `coordinate_note_ko`(원천 좌표 vs 지오코딩 추정),
  하한 관측치 안내(`coverage_note_ko`), `source_as_of_note_ko`(스냅샷 기준일 미확인).
- `construction_records`: `coverage_regions`(현재 `["계양구","미추홀구","연수구"]`)와
  `coverage_by_gu`(구별 `record_count`/`located_record_count`)는 **상수가 아니라 레코드 주소에서 파생**한다.
  좌표 확보 레코드가 1건 이상인 구만 승격하며, 레코드가 있어도 좌표가 0인 구는 unknown으로 남긴다.
  `record_scope_ko`(착공처리일 또는 사용승인일이 있는 행정기록만 포함), `coverage_basis_ko`(학교 주소 구 기준),
  좌표는 행정 주소 기반 추정(`coordinate_note_ko`), 사용승인 완료 기록은 현재 공사 위험 아님(`usage_note_ko`).
- `school_designations`: `programs_covered` 6종, `period_note_ko`(학년도 추정), `record_count` 804,
  `matched_elementary_count` 176.

레이어 승격 규칙: 시설 레이어는 **유효 좌표 레코드가 1건 이상**일 때만 partial.
빈 파일·전부 좌표 결측이면 unavailable, 학교별 노드는 unknown/null.
지정 레이어는 입력 파일이 실제 로딩된 경우에만 available; 아니면 학교별 designations.status="unknown".

### 2. `school_designations.json` — 지정 레코드 267건

필드: `designation_id`(결정론 slug), `school_name/level`, `designation_type`, `program_name`,
`school_year`, `period_basis:"school_year_only"`, `designation_start_date/end_date: null`,
`period_status`(current|expired|upcoming|unknown — 학년도 추정), `financial_support_amount`(원문 명시만),
`verification_status`, `source{url(http/https만)|title|published_date|retrieved_at|source_file}`,
`match{school_id, matching_status}`(matched_exact|unmatched|ambiguous|out_of_scope_level).
별칭은 무모호 확인 후 명시 등록만(현재 1건: 중산초등학교→인천중산초등학교).
행정구역 별칭도 명시 등록만(현재 1건: 남구→미추홀구, 2018-07-01 개칭. 착공신고 원자료의 옛 표기 대응).

### 3. `school_context_summary.json` — 272개 초등학교 전부 키 존재

```json
"B000003024": {
  "school_name": "...", "gu": "부평구",
  "designations": { "status": "available", "current": [...], "historical": [...], "scope_note_ko": "..." },
  "nightlife": {
    "status": "partial", "total_count": null, "observed_count": 3,
    "nearest_observed_m": 210.4, "records": [{"facility_id": "...", "distance_m": 210.4}],
    "within_m": 500, "distance_basis_ko": "직선거리 기준 (도보 경로 아님)",
    "label_ko": "좌표 확보 레코드 기준 최소 관측치 (좌표 미확보 레코드 제외)"
  },
  "construction": { "status": "unknown", "observed_count": null, "total_count": null,
                    "label_ko": "해당 구 자료 미수집 (연수구만 수집)" }
}
```

- `designations.current`에는 current/upcoming, `historical`에는 expired (2025 디지털튜터 등).
- construction은 `coverage_regions`에 속한 구(현재 연수·계양·미추홀)의 학교만 partial
  + `observed_completed_count`(사용승인 완료 기록 수) 포함. 500m 반경은 구 경계를 넘어 계산하므로
  인접 수집 구의 기록도 포함될 수 있다(더 정확한 하한 관측치).
- 학교 좌표 미상 → 시설 노드 `status:"unknown"`, `observed_count:null`.

### 4. `facilities_nightlife.geojson`(1,534) / `facilities_construction.geojson`(3,729)

WGS84 Point, 좌표 미확보 레코드는 geometry:null로 보존. properties에 원천 ID·상태·날짜·
coordinate_status/source·출처 URL(정화 후) 유지. 공사 레코드는 permit/start/approval_date,
`use_approved`, `construction_status`(행정기록임을 명시) 보존.

## 검증 기준선

공간조인은 빌더를 import 하지 않는 독립 재계산(`scripts/context/verify_context_baseline.py`,
자체 거리식: 단위구 3D 현 → 대원거리)으로 학교별 관측 수·record ID·거리를 전수 대조한다.
현재 기준선(전수 일치 확인됨):

| 레이어 | 관측 학교 | 학교-시설 조합 | 최대 | 비고 |
|---|---|---|---|---|
| nightlife | 111 | 1,459 | 163 | 좌표 1,532건 사용 |
| construction | 65 | 2,449 | 130 | 사용승인 완료 조합 2,183 |

회귀 테스트 `tests/test_context_layers.py::RealBuildOutputTestCase`가 이 대조와 수치를 고정한다.
(구 기준선 `outputs/audit_20260906/nightlife_independent_baseline.json`은 좌표 보강 이전 스냅샷이라
대조 대상에서 제외했다. 기준선 갱신은 반드시 독립 재계산 일치 확인 후에만 한다.)

## QA (`data_quality/context_layers_qa_20260906.json`)

레이어별 input_rows/records/located/unlocated, invalid_coordinates, invalid_dates,
unknown_status, duplicates_collapsed, unmatched/ambiguous/out_of_scope 지정,
unsafe_urls_dropped, missing_input_files.

## 프런트엔드 계약

- 요약·manifest는 초기 렌더 비블로킹 지연 로딩, 시설 geojson은 토글/리포트 최초 요구 시 로딩.
  실패 시 다른 기능 영향 없이 "불러오지 못했습니다" 표시.
- 지도 토글: `designation`(배지), `nightlife`(#EC4899 마커), `construction`(#94A3B8 마커) + 범례.
- 학교 카드: 지정 1줄(추정·범위 안내) + 시설 2줄(하한값·행정기록 문구), unknown은 "자료 수집 전(0건 의미 아님)".
- 공사 레이어의 지역 커버리지는 UI 라벨에 하드코딩하지 않고 manifest `coverage_regions`/`coverage_by_gu`로 전달한다.
  (현행 토글 라벨 "🚧 공사장 행정기록"은 지역 무관 문구이며, 미수집 구 학교 카드가 unknown 문구를 그대로 표시한다.)
- 브리지: `row._contextLayers = { load_status, data_as_of, usage_note_ko, manifest_layers,
  school_summary, designation_records, facility_details(거리순 상위 30 + truncated_count) }`.
- 링크는 http/https URL만 렌더(빌더+UI 이중 방어). React 텍스트는 JSX 자동 이스케이프.
- OpenAI 키 불필요: 전 섹션 결정론 렌더링. loopback(localhost/127.0.0.1/[::1])에서는
  AI explainer가 same-origin 엔드포인트만 사용(원격 호스팅 API 폴백 금지).
