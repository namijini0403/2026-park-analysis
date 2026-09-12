# 카카오맵 복원 · 2026-09-12

학교 탐색 지도와 답변 근거 지도 모두 기존 JavaScript 키를 사용하는 네이티브 카카오맵으로 전환했다. 현재 메인 화면은 Leaflet/OSM 배경을 요청하지 않는다. 기존 자료의 경로 출처와 검증 상태는 그대로 유지하며 카카오 길찾기 결과로 바꾸어 부르지 않는다.

- 공통 SDK 로더·지도·마커·반경·GeoJSON Polygon/MultiPolygon·경로: `assets/kakao-maps.js`
- 기존 키 재사용 설정: `assets/kakao-config.js` (문서에 키 값 미기재)
- 학교 탐색: `assets/school-map.js`; 답변·HITL: `assets/chat-workspace.js`
- 숨겨진 화면을 열거나 크기를 바꾸면 relayout하며, 과거 답변의 비동기 지도 로딩은 새 답변을 덮지 않는다.
- SDK 실패 시 학교 검색과 근거 표를 유지한다. 다른 배경지도로 자동 전환하지 않는다.

## 배포 및 검증

운영 URL: https://education-living-area-preview-production.up.railway.app

Railway deployment: `341e9742-5e1a-4f73-aaa5-596d92ff3d27` · SUCCESS

직전 운영 배포의 별도 복사본에 HTML과 지도 관련 자산 5개만 덮어썼다. 공유 빌드 폴더·분석 데이터·다른 창의 작업은 덮어쓰지 않았다. 배포된 6개 파일의 SHA-256이 검증한 소스와 일치한다.

`node tests/verify_kakao_maps.cjs --live`에서 실제 카카오 SDK/타일, 유치원+초등 641곳·전체 917곳, 같은 위치 학교 선택, 500m 반경, 학구도 토글, 도서지역 전체 보기, 답변 위치 103곳, Polygon 구멍/MultiPolygon/경로, 답변 교체, 모바일, SDK 차단 시 검색·표 유지를 확인했다. 실제 장서·외부 도서관 거리·통학구역 HITL 질문에서도 사용자 중요도와 카카오 지도가 함께 표시되었다.

단위 회귀: `test_school_map.cjs`, `test_chat_workspace.cjs`, `test_hitl_analysis.cjs`, `test_observation_restore.cjs` 통과. UI 상태 단위 검사는 지도 대역을 쓰고 실제 지도 렌더링은 위 브라우저 검사로 검증한다.

질문·응답·스크린샷: `outputs/kakao-migration/live/`. 배포 파일 해시: `outputs/kakao-migration/release-manifest.json`.

API 기준: https://apis.map.kakao.com/web/documentation/
