# pipeline/layers/park/ — 공원 레이어 파이프라인 맵 (설계 초안, 2026-08-04)

이 문서는 `data_processed/`를 생성하는 **실제 스크립트 경로**를 단계별로 나열한 지도다. task-2 리포트(`.superpowers/sdd/code_cleanup_handover/task-2-report.md`) B절에서 `[운영 파이프라인]` 태그가 붙은 스크립트만 대상으로 하며, 경로는 리포 루트 기준 상대경로다. **이 문서는 코드를 옮기지 않는다 — 참조 지도일 뿐이다.**

⚠️ 표시가 붙은 단계는 CONTEXT.md 봉인 섹션(159행 이후)이 반영된 산출물을 다루며, **해당 스크립트를 그대로 재실행하면 실측 검증값이 재계산으로 덮어써질 위험**이 있다. 재실행 전 반드시 사람 승인 필요.

## 0. 파이프라인 개요

```
전처리(preprocess) → 접근성(accessibility) → 예측(forecast) → 분류(classification) → 후보지(candidate) → export
```

## 1단계: 전처리 (preprocess)

| 스크립트 경로 | 입력 | 출력 |
|---|---|---|
| `scripts/preprocess/preprocess_step1_schools.py` | (원본 학교 데이터, `data_raw/`) | `data_processed/schools.csv` |
| `scripts/preprocess/preprocess_step1_redevelopment.py` | (원본 재개발구역 데이터) | `data_processed/redevelopment.csv` |
| `scripts/preprocess/preprocess_step2_childcare.py` | (원본 어린이집 데이터) | `data_processed/childcare_coord_missing.csv`, `data_processed/childcare_michuhol.csv` |
| `scripts/preprocess/preprocess_step2_parks.py`, `preprocess_step3_parks_gu.py` | (원본 공원 데이터) | `parks.csv` 체인의 선행 입력 (⚠️ 최종본은 3단계 참고) |
| `scripts/preprocess/preprocess_step4_grid.py`, `preprocess_step4_final.py`, `preprocess_step4b_grid.py`, `preprocess_step4c_grid_combined.py` | 격자 원본 | `data_processed/grid_shp_attributes_sample.csv`, `incheon_grid_codes.csv`, `incheon_grid_codes_dasa.csv` |
| `scripts/preprocess/preprocess_step5_grid1k.py` | 격자 + 인구 원본 | `data_processed/population_grid_1k.csv`, `age_ratio_incheon.csv` |
| `scripts/preprocess/preprocess_step6_geocoding.py` (+ `preprocess_step6b_retry_kakao.py` [일회성 fix, 결측분 재시도]) | 놀이터 주소 | `data_processed/geocoded_playground.csv` |
| `scripts/preprocess/preprocess_step7_osm_playground.py` | OSM 원본 | 놀이터 보조 데이터 |
| `extract_schools_michuhol.py` | `schools.csv` | `data_processed/schools_michuhol.csv` (미추홀구 시연용 서브셋) |

## 2단계: 접근성 (accessibility)

| 스크립트 경로 | 입력 | 출력 | 비고 |
|---|---|---|---|
| `analysis_step1_osmnx.py` | 인천 보행 도로망(OSM) | 보행망 그래프 (isochrone 단계 입력) | |
| `analysis_step3_isochrone.py` | `schools.csv` + 보행망 | `data_processed/school_isochrone_500m.geojson` | index.html 실사용 |
| `analysis_nearest_park.py` | `parks.csv`(전단계) | `data_processed/parks.csv`, `school_nearest_park.csv` | ⚠️봉인 관련 |
| `analysis_large_apt_kakao.py` | 카카오 지오코딩 결과 | `data_processed/large_apt_complexes_2025.csv`, `has_large_apt_diff.csv` | index.html 실사용. 3형제(`analysis_large_apt.py` → `_exact.py` → `_kakao.py`) 중 최종본, 나머지 2개는 [실험] — 이관 대상 아님 |
| `analysis_redev_isochrone.py`, `analysis_redev_proximity.py` | `redevelopment.csv` + 등시선 | `data_processed/redevelopment_geocoded.csv` | index.html 실사용 |
| `add_functional_park_layer_20260506.py` | `parks.csv`, `school_isochrone_500m.geojson` | `parks_with_function_class.csv`, `school_priority_with_functional_park_layer.csv` | ⚠️봉인 관련(school_green_ratio_display_guardrail 산출값 참조) |
| **`scripts/accessibility/build_green_ratio_display_guardrail_20260506.py`** | ⚠️봉인값(`sealed_nearest_park_dist.json` 계열) | `data_processed/school_green_ratio_display_guardrail_20260506.csv` | **⚠️ 재실행 금지, 봉인값 보호** — 앱 표시용 녹지비율 보수 산정 레이어 |
| **`scripts/accessibility/update_manual_verified_nearest_parks.py`** | 수동검증 80개교 결과 | `school_nearest_park.csv` 갱신 | **[일회성 fix], ⚠️ 재실행 금지, 봉인값 보호 — 최우선 확인 대상**(운영 파이프라인 스텝이 아니라 봉인값 반영용 일회성 보정 스크립트) |
| **`scripts/accessibility/recalc_nearest_park_public_only.py`** | `parks.csv`, `sealed_nearest_park_dist.json` | `school_nearest_park.csv` 재계산 | **[일회성 fix], ⚠️ 재실행 금지, 봉인값 보호**(코드 내 봉인값을 덮어쓰지 않는 로직 포함되어 있으나 원본 재실행은 금지. 운영 파이프라인 스텝이 아니라 봉인값 반영용 일회성 보정 스크립트) |
| `scripts/recommendation/run_valhalla_priority_refresh.py` | `isochrone_valhalla.geojson` | 우선순위 갱신 입력 | ⚠️봉인 관련 |
| `add_nearest_school_to_parks.py` | `parks.csv`, `schools.csv` | `data_processed/parks_with_nearest_school.csv` | 경로가 구경로(`data/processed`) 사용 — 실제 최근 실행 여부 불확실(task-2 불확실 항목 3) |

