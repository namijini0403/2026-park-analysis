# 반경 너머, 정책 도달성으로

인천 272개 초등학교의 **정책 도달성** — 외부 접근성(도보 네트워크 기준 도달 가능성) × 내부 공급(학교 안 자원) × 수요(현재·미래 학생 수) — 을 학교 단위로 함께 보아 정책이 실제로 아이에게 닿는지 진단하고, 설명 가능한 정책 행동 카드로 연결하는 의사결정 지원 웹앱입니다. 최종 판단과 승인은 담당자가 합니다.

## 구성 모듈

- **학교 진단 리포트**: 도보 500m 도달권(OSM 보행 네트워크) 기준 외부 접근성(공원·놀이터·녹지), 내부 공급, 유사학교 KNN(k=4) 비교
- **수요 예측**: 학교 재학생 전망(가중 추세 + LightGBM 잔차 보정, 중기 R² 0.932 / MAE 54.8명), 250m 격자 아동 수요(cohort + Prophet + LightGBM)
- **독서교육 모듈**: 공공도서관 252관 도달성 + 학교도서관 내부 공급 → 독서 격차 유형(`reading_gap_type`)
- **후보지 시뮬레이션**: 250m 격자 후보지, Pareto 후보군, 1,000회 가중치 재추출 순위 안정성, SHAP 후보 근거
- **정책 행동 카드**: 7가지 정책 행동 유형, 12개 시나리오(예산 3 × 부지 2 × 접근성 2), 우선 검토안 1 + 조건부 대안 1 + 핵심 근거 3 + 전환조건
- **학교 맥락 레이어**: 지정·연구학교 명단, 유흥·단란주점 인허가 관측치, 공사장 행정기록 (참고용 맥락 정보이며 안전 판정이 아님, 미수집 ≠ 0건)
- **공공데이터 업데이트 센터**: 변경 감지 → 품질검사 → 담당자 승인 → 버전 반영·롤백

## 운영 기준

- 현재 정상 배포 기준 커밋: `b4ee21798ac7856a509cd0ad01338dcf8210a8e0`
- GitHub Pages: `https://namijini0403.github.io/2026-park-analysis/`
- 메인 진입점: `index.html`
- 데이터 경로: `data_processed/`
- 상세 리포트/시뮬레이션 iframe: `ui-preview/dist/index.html`
- 자세한 경로 기준: `OPERATING_PATHS.md`

## 로컬 실행

```powershell
python -m http.server 8080
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:8080/
```

## 배포 전 확인

- `index.html`의 데이터 경로가 `data_processed/`인지 확인한다.
- iframe 경로가 `ui-preview/dist/index.html`인지 확인한다.
- `app/dist` 또는 `data/processed`로 운영 경로를 바꾸지 않는다.
- GitHub Pages 공개 URL에서 지도, 학교 마커, 상세 리포트, 후보지 시뮬레이션을 확인한다.
- 핵심 파일이 공개 URL에서 HTTP 200인지 확인한다.
  - `data_processed/school_priority.csv`
  - `ui-preview/dist/index.html`

## Vercel 배포

학교/기관 PC에서 GitHub Pages가 차단될 경우 Vercel 정적 배포를 사용한다.

```powershell
npm run build:vercel
```

Vercel 설정은 `vercel.json`에 고정되어 있다.

- Build Command: `npm run build:vercel`
- Output Directory: `vercel_public`
- 상세 절차: `docs/VERCEL_DEPLOYMENT.md`
- Kakao 지도 키를 바꿔야 하면 Vercel 환경변수 `KAKAO_MAP_KEY`에 Kakao JavaScript 키를 등록한 뒤 Redeploy한다.

## 복구 메모

2026-04-26에 공개 앱이 깨진 뒤 `origin/main`을 `b4ee217`로 복구했다. 이후 수정은 이 커밋을 기준으로 최소 단위로 적용한다.
