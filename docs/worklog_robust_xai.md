# Robust XAI Recommendation Worklog

## 작업 시작 상태

- 작업 브랜치: `robust-xai-recommendation`
- 작업 전 `git status`: main 기준 변경 없음
- 작업 전 빌드:
  - `npm run build:vercel`: 성공
  - `ui-preview`의 `npm run build`: 샌드박스에서는 esbuild `EPERM` 실패, 외부 실행 승인 후 성공

## 사용한 입력 데이터

- `data_processed/candidate_grid_final.geojson`
- `output/candidate_barrier_routes_by_school.csv`

## 생성 파일

- `scripts/add_robust_xai_recommendation.py`
- `outputs/robust_xai/robust_candidate_recommendations.csv`
- `outputs/robust_xai/robust_candidate_recommendations.json`
- `outputs/robust_xai/shap_candidate_explanations.json`
- `outputs/robust_xai/shap_summary.png`
- `outputs/robust_xai/shap_feature_importance.png`
- `outputs/robust_xai/shap_waterfall_B000002982_CG_00806.png`
- `outputs/robust_xai/shap_waterfall_B000003025_CG_01556.png`
- `outputs/robust_xai/shap_waterfall_B000003027_CG_01256.png`
- `outputs/robust_xai/shap_waterfall_B000003080_CG_01346.png`
- `outputs/robust_xai/shap_waterfall_B000003169_CG_00572.png`
- `outputs/robust_xai/run_summary.json`
- `data_processed/robust_candidate_recommendations.json`
- `data_processed/robust_shap_candidate_explanations.json`
- `docs/robust_xai_recommendation.md`
- `docs/worklog_robust_xai.md`

## 수정 파일

- `index.html`: robust recommendation JSON을 로드하고, 학교-후보 선택 시 `school_id + grid_id` 기준으로 후보 localStorage에 병합
- `ui-preview/src/schoolDataBridge.ts`: robust recommendation 및 SHAP 진단 필드 optional mapping 추가
- `ui-preview/src/SimulationPage.tsx`: 후보 카드에 Pareto 여부, Top5 안정성, 평균 순위, 추천 유형, 추천 이유, SHAP 예측 근거 보기 패널 추가
- `scripts/deploy/build_vercel_static.mjs`: Vercel static export에 robust JSON 및 `outputs/robust_xai` 이미지 포함

## 분석 실행 결과

- 실행 명령: `python scripts/add_robust_xai_recommendation.py`
- 학교-후보 row 수: 1,551
- 학교 수: 195
- merge 성공: 1,551
- merge 실패: 0
- 미래 수혜 아동 수 컬럼: `walkshed_beneficiary_2031`
- 접근성 보완 컬럼: `nearest_park_dist`
- 학교-후보 거리 컬럼: `route_length_m`
- 정규화: 학교별 min-max scaling, 후보 수 20개 이상일 때 1-99 percentile clipping
- 가중치 샘플링: Dirichlet([1, 1, 1]) 1,000회, seed 42
- SHAP 방식: 기존 예측값을 설명하기 위한 surrogate RandomForestRegressor + SHAP TreeExplainer

## 검증 체크

- `robust_candidate_recommendations.csv` 생성 확인
- `robust_candidate_recommendations.json` 생성 확인
- `shap_candidate_explanations.json` 생성 확인
- `robust_rank`, `top5_stability_score`, `pareto_candidate` 결측 0건 확인
- 학교별 후보군 ranking 정상 생성 확인
- 변경 후 `ui-preview`의 `npm run build`: 성공
- 변경 후 root `npm run build:vercel`: 성공
- 로컬 정적 서버에서 `ui-preview/dist/index.html` 렌더링 확인
- 로컬 Kakao Map SDK는 개발 도메인/API 키 제약으로 지도만 fallback 메시지 표시

## 남은 주의사항

- SHAP은 최종 추천 순위 설명이 아니라 미래 수혜 아동 수 예측값 진단이다.
- 현재 waterfall 이미지는 학교별 대표 Top 후보 5건만 생성했다.
- GitHub Pages와 Vercel static export 모두 `outputs/robust_xai` 이미지 경로를 포함하도록 정리했다.
