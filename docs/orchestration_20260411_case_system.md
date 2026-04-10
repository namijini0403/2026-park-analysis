# 2026-04-11 Case System Orchestration Note

## 목적
- `시설유형 == 놀이터` 제외 이후의 최근접 공원/케이스 재정의 작업을 재현 가능하게 남긴다.
- 실측 봉인값 우선 원칙, 별도 태그, 충돌 보완 규칙을 한 곳에 정리한다.
- 다음 작업자가 중간 계산을 다시 처음부터 하지 않도록 스냅샷과 실행 파일을 명시한다.

## 최우선 원칙
- 실측 봉인값 `nearest_park_dist_m`는 절대 수정하지 않는다.
- 자동 재산출보다 실측값이 항상 우선이다.
- 실측값이 `500m 미만`이면 `iso_park_count >= 1`로 보정한다.
- `인천영종초등학교금산분교장`은 예외적으로 `nearest_park_dist_m = null`, `iso_park_count = 0`, `buf_park_count = 0`을 유지한다.
- `parks.csv` 사용 시 기본적으로 `시설유형 == 놀이터`는 제외한다.
- 예외 포함 공원: `가경공원`, `수차공원`

## 오늘 확정된 분류체계
- `is_separate_bundle_tag = 1`
  - `gu == 강화군`
  - 또는 `gu == 옹진군`
  - 또는 학교명에 `분교`, `분교장` 포함
- `is_low_access_tag = 1`
  - `iso_park_count >= 1`
  - 그리고 `access_ratio <= 0.5`
- `is_case_conflict_tag = 1`
  - `nearest_park_dist_m < 500 AND iso_park_count == 0`
  - 또는 `nearest_park_dist_m >= 500 AND iso_park_count >= 1`
  - 운영상 임시로 `case2`에 편입

### case 정의
- `case1`
  - `nearest_park_dist_m >= 500`
  - 그리고 `iso_park_count == 0`
- `case2`
  - `nearest_park_dist_m < 500`
  - 그리고 `iso_park_count >= 1`
  - 그리고 `iso_green_ratio` 하위 1/3
- `case3`
  - `nearest_park_dist_m < 500`
  - 그리고 `iso_park_count >= 1`
  - 그리고 `iso_green_ratio` 중간 1/3
- `case4`
  - `nearest_park_dist_m < 500`
  - 그리고 `iso_park_count >= 1`
  - 그리고 `iso_green_ratio` 상위 1/3

## 내부 정렬 기준
- `case1`
  - `child_pop_quartile`: `Q4 > Q3 > Q2 > Q1`
  - `iso_green_ratio` 낮을수록 우선
  - `iso_playground_count` 적을수록 우선
  - `nearest_park_dist_m` 멀수록 우선
  - `student_slope` 높을수록 우선
- `case2`
  - `child_pop_quartile`: `Q4 > Q3 > Q2 > Q1`
  - `is_low_access_tag = 1` 우선
  - `is_case_conflict_tag = 1` 우선 검토
  - `iso_green_ratio` 낮을수록 우선
  - `iso_playground_count` 적을수록 우선
  - `nearest_park_dist_m` 멀수록 우선
  - `student_slope` 높을수록 우선

## 오늘 추가된 실측 봉인
### 5차 봉인
- 인천가현초등학교 | 수차공원 | 240m
- 인천구산초등학교 | 부개공원 | 105m

### 6차 봉인
- 인천송명초등학교 | 마음공원 | 95m
- 인천영종초등학교 | 영종하늘체육공원 | 235m
- 인천미송초등학교 | 송도랜드마크시티9호근린공원 | 489m
- 인천첨단초등학교 | 어울림공원 | 100m
- 인천아라초등학교 | 아라노을공원 | 166m
- 인천해든초등학교 | 해든공원 | 175m
- 인천원당초등학교 | 원당공원 | 320m
- 인천하늘초등학교 | 박석공원 | 124m
- 인천한별초등학교 | 웃목어린이공원 | 213m
- 인천계산초등학교 | 고향골어린이공원 | 444m
- 상인천초등학교 | 중앙근린공원 | 575m
- 인천장도초등학교 | 동녘어린이공원 | 298m
- 인천부평동초등학교 | 꿈나무어린이공원 | 409m
- 인천부곡초등학교 | 마장공원 | 420m
- 인천석천초등학교 | 하늘공원 | 180m

### 7차 봉인
- 상인천초등학교 | 소공원 | 473m

## 저장된 파일
- 실행 스크립트
  - `apply_case_system_20260411.py`
- 주요 산출물
  - `data_processed/school_priority.csv`
  - `data_processed/school_nearest_park.csv`
  - `output/sealed_nearest_park_dist.json`
- 전후 스냅샷
  - `data_processed/school_priority_20260411_before_case_system.csv`
  - `data_processed/school_nearest_park_20260411_before_case_system.csv`
  - `data_processed/school_priority_case_system_20260411.csv`
  - `data_processed/school_nearest_park_case_system_20260411.csv`

## 스크립트가 하는 일
- 실측 봉인값을 `school_priority.csv`, `school_nearest_park.csv`, `sealed_nearest_park_dist.json`에 동기화
- `parks.csv`에서 놀이터를 제외하고 공공공원 점 레이어 생성
- `isochrone_valhalla.geojson`에 공공공원 점을 공간조인해 `iso_park_count_raw`, `iso_park_area_raw` 재계산
- `시설유형 == 놀이터` 점만 따로 세어 `iso_playground_count` 계산
- 실측값이 `500m 미만`인데 `iso_park_count == 0`이면 최소 `1`로 보정
- `is_separate_bundle_tag`, `is_low_access_tag`, `is_case_conflict_tag` 생성
- `iso_green_ratio = iso_park_area / isochrone_area_m2 * 100` 계산
- 본류 활성 비교군에서 `iso_green_ratio` 3분위로 `case2/3/4` 분류
- 충돌 케이스는 `case2`로 임시 편입
- `case1` 내부 정렬용 `priority_rank` 재산출

## 현재 결과
- 본류 학교 기준
  - `case1 = 27`
  - `case2 = 71`
  - `case3 = 71`
  - `case4 = 71`
- 별도 묶음
  - `is_separate_bundle_tag = 32`
- 별도 태그
  - `is_low_access_tag = 96`
  - `is_case_conflict_tag = 0`

## 현재 남은 충돌 학교
- 없음

## 검증 완료 사항
- 실측 봉인 JSON과 `school_priority.csv`의 `nearest_park_dist_m` 불일치: `0건`
- 실측 봉인값 `500m 미만`인데 `iso_park_count < 1`인 학교: `0건`

## 다시 실행하는 법
```powershell
python apply_case_system_20260411.py
```

## 버전
- 최종 커밋: `77b191e`
- 태그: `case-system-20260411`
- 이전 참조 태그: `pre-public-park-filter-ref`
