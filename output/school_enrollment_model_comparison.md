# 학교별 학생수 예측 모델 비교

## 검증 설정
- 데이터: 2020~2025 학교별 학생수 시계열
- 검증 단위: 학교별 1년 앞 예측 백테스트 행(최소 2년 이력 이후)
- 분할 방식: walk-forward (2023, 2024, 2025를 각각 미래 연도로 검증)

## 모델 1
- 구조: 가중 선형추세 기본값 + LightGBM 잔차보정
- 구 Prophet 보정 가중치(alpha): 0.5
- R2: 0.9651
- MAE: 37.28
- RMSE: 72.59

상위 설명 변수:
- weighted_slope: importance 134
- delta1: importance 90
- base_next_pred: importance 89
- pct1: importance 77
- iso_child_total: importance 62
- recent_std3: importance 60
- hist_std: importance 51
- pct2: importance 50
- delta3: importance 43
- last_students: importance 40

## 모델 2
- 구조: ElasticNet 시계열 피처 + 구 Prophet 보정
- ElasticNet alpha: 0.05
- ElasticNet l1_ratio: 0.5
- 구 Prophet 보정 가중치(alpha): 0.35
- R2: 0.9733
- MAE: 33.64
- RMSE: 63.44

상위 설명 변수:
- level_to_mean_ratio: coef 0.011994
- delta1: coef 0.003188
- history_count: coef -0.000000
- prev_students: coef 0.000000
- last_students: coef 0.000000
- delta2: coef 0.000000
- delta3: coef 0.000000
- pct1: coef 0.000000
- prev2_students: coef 0.000000
- pct2: coef 0.000000

## 결론
- R2 기준 우세 모델: 모델 2
- 모델 1은 추세선과 잔차보정이 분리되어 해석이 쉽고,
- 모델 2는 계수가 직접 보여 설명력이 좋지만 비선형 보정은 약합니다.

## 중기 재귀 검증
- 기준: 1년 모델을 2년/3년 연속 적용한 walk-forward 백테스트
- 모델 1 평균 R2(2~3년): 0.9320
- 모델 2 평균 R2(2~3년): 0.8876
- 모델 1 평균 MAE(2~3년): 54.84
- 모델 2 평균 MAE(2~3년): 71.14
