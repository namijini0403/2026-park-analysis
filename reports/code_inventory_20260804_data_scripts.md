# Task 2 리포트: 데이터·파이썬 스크립트 인벤토리 (읽기 전용 조사)

조사 대상: `2026-park-analysis` 리포지토리 전체. 어떤 파일도 수정·삭제·이동하지 않았음.
사전 필독: `CONTEXT.md`(1926줄, 전체 정독), `OPERATING_PATHS.md`(전체 정독) 완료.

---

## 0. 가장 중요한 발견 (요약)

**`scripts/` 하위 트리는 대부분 `analysis/` 및 루트 `*.py`의 "구버전 사본"이며, 현재 운영 경로(`data_processed/`, `data_raw/`)가 아니라 `OPERATING_PATHS.md`가 명시적으로 "사용하지 않는 경로"로 규정한 `data/processed/`, `data/raw/`를 가리킨다.**

- 루트/`analysis/`의 동명 스크립트와 `scripts/**/` 동명 스크립트를 diff한 결과, 두 판본은 거의 동일한 로직이지만 경로 상수만 다르다 (`data_processed` ↔ `data/processed`).
- 리포 안에 실제 `data/processed/` 디렉터리는 존재하지 않는다 (`data/`에는 `app_examples/`만 있음). 즉 `scripts/**/` 쪽 사본을 그대로 실행하면 존재하지 않는 경로를 읽으려다 실패한다.
- `scripts/` 전체 99개 `.py` 중 52개가 이 구경로(`data/processed`, `data/raw`)를 사용한다. 나머지 약 47개(주로 2026-04-19 이후 추가된 감사/검증/차트 스크립트, 그리고 `scripts/accessibility`, `scripts/classification`, `scripts/export`, `scripts/preprocess`의 일부)는 애초부터 `scripts/` 안에서만 존재했고 현재 경로(`data_processed`)를 정상적으로 사용한다.
- 결론: **`scripts/` 트리는 통째로 "예전에 폴더 구조를 정리하려다 중단된 흔적"으로 보이며, 그 안에서도 신뢰도가 파일마다 다르다.** 정리 작업 시 "scripts/니까 최신"이라고 가정하면 안 되고, 반드시 루트/`analysis/` 쪽 동명 파일과의 diff 결과를 봐야 한다.
- 예상 밖 발견 2: `OPERATING_PATHS.md`의 고정 PATHS 목록(13개)은 실제 `index.html`이 참조하는 `data_processed/` 파일의 부분집합에 불과하다. `index.html`은 그 외에도 `candidate_grid_final.geojson`, `gu_summary.csv`(포함됨), `robust_candidate_recommendations.json`, `school_priority_with_functional_park_layer.csv` 등 여러 파일을 추가로 로딩한다. `OPERATING_PATHS.md`를 "운영 경로의 전체 목록"으로 오인하면 정리 시 실제 사용 중인 파일을 실수로 정리 대상에 넣을 위험이 있다.

---

## A. 데이터 파일 역추적 표 (`data_processed/`, 72개 파일)

열 설명: `OPERATING_PATHS` = `OPERATING_PATHS.md`의 고정 PATHS 목록(13개) 포함 여부. `생성 스크립트` = 리포 전체 `*.py`에서 파일명 문자열 검색 결과(파일을 **읽기만** 하는 스크립트도 포함되므로 "생성"이 아니라 "참조"에 가까움, 표 아래 주석 참고). `앱 참조` = `index.html` / `ui-preview/src` / `api/` 전체에서 파일명 검색 결과. `ui-preview/src`와 `api/`는 전수 검색했으나 데이터 파일명을 직접 참조하는 곳이 없었다(학교 상세 리포트는 `index.html`이 localStorage 브릿지로 값을 넘겨주는 구조이기 때문, CONTEXT.md 2026-04-17 절 참조). 따라서 앱 참조가 있는 파일은 전부 `index.html`이다.

⚠️봉인 = 봉인된 실측값(CONTEXT.md 159행 이후 섹션)이 반영되는 파일.

