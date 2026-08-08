# 스펙: "반경 너머, 정책 도달성으로" 앱 업그레이드

- 날짜: 2026-08-09
- 근거 문서: `DATA_ROCK_범정부 창업 경진대회(교육부 추천작).hwp` (범정부 창업경진대회 제출본)
- 배포 대상: Railway `park-analysis-web` (https://park-analysis-web-production.up.railway.app)
- 작업 브랜치: `policy-reachability` (base: `railway-deploy`)
- 불변 조건: **Vercel 배포(main 브랜치, 2026-park-analysis.vercel.app)는 절대 건드리지 않는다.**

## 0. 확정된 결정사항

| 항목 | 결정 |
|---|---|
| 앱 제목 | **"반경 너머, 정책 도달성으로"** (제출 문서 표기와 동일, 공백 포함) |
| 업데이트 센터 저장소 | **Railway Postgres** (같은 프로젝트에 Postgres 서비스 추가, `DATABASE_URL` 참조변수) |
| 아키텍처 | **A안**: index.html 모놀리스 유지 + LAYER_REGISTRY 리팩터링 + 관리 페이지 신설. React 전면 이전 금지 |
| 실행 순서 | P0 → P1 → P2 → P3 → P4 → P5 순차 |
| 배포 흐름 | `policy-reachability`에서 작업 → 검증 후 `railway-deploy`에만 머지 → Railway 자동 배포. `main` 머지 금지 |

## 1. 목표 — 본선 성공 판정 기준 (제출 문서가 스스로 제시)

1. 인천 **20개교 이상** 정책 행동 카드 시제품 (전환조건 포함)
2. **공공데이터 1종**의 변경 감지 → 재분석 → 승인 반영 **전 과정 로그**
3. 독서교육 표본학교 **데이터 계약·격차 유형 산출**
4. 담당자 과업 테스트 (과업완료시간·권고 수정률 측정) — 앱 범위 밖, 운영 준비만

## 2. Phase 정의

### P0 — 리브랜딩 + 기반 수리

**리브랜딩** ("반경 너머, 도달 가능성으로" → "반경 너머, 정책 도달성으로"):
- `index.html`: `:6` title, `:3018` 커버 h1(span 2개), `:3038` 로고 alt, `:3114` panel-title, `:3416`/`:3441`/`:3493` GUIDE_CONTENT
- `ui-preview/index.html:6` title
- `ui-preview/src/LandingPage.tsx`: `:145` alt="ParkLens"→새 제목, `:151` 헤더 텍스트, `:172-173` h1 span
- ParkLens 잔재 제거: `index.html:6039`(document.title), `:7404`, `:7406`
- 부제·설명문 서사 전환: "도달 가능성 진단" → "정책 도달성(외부 접근성×내부 공급×수요) 기반 의사결정 지원" 톤.
  대상: `index.html:3019, 3021-3022, 3115, 3418-3419, 3421-3422`, `LandingPage.tsx:175-177`. 과장 금지 — 제출 문서의 정의 문장을 벗어나지 않는다.
- OG 메타태그 신설 (현재 전무): `og:title`, `og:description`, `og:image`(logo.png), twitter card
- `CONTEXT.md:1,424` 타이틀 갱신

**잠복 버그 수정**:
- mojibake 4곳: `index.html:3853, 4686-4687, 5451-5452`의 `"?꾨룄"/"寃쎈룄"` → `"위도"/"경도"` 정상 키 + 폴백 정리
- 깨진 경로: `index.html:3223` `candidatePanelExamples` → `./data_processed/candidate_panel_examples.json`으로 경로 변경 + 파일을 `data/app_examples/`에서 복사 + `build_vercel_static.mjs` requiredDataFiles에 추가 (또는 fallback 유지 결정 시 경로 제거)
- CORS: `api/ai-explainer-v2.js:11-16` ALLOWED_ORIGIN_PATTERNS에 `park-analysis-web-production.up.railway.app`만 정확히 추가 (광역 와일드카드 *.up.railway.app은 보안 결함으로 배제 — 타 Railway 사용자 도메인 전부에 무인증 API가 열림)
- Vercel 하드코딩 URL 폴백은 유지하되(무해), 주석으로 역할 명시

**검증**: 로컬 `node server.js` 기동 → 커버/패널/가이드/랜딩(iframe) 제목 확인, 콘솔 에러 0, 학교 마커·후보지 렌더 정상. `npm run build:ui-preview` 후 dist 커밋.

**사용자 액션 (자동화 불가)**: Kakao 개발자 콘솔에 Railway 도메인 등록 확인, OpenAI 키 rotate 권고.

### P1 — LAYER_REGISTRY 리팩터링 + 표준 데이터 계약

- `index.html`에 `LAYER_REGISTRY` 배열 신설: `{ id, label, icon, color, kind: 'point'|'geojson'|'custom', path, latKey, lngKey, titleKey, defaultOn, module }`
- 기존 5개 레이어(isochrone, buffer, parks, redevelopment, candidate)를 registry 항목으로 이전
- registry에서 파생: 토글 버튼 DOM 생성, 체크박스, `ui.toggles`, `state.overlays`, PATHS 병합, `rerenderAll()` 루프, `updateOverlayVisibility()` 루프, 레이어별 CSS(인라인 CSS 변수로)
- `loadData()`의 위치 기반 Promise.all 배열 → 이름 기반 매핑으로 교체
- redevelopment/candidate 전용 렌더 함수는 `kind:'custom'`으로 registry에 등록 (동작 변경 없음)
- **표준 데이터 계약**: `modules/` 디렉토리 신설, `modules/park.yaml`(기존 모듈 소급 기술), 계약 스키마 정의(자원 유형·위치·서비스 용량·이용 대상·운영시간·내부/외부 공급·수요 단위·정책대안 후보·데이터 기준일·출처, 필수/선택 구분). 검증 스크립트 `scripts/validate_module_contract.mjs`
- **회귀 기준**: 리팩터링 전후 화면·동작 동일. 5개 레이어 토글, Case 필터, 접근성 필터, 학교 선택, 후보지 패널 전부 수동 검증

### P2 — 독서교육(도서관) 모듈

- 데이터: 전국공공도서관 표준데이터(공공데이터포털) + 학교도서관 자원(학교알리미 공시). 제공기관·기준연도·라이선스 검증 항목만 반영, 미확보 항목은 **"추가 확인 필요"** 표시
- 산출(기존 파이프라인 재사용):
  - 학교별 도보 500m isochrone(`school_isochrone_500m.geojson`) × 도서관 포인트 교차 → `도달 시설 수`
  - `school_nearest_park` 로직 복제 → `최근접 공공도서관 도보거리/도보시간`
  - 산출물: `data_processed/libraries.csv`, `data_processed/school_library_access.csv`
- UI:
  - 📚 도서관 레이어 (LAYER_REGISTRY 1항목)
  - 학교 진단 패널에 독서교육 섹션: 외부(공공도서관 도보시간·도달 시설 수) / 내부(학교도서관 장서·좌석·전담인력) / 격차 유형 뱃지
- 격차 분기 (문서 원문 그대로):
  - 외부·내부 모두 부족 & 미래수요 높음 → 학교도서관 직접투자 우선, 공간·예산 제약 시 이동도서관·순회 프로그램 조건부
  - 외부만 부족 → 학교 거점·이동형 지원 / 내부만 부족 → 공공도서관 연계 / 양호 → 유지·모니터링
  - 임계값은 데이터 분포 확인 후 확정하고 근거를 `docs/`에 기록
- `modules/reading.yaml` 데이터 계약 작성 + 검증 통과 (판정 기준 3 충족)
- 챗봇: `docs/ai_explainer/07_reading_module.md` 청크 + `detectTopic()` 정규식 + `topicForChunk()` + `build_ai_explainer_chunks.mjs` requiredDocs 확장

### P3 — 정책 행동 카드 + 정책 시나리오

- **7가지 정책 행동 유형** enum: 내부 직접투자 / 외부 신규 공급 / 기관 연계 / 이동형·순회 / 접근경로·안전 개선 / 권역 공동활용·거점화 / 유지·모니터링
- Python 규칙 엔진 (`scripts/policy_cards/`): 학교별 외부 도달성 × 내부 공급 × 수요 조합 → 우선 검토안 1 + 조건부 대안 1 + 핵심 근거 3(기존 지표 인용) 산출
- **시나리오 그리드 사전계산**: 예산 3단계 × 부지 확보 2단계 × 접근성 개선 2단계 = 12개 조건 조합별 권고. 안정성 = 동일 권고 유지 비율, 전환조건 = 권고가 바뀌는 경계 조건 명시
- 산출물: `data_processed/policy_action_cards.json` (272개교 전체, 판정 기준 1 충족)
- UI: 학교 진단 패널에 행동 카드 + 시나리오 조건 토글 3종(예산/부지/접근성) → 사전계산 변형 전환 + 기관별 역할(교육청/지자체/학교) 표시
- **금지**: LLM 자유생성 권고, 가중치 합산 단일점수, Case 자동분류 ML, 안전·재개발 점수 흡수

### P4 — 공공데이터 업데이트 센터 시제품 (+ 소스 위치 추적)

**인프라**: Railway 프로젝트에 Postgres 서비스 추가, `DATABASE_URL` 참조변수. `pg` 의존성 추가(현재 서버 의존성 0 → 1)

**메타층 — 데이터 소스 매니페스트** `data_sources.yaml`:
```yaml
- dataset: parks
  local_file: data_processed/parks.csv
  portal_uddi: "<공공데이터포털 목록 ID>"
  provider: "<제공기관>"
  source_url: "<파일/API URL>"
  license: "<라이선스>"
  update_cycle: "<연간/수시>"
  search_keywords: ["인천 도시공원", ...]   # URL 이동 시 재탐색용
  last_checked: <timestamp>
  content_hash: <sha256>
```
감시 대상 3~5종: 공원, 도서관, 학교(학구), 재개발, 학생수

**감시(CDC) — 결정론적 코드** (`scripts/update_center/scan.mjs` + 관리화면 "지금 검사" 버튼):
- 포털 목록조회 API 메타데이터(수정일) 조회, 파일 URL ETag/Last-Modified/HEAD, 다운로드 해시 비교, 스키마(컬럼) diff
- **위치 추적**: 404/이동 감지 시 search_keywords로 포털 목록 API 재검색 → 새 위치 후보 목록 생성
- 분류: **Green**(내용만 변경, 스키마 동일) / **Yellow**(컬럼 추가·개명 → AI 매핑 제안) / **Red**(구조 변경·검증 실패 → 자동 반영 제외)

**AI 층** (기존 OpenAI 연동 재사용, `AI_EXPLAINER_MODEL` 환경변수로 모델 선택):
- 변경의 의미·분석 영향 해설 생성, 새 위치 후보의 동일 데이터셋 여부 판단 보조, Yellow 매핑 제안
- AI는 제안만, 코드가 검증, 사람이 승인 (문서 원칙)

**승인 UI** `/update-center` (서버 라우트 + 단일 정적 페이지, 모놀리스 밖 신규 파일):
- 변경 알림 목록, 개별·일괄 선택, 품질검사 결과, 전후 비교(영향 학교 수·Case 변동), AI 해설, 승인/보류, 버전 기록·롤백
- 접근 게이트: 기존 ACCESS_CODE 수준의 간단한 코드 (시연용)

**DB 스키마** (Postgres):
- `data_events`(감지 이벤트: dataset, kind, risk, diff_summary, ai_note, status, created_at)
- `data_versions`(dataset, version, content_hash, snapshot_ref, approved_by, applied_at, rolled_back)
- `audit_log`(전 과정 로그 — 판정 기준 2 충족)

**재분석 샌드박스**: 시연 1종(공원 CSV)에 대해 변경→영향 학교 재계산(Node로 구현한 경량 재계산: 최근접 거리·도달 수)→전후 비교→승인→반영→롤백 전 과정. 전체 Python 파이프라인 자동화는 로드맵으로 명시
- **봉인값 보호**: 봉인된 실측값 53개교(`sealed_nearest_park_dist.json`, CONTEXT.md 변경 금지 조항)는 자동 갱신이 덮어쓰지 않는 머지 로직 필수

**API 엔드포인트** (server.js 라우팅 추가): `GET /api/update-center/events`, `POST /api/update-center/scan`, `POST /api/update-center/approve`, `POST /api/update-center/rollback`

### P5 — 모듈 온보딩 에이전트 시제품

- `/update-center` 내 "신규 모듈 제안" 입력: 담당자 자연어 요청 → LLM이 모듈 설계안 + `modules/*.yaml` 초안 생성
- 규칙 코드가 데이터 계약 충족 검사 (P1 검증 스크립트 재사용), 철학 검사(도보권·leakage·낙인 방지 체크리스트)
- 승인 전 운영 미반영, Red 등급 분리
- 일정 부족 시 축소판: 화면 + 사전 준비된 1회 시연 시나리오

## 3. 금지 사항 (제출 문서가 배제한 것 — 전 Phase 공통)

- Case 자동분류 ML 재도입 (target leakage로 폐기됨)
- 생성형 AI의 정책 자유생성·예산 산정·인허가 판단
- 안전·재개발 요소의 점수 흡수 (필터로만)
- 공개본에서 학교명·좌표·수혜인원 출력 (비식별 유지)
- 서로 다른 수혜 단위 합산
- Red 등급 자동 반영
- 봉인된 실측값(53개교) 자동 덮어쓰기

## 4. 검증·배포 규칙

- 각 Phase 완료 시: 로컬 `node server.js` 스모크(빌드 후 `npm run build:vercel`) → 핵심 화면 수동 확인 → `policy-reachability`에 커밋
- `railway-deploy` 머지는 Phase 단위로, 사용자 확인 후
- `ui-preview` 소스 수정 시 반드시 재빌드 + dist 커밋 (GitHub Pages 경로 일관성)
- `build_vercel_static.mjs`의 requiredDataFiles에 새 데이터 파일 등록 누락 금지
- main 브랜치·Vercel 프로젝트에 대한 어떤 변경도 금지
