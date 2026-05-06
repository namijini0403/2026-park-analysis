# 도로·보행부담 용어 통일 검토

작성일: 2026-05-06

## 검색한 키워드

- 고속화도로
- 자동차 전용
- 자동차전용도로
- 간선
- 단절
- 위험
- 접근 불가
- 이용 불가
- 횡단
- 도로

## 수정한 파일

- `docs/PROJECT_SUMMARY_FOR_PRESENTATION_20260504.md`
- `CONTEXT.md`
- `docs/PPT_DATA_PACK_20260505.md`
- `docs/final_app_architecture_data_flow_20260420.md`
- `docs/final_app_architecture_data_flow_20260420.html`
- `docs/final_app_architecture_data_flow_20260420_word_compatible.doc`
- `index.html`
- `ui-preview/src/LandingPage.tsx`
- `ui-preview/src/SchoolDetailReportPagePreview.tsx`
- `ui-preview/src/SimulationPage.tsx`
- `ui-preview/src/schoolDataBridge.ts`
- `ui-preview/src/schoolDataMapper.ts`
- `ui-preview/src/schoolDataMapperSafe.ts`
- `ui-preview/src/previewData.ts`
- `ui-preview/src/statisticsPreviewDataSafe.ts`
- `scripts/candidate_generation/build_candidate_barrier_routes.py`
- `scripts/accessibility/count_school_park_path_barriers.py`
- `scripts/accessibility/add_functional_park_layer_20260506.py`
- `scripts/classification/apply_case_system_20260411.py`
- `scripts/classification/fix_walk_green_ratio_intersection_20260504.py`
- `scripts/classification/reclassify_case_public_only.py`
- `scripts/export/generate_word_doc.py`
- `scripts/README.md`

## 주요 before/after

| before | after |
|---|---|
| 공원 접근 불가 | 공원 접근 결핍 |
| 도로 단절 | 간선도로 횡단 부담 |
| 단절요소 | 보행부담 요소 |
| 후보지-학교 경로 단절요소 | 후보지-학교 경로 보행부담 요소 |
| 도시 대로 횡단 | 주요 도시 간선도로 횡단 |
| 중간급 도로 횡단 | 중간급 간선도로 횡단 |
| 자동차 전용 간선/고속화도로 포함 | 주요 도시 간선도로 부담 큼 |
| 사고다발지역 | 사고위험 지점 |
| 큰 도로 횡단 없음 | 생활도로 중심 |

## 금지 표현 잔존 점검

`rg` 기준으로 UI 문구, 발표 요약, 후보지 설명, 상세 리포트 문구에서는 금지 표현을 제거했다.

남아 있는 예외:

- `docs/PROJECT_SUMMARY_FOR_PRESENTATION_20260504.md`와 `CONTEXT.md`의 "금지 표현" 섹션 안에 금지어 자체가 목록으로 등장한다. 이는 사용자 요청에 따라 문서화한 예외다.
- `scripts/accessibility/add_functional_park_layer_20260506.py`의 `사고다발지역...` 문자열은 원자료 CSV 컬럼명이다. 출력 UI 문구는 `사고위험 지점`으로 변환한다.

## 슬라이드 문맥 점검

- p6: 결핍·측정 의심 설명에서 도로 관련 표현은 `보행부담`, `접근 품질 저하`, `간선도로 횡단 부담`으로 정리했다.
- p7: isochrone vs 반경 비교 문맥은 `직선 반경`과 `실제 도보생활권`의 차이를 중심으로 유지하고, 물리적 접근 불가능 단정 표현을 제거했다.
- p10: case별 지도·후보지 분포 설명에서 `단절요소`를 `보행부담 요소`로 교체했다.
- p15: HITL/XAI 후보지 필터 설명에서 `도시 대로`, `중간급 도로`를 각각 `주요 도시 간선도로`, `중간급 간선도로`로 교체했다.

## UI 문구 점검

- 학교 상세 리포트: 최근접 공원 상세 카드를 `가장 가까운 공원의 이용 조건`으로 분리하고, 경로 특성은 `보행 부담`, `간선도로 횡단`, `대형 교차로 인접`, `사고위험 지점`으로 표시한다.
- 시뮬레이션 필터: `주요 도시 간선도로`, `중간급 간선도로`, `지구 내 간선도로`, `사고위험 지점` 기준으로 표시한다.
- 루트 지도 상세 패널: 기존 시설 접근성 문구를 `가장 가까운 공원의 이용 조건`과 보행부담 요약으로 바꾸었다.

## 문서 반영 여부

- `docs/PROJECT_SUMMARY_FOR_PRESENTATION_20260504.md`: `도로·보행부담 용어 통일 기준` 섹션 반영 완료.
- `CONTEXT.md`: `도로·보행부담 용어 통일 기준` 섹션 반영 완료.

## 최종 판단

금지 표현은 실제 UI·발표 본문 문장에서는 제거했고, 남은 항목은 금지어 목록 자체 또는 원자료 컬럼명 예외다. 보행 경로 관련 해석은 "접근 불가"가 아니라 "접근 품질 저하 / 보행부담"으로 통일했다.
