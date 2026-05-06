# 기능성 공원 접근성 보조 레이어 테스트 결과

작성일: 2026-05-06

## 실행한 명령어

| 명령어 | 결과 |
|---|---|
| `python scripts\accessibility\add_functional_park_layer_20260506.py` | 성공 |
| `npm.cmd run build` (`ui-preview`) | 성공 |
| `Invoke-WebRequest http://127.0.0.1:8000` | 200 |
| `Invoke-WebRequest http://127.0.0.1:8000/data_processed/school_priority_with_functional_park_layer.csv` | 200 |
| `Invoke-WebRequest http://127.0.0.1:8000/ui-preview/dist/index.html` | 200 |

## 변경 파일 목록

- `index.html`
- `ui-preview/index.html`
- `ui-preview/src/LandingPage.tsx`
- `ui-preview/src/SchoolDetailReportPagePreview.tsx`
- `ui-preview/src/schoolDataBridge.ts`
- `ui-preview/dist/index.html`
- `ui-preview/dist/assets/index-Bs1O6BGx.css`
- `ui-preview/dist/assets/index-D10f40n8.js`
- `docs/PROJECT_SUMMARY_FOR_PRESENTATION_20260504.md`
- `CONTEXT.md`
- `scripts/accessibility/add_functional_park_layer_20260506.py`

## 새로 생성된 파일 목록

- `data_processed/parks_with_function_class.csv`
- `data_processed/school_priority_with_functional_park_layer.csv`
- `data_processed/ai_recommendation_before_after_functional_layer.csv`
- `data_quality/park_area_outliers_review.csv`
- `reports/functional_park_layer_column_mapping.md`
- `reports/functional_park_layer_validation.md`
- `reports/ai_recommendation_before_after_functional_layer.md`
- `reports/functional_park_layer_test_result.md`

## UI 반영 여부

- 운영 루트 앱은 `data_processed/school_priority_with_functional_park_layer.csv`를 읽도록 변경했다.
- 메인 제목과 부제를 루트 앱, iframe 앱, 발표 요약 문서, CONTEXT에 반영했다.
- 학교 상세 패널과 상세 리포트에 기존 시설 접근성 유형, 최근접 공식 공원 면적 등급, 활동 가능 공원 거리 표시를 추가했다.
- 접근성 결핍 유형 필터를 루트 지도 필터바에 추가했다.
- `barrier_level` 컬럼이 없어 보행부담 동반 필터는 비활성화했다.

## 검증 요약

- `park_function_class` 개수: playground_like 434, small_child_park 254, mid_activity_park 154, neighborhood_park_scale 251
- `access_condition_type` 학교 수: no_official_park 129, nominal_access_only 77, functional_access_available 66
- 이상치 검수 대상: 138건
- 기존 Case 변경 여부: 변경 없음
- 기존 최근접 공원 거리 변경 여부: 변경 없음
- 기존 녹지비율 변경 여부: 변경 없음

## 남은 TODO

- `barrier_level`이 학교-기존 공원 경로 기준으로 별도 산출되면 `functional_access_with_barrier`와 보행부담 필터를 활성화할 수 있다.
- 면적 이상치 138건은 자동 수정하지 않았으므로, 정책 발표 전 대표 사례에 쓰는 공원은 현장·지도 검수를 권장한다.
