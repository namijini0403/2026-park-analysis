# 공모전 PPT 검증 통계 및 재현 메모

작성일: 2026-05-21
범위: 이 세션에서 확인한 발표용 기술 스택, 지도/CSV 로딩, 학생수 예측 성능, recursive 오차 분포, SHAP/부록 번호 이슈 전체.

## 1. 최종 결론 요약

| 검증 항목 | 최종 판단 | PPT 반영 문구 |
|---|---|---|
| 프론트엔드 기술 스택 | `Vanilla JS`만 썼다고 쓰면 전체 앱 기준으로 부정확함 | `Vanilla JS 정적 메인 앱 + React/TypeScript/Vite/Recharts 기반 ui-preview iframe` |
| CSV 파싱 | 메인 앱 `index.html`에서 PapaParse CDN으로 CSV 클라이언트 파싱 | `PapaParse 기반 클라이언트 CSV 파싱` |
| 지도 라이브러리 | Leaflet 아님. 현재 운영 앱과 React iframe 모두 Kakao Maps SDK 사용 | `Kakao Maps JavaScript SDK 기반 지도 시각화` |
| 학생수 전망 headline | `R² 0.932 / MAE 54.8`은 맞음 | `Model 1의 2~3년 recursive walk-forward 평균 R² 0.932, MAE 54.8` |
| horizon별 성능 | 산출 JSON에는 있음. PPT에는 같이 보여주는 편이 안전함 | 1년/2년/3년 recursive 성능표 추가 |
| 표준편차/IQR | 기존 JSON에는 없어서 행 단위 예측값을 재생성해 산출함 | absolute error 기준 std/IQR을 부록 또는 발표자 노트에 추가 |
| 슬라이드 11의 `부록 A8` | 현재 로컬 PPTX에는 A8 없음. 실제 부록은 A1~A7 | `부록 A8` 삭제 또는 `슬라이드 15`로 수정 |

## 2. 도구: 사용방법 매칭표

| 도구 | 사용방법 |
|---|---|
| Vanilla JS | 메인 정적 앱 `index.html` 구현. 학교 검색, 필터, 지도 레이어 제어, CSV/GeoJSON 로딩, iframe 연결 담당 |
| React | `ui-preview/dist/index.html` iframe 내부의 상세 리포트, 후보지 시뮬레이션, 전체 통계 화면 구현 |
| TypeScript | React 기반 `ui-preview/src/*.tsx` 컴포넌트와 데이터 매핑 로직 작성 |
| Vite | `ui-preview` React 앱 빌드 및 번들링. 배포 시 `ui-preview/dist` 산출물을 정적 파일로 포함 |
| Recharts | 상세 리포트·통계 화면의 차트 시각화에 사용 |
| PapaParse | 클라이언트에서 `data_processed/*.csv` 파일을 직접 파싱해 앱 데이터로 로딩 |
| Kakao Maps JavaScript SDK | 메인 지도 및 React 시뮬레이션 지도 표시. 학교·공원·후보지 마커, 도보권/직선권 레이어, 클러스터링 등에 사용 |
| GeoJSON | 도보 500m 권역, 직선 500m 버퍼, 후보지 격자 등 공간 레이어 표시 데이터 형식 |
| Vercel 정적 배포 | `vercel_public/index.html`, `data_processed/`, `ui-preview/dist/`를 정적 산출물로 배포 |

## 3. 앱 구조 검증

### 3-1. 배포 구조

| 구분 | 확인 내용 | 근거 파일 |
|---|---|---|
| 배포 진입점 | `vercel_public/index.html` | `vercel.json`, `scripts/deploy/build_vercel_static.mjs` |
| 운영 메인 앱 | 루트 `index.html` | `README.md`, `docs/VERCEL_DEPLOYMENT.md` |
| React iframe | `ui-preview/dist/index.html` | `README.md`, `index.html`, `scripts/deploy/build_vercel_static.mjs` |
| 배포 데이터 | `vercel_public/data_processed/` | `scripts/deploy/build_vercel_static.mjs` |

정확한 발표 표현:

> 프론트엔드: Vanilla JS 정적 메인 앱(index.html) + React/TypeScript/Vite/Recharts 기반 ui-preview iframe

주의:

- `Vanilla JS`만 적으면 React 기반 상세 리포트·시뮬레이션·통계 iframe이 빠진다.
- `React 앱`만 적으면 메인 지도/검색/레이어 로직을 담당하는 루트 `index.html`이 빠진다.

### 3-2. CSV/지도 검증

| 항목 | 확인 내용 | 근거 |
|---|---|---|
| PapaParse | `index.html`이 `PapaParse 5.4.1` CDN 로드 후 `Papa.parse()` 사용 | `index.html` |
| CSV fallback | PapaParse가 없으면 fetch 기반 fallback 파서 사용 | `index.html` |
| Kakao Maps | `https://dapi.kakao.com/v2/maps/sdk.js` 로드 | `index.html`, `ui-preview/src/KakaoMap.tsx`, `app/src/KakaoMap.tsx` |
| Leaflet | 현재 운영 소스 기준 Leaflet 사용 흔적 없음 | `rg "leaflet|L\\.map"` 검색 |

정확한 발표 표현:

> 데이터 로딩/지도: PapaParse 기반 클라이언트 CSV 파싱, Kakao Maps JavaScript SDK 기반 지도 시각화

Leaflet이라고 쓰면 개발자가 바로 짚을 가능성이 높다.

## 4. 학생수 예측 모델 검증

### 4-1. 모델 정의

| 모델 | 구조 | 사용 판단 |
|---|---|---|
| Model 1 | weighted trend + LightGBM residual correction | 중기 recursive 안정성이 좋아 최종 채택 |
| Model 2 | ElasticNet timeseries + Prophet correction | 1년 ahead는 더 좋지만 2~3년 recursive에서 누적오차가 큼 |

근거 파일:

- `output/school_enrollment_model_comparison.json`
- `output/school_enrollment_model_comparison.md`
- `data_processed/school_enrollment_forecast_20260418_model1.csv`

### 4-2. 1년 ahead 단기 검증

| 모델 | R² | MAE | RMSE |
|---|---:|---:|---:|
| Model 1 | 0.9651 | 37.28 | 72.59 |
| Model 2 | 0.9733 | 33.64 | 63.44 |

해석:

- 1년 ahead만 보면 Model 2가 더 좋다.
- 하지만 발표에서 쓰는 2029/2031 전망은 중기 예측이므로 recursive 검증이 더 중요하다.

### 4-3. horizon별 recursive 성능

