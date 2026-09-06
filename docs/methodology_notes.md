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

## 3b. 도보 500m 도달권 v3 — 정확 엣지 절단(exact edge trimming) 방식 (2026-09-06, 지도 표시 기준)

### 배경
지도에 표시하던 OSMnx v2 등시권(`school_isochrone_500m.geojson`)은 (1) 노드 기준 컷오프라 500m 경계에 걸친 도로의 도달 가능한 앞부분이 통째로 빠지거나 긴 단순화 엣지가 통째로 들어가고, (2) 학교 중심점을 최근접 **노드**로 스냅해 캠퍼스 중심~도로 오프셋을 무시하며, (3) 도로선 25m 버퍼 합집합이라 가시(tendril)형 폴리곤·블록 내부 구멍이 생기고, (4) 분리 조각 중 최대 조각만 남기고 엣지가 없으면 500m 원으로 대체(도달성 미확인을 완전 접근으로 표시)하는 한계가 있었다. Kakao API는 보행 경로·등시권을 제공하지 않아 대안이 되지 못한다(좌표 지오코딩에만 사용).

### 방법 (`scripts/accessibility/build_walkshed_500m_v3.py`)
- 그래프: OSMnx `graph_from_place("Incheon, South Korea", network_type="walk", retain_all=True)` (2026-09-06 수집, 노드 78,571·엣지 216,190). 노드 30개 미만의 고립 컴포넌트(학교 부지 내부 보행로 조각 등 2,020 노드)는 스냅 대상에서 제거 — 섬 지역 네트워크는 유지.
- 출발점: 학교 점을 최근접 **엣지**에 투영하고, 투영점까지의 직선 오프셋 + 엣지 양끝까지의 선형거리를 초기 비용으로 넣은 가상 출발 노드에서 다익스트라(cutoff 500m).
- 엣지 절단: 각 엣지에서 도달 가능한 부분만 `shapely.ops.substring`으로 잘라 수집. 전체 도달 조건 `(d_u + d_v + len)/2 <= 500`.
- 표현: 부분 엣지 35m 버퍼 합집합 → 20,000㎡ 이하 내부 구멍 채움 → 2m 간소화 → 535m 원 클립. 분리 조각은 모두 유지. 엣지가 없을 때만 원 대체(`method=circle_fallback`, 이번 실행 0건).
- 표시용 폴리곤(버퍼·구멍 채움은 표현 보정)이므로 **시설 수·녹지비율 등 봉인 분석값은 재계산하지 않는다**. 분석 봉인값의 분모는 기존 파일(v2/Valhalla)을 유지한다.

### 결과 (272개교, `data_processed/school_walkshed_500m_v3_report.csv`)
| 지표 | 값 |
|---|---:|
| 500m 원 대비 면적비 평균 / 중앙값 / 최소 / 최대 | 0.335 / 0.325 / 0.060 / 0.683 |
| v3 ÷ v2(OSMnx) 면적 중앙값 | 1.284 (v2보다 작은 학교 24개교) |
| v3 ÷ Valhalla 면적 중앙값 | 0.807 (Valhalla는 격자 등고선 일반화로 과대 경향) |
| 원 대체 fallback | 0개교 |
| 학교 중심→도로 오프셋 중앙값 | 37m (최대 186m, 서도초) |

시각 비교: `reports/figures/walkshed_v3_compare_20260906.png` (갈월초·미송초·청량초, v2 / Valhalla / v3).

### 한계
- OSM 보행로 누락(아파트 단지 내부 등)은 v3도 동일하게 반영하지 못한다 → 20260504 아파트 투과성 보정 시나리오는 별도 유지.
- 35m 버퍼·구멍 채움은 담장·하천을 덮을 수 있으므로 표시용이며 분석 분모로 쓰지 않는다.
- 학교 출입구 좌표가 없어 중심점 투영으로 대체했다.