| 파일 | OPERATING_PATHS | 생성/참조 스크립트(요약) | 앱 참조 |
|---|---|---|---|
| age_ratio_incheon.csv | no | build_mixed_demand_model.py(×2), preprocess_step5_grid1k.py | - |
| ai_recommendation_before_after_functional_layer.csv | no | add_functional_park_layer_20260506.py | - |
| beneficiary_forecast.csv | no | generate_candidate_grid(_v2).py, generate_statistics_preview_data.py, analysis_ml_models.py, run_beneficiary_models_v2.py, run_model2_*.py, build_prophet_cohort_change.py, validate_track2_child_demand.py | - |
| beneficiary_forecast_v3.csv | no | export_school_enrollment_forecast_versioned.py, run_model2_feature_boost_v3.py, validate_track2_child_demand.py | - |
| blocked_parks_by_apt_adjustment_20260504.csv | no | add_functional_park_layer_20260506.py, build_apartment_permeability_walk_adjustment_20260504.py | - |
| **candidate_barrier_routes_by_school.json** | **YES** | analysis/build_candidate_barrier_routes.py (+ scripts/ 구사본) | **index.html** |
| candidate_grid_final.csv | no | build_mixed_demand_model.py, add_functional_park_layer_20260506.py, validate_track2_child_demand.py | - |
| **candidate_grid_final.geojson** | no (OPERATING_PATHS 목록엔 없지만 실제 운영 파일) | build_candidate_barrier_routes.py, build_mixed_demand_model.py, exclude_school_sites.py, add_robust_xai_recommendation.py | **index.html** (`fetch("./data_processed/candidate_grid_final.geojson")`, 5477행) |
| candidate_grid_final_v2.csv | no | generate_candidate_grid_v2.py | - |
| candidate_grid_final_v3.geojson | no | (생성 스크립트 매치 없음 — 불확실, 아래 C절 참고) | - |
| candidate_grid_final_v4.geojson | no | generate_candidate_grid_v2.py | - |
| candidate_grid_final_v5.geojson | no | generate_candidate_grid_v2.py, predict_grid_demand.py | - |
| candidate_grid_population_alloc_v1.csv/.geojson | no | rebuild_candidate_population_demand.py, build_mixed_demand_model.py, validate_track2_child_demand.py | - |
| candidate_grid_raw_v2.geojson | no | generate_candidate_grid.py | - |
| candidate_grid_raw_v3.geojson | no | generate_candidate_grid_v2.py | - |
| candidate_grid_xgb.csv/.geojson | no | (매치 없음 — 불확실) | - |
| candidate_grid_xgb_v2.csv/.geojson | no | enrich_candidate_grid.py(geojson만) | - |
| candidate_grid_xgb_v3.csv/.geojson | no | build_mixed_demand_model.py(geojson만) | - |
| candidate_grid_xgb_v4.csv/.geojson | no | predict_grid_demand.py, rebuild_candidate_population_demand.py, fix/refresh_candidate_simulation_metrics.py | - |
| childcare_coord_missing.csv | no | preprocess_step2_childcare.py | - |
| **childcare_michuhol.csv** | **YES** | preprocess_step2_childcare.py | **index.html** |
| geocoded_playground.csv | no | enrich_candidate_grid.py, preprocess_step6_geocoding.py 계열 | - |
| grid_1km_cohort_pred.csv / grid_1km_final_pred.csv / grid_1km_prophet_alloc.csv / grid_250m_pred.csv | no | build_mixed_demand_model.py, validate_track2_child_demand.py | - |
| grid_shp_attributes_sample.csv | no | preprocess_step4_grid.py | - |
| gu_cohort_ratios.csv | no | build_mixed_demand_model.py | - |
| **gu_summary.csv** | **YES** | analysis_ml_models.py, apply_public_park_case_rules_20260422.py, fix_walk_green_ratio_intersection_20260504.py | **index.html** |
| has_large_apt_diff.csv | no | analysis_large_apt_exact.py, analysis_large_apt_kakao.py, fix_has_large_apt_500m.py, run_school_similarity_v2.py | - |
| incheon_grid_codes(_dasa).csv | no | preprocess_step4*.py 계열 | - |
| incheon_residential_osm.geojson | no | build_apartment_permeability_walk_adjustment_20260504.py, generate_word_doc.py, make_apartment_permeability_isochrone_compare.py | - |
| **isochrone_valhalla.geojson** | **YES** ⚠️봉인(도보경로 보행부담 근거) | rebuild_priority_with_redev.py, recalc_park_playground_counts_valhalla.py, analysis_isochrone_valhalla.py, build_green_ratio_display_guardrail_20260506.py, reclassify_case_public_only.py, generate_word_doc.py | **index.html** |
| kindergartens.csv | no | (매치 없음 — 불확실) | - |
| **large_apt_complexes_2025.csv** | **YES** | analysis_large_apt_exact/kakao.py, fix_has_large_apt_500m.py, run_school_similarity_v3.py, audit_knn_k_choice.py, enrich_candidate_grid.py | **index.html** |
| lightgbm_case_type_best.pkl | no | analysis_ml_models.py | - |
| osm_school_polygons_incheon.geojson | no | exclude_school_sites.py, make_apartment_permeability_isochrone_compare.py | - |
| **parks.csv** | **YES** ⚠️봉인(석남도시숲/석곶체육공원 등 실측 근접공원 반영) | 매우 다수(약 30개 스크립트) — 핵심: analysis_nearest_park.py, apply_case_system_20260411.py, recalc_nearest_park_public_only.py, preprocess_step2/3_parks*.py | **index.html** |
| parks_with_function_class.csv | no | add_functional_park_layer_20260506.py, export_park_area_exclusion_reclassification.py | - |
| parks_with_nearest_school.csv | no | add_functional_park_layer_20260506.py, add_nearest_school_to_parks.py | - |
| population_grid.csv / population_grid_1k.csv | no | build_mixed_demand_model.py, rebuild_candidate_population_demand.py, preprocess_step4/5*.py, analysis_ml_models.py, analysis_school_priority.py 등 | - |
| priority_ml.csv | no | analysis_ml_models.py | - |
| redevelopment.csv | no | rebuild_priority_with_redev.py, analysis_redev_isochrone/proximity.py, preprocess_step1_redevelopment.py | - |
| **redevelopment_geocoded.csv** | **YES** | build_mixed_demand_model.py, analysis_redev_isochrone/proximity.py | **index.html** |
| **robust_candidate_recommendations.json** | no (OPERATING_PATHS 목록 밖이지만 앱이 실사용) | add_robust_xai_recommendation.py | **index.html** |
| robust_shap_candidate_explanations.json | no | add_robust_xai_recommendation.py | - |
| **school_buffer_500m.geojson** | **YES** | analysis_school_priority.py, recalc_park_playground_counts_valhalla.py, add_functional_park_layer_20260506.py, analysis_step1_osmnx.py 등 | **index.html** |
| **school_enrollment_forecast_20260418_model1.csv** | **YES** | export_school_enrollment_forecast_versioned.py, generate_statistics_preview_data_safe.py, fix/refresh_candidate_simulation_metrics.py | **index.html** |
| school_exclusion_log.csv | no | exclude_school_sites.py | - |
| school_green_ratio_display_guardrail_20260506.csv | no ⚠️봉인(표시용 녹지비율에 봉인 검증값 반영, CONTEXT 95행) | add_functional_park_layer_20260506.py, build_green_ratio_display_guardrail_20260506.py | - |
| school_isochrone_500m.geojson | no | 매우 다수 — analysis_step3_isochrone.py가 원본 생성, 이후 다수 스크립트가 읽음 | **index.html** |
| school_isochrone_500m_apt_adjusted_20260504.geojson | no | build_apartment_permeability_walk_adjustment_20260504.py, build_green_ratio_display_guardrail_20260506.py | - |
| **school_nearest_park.csv** | **YES** ⚠️봉인 | analysis_nearest_park.py, apply_case_system_20260411.py, recalc_nearest_park_public_only.py, update_manual_verified_nearest_parks.py | **index.html** |
| school_nearest_park_20260411_before_case_system.csv | no | apply_case_system_20260411.py (자체 생성한 백업본) | - |
| school_nearest_park_case_system_20260411.csv | no | apply_case_system_20260411.py | - |
| **school_priority.csv** | **YES** ⚠️봉인(실측 case/거리 반영) | 매우 다수(40개 이상) — 핵심: analysis_school_priority.py, apply_case_system_20260411.py, rebuild_priority_with_redev.py | **index.html** |
| school_priority_20260411_before_case_system.csv | no | apply_case_system_20260411.py(백업본) | - |
| school_priority_case_system_20260411.csv | no | apply_case_system_20260411.py가 생성, 이후 여러 스크립트가 입력으로 사용(예: generate_candidate_grid*.py) | - |
| school_priority_with_functional_park_layer.csv | no (OPERATING_PATHS 밖이지만 앱이 실사용) ⚠️봉인 | add_functional_park_layer_20260506.py, apply_physical_barrier_tag_20260526.py 등 | **index.html** |
| **school_similar_schools_top5.csv** | **YES** | run_school_similarity_v3.py (v1/v2는 실험, 아래 B절) | **index.html** |
| school_walk_500m_apartment_adjustment_20260504.csv | no | build_apartment_permeability_walk_adjustment_20260504.py | - |
| **schools.csv** | **YES** | preprocess_step1_schools.py가 원본 생성, 이후 매우 다수가 읽음 | **index.html** |
| schools_michuhol.csv | no | extract_schools_michuhol.py, michuhol_vulnerable_green_correlation_20260422.py | - |
| shap_summary.png | no | analysis_ml_models.py, add_robust_xai_recommendation.py | - |
| **student_trend.csv** | **YES** | compare_school_enrollment_models.py, run_school_similarity_v3.py, incheon_student_green_correlation_20260424.py | **index.html** |