| 모델 | 1년 recursive | 2년 recursive | 3년 recursive | 2~3년 평균 |
|---|---:|---:|---:|---:|
| Model 1 선택 | R² 0.970 / MAE 36.7 | R² 0.943 / MAE 48.2 | R² 0.921 / MAE 61.5 | R² 0.932 / MAE 54.8 |
| Model 2 ElasticNet | R² 0.973 / MAE 33.6 | R² 0.922 / MAE 60.1 | R² 0.853 / MAE 82.2 | R² 0.888 / MAE 71.1 |

주의:

- `R² 0.932 / MAE 54.8`은 Model 1의 2년·3년 recursive 성능을 단순 평균낸 headline 값이다.
- 데이터 분석가 질문에 대비하려면 1년/2년/3년 분해표를 함께 제시하는 것이 안전하다.
- pooled 2~3년 전체 행을 한 번에 다시 평가하면 Model 1은 R² 0.9344, MAE 53.48이다. PPT headline과 섞지 말 것.

## 5. recursive 오차 분포: 표준편차/IQR

산출 파일:

- `output/school_enrollment_recursive_error_distribution.md`
- `output/school_enrollment_recursive_error_distribution.csv`
- `output/school_enrollment_recursive_backtest_predictions.csv`
- 재현 스크립트: `scripts/export_school_enrollment_error_distribution.py`

단위는 명이다.

- `residual = prediction - actual`
- `absolute error = abs(prediction - actual)`
- MAE와 바로 연결되는 분포는 `absolute error` 쪽이다.

| 모델 | horizon | n | residual std | residual IQR | absolute error std | absolute error IQR |
|---|---:|---:|---:|---:|---:|---:|
| Model 1 | 1 | 798 | 67.7 | 37.2 | 57.0 | 31.3 |
| Model 1 | 2 | 789 | 91.6 | 48.7 | 78.0 | 42.8 |
| Model 1 | 3 | 523 | 105.7 | 68.3 | 85.9 | 58.4 |
| Model 2 | 1 | 798 | 63.5 | 33.4 | 53.8 | 29.0 |
| Model 2 | 2 | 789 | 106.6 | 58.2 | 88.2 | 52.0 |
| Model 2 | 3 | 523 | 144.0 | 91.1 | 119.0 | 72.5 |
| Model 1 | 2~3 pooled | 1312 | 97.5 | 54.1 | 81.5 | 49.6 |
| Model 2 | 2~3 pooled | 1312 | 122.9 | 68.5 | 102.1 | 60.2 |

PPT에 짧게 넣을 경우 추천:

| 모델 | 중기 평균 성능 | 2~3년 pooled absolute error 분포 |
|---|---|---|
| Model 1 선택 | R² 0.932 / MAE 54.8 | std 81.5명 / IQR 49.6명 |
| Model 2 ElasticNet | R² 0.888 / MAE 71.1 | std 102.1명 / IQR 60.2명 |

말로 설명할 때:

> 1년 단기 성능은 ElasticNet 트랙이 조금 높았지만, 발표에서 쓰는 2029/2031 전망은 2~3년 재귀 예측 영역입니다. 이 구간에서 Model 1은 평균 MAE뿐 아니라 absolute error 분포의 표준편차와 IQR도 더 작아 누적오차가 상대적으로 안정적이었습니다.

## 6. SHAP 및 부록 번호 검증

### 6-1. 현재 PPTX 상태

로컬 PPTX:

- `outputs/robust_xai/ppt_assets/incheon_outdoor_equity_v3_6_robust_xai_inserted.pptx`

확인 결과:

| 항목 | 내용 |
|---|---|
| 총 슬라이드 수 | 24장 |
| 슬라이드 11 문구 | `B 트랙 검증: SHAP으로 후보별 예측 근거 분해 (부록 A8)` |
| 마지막 부록 | A7 |
| A7 내용 | 참고문헌 |
| A8 존재 여부 | 없음 |

따라서 슬라이드 11의 `부록 A8` 참조는 현재 로컬 PPTX 기준으로 틀렸다.

### 6-2. 수정 권장

| 현재 문구 | 수정 문구 |
|---|---|
| `B 트랙 검증: SHAP으로 후보별 예측 근거 분해 (부록 A8)` | `B 트랙 설명: SHAP으로 후보별 예측 근거 분해 (슬라이드 15)` |

또는 SHAP 부록을 새로 만들 경우:

| 선택지 | 처리 |
|---|---|
| A8을 유지 | 새 부록 `A8 | SHAP 후보 진단` 슬라이드 추가 |
| A8을 만들지 않음 | 슬라이드 11에서 `부록 A8` 삭제 또는 `슬라이드 15`로 교체 |

## 7. 재현 절차

### 7-1. 앱 기술 스택 재확인

```powershell
rg -n "Papa|papaparse|leaflet|Leaflet|kakao|Kakao|recharts|React|vite" -S .
rg -n "iframe|ui-preview|PapaParse|Leaflet|Kakao|Vite|Recharts" index.html README.md docs\VERCEL_DEPLOYMENT.md -S
Get-Content -Encoding UTF8 vercel.json
Get-Content -Encoding UTF8 scripts\deploy\build_vercel_static.mjs
```

기대 확인:

- `index.html`에 PapaParse CDN 및 `Papa.parse()`.
- `index.html`, `ui-preview/src/KakaoMap.tsx`, `app/src/KakaoMap.tsx`에 Kakao Maps SDK.
- Leaflet 사용 없음.
- `scripts/deploy/build_vercel_static.mjs`가 `index.html`, `data_processed`, `ui-preview/dist`를 `vercel_public`으로 복사.

### 7-2. 모델 성능 재확인

```powershell
Get-Content -Encoding UTF8 output\school_enrollment_model_comparison.json
Get-Content -Encoding UTF8 output\school_enrollment_model_comparison.md
```

핵심 확인:

- Model 1 2~3년 평균: R² 0.9320, MAE 54.84.
- Model 2 2~3년 평균: R² 0.8876, MAE 71.14.
- horizon별 recursive 성능은 JSON의 `recursive_walk_forward.horizons` 안에 있음.

### 7-3. 표준편차/IQR 재생성

```powershell
$env:PYTHONIOENCODING='utf-8'
python scripts\export_school_enrollment_error_distribution.py
Get-Content -Encoding UTF8 output\school_enrollment_recursive_error_distribution.md
```

생성물:

| 파일 | 역할 |
|---|---|
| `output/school_enrollment_recursive_error_distribution.md` | PPT/문서용 요약표 |
| `output/school_enrollment_recursive_error_distribution.csv` | 요약 수치 원본 |
| `output/school_enrollment_recursive_backtest_predictions.csv` | 행 단위 예측값, residual, absolute error |

검산 명령:

