# 2026 Park Analysis

인천 초등학교 공원 접근성 분석 웹앱입니다.

## 운영 기준

- 현재 정상 배포 기준 커밋: `b4ee21798ac7856a509cd0ad01338dcf8210a8e0`
- GitHub Pages: `https://namijini0403.github.io/2026-park-analysis/`
- 메인 진입점: `index.html`
- 데이터 경로: `data_processed/`
- 상세 리포트/시뮬레이션 iframe: `ui-preview/dist/index.html`
- 자세한 경로 기준: `OPERATING_PATHS.md`

## 로컬 실행

```powershell
python -m http.server 8080
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:8080/
```

## 배포 전 확인

- `index.html`의 데이터 경로가 `data_processed/`인지 확인한다.
- iframe 경로가 `ui-preview/dist/index.html`인지 확인한다.
- `app/dist` 또는 `data/processed`로 운영 경로를 바꾸지 않는다.
- GitHub Pages 공개 URL에서 지도, 학교 마커, 상세 리포트, 후보지 시뮬레이션을 확인한다.
- 핵심 파일이 공개 URL에서 HTTP 200인지 확인한다.
  - `data_processed/school_priority.csv`
  - `ui-preview/dist/index.html`

## 복구 메모

2026-04-26에 공개 앱이 깨진 뒤 `origin/main`을 `b4ee217`로 복구했다. 이후 수정은 이 커밋을 기준으로 최소 단위로 적용한다.
