# Task 1 리포트: 운영 앱 실사용 추적

조사 방법: 정적 코드 읽기 전용 조사(grep/read). 어떤 파일도 수정·삭제·실행(빌드)하지 않았다. `vercel_public/`은 `.gitignore:1-2`에 등록된 빌드 산출물이라 실행하지 않고도 과거 빌드 결과가 남아있어 그대로 근거로 활용했다.

## 표: 대상별 실사용 판정

| 대상 | 실사용 여부 | 근거(파일:라인) |
|---|---|---|
| 루트 `index.html` | 사용 (운영 진입점) | `OPERATING_PATHS.md:9`, `CONTEXT.md:124` 서술과 일치. 실제 파일에서도 `PATHS` 객체가 전부 `./data_processed/...` 경로 사용 확인. |
| `index.html` → `data_processed/*` fetch | 사용 | `index.html:3214-3230` (`PATHS` 객체: schools, schoolCoords, studentTrend, nearestPark, beneficiaryForecast, similarSchools, candidateBarrierRoutes, robustRecommendations, guSummary, parks, isochrone, buffer, redevelopment, largeApt), `index.html:4009,4022,4035`(`fetch(path)` 루프로 PATHS 순회), `index.html:5477`(`fetch("./data_processed/candidate_grid_final.geojson")`) |
| `index.html` → 외부 CDN | 사용 | `index.html:8`(`/_vercel/insights/script.js`), `index.html:9`(cdnjs PapaParse), `index.html:4069`(`dapi.kakao.com/.../sdk.js` 동적 삽입) |
| `index.html` → 루트 `src/` | 미사용 | `index.html` 전체에서 `./src`, `/src/`, `src/` 패턴 매칭 0건 (grep 결과 no matches). `index.html:3038`(`./logo.png`), `index.html:5890,5925,5934`(`./assets/...`)만 상대경로 자산으로 로드. |
| `index.html` → `ui-preview/dist/index.html` (iframe) | 사용 | `index.html:7446-7451` (`<iframe id="simulationFrame" src="ui-preview/dist/index.html">`) |
| `ui-preview` build 스크립트가 쓰는 vite config | `vite.config.js` (둘 다 내용 동일, 사실상 무관) | `ui-preview/package.json:8`(`"build": "vite build"`, config 인자 미지정) → Vite 기본 config 탐색 순서 확인: `ui-preview/node_modules/vite/dist/node/constants.js:34-39` (`vite.config.js`, `.mjs`, `.ts`, `.cjs`, `.mts`, `.cts` 순으로 첫 매치 파일 사용) → `vite.config.js`가 `vite.config.ts`보다 우선 로드됨. 단, `ui-preview/vite.config.js:1-6`와 `ui-preview/vite.config.ts:1-7` 내용이 (`plugins:[react()], base:"./"`) 동일해 실질적 동작 차이는 없음. |
| `ui-preview/index.html` 엔트리 | 사용 | `ui-preview/index.html:11` (`<script type="module" src="/src/main.tsx">`) |
| `ui-preview/src/main.tsx` | 사용(실제 렌더 루트) | `ui-preview/src/main.tsx:3`(`import PreviewWorkspaceSafe from "./PreviewWorkspaceSafe"`), `main.tsx:6-9`에서 `ReactDOM.createRoot(...).render(<PreviewWorkspaceSafe/>)` |
| `ui-preview/src/PreviewWorkspaceSafe.tsx` | 사용 (main.tsx가 직접 렌더) | `ui-preview/src/main.tsx:3` |
| `ui-preview/src/PreviewWorkspace.tsx` (Safe 아님) | 미사용 (죽은 코드, import 그래프 단절) | 어디서도 import되지 않음(자기 자신 외 grep 매치 없음). 게다가 `ui-preview/src/PreviewWorkspace.tsx:4`(`import StatisticsPage from "./StatisticsPage"`), `:6`(`import { cityStatisticsPreviewData } from "./statisticsPreviewData"`)가 참조하는 `StatisticsPage.tsx`, `statisticsPreviewData.ts` 파일 자체가 `ui-preview/src/`에 존재하지 않음(빌드 시 에러 발생할 코드) |
| `ui-preview/src/StatisticsPageSafe.tsx` | 사용 | `ui-preview/src/PreviewWorkspaceSafe.tsx:4`(`import StatisticsPageSafe from "./StatisticsPageSafe"`) |
| `ui-preview/src/StatisticsPage.tsx` (Safe 아님) | 미사용(파일 자체가 없음) | `ui-preview/src` 디렉터리 목록에 `StatisticsPage.tsx` 없음(ls 결과), `PreviewWorkspace.tsx:4`만 이를 import하나 그 파일도 미사용 |
| `ui-preview/src/SchoolDetailReportPagePreview.tsx` | 사용 | `PreviewWorkspaceSafe.tsx:2`(`import SchoolDetailReportPage from "./SchoolDetailReportPagePreview"`) |
| `ui-preview/src/SchoolDetailReportPage.tsx` (Preview 아님) | 미사용 | `ui-preview/src` 전체에서 `"./SchoolDetailReportPage"`(Preview 접미사 없는 형태) import 매치 0건 |
| `ui-preview/src/schoolDataBridge.ts` | 사용 | `PreviewWorkspaceSafe.tsx:9`(`import { applyLegacySchoolSnapshot, mapSchoolRowToReportProps, mapCandidateFeatures } from "./schoolDataBridge"`) |
| `ui-preview/src/schoolDataMapper.ts` / `schoolDataMapperSafe.ts` | 둘 다 미사용 | `schoolDataMapper.ts`는 `ui-preview/src/App.tsx:5`에서만 import되나 `App.tsx` 자체가 `main.tsx`에서 import되지 않는 죽은 파일. `schoolDataMapperSafe.ts`는 `ui-preview/src` 전체에서 import하는 곳 0건(grep 결과 no matches) |
| `ui-preview/src/App.tsx` | 미사용 (죽은 코드) | `ui-preview/src/main.tsx:3`은 `PreviewWorkspaceSafe`만 import, `App.tsx`를 import하는 파일 0건 |
| `ui-preview/src/AiExplainerPanel.tsx` | 사용 | `PreviewWorkspaceSafe.tsx:6`, `SimulationPage.tsx:3`, `SchoolDetailReportPagePreview.tsx:12`에서 import |
| `ui-preview/src/KakaoMap.tsx` | 사용 | `ui-preview/src/SimulationPage.tsx:4`(`import KakaoMap, { CandidateMarker, CandidateRouteLine } from "./KakaoMap"`) |
| `ui-preview/src/LandingPage.tsx` | 사용 | `PreviewWorkspaceSafe.tsx:5`(`import LandingPage from "./LandingPage"`) |
| `api/ai-explainer-v2.js` | 사용 (실제 호출 대상) | `index.html:3210`(`PRODUCTION_AI_EXPLAINER_V2_URL = ".../api/ai-explainer-v2"`), `index.html:5230-5235`(`getAiExplainerEndpoints()`가 `/api/ai-explainer-v2` 또는 프로덕션 v2 URL만 반환), `ui-preview/src/AiExplainerPanel.tsx:133-134`(동일하게 `/api/ai-explainer-v2` 및 `https://2026-park-analysis.vercel.app/api/ai-explainer-v2`만 사용) |
| `api/ai-explainer.js` (v1) | 미사용(프런트에서 호출 안 함, 단 Vercel 라우트로는 여전히 배포됨) | `index.html`, `ui-preview/src/*`, `vercel.json` 전체에서 "ai-explainer.js" 또는 `/api/ai-explainer`(v2 아닌 형태) 문자열 참조 0건. 단 Vercel은 `api/` 폴더의 각 `.js` 파일을 자동으로 서버리스 라우트화하므로, 코드에서 호출하지 않아도 `/api/ai-explainer` 엔드포인트 자체는 배포되어 남아있을 가능성 있음(불확실 — 실제 Vercel 라우팅 동작은 배포 대시보드 확인 필요) |
| `vercel.json` + Vercel 배포 서빙 대상 | 사용 | `vercel.json:4-5`(`buildCommand: "npm run build:vercel"`, `outputDirectory: "vercel_public"`) → 루트 `package.json:8`(`"build:vercel": "node scripts/deploy/build_vercel_static.mjs"`) → `scripts/deploy/build_vercel_static.mjs:12-30`(루트 `index.html`, `logo.png`, `data_processed/` 내 지정 파일들 복사), `:115-117`(`ui-preview/dist`, `assets/`, `outputs/robust_xai` 디렉터리 복사) → 최종적으로 `vercel_public/`이 정적 서빙 루트. `vercel.json:9-26`은 `ui-preview/dist/assets/*`와 `data_processed/*`에 대한 Cache-Control 헤더만 지정, 별도 rewrites 없음. `api/*.js`는 Vercel 관례상 자동으로 서버리스 함수 라우트가 됨(vercel.json에 명시적 rewrites 없어도 동작). |
| `app/` 전체 | 미사용 (운영 경로 어디서도 참조되지 않음) | 루트 `index.html` grep(`app/dist|app/src|app/index|app/package`) 매치 0건, `vercel.json` grep 매치 0건, `scripts/deploy/build_vercel_static.mjs` 어디에도 `app/` 참조 없음(전체 파일 읽음, `ui-preview`만 참조). `CONTEXT.md:128`, `OPERATING_PATHS.md:40-49`에서도 명시적으로 "현재 운영 기준에서 사용하지 않는 경로"로 기록됨. |
| `app/src/SimulationPage.ec76d1b.tsx` | 미사용 (app 내부에서도 죽은 파일) | `app/src` 전체 grep에서 이 파일명을 import하는 코드 0건. `app/src/SimulationPage.tsx:2`만 `KakaoMap`을 import하고, `.ec76d1b.tsx` 변형은 어디서도 import되지 않음(파일명 패턴상 git 충돌/백업 산출물로 추정) |
| `app/legacy_types/` | 미사용 (app 내부에서도 참조 없음) | `app` 디렉터리 전체 grep(`legacy_types`) 매치 0건. `app/src/schoolDataBridge.ts:3-5`는 `./config/regionConfig`, `./config/manualQAOverrides`를 import하지만 `legacy_types/`는 참조하지 않음 |
| 루트 `src/` (`components/`, `types/`, `utils/`) | 미사용 (어디서도 참조 안 됨) | `index.html` 전체 grep 매치 0건, `ui-preview/` 전체 grep(`../../src`, `../src`, `"src/`, `'src/`) 매치 0건, `app/` 전체 동일 grep 매치 0건, `scripts/` 전체 grep 매치 0건. 파일 목록: `src/components/SchoolDetailReportPage.tsx`, `src/types/candidatePanel.ts`, `src/types/candidatePanelView.ts`, `src/utils/candidatePanelMapper.ts` |
| 루트 `package.json` scripts | 전부 실존 파일 가리킴(사용 여부는 각각) | `package.json:4`(`build:ai-chunks` → `scripts/build_ai_explainer_chunks.mjs`, 존재 확인), `:5`(`smoke:ai-explainer-v2` → `scripts/smoke_ai_explainer_v2.mjs`, 존재), `:6`(`qa:ai-explainer-v2` → `scripts/qa_ai_explainer_v2.mjs`, 존재), `:7`(`build:ui-preview` → `npm --prefix ui-preview run build`), `:8`(`build:vercel` → `scripts/deploy/build_vercel_static.mjs`, 존재하며 내부에서 `build:ai-chunks`에 해당하는 `build_ai_explainer_chunks.mjs`를 직접 재호출하고 `ui-preview` 빌드도 재실행함) |

