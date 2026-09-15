# 학교·주변 시설 사진

학교 분석창의 기존 색상과 간격을 사용하는 독립 카드다. 사진 찾아보기 버튼을 눌렀을 때만 Google Places UI Kit을 로드한다. 레이더 기준 변경으로 사진을 다시 조회하지 않는다.

## 연결과 해석

- 선택 학교와 `data_processed/map_layers/{parks,libraries}.json`의 학교 중심 직선 500m 내 시설을 선택한다. 시설은 가나다순이며 투자·품질 순위가 아니다.
- Google UI Kit의 텍스트 검색으로 시설명과 군·구, 좌표를 전달한다. 최대 3개 검색 후보를 공식 카드로 표시하고 이름·주소 확인을 안내한다. 검색 결과를 확정 시설 매칭으로 저장하거나 카카오맵의 위치를 바꾸지 않는다.
- 사진·주소·출처만 요청한다. 평점·리뷰·AI 요약은 표시하지 않는다. Google의 카드 및 사진 출처를 유지한다.
- 좌표 미확보, 시설 목록 연결 실패, 검색 결과 없음, API 오류를 구분한다. 사진 미확보는 시설 부족이나 안전·접근성 판단에 사용하지 않는다.
- Google 사진·검색 응답은 자체 파일, localStorage, 분석 JSON에 저장하지 않는다.

## 설정

브라우저용 키는 서버 환경변수 `GOOGLE_MAPS_BROWSER_KEY`에서 읽는다. 로컬 개발에서는 프로젝트 또는 상위 워크스페이스의 `map.env`도 지원한다. 현재 사용자가 작성한 `구글맵: KEY` 형식, 키 단독, `GOOGLE_MAPS_BROWSER_KEY=KEY`를 지원한다. API는 지정 브라우저 키만 반환하며 다른 환경변수는 공개하지 않는다.

웹 SDK 키는 브라우저에서 보이는 키이므로 Google Cloud에서 웹사이트 HTTP referrer 제한과 Maps JavaScript API / Places UI Kit API 제한을 적용한다. 결제 및 API 활성화가 필요하다. 운영 키는 Railway 환경변수로 설정하고 map.env를 배포 폴더에 복사하지 않는다.

공식 정책:
- https://cloud.google.com/maps-platform/terms/maps-service-terms (Places UI Kit 타사 지도 사용 예외)
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/place-search
- https://developers.google.com/maps/documentation/places/web-service/policies

## 검증 (2026-09-15)

- `node tests/test_school_photos.cjs`: 좌표 결측·500m 필터·초기 Google 호출 없음·키 미설정·시설 자료 실패·HTML 이스케이프 통과.
- 기존 학교 프로필 UI 및 정책 guardrail 검사 통과.
- 정적 빌드 성공. 키 파일은 산출물과 Git에서 제외.
- 실제 Chromium에서 데스크톱/390px 모바일 카드 배치와 가로 넘침 없음 확인. 스크린샷은 `outputs/school-photos-qa/`.
- 실제 Google 요청: 403. `Places UI Kit API is not activated on your project`. 따라서 실제 사진 조회·촬영자 표기·사진 확대는 API 활성화 후 추가 검증해야 한다. 미검증 상태를 성공으로 기록하지 않는다.
- 이번 변경은 로컬 구현 및 빌드까지. 공개 서비스 배포는 하지 않았다.

## 활성화 후 재검증

- 사용자 활성화 후 실제 UI Kit 요청의 403이 해소됐으며 브라우저 콘솔 오류 없이 장소 검색이 응답했다.
- 검색 후보를 직접 선택하면 큰 사진 상세 카드를 표시하도록 보완했다. 학교 선택·시설 선택은 확정 매칭으로 저장하지 않는다.
- 인천부개초등학교의 Google 등록 사진과 확대 대화상자, 촬영자 및 Google Maps 출처 표시를 확인했다. 다만 해당 장소에 등록된 사진 중 학교 외관과 무관해 보이는 사진이 관찰됐다. 오래되거나 무관한 사진이 포함될 수 있다는 안내를 추가했다.
- 부개어린이도서관은 장소 상세 조회가 가능하지만 사진이 표시되지 않았다. 세모공원은 Google의 `세모공원(세모 어린이공원)` 후보를 선택해 사진 표시와 확대를 확인했다. 마분·밤골 공원은 동일 이름 후보를 확인하지 못했다. 모든 시설의 사진 제공을 보장하지 않는다.
- 데스크톱과 모바일 상세 카드 가로 넘침 없음. 기존 학교 프로필 UI·정책 guardrail·사진 결측 검사 및 정적 빌드 통과.
- UI Kit의 닫힌 shadow DOM 내부 버튼 검증을 위해 자동 테스트에서만 shadow DOM을 열어 관측했다. 앱 소스의 SDK 동작은 변경하지 않았다.
- 공개 서비스 배포는 아직 하지 않았다. 로컬 확인 주소: http://localhost:8893/?school=B000003025

## 공개 서비스 배포 완료

- 스냅샷: `outputs/hitl-deploy-1789467793327` (매니페스트 1,472항목). 저장소 루트에서 업로드하지 않았다. `map.env`, `.env`, `node_modules` 제외 확인.
- 기존 미리보기 프로젝트·환경·서비스에 `GOOGLE_MAPS_BROWSER_KEY`를 stdin으로 설정하고 값 일치를 출력 노출 없이 확인했다.
- 배포 ID: `26009cfc-347b-4e01-a785-7caf38909b82`, Railway `SUCCESS` 확인.
- 공개 URL: https://education-living-area-preview-production.up.railway.app
- 사진 JS/CSS, 학교 프로필 JS, simple-app JS, chat-agent JS, index.html 6개 모두 HTTP 200 및 스냅샷 SHA-256 일치. 공개 설정 API의 enabled 및 키 일치 확인.
- 운영 브라우저 첫 검사에서 Google SDK 로딩 지연이 있었으나 새 브라우저 재검사는 정상 완료됐다. 학교 장소 검색, 세모공원 사진 상세·확대 대화상자, 모바일 상세 카드의 가로 넘침 없음 및 콘솔 오류 없음 확인.
