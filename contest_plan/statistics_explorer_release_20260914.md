# 전체 통계 탐색·대화 작업공간 운영 반영

참고: https://2026-park-analysis.vercel.app/ 의 실제 전체 통계 화면(인증 안내에 공개된 심사용 코드 사용)을 브라우저로 확인. 전체 요약 → 군구 비교 → 학교 목록 탐색을 참고했으며 과거 지원 순위·합성 분류는 이식하지 않음.

## 변경
- 9개 영역에서 지표 선택. 전체 분포 / 군구 비교 / 두 지표 관계 / 학교별 자료로 한 번에 하나의 분석 화면 표시.
- 기존 사분위·중앙값·확보율에 히스토그램과 군구 중앙값 점그래프 추가. 히스토그램 경계는 원래 정밀도 유지.
- 영역 간 산점도, 공통 학교 수·제외 수·피어슨 상관. 3곳 미만 또는 상수는 계산 보류. 인과·정책 효과로 해석하지 않음.
- 일반지역과 강화·옹진 별도 비교, PAPS 제외, 누락은 0으로 대체하지 않음. 예측 포함 산점도는 예측임을 명시.
- 군구·학교명으로 원자료 검색, 학교 상세 새 창 연결, 현재 목록 CSV 저장.
- 통계 탭 최초 진입 시 자동 조회 수정. 모바일 차트 내부 스크롤로 전체 화면 넘침 방지.
- 대화는 AI 변수 후보·이유·추가 데이터 제안 → 사용자 선택 → 본 분석. 오른쪽 시각화에 중복 답변을 추가하던 과거 확장 처리 제거.
- 저장 메뉴와 저장 목록의 삭제 기능 포함.

## 검증
- npm run test:statistics, npm run test:agent, saved_conversations, observation_restore, profile_guardrails 통과.
- tests/verify_workspace_browser.cjs: 실제 Chromium, 통계 4개 화면, 영역 간 비교, 도서 분모, 미확보, 모바일 넘침, AI 변수 제안·분석·저장·삭제.
- tests/verify_workspace_map_browser.cjs: 운영 질문 응답의 Kakao 지도 타일 로딩 검증.
- outputs/statistics-v2/ 에 화면 캡처·검증 JSON 보관.

## 배포
- 최신 운영 profile-tabs-merged-20260914의 index가 공개 서버와 일치함을 확인한 뒤 기준 패키지로 사용.
- outputs/workspace-statistics-release-20260914: 변경 11개 파일과 정적 복사본만 갱신. 기존 프로필 탭·운영 데이터 유지.
- deployment: 18bf9cd5-c344-4841-abaa-d51d89c914fe
- URL: https://education-living-area-preview-production.up.railway.app/

배포 문제와 조치: 최초 업로드는 상위 .gitignore의 vercel_public/ 제외 규칙이 적용되어 데이터 symlink 대상이 빠졌고, 활성 데이터 복원 단계에서 종료됨. 배포 전용 패키지 내 실제 데이터 파일을 확인한 뒤 --no-gitignore로 재업로드. 이후 운영 파일 일치·API·브라우저 검증으로 최종 상태 확인.

최종 운영 배포: ed32cf81-fcd0-4501-9bce-8e79b9bc6c27 — SUCCESS 확인.
운영 파일 해시 8개 일치, API 43개 지표 사전과 관측/미확보 분모 검증 통과.
운영 Chromium 데스크톱·390px 모바일 검증 통과. 페이지 JS 오류 0건. 영역 간 산점도, 강화·옹진 분모, 미확보, 필터, AI 변수 제안·본 분석, 저장·삭제 확인.