## 3단계: 예측 (forecast)

| 스크립트 경로 | 입력 | 출력 |
|---|---|---|
| `analysis_ml_models.py` | `parks.csv`, `school_nearest_park.csv`, `population_grid*.csv` | `data_processed/priority_ml.csv`, `lightgbm_case_type_best.pkl`, `shap_summary.png` |
| `build_prophet_cohort_change.py` | 인구 코호트 원본 | `data_processed/gu_cohort_ratios.csv`, `beneficiary_forecast.csv` |
| `export_school_enrollment_forecast_versioned.py` (`analysis/`) | `compare_school_enrollment_models.py`의 모델1 선택 결과 | `data_processed/school_enrollment_forecast_20260418_model1.csv` | index.html 실사용 |
| `analysis/rebuild_candidate_population_demand.py` | 구별 Prophet 총량 + 격자 인구 | `data_processed/candidate_grid_population_alloc_v1.csv/.geojson` | `build_mixed_demand_model.py`의 선행 입력 |

## 4단계: 분류 (classification)

| 스크립트 경로 | 입력 | 출력 | 비고 |
|---|---|---|---|
| `analysis_school_priority.py` | `schools.csv`, `school_nearest_park.csv`, `priority_ml.csv` | `data_processed/school_priority.csv` | ⚠️봉인 관련(실측 case/거리 반영) — 핵심 산출 스크립트 |
| **`apply_case_system_20260411.py`** | `school_priority.csv`, `school_nearest_park.csv` | `school_priority_case_system_20260411.csv`, `school_nearest_park_case_system_20260411.csv` (+ `*_before_case_system.csv` 백업) | **[일회성 fix], ⚠️봉인 관련 — 재실행 금지.** `scripts/classification/` 사본 쪽에 로직이 더 있어(중복 공원 제거 함수) 병합 검토 필요, 삭제·재실행 전 사람 확인 |
| `rebuild_priority_with_redev.py` | `school_priority.csv`, `redevelopment_geocoded.csv` | `school_priority.csv` 갱신 | scripts/ 사본과 완전 동일 파일이라 실행본 불확실(task-2 불확실 항목 2) |
| `apply_public_park_case_rules_20260422.py` | `parks.csv`, `school_nearest_park.csv` | `gu_summary.csv` 등 | |
| `run_school_similarity_v3.py` | `schools.csv`, `student_trend.csv` | `data_processed/school_similar_schools_top5.csv` | index.html 실사용. v1/v2는 `scripts/classification/`에만 존재하는 실험본 — 이관 대상 아님 |

## 5단계: 후보지 생성 (candidate)

| 스크립트 경로 | 입력 | 출력 | 비고 |
|---|---|---|---|
| `analysis/build_candidate_barrier_routes.py` | `schools.csv`, 보행망 그래프 | `data_processed/candidate_barrier_routes_by_school.json` | index.html 실사용. ⚠️봉인 관련 가능성(GRAPH_PATH가 구경로 사용 — 정상 동작 여부 불확실) |
| `count_school_park_path_barriers.py` | 등시선 + 도로망 | barrier 집계 (위 파일의 입력) | |
| `analysis/exclude_school_sites.py` | 후보 격자 + 학교부지 폴리곤 | `data_processed/school_exclusion_log.csv` | |
| **`analysis/build_mixed_demand_model.py`** | `candidate_grid_population_alloc_v1.*`, `school_priority.csv` 등 | **`data_processed/candidate_grid_final.geojson`** | **최종 후보지 파이프라인(2026-04-19 확정), index.html이 실제 fetch하는 파일**. `generate_candidate_grid(.py/_v2.py)`, `predict_grid_demand.py`, XGB 계열은 전부 이 스크립트로 대체된 [실험] 구버전 — 이관 대상 아님 |

## 6단계: export

| 스크립트 경로 | 입력 | 출력 |
|---|---|---|
| `add_robust_xai_recommendation.py` | `candidate_grid_final.geojson`, `lightgbm_case_type_best.pkl` | `data_processed/robust_candidate_recommendations.json`, `robust_shap_candidate_explanations.json` — index.html 실사용 |
| `analysis/generate_statistics_preview_data_safe.py` | `school_priority_with_functional_park_layer.csv`, `student_trend.csv` | 통계 미리보기 데이터 |
| `scripts/export/generate_word_doc.py` | `parks.csv`, `isochrone_valhalla.geojson`, `population_grid.csv` | 보고서 워드 문서 — ⚠️봉인값 참조 |
| `scripts/export/build_submission_package.py` | `data_processed/` 전체 | `submission_package/` |

## 도서관 레이어와의 관계

이 문서의 단계 구조(전처리→접근성→예측→분류→후보지→export)는 공원 레이어 고유의 것이 아니라 `pipeline/core/`로 공통화할 예정인 골격이다. 도서관 레이어 온보딩 시 동일 6단계에 도서관 특화 로직을 채워 넣는 방식을 상정한다 — `pipeline/layers/library/README.md` 참고.
