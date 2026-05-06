# 반경 너머, 도달 가능성으로

도보 네트워크·보행 부담·활동 가능 면적을 반영한 초등학교 야외활동 환경 진단 및 XAI 우선지원 의사결정 시스템

작성일: 2026-05-04
검토·수정일: 2026-05-05
원천: `CONTEXT.md`, `OPERATING_PATHS.md`, 운영 앱 `index.html`, `ui-preview/src/*`, `data_processed/*`, 최종 적용 스크립트 중 `data_processed/`를 갱신하는 파일

범위: **운영 중인 최종 채택안만 정리**. 폐기된 중간 실험(k-means 운영, XGBoost 단독 후보지 1순위, 임의 점수합산식, 제출 패키지용 `data/processed/` 경로 전환)은 제외한다.

---

## 0. 한 줄 요약

> **인천 272개 초등학교의 야외활동 환경을 직선거리 500m가 아니라 실제 보행 도달 가능성 기준으로 재측정하고, 임의 종합점수 대신 명시적 case 분류·필터·사용자 조정형 시뮬레이션으로 정책 의사결정을 지원하는 설명가능한 웹 시스템.**

본 분석은 공식 공원 존재 여부를 부정하지 않고, 초등학생 야외활동 환경 관점에서 공식 공원 접근성과 활동 가능 공원 접근성을 분리해 진단한다.

지원 우선순위 탐색에서는 ‘공원이 아예 없는 학교’와 ‘공원은 있으나 활동면적이 제한된 학교’를 구분해, 신규 조성·학교 유휴공간 활용·기존 소공원 기능 보강 등 서로 다른 정책 처방을 검토할 수 있도록 설계했다.

---

## 0-1. 접근성 4단계 프레임

| 단계 | 질문 | 본 프로젝트의 해석 |
|---|---|---|
| 존재 | 학교 주변에 공식 공원 또는 놀이터가 존재하는가 | 공공데이터상 공원·놀이터 레코드와 기존 최근접 공원 산출값을 보존한다 |
| 도달 | 실제 보행 네트워크 기준으로 도달 가능한가 | OSMnx·Valhalla 기반 도보 500m 생활권을 직선 반경과 분리한다 |
| 보행 부담 | 간선도로 횡단, 대형 교차로, 사고위험 등 초등학생 보행 부담이 있는가 | 보행부담 요소는 점수 감점이 아니라 별도 검토·필터 조건으로 둔다 |
| 공간 기능성 | 도달한 공간이 실제 야외활동 공간으로 기능할 만한 면적을 갖추었는가 | 면적 기반 `park_function_class` 보조 레이어로 해석한다 |

---

## 도로·보행부담 용어 통일 기준

본 프로젝트는 도로 횡단과 교차로 부담을 초등학생의 녹지 접근성을 낮추는 요인으로 해석하되, 공식 도로명 또는 법정 도로분류를 입증할 수 없는 표현은 사용하지 않는다. 따라서 “고속화도로”, “자동차 전용 간선”, “접근 불가”와 같은 표현은 사용하지 않고, 분석 데이터의 도로등급에 따라 “주요 도시 간선도로”, “중간급 간선도로”, “지구 내 간선도로”로 표현한다.

본 분석에서 도로 관련 요소는 물리적 접근 불가능성을 의미하지 않는다. 보행 경로는 존재하지만, 초등학생 관점에서 간선도로 횡단, 대형 교차로 인접, 우회 부담 등이 접근 품질을 낮출 수 있음을 의미한다. 따라서 최종 표현은 “단절”보다 “보행부담”, “접근 품질 저하”, “간선도로 횡단 부담”을 우선 사용한다.

| 데이터 기준 | 발표 표현 |
|---|---|
| primary | 주요 도시 간선도로 |
| secondary | 중간급 간선도로 |
| tertiary | 지구 내 간선도로 |
| residential/service/living_street | 생활도로 |
| major_road_crossing_count | 간선도로 횡단 횟수 |
| large_intersection_flag | 대형 교차로 인접 |
| barrier_level | 보행부담 등급 |

금지 표현: 고속화도로, 자동차 전용 간선, 접근 불가, 완전 단절, 이용 불가, 위험 도로.

권장 표현: 주요 도시 간선도로 횡단, 중간급 간선도로 횡단, 지구 내 간선도로 횡단, 보행부담, 접근 품질 저하, 초등학생 보행 관점에서 추가 검토 필요.

---

## 공식 공원 접근성과 활동 가능 공원 접근성 분리 기준

