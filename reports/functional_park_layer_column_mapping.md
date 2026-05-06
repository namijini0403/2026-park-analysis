# 기능성 공원 레이어 컬럼 매핑

각 파일의 존재 여부와 자동 탐색한 컬럼명이다. 매핑 실패 항목은 빈 값으로 남겨 후속 검토 대상임을 표시한다.

## `C:/2026_data_analysis_park/data_processed/parks.csv`

- 존재 여부: 있음
- 행/열: 1093행, 8열
- 전체 컬럼: `관리번호, 공원명, 공원구분, 위도, 경도, 공원면적, gu, 시설유형`

| 항목 | 매핑 컬럼 |
|---|---|
| park_name | 공원명 |
| park_type | 시설유형 |
| park_area | 공원면적 |
| lat | 위도 |
| lng | 경도 |
| school_id | 매핑 실패 |
| school_name | 매핑 실패 |
| nearest_park_name | 매핑 실패 |
| nearest_park_dist | 매핑 실패 |

## `C:/2026_data_analysis_park/data_processed/parks_with_nearest_school.csv`

- 존재 여부: 있음
- 행/열: 789행, 9열
- 전체 컬럼: `관리번호, 공원명, 공원구분, 위도, 경도, 공원면적, gu, nearest_school, nearest_school_dist_m`

| 항목 | 매핑 컬럼 |
|---|---|
| park_name | 공원명 |
| park_type | 공원구분 |
| park_area | 공원면적 |
| lat | 위도 |
| lng | 경도 |
| school_id | 매핑 실패 |
| school_name | 매핑 실패 |
| nearest_park_name | 매핑 실패 |
| nearest_park_dist | 매핑 실패 |

## `C:/2026_data_analysis_park/data_processed/blocked_parks_by_apt_adjustment_20260504.csv`

- 존재 여부: 있음
- 행/열: 296행, 7열
- 전체 컬럼: `학교ID, 학교명, gu, 공원명, 시설유형, 공원면적_원본, apt_added_park_intersect_m2`

| 항목 | 매핑 컬럼 |
|---|---|
| park_name | 공원명 |
| park_type | 시설유형 |
| park_area | 공원면적_원본 |
| lat | 매핑 실패 |
| lng | 매핑 실패 |
| school_id | 학교ID |
| school_name | 학교명 |
| nearest_park_name | 매핑 실패 |
| nearest_park_dist | 매핑 실패 |

## `C:/2026_data_analysis_park/data_processed/school_priority.csv`

- 존재 여부: 있음
- 행/열: 272행, 45열
- 전체 컬럼: `학교ID, 학교명, gu, iso_park_count, iso_park_area, buf_park_count, buf_park_area, iso_child_total, iso_child_6_12, child_pop_quartile, expected_park_count, gap_count, expected_park_area, gap_area, case_type, priority_score, redev_완료수, redev_진행중수, redev_예정수, redev_status, iso_green_ratio, iso_green_ratio_raw, iso_playground_count, is_separate_bundle_tag, is_low_access_tag, is_case_conflict_tag, isochrone_area_m2, iso_park_count_raw, iso_park_area_raw, green_bucket, case_label, priority_rank, is_island_tag, student_slope, is_new_school, nearest_park_dist_m, apt_blocked_m2, apt_gap_ratio, access_ratio, blocked_park_count, blocked_park_intersect_m2, current_green_ratio, corrected_green_ratio, green_ratio_delta, iso_green_ratio_before_apt`

| 항목 | 매핑 컬럼 |
|---|---|
| park_name | 매핑 실패 |
| park_type | 매핑 실패 |
| park_area | 매핑 실패 |
| lat | 매핑 실패 |
| lng | 매핑 실패 |
| school_id | 학교ID |
| school_name | 학교명 |
| nearest_park_name | 매핑 실패 |
| nearest_park_dist | nearest_park_dist_m |

## `C:/2026_data_analysis_park/data_processed/school_nearest_park.csv`

- 존재 여부: 있음
- 행/열: 272행, 4열
- 전체 컬럼: `학교ID, 학교명, nearest_park_name, nearest_park_dist_m`

| 항목 | 매핑 컬럼 |
|---|---|
| park_name | 매핑 실패 |
| park_type | 매핑 실패 |
| park_area | 매핑 실패 |
| lat | 매핑 실패 |
| lng | 매핑 실패 |
| school_id | 학교ID |
| school_name | 학교명 |
| nearest_park_name | nearest_park_name |
| nearest_park_dist | nearest_park_dist_m |

## `C:/2026_data_analysis_park/data_processed/schools.csv`

- 존재 여부: 있음
- 행/열: 272행, 6열
- 전체 컬럼: `학교ID, 학교명, 위도, 경도, 소재지도로명주소, 시도교육청명`

| 항목 | 매핑 컬럼 |
|---|---|
| park_name | 매핑 실패 |
| park_type | 매핑 실패 |
| park_area | 매핑 실패 |
| lat | 위도 |
| lng | 경도 |
| school_id | 학교ID |
| school_name | 학교명 |
| nearest_park_name | 매핑 실패 |
| nearest_park_dist | 매핑 실패 |