**주의**: "생성 스크립트" 열은 파일명 문자열 grep 결과이므로 실제 쓰기(write)와 읽기(read)를 구분하지 않았다. 여러 스크립트가 동일 파일을 참조하는 것은 대부분 "A가 생성 → B,C,D가 입력으로 읽음" 체인이다. 정확한 생성 스크립트 1개를 특정하려면 각 스크립트 본문에서 `to_csv`/`to_file` 대상 여부를 봐야 하며, 이번 조사에서는 시간 관계상 일부 핵심 파일(A표에 굵게 표시한 OPERATING_PATHS 대상)만 본문까지 확인했다.

---

## B. 파이썬 스크립트 분류

### B-0. 핵심 구조: 루트/`analysis/` vs `scripts/**` 중복 쌍

다음 16개 루트 스크립트와 10개 `analysis/` 스크립트는 전부 `scripts/**` 안에 동명 사본을 갖고 있다. diff 결과 로직은 거의 동일하고 경로 상수만 다르다.

| 루트/analysis 원본 | scripts/ 사본 | 사본의 경로 상수 |
|---|---|---|
| analysis_clustering.py | scripts/classification/analysis_clustering.py | `data/processed` (구경로) |
| analysis_large_apt.py | scripts/accessibility/analysis_large_apt.py | `data/processed`, `data/raw` |
| analysis_large_apt_exact.py | scripts/accessibility/analysis_large_apt_exact.py | `data/processed`, `data/raw` |
| analysis_large_apt_kakao.py | scripts/accessibility/analysis_large_apt_kakao.py | `data/processed` |
| analysis_ml_models.py | scripts/classification/analysis_ml_models.py | `data/processed`, `data/raw` |
| analysis_nearest_park.py | scripts/accessibility/analysis_nearest_park.py | `data/processed` |
| analysis_school_priority.py | scripts/recommendation/analysis_school_priority.py | `data/processed`(대부분 동일, 세부 확인 필요) |
| analysis_step3_isochrone.py | scripts/accessibility/analysis_step3_isochrone.py | 절대경로 하드코딩 차이 |
| apply_case_system_20260411.py | scripts/classification/apply_case_system_20260411.py | `data/processed`, `data/raw` **+ scripts 사본에 `deduplicate_public_parks()` 함수가 추가로 더 있음(63줄 분량)** |
| compare_school_enrollment_models.py | scripts/forecasting/compare_school_enrollment_models.py | `data/processed` |
| fix_has_large_apt_500m.py | scripts/accessibility/fix_has_large_apt_500m.py | `data/processed` |
| rebuild_priority_with_redev.py | scripts/recommendation/rebuild_priority_with_redev.py | **완전히 동일(diff 없음)** |
| recalc_nearest_park_public_only.py | scripts/accessibility/recalc_nearest_park_public_only.py | `data/processed` |
| recalc_park_playground_counts_valhalla.py | scripts/accessibility/recalc_park_playground_counts_valhalla.py | `data/processed` |
| run_school_similarity_v3.py | scripts/classification/run_school_similarity_v3.py | `data/processed` |
| update_playground_mirage.py | scripts/accessibility/update_playground_mirage.py | `data/processed` |
| analysis/build_candidate_barrier_routes.py | scripts/candidate_generation/build_candidate_barrier_routes.py | `data/processed` |
| analysis/build_mixed_demand_model.py | scripts/candidate_generation/build_mixed_demand_model.py | `data/processed`, `data/raw` |
| analysis/exclude_school_sites.py | scripts/candidate_generation/exclude_school_sites.py | `data_processed/` 문자열 리터럴 차이 |
| analysis/export_school_enrollment_forecast_versioned.py | scripts/export/export_school_enrollment_forecast_versioned.py | `data/processed` |
| analysis/generate_candidate_grid.py | scripts/candidate_generation/generate_candidate_grid.py | `data/processed` |
| analysis/generate_candidate_grid_v2.py | scripts/candidate_generation/generate_candidate_grid_v2.py | `data/processed` |
| analysis/generate_statistics_preview_data.py | scripts/export/generate_statistics_preview_data.py | `data/processed` |
| analysis/generate_statistics_preview_data_safe.py | scripts/export/generate_statistics_preview_data_safe.py | diff 없음 또는 미미(재확인 필요 — 불확실) |
| analysis/predict_grid_demand.py | scripts/candidate_generation/predict_grid_demand.py | `data/processed` |
| analysis/rebuild_candidate_population_demand.py | scripts/candidate_generation/rebuild_candidate_population_demand.py | `data/processed`, `data/raw` |