본 프로젝트는 공식 공원 여부를 부정하지 않는다. 다만 초등학생 야외활동 환경을 진단할 때, 공식 공원 “존재”와 실제 활동공간으로서의 “기능성”은 분리해 해석한다.

### 기준 근거

1. 법정 기준 기반
   - 도시공원 및 녹지 등에 관한 법률 시행규칙 [별표 3] 도시공원의 설치 및 규모의 기준에 따르면, 소공원은 유치거리와 규모 제한이 없고, 어린이공원은 유치거리 250m 이하·규모 1,500㎡ 이상, 근린생활권 근린공원은 유치거리 500m 이하·규모 10,000㎡ 이상, 도보권 근린공원은 유치거리 1,000m 이하·규모 30,000㎡ 이상이다.
   - 따라서 1,500㎡ 미만은 어린이공원 최소 규모 기준에 미달하는 초소형 공간으로 해석한다.
   - 10,000㎡ 이상은 근린생활권 근린공원 규모 기준 이상으로 해석한다.

2. 데이터 분포 기반 운영 기준
   - 현재 데이터에서 어린이공원 중앙값은 약 2,066㎡, 소공원 중앙값은 약 1,072㎡이다.
   - 3,000㎡ 미만 공원이 상당수 분포하므로, 3,000㎡는 소규모 공원군과 중간 규모 활동공간을 구분하기 위한 분석상 운영 기준으로 사용한다.
   - 1,500㎡와 10,000㎡는 법정 기준, 3,000㎡는 분석상 운영 기준이다.

3. 보수적 표현 원칙
   - 1,500㎡ 미만 또는 면적이 없는 놀이터성 시설을 “공원이 아니다”라고 표현하지 않는다.
   - “공식 공원은 있으나, 면적상 넓은 야외활동 공간으로 보기에는 제한적”이라고 표현한다.
   - 이 기준은 정책 우선지원 탐색과 UI 설명을 위한 보조 레이어이며, 기존 Case 분류를 대체하지 않는다.

| 내부 분류값 | 면적 기준 | 근거 성격 | UI 표시명 | 해석 |
|---|---:|---|---|---|
| playground_like | 면적 없음 또는 < 1,500㎡ 또는 시설유형=놀이터 | 어린이공원 최소 규모 기준 미달 + 데이터 특성 | 놀이터급·초소형 공간 | 공식 접근성은 있을 수 있으나 넓은 야외활동 공간으로는 제한적 |
| small_child_park | 1,500㎡ 이상 ~ 3,000㎡ 미만 | 법정 최소 기준 이상 + 분석상 운영 기준 미만 | 소규모 어린이공원급 | 놀이·휴식 기능은 있으나 활동면적 제한 가능 |
| mid_activity_park | 3,000㎡ 이상 ~ 10,000㎡ 미만 | 분석상 운영 기준 | 중간 규모 활동공간 | 일정 수준 이상의 야외활동 공간으로 해석 |
| neighborhood_park_scale | 10,000㎡ 이상 | 근린생활권 근린공원 규모 기준 이상 | 근린공원급 활동공간 | 넓은 활동 가능 공원으로 해석 |

3,000㎡ 기준은 법정 기준이 아니라, 본 데이터의 분포와 초등학생 야외활동 공간 해석을 위해 설정한 분석상 운영 기준이다. 따라서 발표 및 문서에서는 “법정 기준”이 아니라 “운영 기준”으로 표기한다.

---

## 1. 이번 검토 반영 사항

| 항목 | 최종 확인·반영 내용 |
|---|---|
| 도보권 파일 | **지도 표시 도보권**은 `isochrone_valhalla.geojson`, **2026-05-04 녹지·case 운영값**은 `school_isochrone_500m.geojson` 기반 교차면적 재계산값으로 구분 |
| 도보권/직선권 면적비 | 지도 Valhalla 레이어 평균 41.67%, 현재 case 산출 기준 도보권 평균 26.94%(본류 242개교), 아파트 보정 시나리오 평균 38.97%(본류)로 구분 |
| 앱 표시용 녹지비율 | 원본 `iso_green_ratio`와 Case는 유지하되, 앱 표시값 `display_green_ratio`는 Valhalla 도보권과 아파트 보정 도보권 중 더 넓은 도보권을 분모로 사용하고, 대형 공원 중심점+면적 원형 프록시는 공원별 30,000㎡ 기여 상한을 적용 |
| 행정착시 | 현재 운영 CSV 기준, `buf_park_count >= 1 AND iso_park_count == 0 AND iso_playground_count <= 2` 조건 25개교. `outlier_type` 컬럼은 현재 운영 CSV에 없으므로 앱 배지 근거로 쓰지 않음 |
| case 분포 | 최신 `school_priority.csv`: case1 17, case2 68, case3 77, case4 80, 별도 묶음 30 |
| 우선순위 정렬 | 현재 스크립트는 `final_quartile`이 있을 때만 사용. 현재 CSV에는 없어 실제 정렬은 녹지 낮음 → 놀이터 적음 → 최근접 공원 멂 → 학생수 추세 높음 순으로 작동 |
| 신설학교 | 현재 `school_priority.csv`의 `is_new_school=1` 기준 6개 |
| 현장 검수 표현 | 발표 문서에서는 개인 역할 설명을 빼고 **수동 검수·봉인값 시스템**으로만 설명 |

