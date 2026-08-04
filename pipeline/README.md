# pipeline/ — 공통 엔진 + 레이어 온보딩 스켈레톤 (설계 초안, 2026-08-04)

## 이 디렉터리의 목적

범정부대회 사업계획서(v4)가 약속한 구조는 다음 4개 축이다.

1. **공통 엔진** (`pipeline/core/`) — 공원·도서관 등 레이어 공통으로 쓰이는 전처리/좌표계/등시선/조인/품질검사 함수
2. **레이어 온보딩** (`pipeline/layers/<layer>/`) — 레이어별(공원, 도서관, ...) 파이프라인 단계 맵
3. **데이터 레지스트리** (`pipeline/registry/data_registry.yaml`) — 산출물 ↔ 생성 스크립트 ↔ 앱 참조 의존성 그래프
4. **공공데이터 업데이트 센터** (`update_center/`) — 감시→품질검사→샌드박스 재분석→전후 비교→버전 기록의 자가진화 루프 (승인 기반)

**이번 태스크(Task 4)는 뼈대만 만든다.** 기존 스크립트(`analysis/`, 루트 `*.py`, `scripts/**`)는 단 하나도 옮기거나 재실행하지 않았다. 코드 이식은 "봉인값 보호 정책"에 따라 사람이 스크립트 하나하나를 확인한 뒤 진행할 다음 단계(W1 이후)의 몫이다.

## 왜 지금 스켈레톤만 만드는가

- `data_processed/`의 다수 파일(`school_priority.csv`, `parks.csv`, `school_nearest_park.csv` 등)은 **⚠️봉인된 실측값**을 담고 있다. 생성 스크립트를 그대로 옮겨 재실행하면 실측 검증값이 재계산으로 덮어써질 위험이 있다.
- `analysis/`·루트·`scripts/**` 세 곳에 동명 스크립트가 중복 존재하며, 경로 상수·로직이 미묘하게 다른 경우가 있다(`.superpowers/sdd/code_cleanup_handover/task-2-report.md` B-0절 참고). 어느 판본이 "진짜 운영판"인지 스크립트별로 사람이 확인해야 한다.
- 따라서 이번 단계는 **구조를 먼저 설계하고, 데이터 의존성 그래프를 문서화**하는 데 그친다. 코드 이관은 이 그래프를 기준으로 스크립트 단위 검토를 거쳐 진행한다.

## 현재 스크립트 → 목표 모듈 매핑 (초안)

| 현재 위치 | 목표 모듈 | 비고 |
|---|---|---|
| `preprocess_step1_schools.py`, `preprocess_step1_redevelopment.py`, `preprocess_step2_childcare.py`, `preprocess_step2_parks.py`, `preprocess_step3_parks_gu.py`, `preprocess_step4*.py`, `preprocess_step5_grid1k.py`, `preprocess_step6*.py`, `preprocess_step7_osm_playground.py` (전부 `scripts/preprocess/`) | `pipeline/core/preprocess.py` (예정) + `pipeline/layers/park/preprocess.py` (레이어 특화 부분) | 순번(`stepN_`) 명명 자체가 PHASE 1 파이프라인. 공원 레이어에 특화된 로직과 공통 로직(좌표 정제, 결측 처리)을 분리해야 함 |
| `analysis_step1_osmnx.py`, `analysis_step3_isochrone.py`, `analysis/build_candidate_barrier_routes.py`, `count_school_park_path_barriers.py` | `pipeline/core/isochrone.py` (예정) | 보행망 수집·EPSG:5179 등시선 계산은 레이어 무관 공통 함수 후보 |
| `analysis_nearest_park.py`, `recalc_nearest_park_public_only.py` [일회성 fix], `update_manual_verified_nearest_parks.py` [일회성 fix] | `pipeline/layers/park/accessibility.py` (예정) | ⚠️봉인 관련 — 재실행 금지, 아래 `layers/park/README.md` 경고 참고. 뒤 2개는 운영 파이프라인 스텝이 아니라 봉인값 반영용 일회성 보정 스크립트 |
| `analysis_school_priority.py`, `apply_case_system_20260411.py`, `rebuild_priority_with_redev.py` | `pipeline/layers/park/priority.py` (예정) | ⚠️봉인 관련 |
| `build_mixed_demand_model.py`, `rebuild_candidate_population_demand.py`, `exclude_school_sites.py` | `pipeline/layers/park/candidate.py` (예정) | 후보지 생성 최종 체인 (`candidate_grid_final.geojson`) |
| `analysis_ml_models.py`, `build_prophet_cohort_change.py`, `export_school_enrollment_forecast_versioned.py` | `pipeline/layers/park/forecast.py` (예정) | 예측 모델(LightGBM/Prophet) |
| `add_robust_xai_recommendation.py`, `generate_statistics_preview_data_safe.py`, `generate_word_doc.py`, `build_submission_package.py` | `pipeline/layers/park/export.py` (예정) | export/보고서 단계 |
| `scripts/config/region_config.py` | `pipeline/core/config.py` (예정) | 구/지역 상수 — 이미 공용 모듈 성격, 이관 우선순위 높음 |
| (도서관 레이어 전체) | `pipeline/layers/library/*` (미착수) | W1-W2 예정, `pipeline/layers/library/README.md` 참고 |

이 표는 task-2 리포트 B절 분류를 기반으로 한 **초안**이며, 실제 이관 시점에 스크립트 본문 diff 후 확정한다.

## 하위 문서

- `pipeline/core/README.md` — 공통화 예정 함수 목록
- `pipeline/layers/park/README.md` — 공원 레이어 파이프라인 맵 (전처리→접근성→예측→분류→후보지→export)
- `pipeline/layers/library/README.md` — 도서관 레이어 온보딩 계약 요약
- `pipeline/registry/data_registry.yaml` — 데이터 의존성 그래프 (업데이트 센터가 참조)

## 근거 자료

- `.superpowers/sdd/code_cleanup_handover/task-2-report.md` (데이터 역추적 표 A, 스크립트 분류 B)
- `OPERATING_PATHS.md` (운영 앱이 실제로 로딩하는 경로 기준)