**해석**: `rebuild_priority_with_redev.py`만 완전히 동일 파일이라 어느 쪽이 실제 실행되는지 구분 불가(불확실). 나머지는 전부 루트/`analysis/` 쪽이 현재 `OPERATING_PATHS.md` 기준 경로와 일치하므로 **실질적 운영판**으로 판단한다. `apply_case_system_20260411.py`는 특이하게 `scripts/` 사본 쪽에 로직이 더 많다(중복 공원 제거 함수 추가) — 이는 "scripts/ 사본이 완전히 죽은 코드는 아니고, 한때 개선 작업이 scripts/ 쪽에서 이루어지다가 경로 전환이 안 된 채 버려졌을 가능성"을 시사한다. 정리 시 이 파일은 로직 병합 검토가 필요할 수 있음(삭제 전 반드시 사람 확인).

### B-1. 태깅 원칙
브리프 지시대로 CONTEXT.md에 명시적으로 언급된 스크립트는 우선 그 언급 문맥의 분류를 따랐다(예: `apply_case_system_*.py`, `update_playground_mirage.py`는 브리프 자체가 예시로 든 [일회성 fix]).

### B-2. 루트 `*.py` (16개)

| 파일 | 태그 | 근거 |
|---|---|---|
| analysis_clustering.py | [실험] | CONTEXT 2026-04-08: "k-means 클러스터링은 최종 운영 흐름에서 제거... 파일명은 유지하지만 현재는 행정착시 플래그 갱신용" — 원래 목적(클러스터링) 폐기, 부분 재활용 |
| analysis_large_apt.py | [실험] | 3형제 중 초기 draft. CONTEXT 2026-04-08: "좌표 확보 119개만 반영" 단계. `_exact`/`_kakao`에 의해 대체됨 |
| analysis_large_apt_exact.py | [실험] | 3형제 중 중간판(정밀 거리 계산). `has_large_apt_diff.csv` 생성 체인의 중간 단계 |
| analysis_large_apt_kakao.py | [운영 파이프라인] | CONTEXT 2026-04-08 업데이트: "536개 전수 카카오 지오코딩 완료, 150개교 확인" — 3형제 중 최종본. `large_apt_complexes_2025.csv`(OPERATING_PATHS 등재) 생성 체인의 핵심 |
| analysis_ml_models.py | [운영 파이프라인] | `lightgbm_case_type_best.pkl`, `priority_ml.csv` 생성. CONTEXT AI모델 구조 섹션과 일치 |
| analysis_nearest_park.py | [운영 파이프라인] | `parks.csv`/`school_nearest_park.csv` 최근접 공원 계산 원본 |
| analysis_school_priority.py | [운영 파이프라인] | `school_priority.csv` 핵심 산출 스크립트 |
| analysis_step3_isochrone.py | [운영 파이프라인] | Phase2 "학교별 실제 도보 500m 등시선 생성" 단계, `school_isochrone_500m.geojson` 원본 생성 |
| apply_case_system_20260411.py | [일회성 fix] | 브리프가 명시적으로 예시로 든 파일. 날짜 고정 스크립트, `_20260411_before_case_system.csv` 백업 파일을 남기는 전형적 1회성 마이그레이션 패턴 |
| compare_school_enrollment_models.py | [실험] | 모델1(가중추세+LightGBM잔차) vs 모델2(ElasticNet) 비교. CONTEXT 2026-04-18 섹션에 전체 실험 기록. 결과는 `output/school_enrollment_model_comparison.*`에 저장, 최종 반영은 별도 export 스크립트가 수행 |
| fix_has_large_apt_500m.py | [일회성 fix] | `fix_` 접두. 반경 500m 판정 재보정, `has_large_apt_diff.csv`(before/after 비교) 생성 패턴 |
| rebuild_priority_with_redev.py | [운영 파이프라인] (⚠️ scripts/ 사본과 완전 동일 파일이라 어느 쪽 실행본인지 불확실) | 재개발 변수(`redevelopment_geocoded.csv`) 반영해 `school_priority.csv` 갱신 |
| recalc_nearest_park_public_only.py | [일회성 fix] ⚠️봉인 | `recalc_` 접두(브리프 예시 패턴), 코드 내 `sealed_nearest_park_dist.json` 참조 확인 — 공공공원만 기준으로 최근접 거리 재계산하며 봉인값은 덮어쓰지 않는 로직 포함 |
| recalc_park_playground_counts_valhalla.py | [일회성 fix] | `recalc_` 접두, Valhalla 등시선 기준 공원/놀이터 카운트 재계산 |
| run_school_similarity_v3.py | [운영 파이프라인] | `school_similar_schools_top5.csv`(OPERATING_PATHS 등재) 생성. v1/v2는 `scripts/classification/`에만 존재하는 실험본(아래 B-3 참고) |
| update_playground_mirage.py | [일회성 fix] | 브리프가 명시적으로 예시로 든 파일. "playground mirage(놀이터 착시)" 수치 보정 1회성 스크립트 |

### B-3. `analysis/` (10개)

