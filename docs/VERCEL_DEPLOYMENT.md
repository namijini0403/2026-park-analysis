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

## Kakao 지도 키 확인

현재 앱의 기본 Kakao JavaScript 키는 `index.html` 안의 `DEFAULT_KAKAO_MAP_KEY` 값이다. Kakao Developers에서 도메인을 등록할 때 반드시 이 JavaScript 키가 속한 애플리케이션에 등록해야 한다.

도메인을 등록했는데도 지도가 뜨지 않고 콘솔 또는 네트워크에서 `domain mismatched`가 보이면 다음 중 하나다.

1. 다른 Kakao 애플리케이션에 도메인을 등록했다.
2. Vercel preview 도메인과 production 도메인이 달라 preview 도메인만 열고 있다.
3. Vercel 도메인을 등록한 뒤 아직 앱을 새로고침하지 않았다.

네 Kakao JavaScript 키를 Vercel 배포에 직접 쓰려면 Vercel Project Settings에서 Environment Variable을 추가한다.

- Name: `KAKAO_MAP_KEY`
- Value: Kakao Developers의 JavaScript 키
- Environment: Production, Preview 모두 필요하면 둘 다 선택

## AI 해설 패널 환경변수

식별앱에서 RAG 기반 AI 해설 패널을 켜려면 Vercel Project Settings에 아래 값을 추가한다.

- `OPENAI_API_KEY`: OpenAI API 키. 브라우저 번들에 넣지 않고 `/api/ai-explainer-v2` 서버리스 함수에서만 사용한다.
- `AI_EXPLAINER_ENABLED`: `false`일 때 서버리스 함수를 강제로 비활성화한다. 생략하면 `OPENAI_API_KEY`가 있을 때 동작한다.
- `VITE_AI_EXPLAINER_ENABLED`: `false`일 때 상세 리포트와 후보지 시뮬레이션 화면에서 AI 해설 패널을 숨긴다. 생략하면 노출한다.
- 선택값 `AI_EXPLAINER_MODEL`: 기본값은 `gpt-5.4-mini`.
- 선택값 `AI_EXPLAINER_MAX_OUTPUT_TOKENS`: 기본값은 `900`.
- 선택값 `AI_EXPLAINER_V2_MIN_SCORE`: retrieval 최소 점수. 기본값은 `8`.

AI 해설 v2는 앱이 먼저 선택 학교·후보지 context pack과 검색된 근거 chunk를 고정한 뒤 OpenAI Responses API에 전달한다. 서버리스 함수는 `strict json_schema`, `tool_choice=none`, `store=false`를 사용하며, 검색되지 않은 chunk id를 인용한 응답은 프론트에 표시하지 않는다.

식별앱 제출 허용 전이거나 비식별 공개 버전에서는 `AI_EXPLAINER_ENABLED=false`, `VITE_AI_EXPLAINER_ENABLED=false`로 둔다. 식별앱 운영 배포에서는 최소 `OPENAI_API_KEY`만 반드시 설정한다.

환경변수를 추가하거나 수정한 뒤에는 반드시 Redeploy해야 한다. `scripts/deploy/build_vercel_static.mjs`가 배포 시 `index.html`의 기본 Kakao 키를 이 값으로 바꿔 넣는다.

급하게 테스트만 할 때는 URL에 직접 키를 붙일 수도 있다.

```text
https://2026-park-analysis.vercel.app/?kakaoKey=여기에_JavaScript_키
```

## 배포 후 확인 URL

- `/`
- `/logo.png`
- `/data_processed/school_priority_with_functional_park_layer.csv`
- `/data_processed/candidate_grid_final.geojson`
- `/ui-preview/dist/index.html`
- `/api/ai-explainer-v2`는 `POST` 전용이며, `AI_EXPLAINER_ENABLED=true`와 `OPENAI_API_KEY`가 있을 때만 동작한다.

## 학교 PC에서 막힐 경우의 대안

1. Vercel 기본 도메인 `vercel.app`이 막히면 Vercel에 커스텀 도메인을 연결한다.
2. 그래도 막히면 Cloudflare Pages 또는 Netlify로 같은 `vercel_public` 산출물을 배포한다.
3. 인터넷 외부 스크립트 자체가 막힌 환경이면 Kakao 지도 SDK와 CDN(PapaParse) 로딩이 막힐 수 있으므로, 오프라인 발표용 캡처 영상 또는 HTML 정적 캡처본을 별도로 준비한다.