---

## 2. 연구의 핵심 방향성

### 2-1. 직선 500m가 아니라 보행 도달 가능성

| 구분 | 직선 500m | 실제 도보 500m |
|---|---|---|
| 의미 | 학교 좌표 중심 원형 buffer | 도로망 기반 보행권 polygon |
| 앱 표시 파일 | `data_processed/school_buffer_500m.geojson` | `data_processed/isochrone_valhalla.geojson` |
| 2026-05-04 운영 지표 산출 기준 | 반경 polygon과 공원 추정 polygon 교차면적 | `data_processed/school_isochrone_500m.geojson`과 공원 추정 polygon 교차면적 |
| 앱 토글 | `⭕ 직선거리 500m` | `🚶 실제 도보이동 500m` |

발표에서 중요한 메시지는 단순하다. **지도상 500m 안에 공원이 있어도, 아이가 실제로 걸어서 도달할 수 있는 공간은 훨씬 작을 수 있다.**

현재 수치 기준:

- 지도 표시용 Valhalla 도보권 평균 면적비: 직선 500m 대비 **41.67%**
- 최신 case·녹지 산출 기준 도보권 평균 면적비: 본류 242개교 기준 **26.94%**, 중앙값 **26.10%**
- 아파트 내부 보행 가능성 보정 시나리오 적용 후 평균 면적비: 본류 기준 **38.97%**
- 2026-05-06 앱 표시용 녹지비율 보수 산정 적용 후, 표시 녹지비율 80% 이상 학교는 **0개교**다. 백운초는 **21.37%**, 함박초는 **8.09%**로 표시한다. 기존 운영 `iso_green_ratio`와 Case는 변경하지 않는다.

### 2-2. 설명가능성: 단일 블랙박스 점수 회피

- `case 1~4`는 정책군 분류이고, `priority_rank`는 같은 case 내부의 검토 순서다.
- case 분류는 `nearest_park_dist_m`, `iso_park_count`, `iso_green_ratio`, `is_separate_bundle_tag`를 이용한 명시 규칙으로 산출한다.
- `case_type`, `case_label`, `priority_score`, `priority_rank`, `is_low_access_tag`, `is_case_conflict_tag`, `is_separate_bundle_tag` 같은 결과·태그 변수는 모델 입력 피처로 사용하지 않는다.
- AI 추천은 최종 결정자가 아니라 기본 시나리오다. 사용자는 필터와 가중치를 조정해 후보지 순위를 즉시 바꿀 수 있다.

### 2-3. 임의 가중치 최소화

| 영역 | 최종 방식 |
|---|---|
| case 분류 | 가중합 점수 금지. 명시적 임계 규칙으로만 분류 |
| 녹지 분기 | `<1%`, `1~5%`, `>=5%` 고정 컷 |
| 학생수 전망 | Model 1 채택 후 2029/2031 예측 파일 고정 |
| 후보지 잠재수요 | 1km 총량 예측 → 250m 분배. LightGBM은 share 보정 역할로 한정 |
| AI 추천 | 기본값 `schoolDistance 70 / benefit 20 / parkDistance 10`, 사용자가 즉시 조정 가능 |
| 보행부담 요소 | 점수 감점이 아니라 boolean 필터로 제외 |
| 재개발 | 모델 feature가 아니라 경고 레이어 |
| 수동 검수값 | 자동 재계산보다 봉인값 우선 |

---

## 3. 운영 앱 구조

```text
index.html (Kakao Map)
  - 학교 마커, 공원 마커, 직선 500m, 도보 500m, 재개발, 대단지 아파트, 후보지 격자
  - 좌측 검색·필터, 우측 학교 상세 패널, 하단 토글바
  - iframe: ui-preview/dist/index.html
      - SchoolDetailReportPagePreview.tsx
      - SimulationPage.tsx
      - StatisticsPageSafe.tsx
```

운영 기준은 `OPERATING_PATHS.md` 그대로다.

