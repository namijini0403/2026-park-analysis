# School Detail Report App

이 폴더는 제출 패키지 안에서 `index.html`의 iframe으로 열리는 React + Vite 상세 리포트 앱입니다.

## 목적

- 정책 의사결정용 학교 상세 리포트 UI를 실제 화면에서 검수
- 학교별 상세 리포트, 후보지 시뮬레이션, 통계 화면을 구성
- 숫자 강조, 평균 비교, 섹션 흐름, 반응형 레이아웃 유지

## 설치

```bash
cd app
npm install
```

## 실행

```bash
npm run dev
```

## 빌드

```bash
npm run build
```

## 미리보기 서버

```bash
npm run preview
```

## 참고

- 제출 패키지의 메인 지도는 루트 `index.html`입니다.
- 빌드 결과는 `app/dist/`에 생성되며, 루트 `index.html`이 이 경로를 iframe으로 엽니다.
- 공개 GitHub Pages 운영 앱은 별도 기준 경로를 쓰므로, 루트 `OPERATING_PATHS.md`를 먼저 확인하세요.
