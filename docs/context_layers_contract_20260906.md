# 학교 맥락 레이어 데이터 계약 v2 (2026-09-06)

학교 지정·지원 프로그램(연구·선도, AI중점, 디지털튜터)과 학교 주변 시설 맥락
(유흥·단란주점 인허가, 공사장 행정기록)을 운영 앱에 "참고 맥락 정보"로 제공하는 계약입니다.
v1 대비: 실데이터 통합, 독립 검토(outputs/audit_20260906/context_review_round1.md) 결함 수정 반영.

핵심 원칙:

1. **맥락 정보이지 판정이 아님.** 자동 안전 등급·지원 자격·법령 위반 판정에 사용하지 않는다.
   학교환경위생정화구역(50m/200m) 등 법정 경계 판단을 학교 중심점 직선거리로 대신하지 않는다.
2. **미수집·미관측 ≠ 0건.** 좌표 부분 확보 레이어의 학교별 수치는 `observed_count`(하한 관측치)이고
   `total_count`는 항상 null. 미수집 구·미수집 레이어·좌표 미상 학교는 `status:"unknown"` + null.
3. **출처 없는 사실 금지.** 레코드에 출처 URL(http/https만)·발행일·수집일. 지정 사실만으로
   예산을 추론하지 않음. LOCALDATA 스냅샷 기준일은 독립 확인 전 null 유지(수집일과 구분).
4. **기존 데이터 불변.** 신규 산출물은 `data_processed/context/` 아래에만 생성.
5. **직선거리 ≠ 도보 경로.** WGS84 하버사인, 반경 500m 경계 포함(<=).
6. **기간 추정 명시.** 지정 명단은 학년도만 확인됨 → `period_basis:"school_year_only"`,
   시작·종료일 null, 상태(current/expired/upcoming)는 학년도(3/1~익년 2월 말) 추정임을 표시.
7. **결정론.** 시계·난수 미사용, JSON 키 정렬, 동일 입력 → 바이트 동일 출력.
   날짜는 실존 달력일만 수용(2026-02-31 등 거절), `--as-of`도 검증.
8. **좌표 유효 범위는 광역.** lat 36.0~39.0 / lng 124.0~128.0 (백령·대청·연평 포함,
   실제 272개교 좌표 전수 포함을 테스트로 고정). 도시 bbox로 도서를 거절하지 않는다.

## 입력 (`data/context_sources/`, 자체 포함 사본 — 상세는 그 폴더 README)

| 어댑터 | 입력 | 실측 규모 |
|---|---|---|
| designations | school_designations_2026 / school_ai_focus_2026 / school_digital_tutor_2025 (.csv) | 267건 (초등 매칭 102교) |
| nightlife | incheon_nightlife_geocoded.csv | 1,534건 영업/정상, 좌표 1,222건 |
| construction | construction_geocoded_exact.csv + construction_yeonsu_exact_unmatched.csv | 연수구 74건, 좌표 추정 15건 |

## 산출물 (`data_processed/context/`)

### 1. `context_layers_manifest.json` (schema_version 2)

`layers` 키: `school_designations`, `nightlife_permits`, `construction_records`.
공통 필드: `status`(`available`|`partial`|`unavailable`), `status_label_ko`, `sources[]`.
- `nightlife_permits`: `record_count` 1534, `active_record_count` 1534, `located_record_count` 1222,
  `unlocated_record_count` 312, `coverage_regions:["인천광역시 전역(인허가 관할 기준)"]`,
  하한 관측치 안내(`coverage_note_ko`), `source_as_of_note_ko`(스냅샷 기준일 미확인).
- `construction_records`: `coverage_regions:["연수구"]`, `coverage_basis_ko`(학교 주소 구 기준),
  좌표는 상가 주소 기반 추정(`coordinate_note_ko`), 사용승인 완료 기록은 현재 공사 위험 아님(`usage_note_ko`).
- `school_designations`: `programs_covered` 3종, `period_note_ko`(학년도 추정), `record_count` 267,
  `matched_elementary_count` 102.

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
- construction은 연수구 학교만 partial + `observed_completed_count`(사용승인 완료 기록 수) 포함.
- 학교 좌표 미상 → 시설 노드 `status:"unknown"`, `observed_count:null`.

### 4. `facilities_nightlife.geojson`(1,534) / `facilities_construction.geojson`(74)

WGS84 Point, 좌표 미확보 레코드는 geometry:null로 보존. properties에 원천 ID·상태·날짜·
coordinate_status/source·출처 URL(정화 후) 유지. 공사 레코드는 permit/start/approval_date,
`use_approved`, `construction_status`(행정기록임을 명시) 보존.

## 검증 기준선

유흥·단란주점 공간조인은 독립 구현(outputs/audit_20260906/independent_nightlife_baseline.py)과
전 학교 관측 수·record ID·거리 일치 확인: 관측 학교 89개, 학교-시설 조합 1,237, 최대 163.
회귀 테스트 `tests/test_context_layers.py::RealBuildOutputTestCase`가 이 대조를 고정.

## QA (`data_quality/context_layers_qa_20260906.json`)

레이어별 input_rows/records/located/unlocated, invalid_coordinates, invalid_dates,
unknown_status, duplicates_collapsed, unmatched/ambiguous/out_of_scope 지정,
unsafe_urls_dropped, missing_input_files.

## 프런트엔드 계약

- 요약·manifest는 초기 렌더 비블로킹 지연 로딩, 시설 geojson은 토글/리포트 최초 요구 시 로딩.
  실패 시 다른 기능 영향 없이 "불러오지 못했습니다" 표시.
- 지도 토글: `designation`(배지), `nightlife`(#EC4899 마커), `construction`(#94A3B8 마커) + 범례.
- 학교 카드: 지정 1줄(추정·범위 안내) + 시설 2줄(하한값·행정기록 문구), unknown은 "자료 수집 전(0건 의미 아님)".
- 브리지: `row._contextLayers = { load_status, data_as_of, usage_note_ko, manifest_layers,
  school_summary, designation_records, facility_details(거리순 상위 30 + truncated_count) }`.
- 링크는 http/https URL만 렌더(빌더+UI 이중 방어). React 텍스트는 JSX 자동 이스케이프.
- OpenAI 키 불필요: 전 섹션 결정론 렌더링. loopback(localhost/127.0.0.1/[::1])에서는
  AI explainer가 same-origin 엔드포인트만 사용(원격 호스팅 API 폴백 금지).