| 변수 | 운영 파일 | 역할 |
|---|---|---|
| `schools` | `data_processed/school_priority.csv` | 학교 case·priority·녹지·접근성 통합 마스터 |
| `schoolCoords` | `data_processed/schools.csv` | 학교 좌표 |
| `studentTrend` | `data_processed/student_trend.csv` | 2020~2025 학생수 시계열 |
| `nearestPark` | `data_processed/school_nearest_park.csv` | 최근접 공원 |
| `beneficiaryForecast` | `data_processed/school_enrollment_forecast_20260418_model1.csv` | 학교별 2029/2031 학생 전망 |
| `similarSchools` | `data_processed/school_similar_schools_top5.csv` | KNN 유사학교 |
| `candidateBarrierRoutes` | `data_processed/candidate_barrier_routes_by_school.json` | 후보지-학교 경로 보행부담 요소 |
| `parks` | `data_processed/parks.csv` | 공원·놀이터 통합 |
| `isochrone` | `data_processed/isochrone_valhalla.geojson` | 지도 표시용 도보 500m 레이어 |
| `buffer` | `data_processed/school_buffer_500m.geojson` | 직선 500m 비교 버퍼 |
| `redevelopment` | `data_processed/redevelopment_geocoded.csv` | 재개발 경고 레이어 |
| `largeApt` | `data_processed/large_apt_complexes_2025.csv` | 500세대 이상 아파트 표시 |
| 후보지 | `data_processed/candidate_grid_final.geojson` | 250m 후보지 격자 |

주의: `ui-preview/src/statisticsPreviewDataSafe.ts`는 정적 프리뷰 데이터라 과거 case 수치가 남아 있을 수 있다. 발표 수치의 기준은 이 문서와 `data_processed/school_priority.csv`다.

---

## 4. 최종 분석 파이프라인

```text
학교·공원·놀이터·인구·재개발·OSM·대단지 아파트
  ↓
표준화: 인코딩, 좌표계, 학교명·주소 정규화
  ↓
공간분석: 도보 500m + 직선 500m buffer
  ↓
공원·녹지·놀이터·보행부담 요소 산출
  ↓
2026-05-04 녹지비율 교정:
  도보권/직선권 polygon ∩ 공원 추정 polygon 교차면적 기준으로 재계산
  ↓
수동 검수 봉인값 적용
  ↓
case 1~4 및 별도 묶음 분류
  ↓
학생수 전망, 후보지 잠재수요, KNN 유사학교 산출
  ↓
후보지 생성·학교부지 배제·보행부담 필터
  ↓
Kakao Map + React iframe 웹 앱
```

---

## 5. Case 분류 체계

### 5-1. 최신 규칙

| Case | 규칙 | 정책 라벨 | 상태 라벨 |
|---|---|---|---|
| case 1 | `nearest_park_dist_m >= 500` AND `iso_park_count == 0` AND `iso_green_ratio == 0` | 즉시 개선 대상 | 공원 접근 결핍 |
| case 2 | 비교군 AND `iso_green_ratio < 1` | 우선 검토 대상 | 공원 접근 가능 · 녹지 부족 |
| case 3 | 비교군 AND `1 <= iso_green_ratio < 5` | 모니터링 대상 | 공원 접근 가능 · 녹지 양호 |
| case 4 | 비교군 AND `iso_green_ratio >= 5` | 유지·관리 대상 | 공원 접근 양호 · 녹지 충분 |
| 별도 묶음 | 강화군 / 옹진군 / 별도 정책 검토 대상 | 별도 정책 적용 | 별도 묶음 |

비교군은 `iso_park_count >= 1` 또는 `nearest_park_dist_m < 500` 중 하나 이상을 만족하는 본류 학교다.

### 5-2. 최신 운영 분포

| 분류 | 학교 수 |
|---|---:|
| case 1 | 17 |
| case 2 | 68 |
| case 3 | 77 |
| case 4 | 80 |
| 별도 묶음 | 30 |
| **합계** | **272** |

### 5-3. 우선순위 정렬

현재 스크립트의 내부 정렬은 case별로 다음 변수를 사전식으로 적용한다.

```text
final_quartile 점수(컬럼이 있을 때만) →
iso_green_ratio 낮음 →
iso_playground_count 적음 →
nearest_park_dist_m 멂 →
student_slope 높음 →
학교명
```

현재 `school_priority.csv`에는 `final_quartile` 컬럼이 없어, 실제 운영 데이터에서는 녹지·놀이터·거리·학생수 추세 순서가 우선 작동한다.

---

## 6. 도보 500m 보완 로직

