# 활동규모 공원 접근성 보조 레이어 테스트 결과

작성일: 2026-05-06

## 실행한 명령어

| 명령어 | 결과 |
|---|---|
| `python scripts\accessibility\add_functional_park_layer_20260506.py` | 성공 |
| `npm.cmd run build` (`ui-preview`) | 성공 |
| `Import-Csv data_processed\school_priority_with_functional_park_layer.csv` 검증 | 성공 |
| `Import-Csv data_processed\parks_with_function_class.csv` 검증 | 성공 |
| `rg` 금지 표현 점검 | 금지 표현 목록·원자료 컬럼명 예외 외 UI/발표 문구 정리 완료 |
| `node -e` 루트 `index.html` inline script parse | 성공 |
| `git diff --check` | 성공 |

## 변경 파일 목록

- `index.html`
- `ui-preview/src/LandingPage.tsx`
- `ui-preview/src/SchoolDetailReportPagePreview.tsx`
- `ui-preview/src/SimulationPage.tsx`
- `ui-preview/src/schoolDataBridge.ts`
- `ui-preview/src/schoolDataMapper.ts`
- `ui-preview/src/schoolDataMapperSafe.ts`
- `ui-preview/src/previewData.ts`
- `ui-preview/src/statisticsPreviewDataSafe.ts`
- `ui-preview/dist/index.html`
- `ui-preview/dist/assets/index-Bmemh2Ey.css`
- `ui-preview/dist/assets/index-mWRnKlzV.js`
- `docs/PROJECT_SUMMARY_FOR_PRESENTATION_20260504.md`
- `CONTEXT.md`
- `scripts/accessibility/add_functional_park_layer_20260506.py`
- `scripts/accessibility/count_school_park_path_barriers.py`
- `scripts/candidate_generation/build_candidate_barrier_routes.py`
- `scripts/classification/apply_case_system_20260411.py`
- `scripts/classification/fix_walk_green_ratio_intersection_20260504.py`
- `scripts/classification/reclassify_case_public_only.py`
- `scripts/export/generate_word_doc.py`

## 새로 생성된 파일 목록

- `data_processed/parks_with_function_class.csv`
- `data_processed/school_priority_with_functional_park_layer.csv`
- `data_processed/ai_recommendation_before_after_functional_layer.csv`
- `data_quality/park_area_outliers_review.csv`
- `reports/functional_park_layer_column_mapping.md`
- `reports/functional_park_layer_validation.md`
- `reports/walking_barrier_logic_validation.md`
- `reports/road_barrier_terminology_review.md`
- `reports/ai_recommendation_before_after_functional_layer.md`
- `reports/functional_park_layer_test_result.md`

## UI 반영 여부

- 운영 루트 앱은 `data_processed/school_priority_with_functional_park_layer.csv`의 활동규모 공원 컬럼과 보행부담 컬럼을 읽는다.
- 표지 제목은 `반경 너머,` / `도달 가능성으로` 의미 단위 줄바꿈으로 고정했고 큰 제목 크기를 낮췄다.
- 학교 상세 리포트의 상단 최근접 공원·녹지 카드에는 요약 수치와 한 줄 해석만 남겼다.
- 최근접 공식 공원명, 공원 유형, 면적, 규모 기준, 활동규모 공원 거리, 보행부담 등급, 간선도로 횡단, 대형 교차로 여부는 `공식 공원과 활동규모 공원` 카드로 분리했다.
- `barrier_with_functional` 필터는 새 보행부담 컬럼을 사용해 활성화했다.

## 검증 요약

- `park_function_class` 개수: playground_like 434, small_child_park 254, mid_activity_park 154, neighborhood_park_scale 251
- `access_condition_type` 학교 수: nominal_access_only 102, near_park_low_green_imbalance 70, no_official_park 41, functional_access_available 35, functional_access_with_barrier 24
- 이상치 검수 대상: 138건
- 인천주안초등학교 검증: 승기어린이공원 64.8m, 8,785.3㎡, 보행 부담 낮음, `no_official_park_flag=False`, `access_condition_type=near_park_low_green_imbalance`
- 기존 Case 변경 여부: 변경 없음
- 기존 최근접 공원 거리 변경 여부: 변경 없음
- 기존 녹지비율 변경 여부: 변경 없음

## 남은 TODO

- 면적 이상치 138건은 자동 수정하지 않았으므로, 발표 대표 사례에 쓰는 공원은 현장·지도 검수를 권장한다.
- 사고위험 지점은 보유 원자료 기준의 경로 인접 추정값이므로, 공식 안전 진단처럼 단정하지 않는다.