## 예상 밖 발견 (요약)

1. **`ui-preview/src/PreviewWorkspace.tsx`(Safe 아닌 버전)는 이미 빌드가 깨져 있다.** `StatisticsPage.tsx`, `statisticsPreviewData.ts`를 import하지만 두 파일 모두 `ui-preview/src/`에 실존하지 않는다. import되지 않아 빌드 시 트리셰이킹으로 제외되므로 지금은 문제가 안 되지만, 파일 자체를 남겨두면 "미사용 안전 변형" 정리 작업 시 혼동 요소가 된다.
2. **`ui-preview`와 `app`가 사실상 동일한 소스 트리를 통째로 복제한 구조다.** `main.tsx`, `PreviewWorkspaceSafe.tsx`, `App.tsx`, `schoolDataMapper*.ts` 등 파일명과 import 관계가 거의 1:1로 동일하며, 둘 다 내부에 "Safe/비Safe", "Preview/비Preview" 이중 변형을 갖고 있다. `app/`은 운영 경로에서 완전히 배제된 것으로 확인되지만, 향후 `ui-preview`를 정리할 때 `app/`에 남은 동일 패턴(`SimulationPage.ec76d1b.tsx` 같은 백업 파일명)이 재발 방지 참고 사례가 될 수 있다.
3. **`api/ai-explainer.js`(v1)는 프런트 코드 어디에서도 호출되지 않지만, Vercel의 `api/` 폴더 자동 라우팅 관례상 삭제하지 않는 한 여전히 배포되어 외부에서 호출 가능한 상태일 수 있다.** 이 부분은 실제 Vercel 배포 설정/로그를 봐야 확정할 수 있어 "불확실"로 남긴다.
4. **`ui-preview/vite.config.js`와 `vite.config.ts`가 동시에 존재**하며 내용이 사실상 동일해 실제 동작에는 영향이 없지만, Vite의 기본 탐색 순서상 `.js`가 항상 우선 채택된다(`ui-preview/node_modules/vite/dist/node/constants.js:34-39`). `.ts` 파일은 정리 대상 후보(죽은 설정 파일)로 볼 수 있다.
