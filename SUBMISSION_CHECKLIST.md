# 제출용 체크리스트

> 주의: 현재 공개 GitHub Pages 운영 앱은 `index.html + data_processed/ + ui-preview/dist/` 구조가 기준입니다.
> 제출 패키지 안에 `app/` 또는 `data/processed/`가 있더라도, 운영 앱 경로를 그쪽으로 바꾸지 않습니다.
> 자세한 기준은 루트 `OPERATING_PATHS.md`를 따릅니다.

## 최종 제출 전 확인

- `submission_package_3` 폴더를 기준으로 제출 파일을 만들었는지 확인
- 실제 API 키가 포함된 `.env`, `app/.env`가 제출본에 없는지 확인
- `app/node_modules/`, 로그, 캐시, 임시 파일이 제출본에 없는지 확인
- `index.html`이 로컬 HTTP 서버에서 정상 실행되는지 확인하되, 최종 판단은 GitHub Pages 공개 URL에서 함
- 카카오맵 키를 `?key=발급키` 또는 `localStorage.KAKAO_MAP_KEY`로 주입했을 때 지도가 정상 표시되는지 확인
- 운영 앱 기준으로 `ui-preview/dist/`가 포함되어 있고 화면이 깨지지 않는지 확인
- 운영 앱 기준으로 `data_processed/school_priority.csv`, `school_nearest_park.csv` 등 핵심 데이터가 포함되어 있는지 확인
- 제출 패키지 내부 별도 구조(`app/dist`, `data/processed`)를 운영 앱 `index.html` 경로로 착각하지 않았는지 확인
- `CONTEXT.md`의 시작부 운영 보정값이 임의로 변경되지 않았는지 확인
- `README.md`와 실제 폴더 구조가 일치하는지 확인
- 최종 제출 파일은 `submission_package_3` 정리본인지 확인

## 권장 추가 확인

- 대용량 GIS 파일과 정식 원천 데이터의 제출 가능 여부를 공모전 안내문과 다시 대조
- 발표 자료의 수치와 제출본 데이터가 같은 버전인지 확인
