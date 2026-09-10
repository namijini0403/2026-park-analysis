# 분석 인사이트 탭 (2026-09-10)

상단 ‘분석 인사이트’ 버튼 또는 전체 통계의 ‘분석 인사이트’ 탭으로 진입한다. ‘현황·상관분석’은 기존 통계와 상관행렬을 유지하고, 인사이트 탭은 전체 분석 요약 카드 5개와 조건을 바꿀 수 있는 상세 분석을 제공한다.

요약은 shared_parks, road_resilience, field_verification, designation_diffusion, curriculum_network JSON에서 직접 집계한다. 자료 요청은 화면 내에서 공유하며 실패한 요청은 재시도할 수 있다. 전체 인천 요약과 상세 학교급·지역 필터의 범위를 구분한다. 관측 비교·공급 배분·구간 중단·확산 가정을 각각 표시하며 각 카드에서 상세 분석 및 근거 JSON으로 이동한다.

계산법·원자료·재현 명령은 network_analysis_methods.md에 기록되어 있다. 이번 변경은 기존 실행 결과의 전달 화면이며 모델이나 결과값을 바꾸지 않았다.

검증: 실제 JSON의 5개 카드, 주요 집계값, 상세 연결 대상, 학교급·지역 전달, 탭 클릭·키보드 이동, 상단 바로가기와 기존 통계 복귀를 자동 검사한다. 연결된 CUA 브라우저가 없어 실제 화면의 시각 검증은 별도 미완료 항목으로 남긴다.

## 배포·검증 결과

- 기능 커밋: `d304da2`, 브랜치 `feat/all-school-levels-academy-public-metrics` GitHub 푸시 완료.
- Railway 배포: `a3c61f9e-fa44-4017-9a4f-ba919633840d`, 해당 ID의 SUCCESS 확인.
- 주소: https://education-living-area-preview-production.up.railway.app (인증번호 2026).
- `npm run test:education` 6종 전체 통과: 네트워크·인사이트, 상관분석, 공시 프로필, 실제 페이지 시작·탭 조작(외부 지도 SDK 모의), 기존 교육 UI, AI 근거 검사.
- 배포된 index.html, education-layers.js, education-networks.js, 분석 JSON 5개 모두 HTTP 200 및 로컬 SHA-256 일치. 증거: `outputs/insights_deploy_http_20260910.json`.
- CUA 조회 `apps: [], browsers: []`; 실제 탭 생성도 `Browser is not available: iab`로 실패했다. 실제 브라우저 시각 검증은 완료했다고 주장하지 않는다.
