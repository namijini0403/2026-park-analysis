# Methodology Notes

## 1. Rule-based 분류 체계 (최종 확정)

### case 분류 조건
- `case3 [최우선지원]`: `iso_park_count == 0 AND buf_park_count == 0` -> 마커 빨강
- `case2 [우선지원]`: `child_pop_quartile == Q4 AND iso_park_count <= 3` -> 마커 주황
- `case1 [관심필요]`: `buf_park_count >= 1 AND iso_park_count == 0` -> 마커 노랑
- `case4 [일반관리]`: 나머지 -> 마커 초록

### 행정착시 [보조배지]
아래 조건 중 하나라도 해당 시 `행정착시` 보조배지 부여

- 유형1: `buf_park_count >= 1 AND iso_park_count == 0 AND iso_playground_count <= 2`
- 유형2: `buf_park_count == 0 AND buf_playground_count >= 4 AND iso_playground_count == 0`

### case2 조건 변경 이력
- 초기: `Q4 AND iso_park_count <= 1`
- 변경: `Q4 AND iso_park_count <= 3`
- 변경 시점: `2026-04-08`
- 변경 근거: LightGBM `rule_low_ml_high` 불일치 분석 결과, Q4 아동밀도 맥락에서 `iso_park_count` 2~3개도 실질적 취약으로 판단

## 2. LightGBM 모델 상세 스펙

### 목적
- rule-based 분류 검증
- 경계 케이스 탐지

### 학습 방법
- 알고리즘: `LightGBM multiclass classification`
- 타겟: `case_type (1/2/3/4)`
- 검증: `Stratified K-Fold (k=5, class 비율 유지)`
- 저장 파일: `data_processed/lightgbm_case_type_best.pkl`
  - 5개 fold 중 validation accuracy 최고 모델 저장

### 피처셋
- `iso_park_count`
- `buf_park_count`
- `iso_playground_count`
- `buf_playground_count`
- `nearest_park_dist_m`
- `child_pop_quartile` (encoding)
- `access_ratio`
- `outlier_type` 파생 피처 포함

### 최종 성능
- Fold 1: `0.9818`
- Fold 2: `0.9455`
- Fold 3: `0.9444`
- Fold 4: `0.9630`
- Fold 5: `0.9630`
- 평균 accuracy: `0.9595`
- 전체 OOF accuracy: `0.9596`

### Confusion Matrix (최종)

| 실제 \\ 예측 | case1 | case2 | case3 | case4 |
|---|---:|---:|---:|---:|
| 실제 case1 | 49 | 0 | 0 | 0 |
| 실제 case2 | 0 | 50 | 0 | 0 |
| 실제 case3 | 0 | 0 | 45 | 0 |
| 실제 case4 | 0 | 11 | 0 | 117 |

### 과대적합이 아닌 근거
- 타겟(`case_type`)이 rule-based 파생변수이고 ML 피처와 동일한 변수 기반이므로, 높은 accuracy는 rule 학습의 결과로 해석 가능
- Fold 간 variance가 작음
  - 최소 `0.9444`
  - 최대 `0.9818`
  - 범위 `0.037`
- 오분류 패턴이 랜덤하지 않고 일관됨
  - 전부 `case4 -> case2`, `11건`
- 해당 11건은 `Q4 + iso>=4` 케이스로, rule 경계에 위치한 학교로 해석 가능

### 불일치 분석 이력
- 초기 불일치: `68건`
- 1차 재학습 후: `33건`
- case2 조건 완화(`iso<=3`) + 2차 재학습 후: `11건` (최종)
- 잔여 11건:
  - `iso>=4`인 `Q4` 학교
  - rule 추가 완화 시 과잉분류 우려가 있어 허용 오차로 유지

## 3. 도보 500m 등시선 계산 방법론 (Valhalla 기반)

### 전환 배경
- 기존 방식:
  - `OSMnx + NetworkX`
  - `network_type='walk'`
  - `convex_hull`로 폴리곤 생성
- 문제:
  - `convex_hull`은 실제 이동 가능 영역이 아니라 노드들의 볼록 껍질
  - 과소/과대 추정이 혼재
  - 특히 `node_count`가 적은 학교(예: `인천용현남초등학교`)에서 등시선이 비정상적으로 작게 계산됨

### 새 방법론: Valhalla Isochrone API
- 엔드포인트: `https://valhalla1.openstreetmap.de/isochrone`
- 요청 방식: `HTTP POST`
- Content-Type: `application/json`
- costing 모델: `pedestrian`
  - 보행자 전용, 차도 제외
- contours: `[{"distance": 0.5}]`
  - 거리 기반 `500m`, 시간 기준 아님
- polygons: `True`
  - 폴리곤 직접 반환

### 요청 예시
```python
payload = {
    "locations": [{"lat": 37.4531, "lon": 126.6408}],
    "costing": "pedestrian",
    "contours": [{"distance": 0.5}],
    "polygons": True
}
res = requests.post(
    "https://valhalla1.openstreetmap.de/isochrone",
    json=payload,
    timeout=10
)
```

### 실행 결과
- 대상: `272개교 전수`
- 성공: `272건`
- fallback: `0건`
- 요청 간 딜레이: `1초`
- 저장 파일: `data_processed/isochrone_valhalla.geojson`

### 기존 OSMnx 대비 면적 비교 (샘플 3개교)

| 학교명 | OSMnx (m²) | Valhalla (m²) | 증감률 |
|---|---:|---:|---:|
| 인천용현남초등학교 | 51,621 | 83,299 | +61.4% |
| 인천용현초등학교 | 358,874 | 406,899 | +13.4% |
| 인천갈월초등학교 | 376,572 | 473,799 | +25.8% |

### 한계
- Valhalla 역시 OSM 데이터 기반이므로, OSM에 보행로가 누락된 아파트 단지 내부는 여전히 미반영 가능
- 아파트 단지 내부 보행로 완전 반영은 OSM 직접 편집이 필요하며, 현실적 제약으로 현재는 미적용
