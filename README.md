# 반경 너머 · 정책 도달성으로
[학교별 지원안·시각화 1,181개 보기·주제 저장 개선](contest_plan/policy_studio_20260912.md) — 2026-09-12 운영 반영·검증 완료.


학교의 교육자원이 학생에게 닿을 조건을 확인하고, 근거로 담당자의 판단을 돕습니다.

## 2026-09-13 수정 요약

- 지도: 마우스 휠 확대·축소 허용. ‘공원까지 보행 경로·거리’ 체크박스를 없애고 ‘자연과 놀이 › 공원’ 레이어를 켜면 선택 학교의 최근접 공원 경로·거리를 함께 표시(초등학교는 거리 원장만 있어 대표점 직선으로 표시).
- 정책 길잡이: 단일 지표 상대 위치 분석(`api/_relative_position.js`). “어떤 학교에 책이 부족하니?” 같은 질문에 학교별 값·전체 평균·중앙값·군·구별 평균·순위·백분위·선택 학교 위치를 계산한다. 가중치·종합점수는 만들지 않으며, 강화·옹진 도서지역은 별도 표로 분리한다. `npm run test:relative`.
- 대화 저장: 질문마다 자동 저장하던 ‘주제별 분석 대화’를 없애고, 대화가 끝나면 ‘대화 저장하기’로 저장한다. ‘04 저장된 대화’ 탭에서 목록·재확인·JSON 저장·삭제. `node tests/test_saved_conversations.cjs`.
- 출처: 모든 답변·학교 요약·지도 레이어 카드의 출처 링크를 공공데이터 원문 페이지(`api/_public_sources.js`)로 연결. 로컬 파일 경로는 접힌 기술 정보로만 표시.

## 현재 앱 (2026-09-12 지도 중심 HITL)

첫 화면에서 유치원·초등학교·중학교·고등학교를 중복 선택하고 학교 위치를 누를 수 있습니다. 선택 학교의 직선 500m 반경과 공식 연결 학구도를 각각 켜고 끕니다. 유치원 학구도는 원자료에 없으며, 실제 배정·보행 가능성을 경계만으로 확정하지 않습니다. 모바일에서는 검색·경계 설정을 접어 지도를 먼저 보여줍니다.

지도 회귀 검사: `npm run test:map`. 브라우저 검수: `tests/verify_school_map_browser.cjs` (Playwright 경로를 `PLAYWRIGHT_MODULE`에 지정). 배포·시각 검수 기록: [지도 화면 변경](contest_plan/map_first_20260912.md).

### HITL 작업 화면

**학교 살펴보기 / 자료에 질문하기 / 검토 기록**으로 화면을 분리했습니다. 현재 구현·이번 수정·후속 개발과 검증 범위는 [HITL 앱 정리](contest_plan/hitl_app_structure_20260912.md)에 정리했습니다. 검토 기록은 관측 요약·출처 해시와 목적·보류 사유를 저장하는 로컬 파일이며 공식 정책 승인은 아닙니다. `npm run test:hitl`로 검증합니다.

### 재사용한 기본 기능

**학교 선택 → 확인된 사실 / 더 확인할 조건 / 검토할 방법 → 하나의 근거 챗봇**

공원·야외활동, 도서관, 학교 장서, 운동, 돌봄을 같은 화면에서 선택합니다. 초등학교를 기본으로 하며 학교급별 자료 범위가 다르면 미확보를 표시합니다. 통계·예측 차트는 질문 화면에서 조회합니다. 기본 지도에는 학교급과 반경·학구도 표시 설정만 둡니다.

- `index.html`, `assets/simple-app.css`, `assets/simple-app.js`: 기본 화면 한 개
- `api/school-summary.js`, `api/_school_summary.js`: 학교 원장과 관측 요약
- `api/chat.js`: 유일한 사용자 질문 경로. `/api/chat` 사용
- `rag/policy-guide.md`, `rag/analysis-guide.md`: 철학·방법·해석·한계의 검색 원본
- `data_processed/`: 승인된 수치 원본. 화면과 챗봇이 함께 조회
- `api/_analysis_engine.js`: 질문했을 때만 실행하는 검증된 통계 계산
- `update-center.html`: 기존 승인 기반 자료 관리 (운영 담당자용)

학교·시설·계산 데이터는 RAG 문서에 복제하지 않습니다. 답변에는 원문 근거와 관련 관측값이 붙고 JSON으로 저장할 수 있습니다. 검색은 소규모 로컬 태그 방식이며, 관련 근거 최대 5개만 기존 AI 연결에 전달합니다. AI 미설정·실패 시 검색 근거를 표시합니다. 범용 웹검색이나 자동 문서 업로드 인덱싱은 하지 않습니다.

## 실행

```powershell
npm run build:vercel
npm start
```

`http://localhost:3000`에서 엽니다. 서버 API를 사용하므로 `python -m http.server`만으로는 실행되지 않습니다. 새 기본 앱에는 React/Vite 빌드나 iframe이 필요하지 않습니다. 자동 자료 스캔 주기 등 운영 설정은 기존 서버 설정을 따릅니다.

```powershell
npm run test:simple
npm run test:analysis
```

## 과거 구조와의 관계

구체적인 변경 범위와 검증: [단순화 기록](contest_plan/simple_app_20260912.md).

직전 메인 화면은 `archive/20260912-before-simple/index.html`에 보존했습니다. `ui-preview/`, 과거 지도·통계 자산과 분석 파이프라인은 연구·복구 참고용이며 기본 화면의 의존성이 아닙니다. 과거 UI 전용 테스트는 `test:education:legacy-ui`로 구분했습니다. 옛 챗봇 API 주소 두 개는 같은 `/api/chat` 처리기로 연결합니다.

과거의 Case 분류, 자동 우선안, 종합점수, 가중합 순위는 현재 판단 규칙이 아닙니다. 최신 철학은 workspace `AGENTS.md`와 `rag/policy-guide.md`를 따릅니다. DATA_ROCK 원본 제출 HWP는 수정하지 않았습니다.

## 파이썬 스크립트 의존성

`scripts/requirements.txt` (루트에 두면 Railway Railpack이 Python 프로젝트로 감지해 npm 빌드가 실패합니다).
