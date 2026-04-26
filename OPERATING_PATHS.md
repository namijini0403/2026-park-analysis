# 운영 경로 기준

이 파일은 Claude Code, Codex, 제출 패키지 정리 작업자가 운영 앱 경로를 헷갈리지 않도록 고정한 기준입니다.

## 현재 GitHub Pages 운영 앱

- 기준 커밋: `b4ee21798ac7856a509cd0ad01338dcf8210a8e0`
- 운영 URL: `https://namijini0403.github.io/2026-park-analysis/`
- 메인 진입점: `index.html`
- 데이터 루트: `data_processed/`
- 상세 리포트/시뮬레이션 iframe: `ui-preview/dist/index.html`

## 반드시 유지할 경로

`index.html`의 `PATHS` 블록은 아래 계열을 사용해야 합니다.

```text
./data_processed/school_priority.csv
./data_processed/schools.csv
./data_processed/student_trend.csv
./data_processed/school_nearest_park.csv
./data_processed/school_enrollment_forecast_20260418_model1.csv
./data_processed/school_similar_schools_top5.csv
./data_processed/candidate_barrier_routes_by_school.json
./data_processed/gu_summary.csv
./data_processed/parks.csv
./data_processed/isochrone_valhalla.geojson
./data_processed/school_buffer_500m.geojson
./data_processed/redevelopment_geocoded.csv
./data_processed/large_apt_complexes_2025.csv
./data_processed/childcare_michuhol.csv
```

상세 리포트 iframe은 아래 경로를 사용해야 합니다.

```text
ui-preview/dist/index.html
```

## 현재 운영 기준에서 사용하지 않는 경로

아래 경로는 제출 패키지 정리 또는 후속 실험 과정에서 생긴 흔적일 수 있지만, 현재 GitHub Pages 운영 앱의 기준 경로가 아닙니다.

```text
data/processed/
app/dist/
app/src/
app/package.json
```

운영 앱을 수정할 때 위 경로로 전환하지 마세요. 전환이 정말 필요하면 먼저 `index.html`, GitHub Pages 공개 URL, 데이터 파일 배포 구조를 함께 바꾼 뒤 공개 URL에서 검증해야 합니다.

## 공개 URL 검증 체크리스트

수정 후에는 로컬 `localhost`만 보지 말고 반드시 공개 URL에서 확인합니다.

- Kakao 지도 표시
- 학교 마커 표시
- 상태 텍스트 `학교 우선순위: 272건`
- 상태 텍스트 `지도 표시 학교: 272건`
- 학교 클릭 시 상세 리포트/시뮬레이션 오버레이 표시
- `https://namijini0403.github.io/2026-park-analysis/data_processed/school_priority.csv` HTTP 200
- `https://namijini0403.github.io/2026-park-analysis/ui-preview/dist/index.html` HTTP 200

## 제출 패키지와 운영 앱의 차이

공모전 제출용 패키지에는 `app/` 또는 `data/processed/` 구조가 포함될 수 있습니다. 하지만 현재 공개 시연 앱은 루트 `index.html + data_processed + ui-preview/dist` 구조로 동작합니다. 제출 패키지 정리는 운영 앱 경로를 바꾸지 않는 범위에서만 진행합니다.
