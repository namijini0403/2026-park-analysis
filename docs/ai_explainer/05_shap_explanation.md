# 05 SHAP Explanation

### [chunk: 05_shap_explanation#role]
tags: SHAP, 설명가능성, 후보진단, 미래수요

SHAP은 후보지의 미래 수혜 아동 수 예측값을 높이거나 낮춘 변수별 기여를 보여주는 사후 설명 도구다. 본 앱에서 SHAP은 최종 추천 순위를 설명하는 도구가 아니라, 후보별 미래 수요 예측 근거를 진단하는 보조 정보다.

### [chunk: 05_shap_explanation#not-ranking]
tags: SHAP, 추천순위, 오해방지, 한계

SHAP 값이 높다고 해서 해당 후보가 자동으로 최종 추천 후보가 되는 것은 아니다. 최종 후보 검토에는 Pareto 여부, Top5 안정성, 평균 순위, 정책 필터, 보행 부담, 현장 검토가 함께 필요하다.

### [chunk: 05_shap_explanation#surrogate]
tags: surrogate, RandomForest, TreeExplainer, 사후설명

현재 배포 산출물에서는 원 학습 artifact와 feature matrix가 완전한 형태로 고정되어 있지 않기 때문에, 후보 단위 예측값 설명에는 surrogate explainability model을 사용한다. 이는 기존 예측값을 사후적으로 설명하기 위한 방식이며, 원 예측모델 내부 전체를 완전히 대체하는 설명은 아니다.

### [chunk: 05_shap_explanation#hitl-use]
tags: SHAP, HITL, 정책담당자, 확인사항

정책 담당자는 SHAP을 통해 후보지 예측값이 어떤 변수에 민감한지 확인하고, 개발계획 의존성이나 접근성 보완성 같은 해석 포인트를 점검한다. SHAP은 현장 확인 질문을 만드는 도구로 사용하는 것이 적절하다.
