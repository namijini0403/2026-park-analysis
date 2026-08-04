# 2026-08 Attic: 구버전·구경로 사본 스크립트 보관

## A. 루트 일회성 fix (oneoff_fixes/)
- `apply_case_system_20260411.py` — 봉인값 케이스 시스템 적용 (일회성, v2 존재)
- `fix_has_large_apt_500m.py` — 500m 대형아파트 보정 (일회성)
- `update_playground_mirage.py` — 놀이터 데이터 마이라주 보정 (일회성)
- `recalc_park_playground_counts_valhalla.py` — Valhalla 놀이터 개수 재계산 (일회성)

## B. 루트 구버전 실험 (experiments/)
- `analysis_large_apt.py` — 대형아파트 분석 v1 (analysis_large_apt_kakao.py가 최종본)
- `analysis_large_apt_exact.py` — 대형아파트 정확도 분석 (superseded by v3)

## C. analysis/ 구버전 (analysis_superseded/)
- `generate_candidate_grid.py` — 후보지 그리드 생성 v1 (v2 존재)
- `generate_candidate_grid_v2.py` — 후보지 그리드 생성 v2 (mixed_demand_model로 대체)
- `predict_grid_demand.py` — 그리드 수요 예측 v1 (build_mixed_demand_model.py로 통합)
- `generate_statistics_preview_data.py` — 통계 미리보기 v1 (_safe판이 최종본)

## D. scripts/** 구경로 사본 (scripts_stale/)

### accessibility/ (9개)
- `analysis_large_apt.py` — 대형아파트 분석 (루트/kakao가 최종)
- `analysis_large_apt_exact.py` — 대형아파트 정확도 분석 (obsolete)
- `analysis_large_apt_kakao.py` — 대형아파트 분석 구경로 사본
- `analysis_nearest_park.py` — 최인접 공원 분석 구경로 사본
- `fix_has_large_apt_500m.py` — 500m 대형아파트 보정 구경로 사본
- `recalc_nearest_park_all_records.py` — 모든 최인접 공원 재계산 구경로 사본
- `recalc_nearest_park_public_only.py` — 공용 최인접 공원 재계산 구경로 사본
- `recalc_park_playground_counts_valhalla.py` — 놀이터 개수 재계산 구경로 사본
- `update_playground_mirage.py` — 놀이터 마이라주 업데이트 구경로 사본

### candidate_generation/ (10개)
- `build_candidate_barrier_routes.py` — 후보지 장애물 경로 구축 구경로 사본
- `build_mixed_demand_model.py` — 혼합 수요 모델 구축 구경로 사본
- `enrich_candidate_grid.py` — 후보지 그리드 보강 구경로 사본
- `exclude_school_sites.py` — 학교 부지 제외 구경로 사본
- `fix_candidate_simulation_metrics.py` — 후보지 시뮬레이션 메트릭 수정 구경로 사본
- `generate_candidate_grid.py` — 후보지 그리드 생성 v1 구경로 사본
- `generate_candidate_grid_v2.py` — 후보지 그리드 생성 v2 구경로 사본
- `predict_grid_demand.py` — 그리드 수요 예측 구경로 사본
- `rebuild_candidate_population_demand.py` — 후보지 인구 수요 재구축 구경로 사본
- `refresh_candidate_simulation_metrics.py` — 후보지 시뮬레이션 메트릭 갱신 구경로 사본

### classification/ (10개, E 유사도 구버전 3개 포함)
- `analysis_clustering.py` — 클러스터링 분석 구경로 사본
- `analysis_ml_models.py` — ML 모델 분석 구경로 사본
- **`apply_case_system_20260411.py`** — 케이스 시스템 적용 (루트판에 없는 `deduplicate_public_parks()` 함수 추가분 있음 → **로직 병합 검토 필요**)
- `incheon_student_green_correlation_20260424.py` — 인천 학생-녹지 상관 구경로 사본
- `incheon_vulnerable_green_correlation_20260423.py` — 인천 취약층-녹지 상관 구경로 사본
- `michuhol_vulnerable_green_correlation_20260422.py` — 미추홀 취약층-녹지 상관 구경로 사본
- `reclassify_case_public_only.py` — 공용 공원만 케이스 재분류 구경로 사본
- `run_school_similarity.py` — 학교 유사도 계산 v1 (E: 규칙 D와 무관 무조건 이동)
- `run_school_similarity_v2.py` — 학교 유사도 계산 v2 (E: 규칙 D와 무관 무조건 이동)
- `run_school_similarity_v3.py` — 학교 유사도 계산 v3 (규칙 D: data/processed 매치)

### export/ (3개)
- `export_school_enrollment_forecast_versioned.py` — 학교 등록 예측 버전별 내보내기 구경로 사본
- `generate_statistics_preview_data.py` — 통계 미리보기 생성 구경로 사본
- `render_park_count_green_ratio_scatter_20260422.py` — 공원 개수-녹지 비율 산점도 렌더링 구경로 사본

### forecasting/ (2개)
- `compare_school_enrollment_models.py` — 학교 등록 모델 비교 구경로 사본
- `run_model2_ablation_v3.py` — 모델2 제거 테스트 v3 구경로 사본

### recommendation/ (1개)
- `rebuild_priority_with_redev.py` — 재개발 포함 우선순위 재구축 (루트판 동일 사본)

---

**총 이동 파일 수: 45개** (A:4 + B:2 + C:4 + D:35)
**D 세부: D-1:9 + D-2:10 + D-3:10(E 포함) + D-4:3 + D-5:2 + D-6:0 + D-7:1 = 35개**
**복원 사유: 유일본 운영·검증 스크립트 14개는 구경로 참조 여부와 무관하게 scripts/ 원위치 잔류 (인벤토리 기준)**
**이동 전 안전 검증: 잔류 파일 import 참조 0건**
**특별 주의: D-3 scripts/classification/apply_case_system_20260411.py 로직 병합 검토 권장**

주의: scripts/ 잔류 파일 중 일부는 구경로(data/processed, data/raw)를 참조하므로 재실행 전 경로 수정 필요 — pipeline/registry/data_registry.yaml 참고