| 파일 | 태그 | 근거 |
|---|---|---|
| build_candidate_barrier_routes.py | [운영 파이프라인] ⚠️봉인 관련 가능성 | `candidate_barrier_routes_by_school.json`(OPERATING_PATHS 등재, index.html 사용) 생성. 단 `GRAPH_PATH`만 `data/processed` 구경로를 쓰고 있어(다른 경로는 정상) 그래프 파일 로딩 부분이 실제 동작하는지는 불확실 |
| build_mixed_demand_model.py | [운영 파이프라인] | CONTEXT "수혜인구 예측 모델 — 혼합모델 최종 고정 버전(2026-04-19 확정)" Step A~G 전체를 구현. `candidate_grid_final.geojson`(index.html이 실제로 fetch하는 후보지 파일) 생성 — **가장 최신·최종 후보지 파이프라인** |
| exclude_school_sites.py | [운영 파이프라인] | 학교부지와 겹치는 후보지 제외, `school_exclusion_log.csv` 생성 |
| export_school_enrollment_forecast_versioned.py | [운영 파이프라인] | `school_enrollment_forecast_20260418_model1.csv`(OPERATING_PATHS 등재) 생성 — compare_school_enrollment_models.py 실험 결과 중 "모델1" 선택을 반영 |
| generate_candidate_grid.py | [실험] (v1) | `candidate_grid_raw_v2.geojson` 생성. 브리프가 예시로 든 v1/v2 쌍의 v1. v2에 의해 대체됨 |
| generate_candidate_grid_v2.py | [실험] (v2, v1보다는 최신이나 이후 population_alloc/mixed_demand_model 체계로 대체됨) | `candidate_grid_raw_v3.geojson`, `candidate_grid_final_v4.geojson` 생성 |
| generate_statistics_preview_data.py | [실험/구버전] | `school_priority_case_system_20260411.csv`, `beneficiary_forecast.csv` 등 구 산출물을 입력으로 사용 |
| generate_statistics_preview_data_safe.py | [운영 파이프라인] | `_safe` 접미사, `school_priority_with_functional_park_layer.csv`·`student_trend.csv` 등 최신 파일을 입력으로 사용. `generate_statistics_preview_data.py`(구버전)의 후속 안전판으로 추정 |
| predict_grid_demand.py | [실험] | 구 XGBoost 기반 후보지 수요예측(`candidate_grid_xgb_v4.*`). CONTEXT 2026-04-19: "학교 단위 forecast 전파 방식은 폐기한다" — population_alloc/mixed_demand_model로 대체됨 |
| rebuild_candidate_population_demand.py | [운영 파이프라인] | CONTEXT 2026-04-19 "구별 Prophet 총량 + 격자 인구 비례배분"(`gu_prophet_grid_alloc_v1_20260419`) 구현. `candidate_grid_population_alloc_v1.*` 생성 — `build_mixed_demand_model.py` 최종 체인의 선행 입력 단계로 여전히 사용 중 |

### B-4. `scripts/` 재귀 (약 99개) — 서브폴더별

**scripts/accessibility/ (23개)**

| 파일 | 태그 | 근거 |
|---|---|---|
| add_functional_park_layer_20260506.py | [운영 파이프라인] | CONTEXT 최상단 "2026-05 기능성 공원 접근성 보조 레이어" 섹션의 핵심 스크립트. `parks_with_function_class.csv`, `school_priority_with_functional_park_layer.csv`, `reports/*.md` 3종 생성 |
| add_nearest_school_to_parks.py | [운영 파이프라인] (경로 `data/processed` 사용 — 실행 여부 불확실) | `parks_with_nearest_school.csv` 생성. root/analysis에 동명 사본 없음(scripts에만 존재) |
| analysis_isochrone_valhalla.py | [운영 파이프라인] (경로 `data/processed` 사용 — 불확실) | `isochrone_valhalla.geojson`(핵심 운영 파일) 생성 후보로 추정되나 구경로를 써서 실제 최신 재산출 경로인지 불확실 |
| analysis_large_apt.py / _exact.py / _kakao.py | 루트 사본, B-2와 동일 태그(각 [실험]/[실험]/[운영 파이프라인] duplicate) | B-0 참고, 구경로 사용 |
| analysis_nearest_park.py | 루트 사본 [운영 파이프라인 duplicate] | B-0 참고 |
| analysis_redev_isochrone.py | [운영 파이프라인] | 재개발구역-도보등시선 교차 분석, 정상 경로(`data_processed`) 사용 |
| analysis_redev_proximity.py | [운영 파이프라인] | 재개발구역 근접성 분석, 정상 경로 사용 |
| analysis_step1_osmnx.py | [운영 파이프라인] | Phase2 "OSMnx로 인천 보행 도로망 자동 수집" 최초 단계, 정상 경로 |
| analysis_step3_isochrone.py | 루트 사본 [운영 파이프라인 duplicate] | B-0 참고 |
| audit_and_fix_radius_green_ratio_20260504.py | [검증·감사] | CONTEXT 2026-05-04 "녹지비율 교정 메모" 섹션이 "교정 스크립트"로 명시 지목 |
| audit_ui_route_basis_alignment_20260512.py | [검증·감사] | `data_quality/ui_route_basis_mismatch_audit_20260512.csv` 생성, UI-데이터 경로 정합성 감사 |
| build_apartment_permeability_walk_adjustment_20260504.py | [검증·감사]/시나리오 빌더 혼합 | CONTEXT 2026-05-04 섹션이 동일 "교정 스크립트" 목록에 포함. 다만 실제로는 `school_walk_500m_apartment_adjustment_20260504.csv` 시나리오 파일 생성이 주 기능 |
| build_green_ratio_display_guardrail_20260506.py | [운영 파이프라인] | CONTEXT 2026-05-06 "앱 표시용 녹지비율 보수 산정 레이어" 구현, ⚠️봉인값 참조 확인 |
| compare_buffer_walk_green_ratio_20260423.py | [검증·감사] | `compare_` 접두, 반경버퍼 vs 도보등시선 녹지비율 비교 검증 |
| compare_nearest_park_walk_straight_20260423.py | [검증·감사] | 최근접공원 도보거리 vs 직선거리 비교 검증 |
| count_school_park_path_barriers.py | [운영 파이프라인] | 학교-공원 경로의 보행부담 요소(간선도로 횡단 등) 집계, `candidate_barrier_routes_by_school.json` 계열 입력 산출 |
| fix_has_large_apt_500m.py | 루트 사본 [일회성 fix duplicate] | B-0 참고 |
| recalc_nearest_park_all_records.py | [일회성 fix] | `recalc_` 접두, root/analysis 사본 없음(scripts에만 존재), 구경로 사용 |
| recalc_nearest_park_public_only.py | 루트 사본 [일회성 fix duplicate] ⚠️봉인 | B-0 참고 |
| recalc_park_playground_counts_valhalla.py | 루트 사본 [일회성 fix duplicate] | B-0 참고 |
| update_manual_verified_nearest_parks.py | [일회성 fix] ⚠️봉인 (핵심) | 파일명 자체가 "수동검증 반영". `sealed_nearest_park_dist.json` 직접 참조 확인. 봉인표(CONTEXT.md 159행~) 반영용 스크립트로 추정 — **수동검증 80개교 봉인값 관련 최우선 확인 대상** |
| update_playground_mirage.py | 루트 사본 [일회성 fix duplicate] | B-0 참고, 브리프 명시 예시 |