```powershell
$env:PYTHONIOENCODING='utf-8'
python -c "import pandas as pd; from sklearn.metrics import r2_score, mean_absolute_error; df=pd.read_csv('output/school_enrollment_recursive_backtest_predictions.csv', encoding='utf-8-sig'); [print(m,h,len(g),round(r2_score(g.actual,g.prediction),4),round(mean_absolute_error(g.actual,g.prediction),2)) for (m,h),g in df.groupby(['model','horizon'])]"
```

기대 출력:

```text
Model 1 1 798 0.9695 36.72
Model 1 2 789 0.9426 48.17
Model 1 3 523 0.9214 61.5
Model 2 1 798 0.9733 33.64
Model 2 2 789 0.9223 60.1
Model 2 3 523 0.8529 82.19
```

### 7-4. PPT 슬라이드 번호 재확인

```powershell
$env:PYTHONIOENCODING='utf-8'
python -c "from pptx import Presentation; prs=Presentation('outputs/robust_xai/ppt_assets/incheon_outdoor_equity_v3_6_robust_xai_inserted.pptx'); print('slides', len(prs.slides)); [print(f'{i:02d}: ' + ' || '.join([' '.join(sh.text.strip().split()) for sh in s.shapes if hasattr(sh,'text') and sh.text.strip()][:4])) for i,s in enumerate(prs.slides,1)]"
```

기대 확인:

- 총 24장.
- 11번 슬라이드에 `부록 A8` 문구.
- 24번 슬라이드는 `A7 | 부록 | 참고문헌`.
- A8 없음.

## 8. PPT에 바로 넣을 최종 문구

### 기술 스택

> Vanilla JS 정적 메인 앱(index.html)과 React/TypeScript/Vite/Recharts 기반 ui-preview iframe을 결합해, 지도 기반 탐색과 상세 리포트·시뮬레이션·통계 화면을 분리 구현했다.

### 데이터 로딩/지도

> CSV 데이터는 PapaParse로 클라이언트에서 직접 파싱하고, 지도 시각화는 Kakao Maps JavaScript SDK로 구현했다.

### 학생수 전망

> 1년 단기 검증에서는 ElasticNet 트랙이 우세했지만, 실제 발표에 사용하는 2029/2031 전망은 2~3년 재귀 예측 영역이다. 이 구간에서 Model 1은 R² 0.932, MAE 54.8로 Model 2보다 안정적이어서 최종 학생수 전망 모델로 채택했다.

### 오차 분포

> 2~3년 recursive 구간의 pooled absolute error 기준으로 Model 1은 std 81.5명, IQR 49.6명이며, Model 2의 std 102.1명, IQR 60.2명보다 누적오차 분포가 작다.

### SHAP

> SHAP은 최종 추천 순위의 절대 근거가 아니라, 후보별 미래 수혜 아동 수 예측값을 움직인 변수별 설명 신호로 사용했다.

### 부록 참조 수정

> 슬라이드 11의 `부록 A8` 참조는 현재 부록 구조와 맞지 않으므로 `슬라이드 15`로 수정하거나, 별도 `A8 | SHAP 후보 진단` 부록을 신설한다.

## 9. Track 2 지역 아동수 예측 검증

작성일: 2026-05-21
재현 스크립트: `scripts/validate_track2_child_demand.py`
산출 폴더: `outputs/track2_validation/`

### 9-1. 데이터 가용성 결론

| 항목 | 확인 결과 |
|---|---|
| 구별 연도별 아동수 | `C:\2026_data_analysis_park\data\processed\incheon_gu_child_timeseries.csv`에 2021~2025 후행검증 가능한 시계열 존재 |
| 1km 격자 기준값 | `data_processed/population_grid_1k.csv`에 현재 기준 `child_pop_0_5`, `child_pop_6_12` 존재 |
| 1km 미래 예측 | `grid_1km_cohort_pred.csv`, `grid_1km_prophet_alloc.csv`, `grid_1km_final_pred.csv` 존재 |
| 250m 후보지 예측 | `grid_250m_pred.csv`, `candidate_grid_final.csv` 존재 |
| 후보지 추천 결과 | `outputs/robust_xai/robust_candidate_recommendations.csv` 존재 |
| 후보지/250m 다년도 실제값 | 현재 저장소에 없음. 직접 후행검증 불가 |

주의 문구:

> 격자 단위 검증 기준값은 주민등록 또는 공공 인구자료를 공간 단위로 배분한 정책 분석용 기준값이며, 개별 아동 위치의 실측값을 의미하지 않는다.

### 9-2. 산출물

| 파일 | 역할 |
|---|---|
| `outputs/track2_validation/track2_validation_data_audit.md` | 데이터 가용성 감사 |
| `outputs/track2_validation/track2_backtest_metrics.csv` | Proposed 구별 총량 후행검증 지표 |
| `outputs/track2_validation/track2_baseline_comparison.csv` | baseline 비교 |
| `outputs/track2_validation/track2_policy_rank_stability.csv` | 정책 단위 순위 안정성 |
| `outputs/track2_validation/track2_candidate_perturbation.csv` | 잔차 기반 후보 유지율 |
| `outputs/track2_validation/track2_validation_summary.md` | 전체 해석 요약 |
| `outputs/track2_validation/track2_ppt_numbers.md` | PPT 삽입 숫자 |

### 9-3. Backtest 및 Baseline 비교

직접 후행검증은 구별 0~12세 총량 단위에서 수행했다. 250m 격자/후보지 단위는 다년도 실제값이 없어 후행 정확도 산출 대상에서 제외했다.

| 모델 | 단위 | 전체 MAE | 전체 WAPE | 전체 RMSE | 해석 |
|---|---|---:|---:|---:|---|
| Baseline 1 | 구별 총량 | 1,222.3명 | 4.29% | 1,827.0명 | 최근값 유지 |
| Baseline 2 | 구별 총량 | 834.1명 | 2.93% | 1,428.3명 | 구별 직전 증감률 적용 |
| Baseline 2-city | 구별 총량 | 1,033.6명 | 3.63% | 1,736.6명 | 인천 전체 직전 증감률 적용 |
| Proposed | 구별 총량 | 1,041.1명 | 3.66% | 1,792.2명 | 구별 Prophet 총량 예측 |
| Baseline 3 | 250m grid distribution | 산출 불가 | 산출 불가 | 산출 불가 | 미래 격자 기준값 부재. 고정 공간비율 배분과 Proposed 운영 분포 비교만 가능 |

핵심 해석:

- Proposed는 최근값 유지 baseline보다 WAPE가 낮다.
- 단순한 구별 직전 증감률 baseline보다 WAPE가 낮지는 않다. 이 점은 숨기지 않는 것이 안전하다.
- Track 2의 강점은 “절대값 정확도 1등”보다 “정책 후보군의 상대 수요와 상위 후보 안정성”으로 설명하는 것이 맞다.

### 9-4. 정책 단위 순위 안정성