### 6-1. 아파트 내부 보행로 누락 보정

문제: OSM/도로망 기반 도보권은 아파트 단지 내부 보행로를 충분히 반영하지 못할 수 있다.

최종 적용:

- 스크립트: `scripts/accessibility/build_apartment_permeability_walk_adjustment_20260504.py`
- 기준 gap: `직선 500m buffer - 현재 도보 500m isochrone`
- 추가 대상: gap 안의 OSM 주거·아파트 polygon 중, 기존 도보권 경계 15m buffer와 연결되고 500m² 이상인 조각
- 보호 대상: 수동 검수·봉인 학교는 자동 보정으로 덮어쓰지 않음
- 운영값 보존: `iso_green_ratio`, `case_type`은 덮어쓰지 않고 시나리오 컬럼으로만 보관
- 산출물:
  - `data_processed/school_walk_500m_apartment_adjustment_20260504.csv`
  - `data_processed/school_isochrone_500m_apt_adjusted_20260504.geojson`
  - `data_processed/blocked_parks_by_apt_adjustment_20260504.csv`

운영 CSV에는 다음 sidecar 컬럼이 들어가 있다.

| 컬럼 | 의미 |
|---|---|
| `apt_blocked_m2` | 도보권 gap 안에서 추가 검토된 주거·아파트 면적 |
| `apt_gap_ratio` | 직선 500m buffer 대비 추가 검토 면적 비율 |
| `blocked_park_count` | 보정 조각과 맞닿은 공원 수 |
| `blocked_park_intersect_m2` | 보정 조각과 공원 추정 polygon 교차면적 |
| `current_green_ratio` | 보정 전 도보권 녹지율 |
| `corrected_green_ratio` | 아파트 보행 가능성 시나리오 녹지율 |
| `green_ratio_delta` | 보정 전후 녹지율 차이 |

기술통계:

- 본류 242개교 중 아파트 보행 가능성 flag: **206개교**
- 우선 검토 후보: **194개교**
- 보정 조각과 공원이 맞닿은 학교: **132개교**
- 본류 평균 추가 면적: **94,035.9m²**
- 보정 전 도보권/직선권 평균 면적비: **26.98%**
- 보정 시나리오 후 평균 면적비: **38.97%**
- 녹지율 변화 평균: **-0.95%p**
  단, 면적 분모가 함께 커지므로 보정 후 녹지율이 반드시 증가하지는 않는다. 그래서 운영 case를 자동 변경하지 않는다.

### 6-2. 학교·후보지 보완 로직

후보지 생성과 표시에는 학교 관련 보완 로직이 별도로 들어가 있다.

- 후보지는 case1~3 학교 도보권을 중심으로 연결 학교(`linked_schools`)를 붙인다. case4는 외부 후보를 기본 생성 대상으로 보지 않는다.
- 후보지 원자료 1,666개 중 학교·대학 부지와 겹치는 131개를 제외해 최종 외부 후보지 1,535개를 사용한다.
- 학교부지 배제는 `scripts/candidate_generation/exclude_school_sites.py` 기준이다.
  - OSM `amenity=school` polygon + 10m buffer
  - OSM `amenity=college/university` polygon + 15m buffer
  - OSM polygon이 없으면 공식 학교·대학 좌표 point fallback
- 특정 학교의 직접 연결 후보가 6개 미만이면 `index.html`의 `supplementCandidateFallbacks()`가 직선거리 600m 이내 인접 후보를 **보조 후보지**로 추가한다.
- 보조 후보지는 `fallback_candidate=true`, `fallback_distance_basis=straight_line_m`으로 표시하며 기본 후보와 구분한다.
- React mapper는 항상 `SCHOOL_INT` 후보를 추가해 학교 내부 개선·복합화 옵션을 비교할 수 있게 한다.

---

## 7. AI / ML 모델 사용처

### 7-1. 학교별 학생 전망

- 파일: `data_processed/school_enrollment_forecast_20260418_model1.csv`
- 모델 버전: `school_enrollment_model1_walk_forward_recursive_20260418`
- 채택 모델: `weighted_trend_plus_lgbm_residual`

| 모델 | 1년 ahead | 2년 recursive | 3년 recursive | 중기 평균 |
|---|---|---|---|---|
| Model 1 선택 | R²=0.965, MAE=37.3 | R²=0.943, MAE=48.2 | R²=0.921, MAE=61.5 | R²=0.932, MAE=54.8 |
| Model 2 ElasticNet | R²=0.973, MAE=33.6 | R²=0.922, MAE=60.1 | R²=0.853, MAE=82.2 | R²=0.888, MAE=71.1 |

