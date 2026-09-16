# 시각화 개선·디자인 배포 확인 (2026-09-16)

## 작업 시작 시 확인한 상태

- 기준 저장소: `namijini0403/2026-park-analysis`, 브랜치 `feat/all-school-levels-academy-public-metrics`, 로컬 폴더 `park-railway-deploy`.
- 원격과 로컬 HEAD는 `4ed812179a3309b2b72b6d462e2cc7c0a7f34f61`로 일치했다. 이 병합의 부모는 기능 `d966d5c`와 디자인 `9ef75f1`이다. `main`과 별도 로컬 `2026-park-analysis`는 최신 앱 작업 기준이 아니다.
- 공개 사이트: https://education-living-area-preview-production.up.railway.app
- Railway 프로젝트 `819e8af2-e6db-4fbf-bab9-76731a7408d5`, 환경 `08a322cd-3447-4eef-8a9e-a7a8d8ead656`, 서비스 `0959785c-35d7-4734-b4c0-63b2c8e4eeac`.
- 작업 시작 시 최신 배포 `0e076935-fb00-4990-b5b3-950770d00d57`는 `SUCCESS`였다. 생성 2026-09-15 13:35:31 UTC, 성공 갱신 13:37:16 UTC. 서비스 live, 미적용 설정 없음.
- 확인한 디자인·통계·챗봇·사진 공개 파일 17개 중 14개는 HEAD와 SHA-256이 일치했다. `/api/domain-stats?domain=park&level=초등학교`는 HTTP 200, 전체 카탈로그 43개, 해당 영역 지표 8개를 반환했다. 이 검사는 자료 의미 전체를 검증했다는 뜻이 아니다.

## 운영에만 있던 수정 복구

다음 네 파일은 운영본이 Git보다 앞서 있었다. 실제 공개 응답을 확인하여 작업 트리에 복구했다. 이전 스냅샷을 재사용하면 이 수정이 유실된다.

| 파일 | 확인된 변경 | 복구 당시 운영 SHA-256 |
| --- | --- | --- |
| `index.html` | 최신 통계·사진 스타일 연결 한 줄 | `7e7254c5b4e9849f731f6b1bd2af49cffd5d39af5b7a3d09af8ce04ccb36cb6b` |
| `assets/manager-ai-layout.js` | 현재 챗봇 설정 묶음과 펼침 상태, 진행 단계 보존 | `cb5c06419aba95067d6502b9416084f673d67ecf035283384ef0a61ec78fa239` |
| `assets/manager-ai-layout.css` | 현재 대화·설정·저장 UI 스타일 보완 | `7b5f3ed335dfea7aae3967963fa176f88416814176cf09555fb738aab71b6195` |
| `assets/manager-latest-reading.css` | 최신 통계·사진 UI의 아이보리 스타일, 모바일 및 키보드 포커스 | `707ab12d390c78e49231f860c3a97262f6b20868362f187e13cd982ac34be99b` |

`node --check assets/manager-ai-layout.js` 통과. 이 표의 해시는 복구 시점 기록이며 이후 승인된 시각화 개선의 최종 해시와 다를 수 있다.

## 배포 검증 기준

1. 소스 수정과 브라우저 확인이 끝난 뒤 `npm run build:vercel`로 현재 소스·현재 분석자료를 다시 복사한다. 빌드 스크립트는 저장소 내부의 정확한 `vercel_public` 경로를 검사한 뒤 그 생성물만 재생성한다.
2. `node scripts/deploy/prepare_hitl_release.cjs`로 새 타임스탬프 스냅샷을 만든다. 허용 목록으로 API·정적 자산·분석자료를 복사하고 복사 전후 및 최종 소스 해시를 검증한다. 실패 시 배포하지 않는다.
3. 새 스냅샷 내부에서만 대상 프로젝트·환경·서비스를 명시하여 업로드한다. 기존 `/app/data` 볼륨과 환경 설정을 변경하지 않는다.
4. 해당 업로드가 반환한 배포 ID의 `SUCCESS`를 확인한다. 다른 배포의 성공이나 업로드 종료코드를 대신 사용하지 않는다.
5. 변경·복구한 공개 파일을 스냅샷 manifest의 SHA-256과 대조하고 통계 API·실제 화면을 확인한다. 최종 배포 ID와 검증 결과를 아래에 기록한다.

## 시각화 변경

- 전체 통계: 영역별 강조색, 어두운 검토 안내 카드(확인된 자료 / 확인할 조건 / 다음 검토), 확보·미확보 분모 표시.
- 군구 중앙값은 항목별 색과 수치로 읽고, 군구 내부 사분위·범위는 상세 펼침으로 확인한다. 군구 버튼을 누르면 해당 학교 목록으로 이동한다. 이름순을 유지한다.
- 히스토그램은 숫자축·학교 수 라벨·정확한 구간표를 제공한다. 결측을 0으로 넣지 않는다.
- 공통 차트: 제목·표시 개수·항목색·선택 항목 강조·관측/예측 범례·실제 연도 눈금·작은 시계열 값 라벨. 전체 통계와 챗봇이 동일 렌더러를 사용한다.
- 디자인팀 아이보리·야간 테마를 유지하고 운영 전용 수정도 저장소에 보존한다. 순위·기본 합성점수·새 정책 판정은 추가하지 않는다.

## 질문별 동적 차트 구조

현재 `api/_agent.js`는 도구를 선택해 실행하고 `api/_agent_tools.js`가 서버에서 계산한 `visual.sections`를 반환한다. `assets/chat-workspace.js`와 공통 `StatisticalCharts`가 차트·표를 표시한다. 질문에 따라 조합하는 기능이 이미 있으므로 외부 시각화 API/MCP는 이번 변경에 필요하지 않다.

권장: 질문 → 범위·변수 선택 → 서버 집계 → 제한된 차트 명세 → 공통 렌더러. 모델이 숫자 또는 실행할 HTML/JS를 생성하는 방식은 쓰지 않는다. 고정 통계는 같은 데이터 스냅샷 기준으로 집계·캐시할 수 있다. 캐시에는 지표·학교급·지역·자료 버전이 필요하다(이번 변경은 캐시 시스템 추가 범위가 아님).

복합 차트가 필요해질 때 [Vega-Lite 명세](https://vega.github.io/vega-lite/docs/)를 내부 렌더러 어댑터로 검토한다. [MCP](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)는 외부 데이터나 서비스를 연결할 때 검토한다. 차트만 그리기 위한 새 외부 의존성은 넣지 않았다.

## 검증

- `npm run test:statistics`, `npm run test:simple`, `npm run test:agent`: 통과.
- `tests/verify_visual_story.cjs`: 실제 Chromium에서 안내, 막대 값, 군구 → 학교 필터, 영역 간 산점도, 강화·옹진 분리, 유치원 독서 미확보 판단 보류, 390px 가로 넘침 없음 확인.
- 화면 PNG를 직접 열어 데스크톱 안내·히스토그램·군구 차트·모바일 레이아웃을 확인했다. `outputs/visualization-20260916/`에 기록.
- 과거 `test_chat_workspace.cjs`는 현재 API의 응답 모드를 예전 `roster`로 가정하여 렌더러 실행 전에 실패한다. 이 변경의 통과 근거로 쓰지 않았다. 현재 agent/simple 검사로 회귀를 확인했다.

## 최종 반영

배포 준비 중. 최종 배포와 공개 검증 후 기록한다.