| 검증 단위 | 기준값 | 예측값 | Spearman | Top-K | Overlap | Jaccard | 해석 |
|---|---|---|---:|---:|---:|---:|---|
| gu_total_backtest | 구별 실제 0~12세 | 구별 Prophet 예측 | 0.976~1.000 | 3 | 3/3 | 1.000 | 구별 총량 순위는 매우 안정적 |
| candidate_grid_current_vs_2031 | 후보지 현재 기준 아동수 | 후보지 2031 예측 수혜값 | 0.147 | 85 | 15/85 | 0.097 | 현재 인구 분포와 미래 수요 후보 순위는 크게 달라짐 |
| school_walkshed_proxy | 학교 도보권 현재 아동수 | 연결 후보지 2031 예측값 합산 | 0.204 | 85 | 51/85 | 0.429 | 학교 정책 단위에서는 상위 후보군 일부가 유지됨 |

주의:

- 후보지/학교 단위 Spearman은 실측 미래값과의 정확도 검증이 아니다.
- 현재 기준값 대비 미래 예측 수요의 순위 일관성을 보는 정책 단위 proxy 검증이다.

### 9-5. 잔차 기반 후보 추천 안정성

구별 Prophet backtest의 residual rate를 후보지 예측 수요에 1,000회 무작위 적용했다. Random seed는 42.

| K | n_sim | 평균 Jaccard | 중앙 Jaccard | 평균 유지율 | 중앙 유지율 | 평균 순위 변동 | Jaccard p10~p90 |
|---:|---:|---:|---:|---:|---:|---:|---|
| 50 | 1,000 | 0.953 | 0.961 | 97.57% | 98.00% | 2.08 | 0.923~1.000 |
| 85 | 1,000 | 0.883 | 0.889 | 93.75% | 94.12% | 3.41 | 0.848~0.910 |
| 155 | 1,000 | 0.923 | 0.925 | 96.00% | 96.13% | 5.77 | 0.902~0.950 |

PPT 본문용 숫자:

| 항목 | 값 |
|---|---:|
| Backtest MAE | 1,041.1명 |
| Backtest WAPE | 3.66% |
| 후보지 Top-K 유지율, K=85 | 93.75% |
| 후보지 Jaccard, K=85 | 평균 0.883 / 중앙값 0.889 |
| Perturbation 횟수 | 1,000회 |

PPT 문장:

> Track 2는 개별 격자의 미래 아동수 절대값을 단정하기보다, 구별 총량 후행검증과 후보지 잔차 perturbation을 통해 정책 우선순위 후보군이 안정적으로 유지되는지 검증했다.

더 보수적인 문장:

> 구별 총량 backtest에서 Proposed WAPE는 3.66%였고, 예측 잔차를 반영해 후보지 수요를 1,000회 흔들어도 K=85 상위 후보의 평균 유지율은 93.75%였다.

한계 문장:

> 250m 격자·후보지 단위의 다년도 실제 관측값은 없어, 격자 기준값은 공공 인구자료를 공간 배분한 정책 분석용 기준값으로 해석해야 한다.

### 9-6. 재현 명령

```powershell
$env:PYTHONIOENCODING='utf-8'
python scripts\validate_track2_child_demand.py
Get-Content -Encoding UTF8 outputs\track2_validation\track2_ppt_numbers.md
Get-Content -Encoding UTF8 outputs\track2_validation\track2_validation_summary.md
Get-Content -Encoding UTF8 outputs\track2_validation\track2_multistep_horizon_origin2021plus.md
```

검증 완료 기준:

- `track2_validation_data_audit.md`에 데이터 가용성 표가 생성된다.
- `track2_baseline_comparison.csv`에 Baseline 1/2/2-city/3/Proposed가 생성된다.
- `track2_candidate_perturbation.csv`에 K=50, 85, 10% 후보군 유지율이 생성된다.

### 9-7. Multi-step ahead backtest 추가 검증

사용자 요청에 따라 1-step ahead가 아니라 origin year까지 학습한 뒤 이후 여러 target year를 예측하는 multi-step ahead 검증을 추가했다.

산출 파일:

| 파일 | 역할 |
|---|---|
| `outputs/track2_validation/track2_multistep_backtest_rows.csv` | origin 2020~2024 포함 행 단위 예측 |
| `outputs/track2_validation/track2_multistep_horizon_metrics.csv` | origin 2020~2024 포함 horizon별 지표 |
| `outputs/track2_validation/track2_multistep_horizon.md` | origin 2020~2024 포함 요약표 |
| `outputs/track2_validation/track2_multistep_backtest_rows_origin2021plus.csv` | origin 2021~2024, 사용자 예시 구조 |
| `outputs/track2_validation/track2_multistep_horizon_metrics_origin2021plus.csv` | origin 2021~2024 horizon별 지표 |
| `outputs/track2_validation/track2_multistep_horizon_origin2021plus.md` | 사용자 예시 구조 요약표 |

검증 정의:

- Baseline 1: origin year의 최근값 유지
- Baseline 2: 구별 origin 직전 1년 증감률을 horizon만큼 누적 적용
- Baseline 2-city: 인천 전체 origin 직전 1년 증감률을 horizon만큼 누적 적용
- Proposed: origin year까지 학습한 Prophet으로 각 target year 직접 예측

사용자 예시 구조: origin 2021~2024만 사용

| Horizon | n | Baseline 1 WAPE | Baseline 2 WAPE | Baseline 2-city WAPE | Proposed WAPE | Winner |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 40 | 4.51% | 2.63% | 3.83% | 3.64% | Baseline 2 |
| 2 | 30 | 8.52% | 6.11% | 7.26% | 6.40% | Baseline 2 |
| 3 | 20 | 12.64% | 7.76% | 10.64% | 8.44% | Baseline 2 |
| 4 | 10 | 17.68% | 7.32% | 14.67% | 15.61% | Baseline 2 |

5년 horizon을 보기 위해 origin 2020을 추가한 스트레스 테스트:

| Horizon | n | Baseline 1 WAPE | Baseline 2 WAPE | Baseline 2-city WAPE | Proposed WAPE | Winner |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 50 | 4.29% | 2.93% | 3.63% | 3.66% | Baseline 2 |
| 2 | 40 | 8.74% | 7.20% | 7.22% | 7.25% | Baseline 2 |
| 3 | 30 | 13.33% | 10.59% | 11.21% | 10.87% | Baseline 2 |
| 4 | 20 | 17.66% | 13.93% | 15.09% | 17.78% | Baseline 2 |
| 5 | 10 | 21.54% | 25.02% | 19.44% | 24.78% | Baseline 2-city |

중요 결론:

