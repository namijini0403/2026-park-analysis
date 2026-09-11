# 카카오·OSM·출입구 검수

분석 지도 상단 메뉴의 **도보·출입구 검수**, 또는 `assets/hybrid-walk-review.html`에서 연다. 기존 수동 보정 53개교를 대상으로 한다. 기존 검수 거리와 정책값을 자동으로 덮어쓰지 않는다.

## 계산과 검수

1. 기존 카카오 대표점 대조에서 500m 판정 차이 → 450~550m 경계 → 거리 차이 순으로 정렬한다. 처음 9개교를 표본 조회 대상으로 지정한다.
2. OSM 그래프와 최근접 간선 공간 인덱스를 한 번 만들고 모든 대상 학교의 500m 도달권을 일괄 계산한다. EPSG:5179 투영, 보행용 무방향 그래프, 간선 geometry 길이, 최근접 간선 투영점과 학교~투영점 직선 연결비용을 사용한다. 간선 끝을 정확히 자르고 10m 표시 버퍼를 만들며 내부 구멍을 채우지 않는다. 고립된 작은 컴포넌트는 숨기지 않는다. 출발 연결이 50m를 넘으면 미산출이다. 이 버퍼는 보행 가능한 필지 면적이 아니다.
3. 우선 학교에서 반경 200·400m의 8방향 표본을 만들고 OSM 거리 500m에 가까운 표본 2개씩 카카오 SHORTEST로 대조한다. 검수 공원 경로는 이전 성공 캐시를 재사용한다. 같은 간선 위의 직접 이동도 계산한다. 도착 연결 50m 초과·15km 탐색 범위 밖·단절은 거리 0이 아닌 미확보다. OSM 최근접 간선 선택과 직선 연결은 벽·출입허용을 보증하지 않는다.
4. 카카오 점간 결과는 그 표본점에만 적용한다. 원·볼록껍질로 카카오 도달권 폴리곤을 만들거나 표본 일치율을 전체 정확도라 부르지 않는다. 출발·도착 좌표 또는 경로 옵션이 바뀌면 캐시 키가 달라진다. 호출 상한과 중간 저장으로 중복 비용을 줄인다. 캐시의 시점도 확인해야 한다.
5. 우선 학교 주변 200m OSM entrance/gate 후보를 별도로 조회한다. 소속·실제 개방이 확인되지 않은 참고 후보이며, 누락은 출입구 없음을 뜻하지 않는다. 공식 자료·거리뷰·현장 근거로 시설 식별, 도보 통행 가능, 실제 좌표, 근거, 확인일, 검수자를 기록한다. 근거 없는 상태 플래그만으로 검증 완료가 되지 않으며 365일 초과 근거는 다시 확인한다.
6. 검수 화면의 JSON을 내려받아 `--reviews`로 지정해 재산출한다. 화면 저장은 현재 탭 임시 기록이고 서버 자료를 바꾸지 않는다. 두 출입구가 확인되어도 `route_review_required`로 남으며 기존 수동값 해제는 별도 경로 검수가 필요하다. 미확인 대표점은 확인된 출입구처럼 입력하지 않는다.

## 재현

저장소 루트에서 `requirements-walking.txt`의 별도 분석 환경을 사용한다. 웹 서버의 의존성을 변경하지 않는다. 대형 GraphML 원본은 저장소 밖에 있으며 기본 경로는 `../_cache/incheon_walk_graph_v3.graphml`이다. 산출물에 원본 SHA-256을 기록한다.

```powershell
python -m scripts.accessibility.build_hybrid_walk_review --max-calls 18
python -m scripts.accessibility.fetch_review_entrance_candidates
python -m unittest tests.test_hybrid_walk_review tests.test_hybrid_walk_geometry
node tests/test_hybrid_walk_ui.cjs
# 출입구 기록 반영 예시 (검수 파일은 별도 보관)
python -m scripts.accessibility.build_hybrid_walk_review --reviews C:/review/walk_entrance_reviews.json --max-calls 18
```

`--max-calls 0`이 기본이며 기존 성공값만 재사용한다. 카카오 키는 `KAKAO_REST_KEY` 또는 저장소 밖 키 파일에서 읽고 공개 파일·로그·커밋에 넣지 않는다. 호출 실패는 명시적으로 남긴다. 공원 식별 미해결 사례는 임의의 공원과 연결하지 않는다.

출처: [카카오 도보 API](https://developers.kakao.com/docs/ko/kakaomap/rest-api), [OpenStreetMap·ODbL](https://www.openstreetmap.org/copyright). 원본 검수 비교표는 `data_processed/education/route_review.json`, 통합 산출물은 `hybrid_walk_review.json`과 `hybrid_walkshed_500m.geojson`이다.

## 2026-09-11 실행 결과

- 53개교 중 OSM 도달권 39개 산출. 14개는 출발 연결 50m 초과로 보류했다.
- 우선 9개교 중 8개교에서 표본 16점의 카카오 실호출 성공. 7점에서 OSM과 500m 판정이 달랐다. 경계 중심 표본이므로 전체 오류율이 아니다. 나머지 1개교는 출발 연결 문제로 표본 대조를 보류했다.
- OSM entrance/gate 노드 후보 12개 확보. `hybrid_entrance_candidates.json`에 별도로 보관한다. 실제 출입구 쌍의 검증 완료는 0건이며 현장·공식 근거를 확인했다고 주장하지 않는다.
- 기존 보정 거리 53건 모두 유지. 39개 도형의 유효성과 출발 연결 기준 검사, Python 7개 검사, 실제 산출물 기반 JSDOM 화면·기록 저장 검사 통과.
- 화면의 저장·내려받기는 검수 기록 작성 기능이다. 확인된 출입구와 카카오 경로가 자동으로 정책값에 적용되는 기능은 아니다.
