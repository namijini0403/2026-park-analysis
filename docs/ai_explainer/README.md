# AI Explainer Evidence Pack

이 폴더는 식별앱의 RAG 기반 AI 해설 패널에 들어가는 근거 문서 원천이다. 문서는 발표 Q&A 방어에도 그대로 사용할 수 있도록 정책 판단 기준, 지표 정의, 추천 로직, SHAP 해석, 한계를 분리해 기록한다.

## 운영 원칙

### [chunk: README#mode-split]
tags: 식별앱, 비식별앱, 공개범위, 안전장치

식별앱에서는 선택 학교와 후보지의 실제 지표를 기반으로 근거 기반 AI 해설 패널을 제공할 수 있다. 비식별앱에서는 학교명, 후보지, 지역명, 공원명, 좌표, 거리값이 재식별 단서가 될 수 있으므로 개별 학교·후보지 해설을 제공하지 않는다.

### [chunk: README#answer-guard]
tags: RAG, citation, 차단, JSON

AI 해설은 검색된 chunk와 선택된 학교·후보지 context pack 안에서만 답변한다. 답변에는 반드시 `cited_chunk_ids`가 포함되어야 하며, 근거 chunk가 비어 있으면 프론트엔드에서 답변을 표시하지 않는다.

### [chunk: README#decision-role]
tags: HITL, 정책지원, 의사결정

LLM은 정책 결정을 내리지 않는다. 이미 산출된 Case, 지표, 후보지 점수, SHAP 진단, 한계 문서를 사람이 이해하기 쉬운 문장으로 번역하는 설명 보조 역할만 수행한다.