- 예상했던 “장기 horizon에서 Proposed가 baseline을 이긴다” 패턴은 현재 데이터/구현 기준으로 나오지 않았다.
- 사용자 예시 구조에서는 1~4년 ahead 모두 Baseline 2가 WAPE 최저다.
- origin 2020을 추가한 5년 ahead 스트레스 테스트에서도 Proposed가 이기지 않는다.
- 따라서 PPT에서 “Track 2 Prophet 총량 모델이 장기 정확도에서 baseline보다 우수하다”고 쓰면 안 된다.

안전한 PPT 문장:

> Track 2의 구별 총량 예측은 multi-step backtest에서 단순 직전 증감률 baseline을 넘지는 못했다. 따라서 본 모델은 장기 총량 정확도 우위가 아니라, 후보지 수요 분포를 만들고 잔차 perturbation으로 상위 후보군 안정성을 점검하는 정책 시뮬레이션 보조 트랙으로 해석한다.

짧은 발표자 방어 문장:

> 총량 예측 정확도만 보면 직전 증감률 baseline이 더 강했습니다. 그래서 저희는 Track 2를 절대 아동수 단정 모델이 아니라 후보지 우선순위의 민감도와 안정성을 보는 보조 트랙으로 제한해 사용했습니다.

### 9-8. Baseline2-equivalent 격자 분배 perturbation 검증

사용자 요청에 따라 Baseline 2의 구별 2031 총량을 후보 격자에 강제로 분배한 뒤, Proposed와 동일한 방식으로 Top-K 안정성을 비교했다.

정의:

- Baseline2-equivalent 구별 총량: 2025년 구별 0~12세 총량에 2024→2025 구별 증감률을 6년 누적 적용해 2031년 값 생성.
- 격자 분배: 명시적 2024 격자별 아동수 비율 파일이 현재 repo에서 확인되지 않아 `candidate_child_current`의 구별 내부 비율을 2024 고정 공간비율 proxy로 사용.
- 비교 단위: `school_id::grid_id` 학교-후보 격자 쌍.
- perturbation: 구별 backtest residual rate를 후보 수요에 1,000회 무작위 적용, random seed 42.

| 모델 | K | 평균 Jaccard | Top-K 유지율 | 평균 순위변동 |
|---|---:|---:|---:|---:|
| Proposed + Prophet residual | 50 | 0.953 | 97.57% | 2.08 |
| Proposed + Prophet residual | 85 | 0.883 | 93.75% | 3.41 |
| Proposed + Prophet residual | 155 | 0.923 | 96.00% | 5.77 |
| Baseline2-equivalent 고정공간비율 + 동일 Prophet residual | 50 | 0.936 | 96.68% | 2.88 |
| Baseline2-equivalent 고정공간비율 + 동일 Prophet residual | 85 | 0.934 | 96.59% | 3.74 |
| Baseline2-equivalent 고정공간비율 + 동일 Prophet residual | 155 | 0.925 | 96.07% | 4.89 |
| Baseline2-equivalent 고정공간비율 + Baseline2 residual | 50 | 0.940 | 96.87% | 2.47 |
| Baseline2-equivalent 고정공간비율 + Baseline2 residual | 85 | 0.946 | 97.20% | 3.16 |
| Baseline2-equivalent 고정공간비율 + Baseline2 residual | 155 | 0.937 | 96.76% | 4.09 |

기대했던 `Proposed 93.75% vs Baseline 70~80%` 패턴은 나오지 않았다. Baseline2-equivalent도 고정 공간비율 구조 때문에 perturbation Top-K 유지율이 매우 높다. 따라서 PPT에서 “Proposed가 후보 유지 안정성에서 baseline보다 우수하다”고 쓰면 위험하다.

다만 두 방식이 고르는 후보군은 크게 다르다.

| Top-K | Proposed vs Baseline2-equivalent 겹침 | Jaccard |
|---:|---:|---:|
| 50 | 7 / 50 | 0.075 |
| 85 | 15 / 85 | 0.097 |
| 155 | 34 / 155 | 0.123 |

안전한 해석:

> Baseline2-equivalent는 고정 공간비율 가정 때문에 후보 순위 자체는 안정적이나, Proposed와 추천 후보군이 크게 다르다. Track 2의 차별점은 perturbation 안정성 우위가 아니라, 공간 특성과 정책 조건을 반영해 다른 후보군을 도출한다는 데 있다.

### 9-9. Proposed vs Baseline2-equivalent Top-85 정책 타겟 특성 비교

추가 검증으로 Proposed의 K=85 후보 격자와 Baseline2-equivalent의 K=85 후보 격자에 대해 같은 정책 지표의 평균을 비교했다. 여기서 `access_gap_score`는 기존 활동가능공원 접근 결핍 점수, `proximity_score`는 학교-후보지 접근성 점수이며 값이 높을수록 해당 기준에서 유리하다. `grid_child_change_rate`는 후보 격자 단위 `pred_beneficiary_2031` 대비 `candidate_child_current` 변화율이다.

| 그룹 | n | 공원 부재 점수 평균 | 학교 접근성 점수 평균 | 평균 경로거리 | grid child_pop 변화율 평균 | grid child_pop 변화율 중앙값 | 현재 아동수 평균 | 2031 격자 예측 평균 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Proposed Top-85 | 85 | 0.457 | 0.605 | 451.8m | +336.5% | +66.3% | 107.5명 | 214.7명 |
| Baseline2-equivalent Top-85 | 85 | 0.465 | 0.552 | 524.2m | -46.2% | -76.6% | 316.3명 | 151.0명 |

Top-85 중 서로 겹치지 않는 후보만 비교하면 차이가 더 선명하다.

| 그룹 | n | 공원 부재 점수 평균 | 학교 접근성 점수 평균 | 평균 경로거리 | grid child_pop 변화율 평균 | grid child_pop 변화율 중앙값 | 현재 아동수 평균 | 2031 격자 예측 평균 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Proposed-only | 70 | 0.463 | 0.587 | 481.2m | +400.4% | +66.5% | 70.2명 | 177.8명 |
| Baseline-only | 70 | 0.473 | 0.524 | 569.1m | -66.0% | -83.7% | 323.7명 | 100.5명 |

한 줄 요약:

> Proposed Top-85는 Baseline2-equivalent보다 공원 부재 점수는 높지 않았지만, 학교 접근성 점수는 더 높고(0.605 vs 0.552), 2031 격자 아동 변화율도 더 높아(+66.3% median vs -76.6% median) “현재 인구가 많은 곳”보다 “미래 수요와 학교 접근성을 반영한 후보”를 고른 것으로 해석할 수 있다.

주의:

- 공원 부재 점수는 Baseline2-equivalent가 근소하게 높으므로, `Proposed가 공원 부재 조건까지 더 강하게 반영했다`고 쓰면 안 된다.
- child_pop 변화율 평균은 작은 분모 후보 때문에 커질 수 있어 PPT에는 중앙값 또는 방향성 중심으로 쓰는 편이 안전하다.

