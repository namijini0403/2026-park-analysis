# Methodology Notes

## 1. 분류 체계 v2 확정 (2026-04-09)

도시권 학교는 아래 규칙으로 분류한다.

- `case1 즉시개선필요`
  - `nearest_park_dist_m > 500`
  - `AND child_pop_quartile in [3, 4]`
- `case2 우선검토대상`
  - `(nearest_park_dist_m > 500 AND child_pop_quartile in [1, 2])`
  - `OR (nearest_park_dist_m > 400 AND nearest_park_dist_m <= 500 AND child_pop_quartile in [3, 4])`
- `case3 수요관리필요`
  - `nearest_park_dist_m <= 400`
  - `AND iso_playground_count <= 2`
  - `AND child_pop_quartile in [3, 4]`
- `case4 현상유지`
  - 위 조건에 해당하지 않는 나머지
- `island 별도정책필요`
  - `is_island == True`

## 2. 검증 원칙

- 최종 분류는 규칙 기반으로 확정한다.
- 모델 검증은 최종 의사결정에 사용하지 않는다.
- 사유:
  - `case_type` 자체가 규칙 기반으로 정의된 정답 기준이다.
  - 같은 규칙 파생 변수로 모델을 학습하면 높은 성능이 나와도 구조적으로 자기복원에 가깝다.
  - 따라서 이번 버전에서는 LightGBM 검증 결과를 방법론 본문에서 제외한다.

## 3. 도보 500m 등시선 계산 방법론 (Valhalla 기반)

### 전환 배경

- 기존 방식:
  - `OSMnx + NetworkX`
  - `network_type='walk'`
  - `convex_hull`로 폴리곤 생성
- 문제:
  - `convex_hull`은 실제 이동 가능 영역이 아니라 노드들의 볼록 껍질이다.
  - 과소/과대 추정이 혼재할 수 있다.
  - 특히 `node_count`가 작은 학교에서는 등시선이 비정상적으로 작게 계산되는 사례가 있었다.

### 새 방법론

- 엔드포인트: `https://valhalla1.openstreetmap.de/isochrone`
- 요청 방식: `HTTP POST`
- `Content-Type: application/json`
- costing: `pedestrian`
- contours: `[{"distance": 0.5}]`
- polygons: `True`

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

### 기존 OSMnx 대비 면적 비교 샘플

| 학교명 | OSMnx (m²) | Valhalla (m²) | 증감률 |
|---|---:|---:|---:|
| 인천용현남초 | 51,621 | 83,299 | +61.4% |
| 인천용현초 | 358,874 | 406,899 | +13.4% |
| 인천갈월초 | 376,572 | 473,799 | +25.8% |

### 한계

- Valhalla도 OSM 데이터 기반이다.
- OSM에 보행로가 누락된 아파트 단지 내부는 여전히 미반영될 수 있다.
- 아파트 단지 내부 보행로 완전 반영은 OSM 직접 편집이 필요하나, 현실적 제약으로 이번 작업에는 포함하지 않았다.
