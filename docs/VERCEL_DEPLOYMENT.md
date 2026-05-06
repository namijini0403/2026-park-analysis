# Vercel 배포 가이드

이 앱은 GitHub Pages 대신 Vercel 정적 배포로 외부 공개할 수 있다.

## 배포 구조

- Vercel build command: `npm run build:vercel`
- Vercel output directory: `vercel_public`
- 진입점: `vercel_public/index.html`
- 데이터: `vercel_public/data_processed/`
- 상세 리포트 iframe: `vercel_public/ui-preview/dist/index.html`

`scripts/deploy/build_vercel_static.mjs`가 필요한 파일만 `vercel_public`으로 복사한다. 전체 분석 코드, 원자료, `.env` 등은 배포 산출물에 포함하지 않는다.

## MJ가 Vercel에서 해야 할 일

1. Vercel에 로그인한다.
2. `Add New...` → `Project` → GitHub 저장소 `2026-park-analysis`를 Import한다.
3. Root Directory는 저장소 루트 그대로 둔다.
4. 설정은 `vercel.json`이 자동 적용되도록 둔다.
   - Framework Preset: Other 또는 자동
   - Build Command: `npm run build:vercel`
   - Output Directory: `vercel_public`
5. Deploy를 누른다.
6. 배포 URL 예: `https://2026-park-analysis.vercel.app`를 연다.
7. Kakao Developers 콘솔에서 JavaScript 키의 Web 플랫폼 도메인에 Vercel 도메인을 추가한다.
   - 예: `https://2026-park-analysis.vercel.app`
   - 커스텀 도메인을 쓰면 그 도메인도 추가한다.
   - Vercel preview 도메인까지 지도 테스트를 하려면 preview URL도 별도로 추가한다.

## 배포 후 확인 URL

- `/`
- `/logo.png`
- `/data_processed/school_priority_with_functional_park_layer.csv`
- `/data_processed/candidate_grid_final.geojson`
- `/ui-preview/dist/index.html`

## 학교 PC에서 막힐 경우의 대안

1. Vercel 기본 도메인 `vercel.app`이 막히면 Vercel에 커스텀 도메인을 연결한다.
2. 그래도 막히면 Cloudflare Pages 또는 Netlify로 같은 `vercel_public` 산출물을 배포한다.
3. 인터넷 외부 스크립트 자체가 막힌 환경이면 Kakao 지도 SDK와 CDN(PapaParse) 로딩이 막힐 수 있으므로, 오프라인 발표용 캡처 영상 또는 HTML 정적 캡처본을 별도로 준비한다.
