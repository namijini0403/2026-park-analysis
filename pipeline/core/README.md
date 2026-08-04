# pipeline/core/ — 공통 엔진 함수 목록 (설계 초안)

이 문서는 실제 코드가 아니다. task-2 리포트 B절의 [운영 파이프라인] 태그가 붙은 스크립트들에서 **레이어(공원/도서관) 무관하게 반복되는 패턴**을 추출해 나열한 것이다. 실제 `pipeline/core/*.py` 구현은 스크립트별 본문 diff 후 다음 단계에서 진행한다.

## 1. 전처리 (preprocess)

공통 후보 함수:
- 좌표 정제/결측 처리 (예: 카카오 지오코딩 실패분 재시도 — `preprocess_step6b_retry_kakao.py`, `_run_kakao_missing*.py` 패턴)
- 원본 좌표계 → EPSG:5179 변환 (아래 2번과 공유)
- 격자(grid) 생성/속성 조인 (`preprocess_step4_grid.py` 계열, `preprocess_step5_grid1k.py`)

근거 스크립트: `scripts/preprocess/preprocess_step1~7_*.py` (18개, task-2 B-4절)

## 2. EPSG:5179 좌표 변환 / 거리 계산

공통 후보 함수:
- 위경도 ↔ EPSG:5179(중부원점) 투영 변환
- 두 지점 간 직선거리(m) 계산 — `compare_nearest_park_walk_straight_20260423.py`가 도보거리와 비교하는 로직의 기준점
- 반경 버퍼(500m 등) 생성

근거 스크립트: `analysis_nearest_park.py`, `analysis_large_apt_exact.py`, `fix_has_large_apt_500m.py`

## 3. Isochrone(등시선) 계산

공통 후보 함수:
- OSMnx 보행망 수집 (`analysis_step1_osmnx.py`)
- Valhalla 기반 도보 등시선 생성 (`analysis_step3_isochrone.py`, `scripts/accessibility/analysis_isochrone_valhalla.py`)
- 등시선-폴리곤 교차 면적 계산 (`fix_walk_green_ratio_intersection_20260504.py`)

⚠️ `isochrone_valhalla.geojson`은 봉인값(도보경로 보행부담 근거) — 재계산 함수를 core로 이관하더라도 **기존 산출물 자동 재생성 금지**, 사람 승인 후에만 재실행.

## 4. 공간 조인 (spatial join)

공통 후보 함수:
- 학교 buffer ↔ 공원 폴리곤 교차 판정
- 학교 ↔ 최근접 시설(공원/어린이집/유치원) 매칭
- 격자 ↔ 인구/수요 데이터 조인

근거 스크립트: `analysis_nearest_park.py`, `add_nearest_school_to_parks.py`, `build_mixed_demand_model.py`

## 5. 품질검사 (validate/audit)

공통 후보 함수:
- 산출물 스키마/행수 정합성 검증 (`validate_outputs.py`)
- 전후 비교(before/after) 리포트 생성 패턴 — 다수의 `fix_*.py`, `audit_*.py`, `compare_*.py`가 각자 구현 중인 로직을 공통화 후보로 표시

근거 스크립트: `validate_outputs.py`, `validate_track2_child_demand.py`, `audit_case_threshold_sensitivity.py`, `audit_knn_k_choice.py`, `audit_ui_route_basis_alignment_20260512.py`

## 이관 우선순위 메모

- `scripts/config/region_config.py`는 이미 사실상 공용 모듈(구/지역 상수)이라 이관 난이도가 가장 낮음 — 우선 검토 대상.
- 나머지 함수들은 레이어별 파일에 로직이 섞여 있어(예: `analysis_nearest_park.py`가 EPSG 변환+거리 계산+공원 레이어 필터링을 한 파일에서 처리) 공통 부분만 뽑아내는 리팩터링이 필요하다. 이번 태스크에서는 수행하지 않는다.