**scripts/candidate_generation/ (11개)** — 대부분 `analysis/`의 사본이거나 그 확장

| 파일 | 태그 | 근거 |
|---|---|---|
| build_candidate_barrier_routes.py / build_mixed_demand_model.py / exclude_school_sites.py / generate_candidate_grid.py / generate_candidate_grid_v2.py / predict_grid_demand.py / rebuild_candidate_population_demand.py | `analysis/` 사본, B-3와 동일 태그(구경로) | B-0 참고 |
| enrich_candidate_grid.py | [실험] | root/analysis 사본 없음. `candidate_grid_xgb_v2.geojson` 등 구 XGBoost 계열 파일만 생성 — CONTEXT 2026-04-19 이후 population_alloc/mixed_demand_model로 대체된 구 파이프라인 |
| fix_candidate_simulation_metrics.py | [일회성 fix] (실행 여부 불확실) | `fix_` 접두, 구경로 사용. `refresh_candidate_simulation_metrics.py`가 후속판으로 추정 |
| refresh_candidate_simulation_metrics.py | [운영 파이프라인] 또는 [일회성 fix] — 불확실 | `fix_candidate_simulation_metrics.py`의 "refresh"판으로 보이나 CONTEXT에 명시적 언급 없어 역할 불확실 |

**scripts/classification/ (15개)**

| 파일 | 태그 | 근거 |
|---|---|---|
| analysis_clustering.py / analysis_ml_models.py / apply_case_system_20260411.py / run_school_similarity_v3.py | 루트 사본, B-2와 동일 태그 | B-0 참고 |
| apply_public_park_case_rules_20260422.py | [운영 파이프라인] | `parks.csv`, `school_nearest_park.csv`, `gu_summary.csv` 참조, CONTEXT 2026-04-18 "case 분류 기준 개편" 반영 스크립트로 추정 |
| calc_gu_park_area_per_capita_20260424.py | [검증·감사]/통계 산출 | 구별 1인당 공원면적 계산, 보고서용 보조 통계로 추정 |
| compare_student_green_scenarios_20260424.py | [검증·감사] | `compare_` 접두, 시나리오 비교 |
| fix_walk_green_ratio_intersection_20260504.py | [검증·감사] | CONTEXT 2026-05-04 섹션이 "교정 스크립트"로 명시 지목(도보 녹지 교차면적 재계산) |
| incheon_student_green_correlation_20260424.py / incheon_vulnerable_green_correlation_20260423.py / michuhol_vulnerable_green_correlation_20260422.py | [실험]/보고서용 통계 분석 | 상관분석 3종, 날짜 고정 접미사로 보아 특정 보고서 챕터용 1회성 분석에 가까움 |
| reclassify_case_public_only.py | [일회성 fix] | `reclassify_` 접두, `isochrone_valhalla.geojson`·`parks.csv` 기준 재분류 |
| run_school_similarity.py / run_school_similarity_v2.py | [실험] (v1, v2 — v3에 의해 대체됨) | root/analysis에 사본 없음. `run_school_similarity_v3.py`가 최종 운영판(B-2 참고) |

**scripts/config/ (2개)**: `__init__.py`, `region_config.py` — 4종 태그 밖의 **공용 설정 모듈**(구/지역 상수 등 정의로 추정). 분석 스크립트가 아니라 import 대상이므로 분류 제외.

**scripts/export/ (16개)**

| 파일 | 태그 | 근거 |
|---|---|---|
| build_submission_package.py | [운영 파이프라인](제출 패키지 빌드 유틸) | `submission_package/` 디렉터리로 파일 복사하는 shutil 기반 패키징 스크립트. 핵심 분석 로직은 없음 |
| create_chapter6_visuals_20260423.py / create_vulnerable_green_annotated_visuals_20260424.py / create_vulnerable_green_extra_visuals_20260423.py | [검증·감사]/보고서 시각화 | 날짜 고정 접미사, 보고서 특정 챕터용 1회성 시각화로 추정 |
| export_school_enrollment_forecast_versioned.py / generate_statistics_preview_data.py / generate_statistics_preview_data_safe.py | `analysis/` 사본, B-3와 동일 태그 | B-0 참고 |
| generate_word_doc.py | [운영 파이프라인]/보고서 생성 | ⚠️봉인 참조 확인, `parks.csv`·`isochrone_valhalla.geojson`·`population_grid.csv` 등 다수 참조 — 최종 보고서 워드 문서 자동 생성으로 추정 |
| render_michuhol_vulnerable_case12_scatter_20260422.py / render_park_count_green_ratio_scatter_20260422.py / render_student_green_gap_extreme_20260424.py | [검증·감사]/시각화 | 날짜 고정, 보고서용 산점도 렌더링 1회성 |
| reproduce_vulnerable_green_quartile_20260520.py | [검증·감사] | `reproduce_` 접두 — 재현성 검증, `outputs/verification/*20260520*` 생성과 매칭 |
| validate_outputs.py | [검증·감사] | 파일명 자체가 검증. `parks.csv`, `schools.csv`, `population_grid_1k.csv` 등 핵심 산출물 정합성 검증으로 추정 |

**scripts/forecasting/ (6개)**