## 10. 소규모 공원 제외 직선거리 분포 그래프

작성일: 2026-05-21
재현 스크립트: `scripts/export_park_distance_boxplot.py`
산출물:

- `outputs/park_distance_comparison/park_distance_boxplot_active_policy_target.png`
- `outputs/park_distance_comparison/park_distance_boxplot_stats_active_policy_target.csv`
- 호환 경로: `outputs/case_reclassification/case_reclassification_active_policy_target.png`

기준:

- 원천 파일: `data_quality/park_function_counterfactual_by_school_20260518.csv`
- 대상: 현재 앱 case가 있는 `active_policy_target` 242교
- 세 시나리오는 `data_quality/park_function_counterfactual_nearest_long_20260518.csv`의 `nearest_eligible_park_dist_m_straight` 기준
- 비교 기준 1: 전체 공원 포함
- 비교 기준 2: 놀이터급·초소형 공간 제외
- 비교 기준 3: 놀이터급·초소형 공간과 3,000㎡ 미만 소규모 어린이공원 제외

PPT 문구:

> 현재 앱 case가 부여된 242교를 기준으로, 전체 공원을 포함하면 가까운 공원까지의 평균 직선거리는 249.9m, 중앙값은 177.1m다. 놀이터급·초소형 공간을 제외하면 평균 325.0m, 중앙값 215.6m로 늘고, 소규모 어린이공원까지 제외하면 평균 425.6m, 중앙값 320.6m로 더 멀어진다.

거리 통계:

| 기준 | n | 평균 | 1분위 | 중앙값 | 3분위 |
|---|---:|---:|---:|---:|---:|
| 전체 공원 포함 | 242 | 249.9m | 116.6m | 177.1m | 311.1m |
| 놀이터급·초소형 공간 제외 | 242 | 325.0m | 134.5m | 215.6m | 390.6m |
| 놀이터급·소규모 어린이공원 제외 | 242 | 425.6m | 166.8m | 320.6m | 516.0m |

주의:

- 전체 272교 기준으로 보면 별도 묶음/미분류 30교가 포함되어 다른 집계가 나온다.
- 이 그래프는 242교 기준이라고 주석 또는 캡션에 반드시 명시한다.
- 이 그래프는 도보거리가 아니라 직선 최단거리 counterfactual이다. 발표 문구에서 "도보 최단거리"라고 쓰지 않는다.

## 11. 도보 500m 면적 제외 case 재분류

작성일: 2026-05-22
재현 스크립트: `scripts/export_park_area_exclusion_reclassification.py`
산출물:

- `outputs/park_area_exclusion_reclassification/park_area_exclusion_case_reclassification.png`
- `outputs/park_area_exclusion_reclassification/park_area_exclusion_case_counts.csv`
- `outputs/park_area_exclusion_reclassification/park_area_exclusion_reclassified_by_school.csv`
- `outputs/park_area_exclusion_reclassification/park_area_exclusion_transition_exclude_playground_like.csv`
- `outputs/park_area_exclusion_reclassification/park_area_exclusion_transition_exclude_playground_and_small_child.csv`

기준:

- 대상: 현재 앱 case가 부여된 242교
- 공간 기준: `data_processed/school_isochrone_500m.geojson`, 학교 기준 도보 500m 등시선
- 공원 기준: `data_processed/parks_with_function_class.csv`
- 공원 면적 처리: 실제 공원 경계 polygon이 아니라, 기존 프로젝트 방식과 맞춘 공원 중심점 + 공원면적 기반 원형 proxy
- 재분류 방식: 제외 대상 공원 proxy 면적을 기존 운영 도보권 녹지면적에서 차감하고, 남은 녹지비율로 case 재분류
- 이 재분류는 직선거리 기준이 아니다. 학교 도보 500m 생활권 안에서 남는 공원면적을 다시 계산한 결과다.

재분류 결과:

| 기준 | Case 1 | Case 2 | Case 3 | Case 4 |
|---|---:|---:|---:|---:|
| 현재 | 17교 (7.0%) | 68교 (28.1%) | 77교 (31.8%) | 80교 (33.1%) |
| 놀이터급 제외 | 56교 (23.1%) | 38교 (15.7%) | 68교 (28.1%) | 80교 (33.1%) |
| 소규모 이하 제외 | 86교 (35.5%) | 27교 (11.2%) | 56교 (23.1%) | 73교 (30.2%) |

전환표, 놀이터급 제외:

| 현재 case → 재분류 case | Case 1 | Case 2 | Case 3 | Case 4 |
|---|---:|---:|---:|---:|
| Case 1 | 17 | 0 | 0 | 0 |
| Case 2 | 39 | 29 | 0 | 0 |
| Case 3 | 0 | 9 | 68 | 0 |
| Case 4 | 0 | 0 | 0 | 80 |

전환표, 소규모 이하 제외:

| 현재 case → 재분류 case | Case 1 | Case 2 | Case 3 | Case 4 |
|---|---:|---:|---:|---:|
| Case 1 | 17 | 0 | 0 | 0 |
| Case 2 | 52 | 16 | 0 | 0 |
| Case 3 | 17 | 11 | 49 | 0 |
| Case 4 | 0 | 0 | 7 | 73 |

PPT 문구:

> 학교 도보 500m 생활권 안에서 놀이터급·소규모 어린이공원 면적을 제외한 뒤 남은 녹지비율로 case를 재분류했다. 놀이터급 공간만 제외해도 Case 1은 17교에서 56교로 늘고, 소규모 어린이공원까지 제외하면 86교까지 증가한다. 이는 현재 도보권 녹지 접근성이 상당 부분 작은 놀이공간과 소규모 공원 면적에 의존하고 있음을 보여준다.

주의:

- 이전 `미분류` 방식은 제외 후 남는 대상 공원 수/거리만 바꾸고 녹지비율을 재계산하지 않아 발표용 case 재분류로 부적절하다.
- 이 표에는 미분류를 두지 않는다. 제외 면적 차감 후 남은 녹지비율이 0%이면 Case 1, 1% 이하이면 Case 2, 1~5%이면 Case 3, 5% 초과이면 Case 4로 해석한다.
- 실제 공원 경계 polygon이 아니라 proxy 면적이므로, 절대값보다 시나리오 간 변화 방향과 규모를 설명하는 용도로 사용한다.

## 12. 도보 500m 녹지비율 분포 그래프

작성일: 2026-05-21
재현 스크립트: `scripts/export_green_ratio_threshold_chart.py`
산출물:

- 검은 배경: `outputs/green_ratio_threshold/green_ratio_distribution_005_threshold.png`
- 흰 배경: `outputs/green_ratio_threshold/green_ratio_distribution_005_threshold_white.png`
- 집계 CSV: `outputs/green_ratio_threshold/green_ratio_distribution_005_threshold.csv`
- `<0.05%` 학교 목록: `outputs/green_ratio_threshold/green_ratio_under_005_schools.csv`

기준:

- 원천 파일: `data_processed/school_priority_with_functional_park_layer.csv`
- 녹지율 컬럼: `display_green_ratio`
- 대상: 별도 묶음/도서 태그 제외, 242교
- 기존 `0%` 구간을 `<0.05%`로 변경하고 나머지 기준은 동일하게 유지

| 도보 500m 녹지비율 구간 | 학교 수 | 비율 |
|---|---:|---:|
| `<0.05%` | 37 | 15.3% |
| `0.05~5%` | 126 | 52.1% |
| `5~10%` | 47 | 19.4% |
| `10%↑` | 32 | 13.2% |
| 5% 미만 합산 | 163 | 67.4% |

주의:

- 이 그래프는 앱 표시/발표용 보정 녹지율인 `display_green_ratio` 기준이다.
- 2026-05-26 최종 기준부터 Case 분류도 `display_green_ratio` 기준으로 통일했다.

### 12-1. 최종 Case 분류식

검증일: 2026-05-26
원천 파일: `data_processed/school_priority_with_functional_park_layer.csv`

대상은 별도 묶음/도서 태그 제외, 현재 case가 부여된 242교다.

| Case | 최종 분류식 | 학교 수 |
|---|---|---:|
| Case 1 | `nearest_park_dist_m >= 500` AND `iso_park_count == 0` AND `display_green_ratio == 0` | 17 |
| Case 2 | 접근 가능 후보군 AND `display_green_ratio < 1` | 64 |
| Case 3 | 접근 가능 후보군 AND `1 <= display_green_ratio < 5` | 82 |
| Case 4 | 접근 가능 후보군 AND `display_green_ratio >= 5` | 79 |
| Case 1~3 합산 | `display_green_ratio < 5`와 동일 | 163 |

검증값:

- Case 1~3 학교 수: 163개교
- `display_green_ratio < 5%` 학교 수: 163개교
- Case 1~3과 `display_green_ratio < 5%` 불일치: 0개교
- 기존 `iso_green_ratio` 기준 Case 대비 변경 학교 수: 50개교

## 13. Case 1·2 학교 학생수 전망 합계

검증일: 2026-05-26
원천 파일:

- Case 분류: `data_processed/school_priority_with_functional_park_layer.csv`
- 학생수 전망: `data_processed/school_enrollment_forecast_20260418_model1.csv`

기준:

- Case 1·2 학교 수: 81개교
- Case 분류 기준: 최종 `display_green_ratio`
- 합산 컬럼: 학교별 학생수 전망 `forecast_2029`, `forecast_2031`
- 이 값은 격자 수요나 도보권 잠재수혜가 아니라 학교 단위 학생수 전망 합계다.

| 기준 | 학교 수 | 2025 현재 학생수 | 2029 전망 합계 | 2031 전망 합계 |
|---|---:|---:|---:|---:|
| Case 1·2 학교 | 81개교 | 46,310명 | 38,838명 | 35,202명 |

PPT 문구:

> Case 1·2 학교 81개교의 학생수 전망 합계는 2029년 38,838명, 2031년 35,202명이다.

주의:

- `38,838명`, `35,202명`은 학생수 전망 모델의 학교 단위 합계다.
- `walkshed_beneficiary` 또는 `pred_beneficiary`와 섞어 쓰면 안 된다.

## 14. 격자 자체 예측 vs 도보권 잠재수혜 정의

검증일: 2026-05-26
원천 파일:

- `data_processed/grid_250m_pred.csv`
- `data_processed/candidate_grid_final.csv`

컬럼 정의:

| 개념 | 컬럼 | 의미 |
|---|---|---|
| 단순 250m 격자 예측 | `pred_2029_250m`, `pred_2031_250m` | 250m 격자 자체의 예측 아동수 |
| 후보지 파일 내 단순 격자 예측 | `pred_beneficiary_2029`, `pred_beneficiary_2031` | 위 250m 격자 예측값이 후보지 파일에 붙은 것 |
| 도보권 잠재수혜 | `walkshed_beneficiary_2029`, `walkshed_beneficiary_2031` | 후보지에서 도보 접근 가능한 주변 격자 인구까지 합산한 잠재수혜 규모 |

Case 1·2 학교에 연결된 후보 격자를 `grid_id` 기준 중복 제거해 합산한 결과:

| 기준 | 중복제거 격자 수 | 2029 | 2031 |
|---|---:|---:|---:|
| 단순 250m 격자 예측, `pred_beneficiary` | 753개 | 32,466명 | 31,791명 |
| 도보권 잠재수혜, `walkshed_beneficiary` | 753개 | 186,153명 | 179,772명 |

`worst_case_type`이 1 또는 2인 후보 격자를 `grid_id` 기준 중복 제거해 합산한 결과:

| 기준 | 중복제거 격자 수 | 2029 | 2031 |
|---|---:|---:|---:|
| 단순 250m 격자 예측, `pred_beneficiary` | 753개 | 32,466명 | 31,791명 |
| 도보권 잠재수혜, `walkshed_beneficiary` | 753개 | 186,153명 | 179,772명 |

`25,701명` 검토 결과:

- 현재 확인한 주요 산출 파일 기준으로 `Case 1·2 학교 연결 격자, 중복제거, 2029 단순 격자수요`로는 재현되지 않는다.
- 같은 정의의 현재 재현값은 32,466명이다.
- 따라서 `25,701명`은 출처를 다시 찾기 전까지 PPT에 쓰지 않는 것이 안전하다.

PPT 라벨 추천:

| 라벨 | 설명 |
|---|---|
| `250m 격자 자체 예측 아동수` | 후보 격자 자체 인구 예측을 말할 때 |
| `후보지 도보권 잠재수혜 아동수` | 주변 도보권 인구를 합산한 수혜 규모를 말할 때 |

발표 설명:

> 도보권 잠재수혜 아동수는 후보 격자에 거주하는 아동수만이 아니라, 해당 후보지가 조성되었을 때 도보 500m 안에서 접근 가능해지는 주변 격자의 예측 아동수를 함께 합산한 값입니다. 후보지 간 도보권이 겹칠 수 있으므로 전체 합계는 인천 전체 아동 수가 아니라 후보지별 수혜 가능 규모를 더한 정책 검토용 지표입니다.

주의:

- `수요 인구`라고만 쓰지 말고, `격자 자체 예측`인지 `도보권 잠재수혜`인지 반드시 구분한다.
- `walkshed_beneficiary` 합계는 후보지별 도보권이 겹치면 중복 산입될 수 있으므로 전체 인구 총량처럼 해석하면 안 된다.