1년 단기는 Model 2가 좋았지만, 발표에 쓰는 2029/2031 전망은 중기 recursive 영역이라 Model 1을 채택했다.

### 7-2. 후보지 잠재수요

```text
구별 시계열 → cohort ratio → 1km 예측
  + Prophet 총량 분배
  ↓
2029 = 0.8*cohort + 0.2*Prophet
2031 = 0.7*cohort + 0.3*Prophet
  ↓
250m 분배: base share + LightGBM share correction
  ↓
candidate_grid_final.geojson
```

- LightGBM은 아동 수 직접 예측이 아니라 250m share 보정에 한정한다.
- `walkshed_beneficiary_2029/2031`이 후보지 표시 수요의 1순위다.
- `xgb_predicted_*`는 fallback의 fallback으로만 사용한다.

### 7-3. KNN 유사학교

- 파일: `data_processed/school_similar_schools_top5.csv`
- 방식: `StandardScaler + NearestNeighbors`
- 본류 학교와 별도 묶음 학교를 분리해 계산한다.
- 운영 결과 변수는 입력 피처에서 제외한다.

### 7-4. AI 추천 시뮬레이션

`ui-preview/src/SimulationPage.tsx` 기준:

```ts
AI_DEFAULT_FILTERS = {
  excludePrimary: true,
  excludeSecondary: true,
  excludeTertiary: false,
  excludeAccident: false,
  excludeRedev: false,
  excludeLargeApt: false,
}

AI_DEFAULT_WEIGHTS = {
  benefit: 20,
  schoolDistance: 70,
  parkDistance: 10,
}
```

- 주요 도시 간선도로·중간급 간선도로 횡단 후보는 기본 추천에서 제외한다.
- 후보가 없으면 주요 도시 간선도로 미횡단 조건은 유지하고, 중간급 간선도로 조건만 완화한다.
- 추천은 3개까지만 보여주며, 모든 후보는 필터와 점수 구조를 통해 설명 가능하다.

---

## 8. 실측 봉인값 시스템

자동 계산값보다 수동 검수·확정값을 우선한다.

- 최근접 공원명·도보거리: `school_nearest_park.csv`, `school_priority.csv`에 일관 반영
- 수동 녹지비율: 예를 들어 인천신석초 `iso_green_ratio=7.3447%` 봉인
- 경로 보행부담 요소: 자동 산출이 현장·지도 확인과 다르면 봉인값 우선
- 봉인 저장: `output/sealed_nearest_park_dist.json`
- 2026-05-04 자동 녹지 교정에서도 보호 학교 19개교, 수동 녹지비율 6개교는 덮어쓰지 않음

발표 표현: **공공 공간 데이터의 빈틈을 자동 계산만으로 밀어붙이지 않고, 수동 검수값을 별도 봉인해 재계산 과정에서 보존했다.**

---

## 9. 기술통계 요약

### 9-1. 본류 242개교 접근성·녹지 지표

| 지표 | 평균 | 중앙값 | Q1 | Q3 | 최소 | 최대 |
|---|---:|---:|---:|---:|---:|---:|
| 최근접 공원 도보거리(m) | 318.6 | 219.9 | 120.3 | 328.1 | 0.0 | 13,471.8 |
| 도보권 녹지율(앱 표시, %) | 4.59 | 2.45 | 0.57 | 6.47 | 0.00 | 54.31 |
| 도보권 공원 수 | 2.23 | 2.00 | 1.00 | 3.00 | 0 | 15 |
| 직선권 공원 수 | 3.93 | 4.00 | 2.00 | 6.00 | 0 | 12 |
| 도보권 놀이터 수 | 0.53 | 0.00 | 0.00 | 0.00 | 0 | 18 |
| 도보권/직선권 면적비(%) | 26.94 | 26.10 | 15.56 | 37.17 | 2.48 | 99.84 |

추가 해석:

- 본류 242개교 중 도보권 공원 0개: **44개교**
- 본류 242개교 중 도보권 놀이터 0개: **207개교**
- 최근접 공원 500m 이상: **21개교**
- 현재 운영 기준 행정착시 조건 학교: **25개교**
- 표시 녹지비율 분포: **0% 36개교**, **0~5% 127개교**, **5~10% 47개교**, **10% 이상 32개교**

주의: `case_type`은 기존 운영 `iso_green_ratio` 기준을 유지하고, 위 녹지율 통계는 2026-05-06 앱 표시용 `display_green_ratio` 기준으로 재계산했다.

### 9-2. case별 핵심 지표