| 파일 | 태그 | 근거 |
|---|---|---|
| build_prophet_cohort_change.py | [운영 파이프라인] | 구별 Prophet cohort 변화율 산출, `gu_cohort_ratios.csv`·`beneficiary_forecast.csv` 체인의 근간 |
| compare_school_enrollment_models.py | 루트 사본, B-2와 동일 [실험] | B-0 참고 |
| run_beneficiary_models_v2.py | [실험] | `_v2` 접미사, `beneficiary_forecast.csv` 계열 초기 실험 버전 |
| run_model2_ablation_v3.py / run_model2_feature_boost_v2.py / run_model2_feature_boost_v3.py | [실험] | CONTEXT 2026-04-19 이전 "모델2(XGBoost)" 계열 ablation/feature-boost 실험. 이후 mixed_demand_model로 전체 대체됨 |

**scripts/preprocess/ (18개)**

| 파일 | 태그 | 근거 |
|---|---|---|
| preprocess_step1_schools.py, preprocess_step1_redevelopment.py, preprocess_step2_childcare.py, preprocess_step2_parks.py, preprocess_step3_parks_gu.py, preprocess_step4_grid.py, preprocess_step4_final.py, preprocess_step4b_grid.py, preprocess_step4c_grid_combined.py, preprocess_step5_grid1k.py, preprocess_step6_geocoding.py, preprocess_step7_osm_playground.py | [운영 파이프라인] | `stepN_` 순번 명명 — PHASE 1 데이터 전처리 파이프라인 그 자체. CONTEXT PHASE 1 섹션과 완전히 대응 |
| preprocess_step6b_retry_kakao.py | [일회성 fix] | `_retry` — step6 지오코딩 실패분 재시도 1회성 스크립트 |
| extract_schools_michuhol.py | [운영 파이프라인]/보조 | 미추홀구 시연용 서브셋 추출(`schools_michuhol.csv`), CONTEXT "미추홀구: 발표 시연 사례" 대응 |
| _run_kakao_gawon.py, _run_kakao_missing.py, _run_kakao_missing_v2.py | [일회성 fix] | 파일명 선행 언더스코어(`_`) 자체가 "직접 실행하지 않는 1회성 보조 스크립트" 관례 표시. 카카오 지오코딩 결측/특정건(가원) 재처리용 |

**scripts/recommendation/ (3개)**

| 파일 | 태그 | 근거 |
|---|---|---|
| analysis_school_priority.py / rebuild_priority_with_redev.py | 루트 사본, B-2와 동일 태그 | B-0 참고 |
| run_valhalla_priority_refresh.py | [운영 파이프라인] ⚠️봉인 | 이름 자체가 "Valhalla 기준 우선순위 갱신", `sealed_` 참조 확인 — 정상 경로 사용 |

**scripts/ 루트 직속 느슨한 파일 (12개)** — 전부 mtime이 2026-04-19 이후로, 나머지 대부분(2026-04-07 기준 mtime)보다 명확히 나중에 추가된 최신 스크립트군

| 파일 | 태그 | 근거 |
|---|---|---|
| add_robust_xai_recommendation.py | [운영 파이프라인] | `robust_candidate_recommendations.json`(index.html 실사용) 생성 |
| audit_case_threshold_sensitivity.py | [검증·감사] | `outputs/case_threshold_sensitivity/*` 생성, case 분류 임계값 민감도 검증 |
| audit_knn_k_choice.py | [검증·감사] | `outputs/knn/knn_k_choice_*` 생성, 유사학교 추천 KNN k값 선택 근거 검증 |
| export_case_reclassification_chart.py | [검증·감사] | `outputs/case_reclassification/*` 생성 |
| export_green_ratio_threshold_chart.py | [검증·감사] | `outputs/green_ratio_threshold/*` 생성 |
| export_park_area_exclusion_reclassification.py | [검증·감사] | `outputs/park_area_exclusion_reclassification/*` 생성 |
| export_park_distance_boxplot.py | [검증·감사] | `outputs/park_distance_comparison/*` 생성 |
| export_school_enrollment_error_distribution.py | [검증·감사] | `output/school_enrollment_recursive_error_distribution.*` 생성 |
| insert_robust_xai_ppt_assets.py | [일회성 fix] | "insert" — 기존 PPT 파일에 자산을 삽입하는 1회성 작업으로 추정 |
| make_apartment_permeability_isochrone_compare.py | [검증·감사] | 아파트 투과성 보정 전후 도보권 비교 시각화 |
| make_robust_xai_ppt_assets.py | [운영 파이프라인]/보고서 자산 생성 | `outputs/robust_xai/*` SHAP 시각화 자산 생성 |
| validate_track2_child_demand.py | [검증·감사] | `outputs/track2_validation/*` 다수 생성, 이름 자체가 검증 |

---

## C. 중복·잔재 확인

### `output/` vs `outputs/`
- **`output/` (단수, 11개 파일)**: 루트 직속 산출물. `analysis/predict_grid_demand.py`만 `output/`(단수)를 참조하는 것으로 확인됨. 내용은 대부분 학생수 예측 모델 비교(`school_enrollment_model_comparison.*`, `school_enrollment_recursive_*`)와 `sealed_nearest_park_dist.json`(⚠️봉인값 원본 JSON 추정), `candidate_population_model_metrics_20260419.*`, `green_ratio_manual_review_list.csv` 등. 2026-04-18~19 시기 산출물 위주.
- **`outputs/` (복수, 다수 하위폴더)**: `scripts/add_robust_xai_recommendation.py`, `scripts/classification/calc_gu_park_area_per_capita_20260424.py` 등 **최신(2026-05 전후) 감사/검증/시각화 스크립트들이 참조**. `case_reclassification/`, `case_threshold_sensitivity/`, `green_ratio_threshold/`, `knn/`, `park_area_exclusion_reclassification/`, `park_distance_comparison/`, `ppt_app_alignment_audit_20260526/`, `robust_xai/`, `track2_validation/`, `verification/`, `screenshots/` 등 주제별 하위폴더로 잘 정리되어 있음. `final_pre_submission_audit_20260526.md`도 이 안에 있음.
- **판단**: `output/`(단수)는 2026-04 중순 시점의 구 산출물 폴더, `outputs/`(복수)는 2026-04 말~05월에 새로 도입된 "정리된" 산출물 폴더로 보인다. 정리 작업 시 `output/`(단수)의 파일들을 `outputs/`(복수) 체계로 흡수하거나, 적어도 명명 규칙 통일이 필요해 보인다. 다만 `output/sealed_nearest_park_dist.json`은 ⚠️봉인값 원본일 가능성이 있으므로 **삭제·이동 전 반드시 CONTEXT.md 봉인 섹션과 대조 확인 필요**.

