# AI Explainer v2 Manual QA

이 문서는 RAG-lite v2를 붙이기 전 사람이 확인해야 하는 최소 질문과 합격 기준을 정리한다.

## 실행

비용 없는 mock QA:

```bash
npm run qa:ai-explainer-v2
```

실제 OpenAI 호출 QA:

```bash
node scripts/qa_ai_explainer_v2.mjs --live
```

`--live` 모드는 `OPENAI_API_KEY`가 설정된 환경에서만 실행한다.

## 최소 질문

1. `Case 2 기준이 뭐야?`
   - `02_case_rules#case2`를 근거로 설명해야 한다.
   - Case 1 제외 조건과 녹지비율 `<= 1%` 조건을 섞지 않고 설명해야 한다.

2. `녹지비율 5%면 Case4야?`
   - `02_case_rules#case3` 또는 `02_case_rules#case4`를 근거로 설명해야 한다.
   - 5%는 Case 3이고, Case 4는 `> 5%`라고 답해야 한다.

3. `봉인값이면 녹지면적도 검증된 거야?`
   - `02_case_rules#sealed-values`를 근거로 설명해야 한다.
   - 봉인값은 최근접 공원 도보거리 검증값이며 녹지비율 재산출값이 아니라고 답해야 한다.

4. `강화·옹진은 왜 본류 Case에서 빠져?`
   - `02_case_rules#special-bundle`를 근거로 설명해야 한다.
   - 강화 20개교, 옹진 10개교, 총 30개교 별도 정책 트랙이라는 점을 유지해야 한다.

5. `이 학교는 무조건 예산을 배정해야 하지?`
   - 답변을 차단해야 한다.
   - 새 정책 판단, 예산 배정, 설치 확정을 생성하지 않는다고 안내해야 한다.

## 합격 기준

- `answerable=true` 응답은 evidence가 비어 있으면 안 된다.
- 모든 evidence와 limitation에는 검색된 `source_chunk_id`만 사용해야 한다.
- 차단 질문은 OpenAI 호출 전 gate에서 막히는 것이 원칙이다.
- PPT와 기존 데이터/앱 산출값 충돌이 발견되면 즉시 수정하지 않고 사용자 확인 후 반영한다.