| Case | 학교 수 | 도보권 공원 0개 | 도보 놀이터 0개 | 평균 녹지율 | 중앙 녹지율 | 평균 최근접 공원거리 |
|---|---:|---:|---:|---:|---:|---:|
| case 1 | 17 | 17 | 10 | 0.00% | 0.00% | 1,637.0m |
| case 2 | 68 | 27 | 61 | 0.75% | 0.45% | 248.7m |
| case 3 | 77 | 0 | 69 | 3.00% | 2.51% | 211.5m |
| case 4 | 80 | 0 | 67 | 10.37% | 8.06% | 201.0m |

### 9-3. 구별 case 분포

| 구·군 | case1 | case2 | case3 | case4 | 별도 묶음 |
|---|---:|---:|---:|---:|---:|
| 중구 | 6 | 0 | 1 | 9 | 0 |
| 동구 | 1 | 4 | 2 | 1 | 0 |
| 미추홀구 | 1 | 10 | 7 | 5 | 0 |
| 연수구 | 2 | 8 | 6 | 18 | 0 |
| 남동구 | 0 | 9 | 16 | 14 | 0 |
| 부평구 | 4 | 13 | 14 | 11 | 0 |
| 계양구 | 0 | 8 | 14 | 5 | 0 |
| 서구 | 3 | 16 | 17 | 17 | 0 |
| 강화군 | 0 | 0 | 0 | 0 | 20 |
| 옹진군 | 0 | 0 | 0 | 0 | 10 |

### 9-4. 잠재 수요와 후보지

| 항목 | 값 |
|---|---:|
| 2029 전체 학교 전망 합계 | 120,035명 |
| 2031 전체 학교 전망 합계 | 108,184명 |
| 2029 본류 학교 전망 합계 | 118,699명 |
| 2031 본류 학교 전망 합계 | 107,156명 |
| 2029 case1+2 전망 합계 | 44,360명 |
| 2031 case1+2 전망 합계 | 40,638명 |
| 최종 외부 후보지 | 1,535개 |
| 후보지 중 worst case1 연결 | 238개 |
| 후보지 중 worst case2 연결 | 649개 |
| 후보지 중 worst case3 연결 | 648개 |
| 후보지 `walkshed_beneficiary_2029` 평균/중앙값 | 252.6명 / 148.3명 |
| 후보지 `walkshed_beneficiary_2029` 최대 | 2,624.0명 |

### 9-5. 현재 행정착시 예시

현재 운영 CSV 기준으로는 아래처럼 직접 조건을 적용해 설명한다.

| 학교 | 구 | case | 직선권 공원 | 도보권 공원 | 도보 놀이터 |
|---|---|---:|---:|---:|---:|
| 인천연수초등학교 | 연수구 | 2 | 9 | 0 | 0 |
| 인천만수북초등학교 | 남동구 | 2 | 6 | 0 | 0 |
| 인천주원초등학교 | 남동구 | 2 | 6 | 0 | 1 |
| 인천용학초등학교 | 미추홀구 | 2 | 5 | 0 | 0 |

---

## 10. 발표용 핵심 인사이트

1. **직선 500m는 과대평가 위험이 크다.**
   직선권 공원 수 평균은 3.93개지만 도보권 공원 수 평균은 2.23개다. 도보권 놀이터 중앙값은 0개다.

2. **case1은 정말 다른 군집이다.**
   case1 17개교는 모두 도보권 공원 0개, 녹지율 0%이며 평균 최근접 공원거리가 1.64km다.

3. **case2는 "가까운 공원이 아예 없음"만의 문제가 아니다.**
   운영 Case 기준에서는 최근접 공원이 500m 안에 있어도 원본 도보권 녹지율(`iso_green_ratio`)이 1% 미만이면 우선 검토 대상이다. 발표·앱에서는 같은 Case를 유지하되, 보수 산정한 표시 녹지율(`display_green_ratio`)을 함께 제시한다.

4. **아파트 내부 보행로 누락은 운영 case를 뒤집는 자동 보정이 아니라 시나리오다.**
   보행 가능성이 있는 면적을 별도로 보여주되, 검증 전에는 `case_type`을 덮어쓰지 않는다.

5. **후보지는 설치 좌표가 아니라 검토 블록이다.**
   학교·대학 부지를 제외하고, 직접 연결 후보가 부족할 때만 보조 후보를 붙인다.

---

## 11. 한계와 발표 표현 원칙

