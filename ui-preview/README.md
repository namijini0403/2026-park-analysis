# UI Preview

이 폴더는 기존 `index.html` 기반 지도 앱과 분리된, 학교 상세 리포트 UI 전용 미리보기 환경입니다.

## 목적

- 정책 의사결정용 학교 상세 리포트 UI를 실제 화면에서 검수
- 숫자 강조, 평균 비교, 섹션 흐름, 반응형 레이아웃을 먼저 확인
- 실제 데이터 연동 전까지 사용하는 임시 preview 환경 유지

## 설치

```bash
cd ui-preview
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

- `src/previewData.ts` 만 테스트용 데이터를 가집니다.
- `src/SchoolDetailReportPage.tsx` 는 props 기반 구조를 유지합니다.
- 루트의 기존 지도 앱 구조나 빌드 체계는 수정하지 않습니다.
