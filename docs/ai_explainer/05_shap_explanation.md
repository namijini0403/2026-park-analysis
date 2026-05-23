# 05 SHAP Explanation

### [chunk: 05_shap_explanation#role]
tags: SHAP, 설명가능성, 후보진단, 미래수요, shap_summary, shap_waterfall, PPT기준

정의:
SHAP은 후보지별 예상 수혜와 보완 가능성을 변수별로 해석하는 사후 설명 도구다. 앱에서는 `shap_summary`와 후보별 `shap_waterfall` 형태의 진단 산출물을 사용한다.

해석:
SHAP은 수요, 접근성 공백, 학교와의 거리, 대체 공원 여부 등이 후보 판단에 어떤 방향으로 작용했는지 보여준다. 본 앱에서 SHAP은 최종 추천 순위를 설명하는 도구가 아니라, 후보별 미래 수요 예측 근거와 검토 포인트를 진단하는 보조 정보다.

주의:
SHAP 설명 신호의 비중은 후보별 상위 양·음 driver의 절대 SHAP값을 한글 범주로 합산한 뒤 상위 범주 내에서 계산한 비중이다. 빈도나 정책 가중치가 아니다.

잘못된 해석:
SHAP이 정책 가중치를 자동으로 정하거나, 후보지 추천 순위를 독립적으로 결정한다고 설명하면 안 된다.

### [chunk: 05_shap_explanation#not-ranking]
tags: SHAP, 추천순위, 오해방지, 한계, Pareto, Top5안정성, HITL, PPT기준

정의:
SHAP은 추천 순위 결정 모델이 아니라 후보별 예측 근거를 해석하는 설명 레이어다.

해석:
SHAP 값이 높다고 해서 해당 후보가 자동으로 최종 추천 후보가 되는 것은 아니다. 최종 후보 검토에는 Pareto 여부, Top5 안정성, 평균 순위, 정책 필터, 보행 부담, 현장 검토가 함께 필요하다.

주의:
PPT 기준에서도 SHAP의 의의는 예측 중요도와 정책 가중치를 분리하는 데 있다. SHAP은 “왜 이 후보의 예측값이 이렇게 나왔는가”를 설명하고, “무엇을 정책적으로 선택해야 하는가”는 사람이 판단한다.

잘못된 해석:
SHAP 값이 높은 변수가 곧 정책 우선순위이거나 예산 배정 기준이라고 설명하면 안 된다.

### [chunk: 05_shap_explanation#outputs]
tags: SHAP, 후보진단, shap_summary, shap_waterfall, predicted_beneficiaries_used, PPT기준

정의:
후보 단위 SHAP 산출물은 최종 후보지 수요·접근성 진단 결과를 정책 담당자가 검토할 수 있도록 정리한 설명 자료다.

해석:
앱은 후보별 `shap_summary`, `shap_waterfall`, 양·음 driver, 설명 문구를 통해 어떤 변수 묶음이 예상 수혜와 보완 가능성 설명에 기여했는지 보여준다. 이 산출물은 후보를 이해하기 위한 설명 레이어이며, 최종 추천 순위 자체를 새로 계산하는 별도 의사결정 모델이 아니다.

주의:
SHAP 산출물은 최종안에서 쓰는 후보 진단 자료만 설명한다. 최종 문서에 명시된 변수 묶음과 산출물만 사용한다.

잘못된 해석:
SHAP 산출물을 정책 가중치 결정, 설치 확정, 예산 배정, 현장 안전 검증의 근거로 설명하면 안 된다.

### [chunk: 05_shap_explanation#hitl-use]
tags: SHAP, HITL, 정책담당자, 확인사항, 변수매핑, PPT기준

정의:
SHAP은 정책 담당자가 후보별 확인 질문을 만드는 HITL 보조 도구다.

해석:
PPT 기준 한글 설명 범주는 다음 변수 묶음과 연결된다. 주변 아동·미래 수요는 `candidate_child_current`, `demand_score`와 연결되고, 기존 공원 공백 보완은 `nearest_park_dist`, `avg_park_dist_m`, `access_gap_score`와 연결된다. 학교와 가까운 위치는 `route_length_m`, `proximity_score`, 여러 학교 생활권 연결은 `linked_school_count`로 설명한다.

주의:
재개발·정비사업(`redev_flag_numeric`), 도로 횡단 부담(`primary`, `secondary`, `tertiary`, `trunk`), 사고위험 신호는 SHAP 보조설명과 정책 필터에서 확인해야 할 항목이다. 이런 요소를 최종 점수 안에 숨겨 희석하지 않는 것이 원칙이다.

잘못된 해석:
SHAP 설명이 현장 조사, 안전 검토, 도시계획 협의, 예산 판단을 대체한다고 설명하면 안 된다.