- 250m 후보지는 **검토 블록**이지 정확한 설치 좌표가 아니다.
- 잠재수요는 **추정치**다. "예상 수혜 아동 규모" 또는 "잠재 수혜인구 추정"으로 표현한다.
- AI 추천은 **기본 정책 시나리오**이며, 사용자 조정·현장 검토가 전제다.
- 직선거리 500m는 비교 설명용이다. 최종 취약성 판단은 도보권 지표와 수동 검수값을 함께 본다.
- 아파트 보정값은 시나리오 컬럼이다. 운영 `case_type`을 자동 변경하지 않는다.
- 동구 공원 데이터는 공공데이터 누락으로 OSM 보완을 사용했다.
- 신설학교는 현재 운영 CSV 기준 6개이며 학생수 시계열이 제한적일 수 있다.
- R² 0.9대는 내부 검증 성능이지 장기 일반화 보증이 아니다.
- SHAP은 "아동 수 결정요인"이 아니라 **공간 분배 보정 기여 변수**로 표현한다.

표현 권장:

| 피해야 할 표현 | 권장 표현 |
|---|---|
| 미래 수혜인구 예측 | 미래 잠재 수혜인구 추정 |
| AI가 추천한 최종 후보 | 기본 시나리오 + 사용자 조정 가능 후보 |
| 정확 일치 100% | 총량보존의 수학적 일관성 |
| 아파트 보정 후 case 변경 | 아파트 내부 보행 가능성 시나리오 |

---

## 12. 발표 슬라이드 매핑 제안

| 슬라이드 | 본 문서 절 | 강조 포인트 |
|---|---|---|
| 문제 정의 | §0, §2 | 직선 500m와 실제 도보권의 차이 |
| 데이터 & 방법 | §3, §4 | 운영 경로, 도보권, 녹지비율 교정 |
| 분류 체계 | §5 | 17/68/77/80/30, 명시 규칙 |
| 보완 로직 | §6 | 아파트 내부 보행로, 학교부지 배제, 보조 후보 |
| AI/ML 활용 | §7 | 학생 전망, 후보지 수요, KNN, AI 추천 |
| 봉인값 시스템 | §8 | 자동 계산보다 검수값 우선 |
| 기술통계 | §9 | 평균·중앙값·case별·구별 분포 |
| 정책 메시지 | §10 | 도달 가능성 중심 정책 |
| 한계와 표현 | §11 | 검토 블록, 잠재 추정, 시나리오 표현 |

---

## 13. 핵심 운영 파일 빠른 참조

- 진입: `index.html`, `ui-preview/src/main.tsx`
- React: `ui-preview/src/PreviewWorkspaceSafe.tsx`, `ui-preview/src/SimulationPage.tsx`, `ui-preview/src/SchoolDetailReportPagePreview.tsx`
- 데이터 변환: `ui-preview/src/schoolDataBridge.ts`, `ui-preview/src/schoolDataMapper.ts`
- 운영 마스터: `data_processed/school_priority.csv`
- 지도 도보권: `data_processed/isochrone_valhalla.geojson`
- 2026-05-04 녹지·보정 기준 도보권: `data_processed/school_isochrone_500m.geojson`
- 직선권: `data_processed/school_buffer_500m.geojson`
- 아파트 보정: `data_processed/school_walk_500m_apartment_adjustment_20260504.csv`
- 아파트 보정 도보권: `data_processed/school_isochrone_500m_apt_adjusted_20260504.geojson`
- 최종 후보지: `data_processed/candidate_grid_final.geojson`
- 학교부지 배제 로그: `data_processed/school_exclusion_log.csv`
- 유사학교: `data_processed/school_similar_schools_top5.csv`
- 봉인값: `output/sealed_nearest_park_dist.json`

---

## 부록. 채택하지 않은 접근

| 접근 | 제외 이유 |
|---|---|
| 가중합 단일 priority 점수 | 임의 가중치가 정책 판단을 숨김 |
| 직선거리만으로 접근성 평가 | 강·철도·대로·단지 구조를 반영하지 못함 |
| OSMnx convex_hull 등시선만 사용 | 노드가 적은 학교에서 비정상 산출 가능 |
| 보행부담 요소 거리 가중 감점 | 보행 부담을 낮은 점수로 희석할 위험 |
| 재개발을 모델 feature로 사용 | 정책 외생변수가 모델 판단에 섞임 |
| 결과 변수로 모델 학습 | 자기복원·데이터 누수 위험 |
| XGBoost 단독 후보지 수요 | 학교 단위 평균 입력으로 후보지별 차이 왜곡 |
| AI가 후보지를 자동 확정 | 후보지는 검토 블록이며 현장·예산·도시계획 검토가 필요 |

---

*본 문서는 발표·PPT 자료의 사실 근거 정리용이며, 지도 캡처와 차트 이미지는 별도로 제작한다.*
