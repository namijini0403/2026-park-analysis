# 활동규모 공원 접근성 보조 레이어 검증

이번 작업은 공식 공원 접근성과 활동규모 공원 접근성을 분리하는 보조 해석 레이어를 추가하고, 최종 표시 녹지비율 기준으로 Case 분류를 갱신한 것이다.

활동규모 공원은 본 프로젝트의 운영 기준인 3,000㎡ 이상으로, 아이들이 머물며 활동할 수 있는 규모의 공원으로 해석한다.

## 입력·산출 요약

- 전체 공원/놀이터 레코드 수: 1093
- 공원면적 있는 레코드 수: 789
- 공원면적 없는 레코드 수: 304
- 이상치 검수 대상 레코드 수: 138
- 도보거리 산출 메모: GraphML 파일을 찾지 못해 활동규모 공원 최근접 도보거리 산출을 건너뜀; GraphML 부재/누락 컬럼으로 기존 최종 CSV의 보행거리·보행부담 컬럼을 유지
- AI 추천 before/after: C:\Users\Mijin\Desktop\공공데이터공모전\2026-park-analysis\data_processed\ai_recommendation_before_after_functional_layer.csv 생성; candidate case fields refreshed: candidate_grid_final.csv, candidate_grid_final.geojson
- 보행부담 컬럼: `nearest_official_*`, `nearest_functional_*` 경로별 산출.

## park_function_class별 개수

| 값 | 개수 |
|---|---:|
| playground_like | 434 |
| small_child_park | 254 |
| mid_activity_park | 154 |
| neighborhood_park_scale | 251 |

## park_function_class별 면적 중앙값

| park_function_class | 중앙값(㎡) |
|---|---:|
| playground_like | 1,015.00 |
| small_child_park | 1,889.00 |
| mid_activity_park | 4,747.50 |
| neighborhood_park_scale | 32,149.00 |

## 학교 플래그 집계

- no_official_park_flag: 41개교
- only_micro_park_flag: 102개교
- no_functional_park_flag: 142개교
- no_neighborhood_scale_park_flag: 187개교
- activity_space_limited_flag: 87개교
- nominal_access_gap_flag: 102개교
- near_park_low_green_imbalance_flag: 75개교

## 녹지비율 표시값 검수 플래그

- display_green_ratio 80% 이상 검수 대상: 0개교
- 이 플래그는 Case 분류에 사용하는 최종 표시 녹지비율이 비정상적으로 높을 때 추가 검수가 필요함을 알리기 위한 보조 정보다.

- 검수 대상 없음

## access_condition_type별 학교 수

| 값 | 개수 |
|---|---:|
| no_official_park | 41 |
| nominal_access_only | 102 |
| near_park_low_green_imbalance | 74 |
| functional_access_with_barrier | 24 |
| functional_access_available | 31 |
| unknown | 0 |

## Case 갱신 및 기존 값 보존 검증

- Case 분류 기준: `display_green_ratio` 0%, 1%, 5% 임계값
- Case 변경 학교 수: 50개교
- Case 1~3 학교 수: 163개교
- `display_green_ratio < 5%` 학교 수: 163개교
- Case 1~3과 `display_green_ratio < 5%` 불일치: 0개교
- 기존 최근접 공원 거리 컬럼 변경 없음: True
- 기존 녹지비율 컬럼 변경 없음: True

## 이상치 예시 10건

| 공원명 | 시설유형 | 공원면적 | gu | review_reason |
|---|---|---|---|---|
| 귤현공원 | 근린공원 | 33.003 | 계양구 | 근린공원인데 공원면적 500㎡ 미만 |
| 중앙공원 | 근린공원 | 351770.8 | 미추홀구 | 같은 공원명 내 면적 차이 큼 |
| 글로벌파크 | 근린공원 | 87033.0 | 연수구 | 같은 공원명 내 면적 차이 큼 |
| 솔찬공원 | 근린공원 | 157445.0 | 연수구 | 같은 공원명 내 면적 차이 큼 |
| 미추홀공원 | 근린공원 | 160099.0 | 연수구 | 같은 공원명 내 면적 차이 큼 |
| 동양공원 | 근린공원 | 16261.4 | 계양구 | 같은 공원명 내 면적 차이 큼 |
| 서운공원 | 근린공원 | 12822.4 | 계양구 | 같은 공원명 내 면적 차이 큼 |
| 살나리공원 | 소공원 | 669.0 | 계양구 | 같은 공원명 내 면적 차이 큼 |
| 동양공원 | 소공원 | 837.6 | 계양구 | 같은 공원명 내 면적 차이 큼 |
| 살나리공원 | 어린이공원 | 2053.5 | 계양구 | 같은 공원명 내 면적 차이 큼 |