## 15. 취약계층 비율 분위별 녹지 1% 미만 검증값

검증일: 2026-05-20 산출물 재확인: 2026-05-21
재현 스크립트: `scripts/export/reproduce_vulnerable_green_quartile_20260520.py`
산출물:

- `outputs/verification/vulnerable_green_quartile_reproduced_20260520.csv`
- `outputs/verification/vulnerable_green_quartile_stats_20260520.json`
- `outputs/verification/vulnerable_green_quartile_reproduced_20260520.png`

검증 정의:

- 동별 0~14세 취약계층 비율을 학교 행 기준으로 4분위화
- 각 분위에서 도보권 녹지율 `display_green_ratio < 1%`인 학교 비율 산출
- 방향성 가설: 취약계층 비율 분위가 높을수록 녹지 1% 미만 학교 비율이 증가한다.

분위별 원자료:

| 취약계층 비율 분위 | 학교 수 | 녹지 1% 미만 학교 | 비율 | 취약계층 비율 범위 |
|---:|---:|---:|---:|---:|
| Q1 낮음 | 63 | 17 | 27.0% | 0.17~1.89% |
| Q2 | 58 | 16 | 27.6% | 1.90~4.02% |
| Q3 | 60 | 23 | 38.3% | 4.07~6.29% |
| Q4 높음 | 61 | 25 | 41.0% | 6.59~18.42% |

검증값 세트:

| 검정 | 값 |
|---|---:|
| 상위 절반 vs 하위 절반 오즈비 | 1.75 |
| Cochran-Armitage trend z | 1.947 |
| Cochran-Armitage one-sided p | 0.0258 |
| Cochran-Armitage two-sided p | 0.0515 |
| Fisher exact one-sided p | 0.0281 |
| Fisher exact two-sided p | 0.0562 |
| Chi-square, no Yates p | 0.0410 |
| Chi-square, Yates correction p | 0.0565 |
| Mann-Whitney one-sided p | 0.0208 |
| Mann-Whitney two-sided p | 0.0415 |

PPT 문구:

> 취약계층 비율이 높은 분위일수록 도보권 녹지 1% 미만 학교 비율이 증가하는 경향이 확인되었다. 방향성 가설 기준 Cochran-Armitage trend test one-sided p=0.026, Fisher exact one-sided p=0.028.

주의:

- 양측 Cochran-Armitage p값은 0.0515이므로, `강하게 유의`라고 쓰면 위험하다.
- 안전한 표현은 `방향성 검정에서 유의한 증가 경향`이다.

## 16. Track 2 해석상 주의 문장 모음

Track 2 지역 아동수 예측과 후보 추천 검증을 발표할 때는 아래 경계를 지킨다.

| 말할 수 있는 것 | 말하면 위험한 것 |
|---|---|
| Proposed는 Baseline2-equivalent와 다른 후보군을 고른다. Top-85 겹침은 15/85, Jaccard 0.097이다. | Proposed가 Baseline2보다 예측 정확도가 높다. |
| Proposed Top-85는 Baseline보다 학교 접근성 점수와 2031 격자 아동 변화율이 높다. | Proposed가 잔차를 더 잘 설명한다. |
| Baseline2-equivalent는 고정 공간비율 구조라 후보군 유지율이 높다. | Proposed가 perturbation 안정성에서 우월하다. |
| Track 2는 후보지 우선순위의 민감도와 정책 시나리오를 보는 보조 트랙이다. | Track 2는 미래 아동수 절대값을 단정하는 모델이다. |

가장 안전한 문장:

> Track 2는 미래 아동수 절대값을 단정하기보다, 단순 현재인구 배분 baseline과 비교해 어떤 후보군이 선택되는지와 그 후보군이 잔차 perturbation에서 얼마나 유지되는지를 점검한 정책 시나리오 보조 검증이다.

## 17. "85" 숫자 혼동 주의

검증일: 2026-05-26

최종 `display_green_ratio` 기준 Case 재분류 후 Case 1·2 학교 수는 81개교다. 따라서 K=85와 Case 1·2 학교 수가 같아 보이던 이전 혼동은 해소되었지만, K=85는 여전히 Case 1·2와 무관한 별도 검증 파라미터다.

| 위치 | 표현 | 실제 의미 | Case 1+2와 관련? |
|---|---|---|---|
| 슬라이드 12 | Case 1·2 학교 81개교 | case_type 1(17교) + 2(64교) | ✅ 정의 그 자체 |
| 슬라이드 22 | K=85 후보 유지율 93.75% | 1,551개 school::candidate 쌍 중 수혜 예측값 상위 85개 | ❌ Case 1+2와 무관 |
| 슬라이드 11 | 우선지원 후보지 85개(Case1,2 학교에 연결된 후보지) | **잘못된 표현** — K=85를 "Case1+2 연결 후보지 수"로 오해한 것 | ❌ 설명 자체가 틀림 |

### K=85의 실제 출처

`scripts/validate_track2_child_demand.py:531`에서 K값은 하드코딩:

```python
k_values = [50, 85, max(1, int(round(n * 0.10)))]
```

- 입력 데이터: `robust_candidate_recommendations.csv` — **195개 학교(Case 1~4 전체)** × 후보지 = 1,551개 school::candidate 쌍
- K=85 = 1,551개 중 `predicted_beneficiaries_used` 기준 **상위 85개 쌍**
- K=85는 Case 1+2 학교 수(81)와 다르며, 코드상 의도적 연결의 근거 없음

### top-85의 실제 case 분포 (2026-05-26 실행 기준)

| case_type | 쌍 수 | 비율 |
|---:|---:|---:|
| Case 1 | 11 | 13% |
| Case 2 | 21 | 25% |
| Case 3 | 29 | 34% |
| Case 4 | 24 | 28% |

→ top-85 중 Case 1+2는 32/85(38%)다. Case 3+4도 53/85(62%) 포함된다.

### 실제 후보지 수 (참고)

| 기준 | 수 |
|---|---:|
| 전체 후보 격자 (`candidate_grid_final.csv`) | 1,535개 |
| Case 1+2 학교에 연결된 고유 후보지 (`candidate_grid_final.csv`) | 753개 |
| `worst_case_type` 1 or 2인 후보 격자 | 753개 |

### PPT 수정 방향

슬라이드 11·22에서 "(Case1, 2 학교에 연결된 후보지)" 괄호 설명은 **삭제**한다.

올바른 표현:

> 구별 예측 잔차를 1,000회 교란 입력으로 주입해도 수혜 예측 상위 85개 후보(전체 1,551개 school-후보지 쌍 중 상위) 유지율 93.75%, Jaccard 0.883을 보여 후보 추천 안정성을 확인