### `data/` vs `data_quality/`
- **`data/`**: 하위에 `app_examples/candidate_panel_examples.json` 단 1개 파일만 존재. 이 파일은 `index.html`, `vercel_public/index.html`, `app/legacy_types/candidatePanelMapper.ts`, `src/utils/candidatePanelMapper.ts`에서 실제로 참조되는 **앱 예시 데이터**다. `OPERATING_PATHS.md`가 "사용하지 않는 경로"로 지목한 `data/processed/`와는 무관한, 별도 역할의 디렉터리이므로 혼동 주의.
- **`data_quality/`**: 봉인 검증·재분류 근거 등 **QA/감사 산출물** 저장소(`park_area_outliers_review.csv`, `park_function_counterfactual_*.csv` 5종, `ui_route_basis_mismatch_audit_20260512.csv`). `index.html`은 이 디렉터리를 전혀 참조하지 않음 — 순수 내부 분석/문서화 자료.

### 루트 로그/`__pycache__`
- 로그 8쌍 16개(`_auth_verify_http.*`, `_codex_http_8765.*`, `_codex_iso_http.*`, `_codex_node_8766.*`, `_guide_capture_http.*`, `_verify_http.*`, `root.http.*`)는 실제로는 7종 접두사 × err/out = 14개 + `root.http.*` 2개 = 총 14개(브리프에서 요청한 `_*.log` 패턴). 전부 2026년 5월 중 로컬 개발 서버(HTTP 서버) 기동 시 생성된 stdout/stderr 캡처 로그로, 내용은 서버 기동/요청 로그일 뿐 어떤 스크립트도 이를 입력으로 참조하지 않음(전체 grep 결과 참조 스크립트 없음) → **삭제 후보로 확정 가능**.
- `__pycache__` 3곳(`./__pycache__`, `scripts/__pycache__`, `scripts/accessibility/__pycache__`)에 `.pyc` 총 4개(`compare_school_enrollment_models`, `export_park_distance_boxplot`, `make_robust_xai_ppt_assets`, `add_functional_park_layer_20260506`) → **표준 바이트코드 캐시, 삭제 후보로 확정 가능**(재실행 시 자동 재생성됨).

### `analysis/` 내부 버전쌍
- `generate_candidate_grid.py`(v1, `candidate_grid_raw_v2.geojson` 생성) → `generate_candidate_grid_v2.py`(v2, `candidate_grid_raw_v3.geojson`/`candidate_grid_final_v4.geojson` 생성) → `predict_grid_demand.py`(xgb v4/v5) → `rebuild_candidate_population_demand.py`(population_alloc_v1) → `build_mixed_demand_model.py`(**최종**, `candidate_grid_final.geojson`, index.html 실사용).
- CONTEXT.md와 index.html 코드(5477행)를 교차 확인한 결과 **최종본은 `build_mixed_demand_model.py`가 생성하는 `candidate_grid_final.geojson`(접미사 없음)**이며, v2/v3/v4/v5/xgb 계열은 모두 이전 세대 실험판으로 판단된다.

---

## 불확실 항목 종합 (판정 불가)

1. `candidate_grid_final_v3.geojson`, `candidate_grid_xgb.csv/.geojson`, `candidate_grid_xgb_v2.csv`, `candidate_grid_xgb_v3.csv`, `kindergartens.csv` — 리포 전체 `*.py`에서 파일명 직접 매치가 나오지 않음. 생성 스크립트가 삭제되었거나, 파일명이 스크립트 내부에서 변수 조합(f-string)으로 만들어져 grep에 안 걸렸을 가능성.
2. `rebuild_priority_with_redev.py`(루트) vs `scripts/recommendation/rebuild_priority_with_redev.py` — 완전히 동일한 내용이라 실행 커맨드(예: `python rebuild_priority_with_redev.py` vs `python -m scripts.recommendation.rebuild_priority_with_redev`) 기록이 없는 한 어느 쪽이 "진짜 실행됐던 판"인지 구분 불가.
3. `scripts/accessibility/add_nearest_school_to_parks.py`, `scripts/accessibility/analysis_isochrone_valhalla.py` — 구경로(`data/processed`)를 쓰지만 root/analysis에 대응 사본이 없어 "이 파일이 실제로 최근 정상 실행된 적이 있는지"가 불확실. `isochrone_valhalla.geojson`은 운영 핵심 파일이라 이 스크립트의 실제 최신 생성 경로를 사람이 재확인할 필요가 있음.
4. `scripts/candidate_generation/fix_candidate_simulation_metrics.py` vs `refresh_candidate_simulation_metrics.py` — 어느 것이 최신/운영판인지 CONTEXT.md에 명시 언급이 없어 판단 근거 부족.
5. `scripts/classification/run_school_similarity.py`(v1) vs `_v2.py` vs 루트 `run_school_similarity_v3.py` — v3가 최종본이라는 점은 OPERATING_PATHS 대조로 확실하나, v1/v2 각각의 정확한 폐기 시점/사유는 CONTEXT.md에 별도 기록이 없음.

---

## 참고: 조사에 사용한 임시 산출물
`C:\Users\Mijin\AppData\Local\Temp\claude\c--Users-Mijin-Desktop---------\e8be247d-dc0f-45b2-92a3-5e69343bdfd0\scratchpad\data_xref.tsv` — data_processed 72개 파일의 grep 원본 교차참조 결과(TSV). 리포 밖 scratchpad에 있으며 리포 정리 작업에는 영향 없음.
