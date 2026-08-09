# P3: 정책 행동 카드 + 정책 시나리오 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 272개교 전체에 대해 규칙 기반 정책 행동 카드(우선 검토안 1 + 조건부 대안 1 + 핵심 근거 3 + 권고 안정성·전환조건)를 사전계산하고, 진단 패널에 카드 + 시나리오 조건 토글(예산 3×부지 2×접근성 2 = 12조합)을 구현한다 (본선 판정 기준 1 충족: 20개교 이상 → 272개교 전체).

**Architecture:** Python 규칙 엔진이 공원 모듈(Case·활동규모·보행부담) + 독서 모듈(reading_gap_type) + 수요(forecast_2029)를 입력으로 12개 시나리오 조합 전부를 사전계산 → `data_processed/policy_action_cards.json` → UI는 조건 토글에 따라 사전계산 변형을 표시만 한다. **LLM 없음, 런타임 계산 없음, 가중치 합산 없음** — 문서 원칙("공개 규칙+예측+안정성 검증+HITL") 그대로.

**Tech Stack:** Python 3 (pandas), 바닐라 JS(index.html), Node(청크 빌드).

## Global Constraints

- **금지**: LLM 자유생성 권고 / 가중치 합산 단일점수 / Case 자동분류 ML / 안전·재개발 요소의 점수 흡수(보행부담은 근거·행동 선택 조건으로만) / 예산 금액 산정
- 행동 유형은 7-action enum만 (`scripts/validate_module_contract.mjs`의 POLICY_ACTION_ENUM): internal_investment / external_supply_new / institution_link / mobile_service / access_route_improvement / shared_hub / maintain_monitor
- 독서 모듈 인터페이스: `modules/reading.yaml`의 `gap_type_actions` 매핑 사용. **`internal_shortage`는 3값**(True/False/"추가 확인 필요") — 문자열을 truthy로 취급 금지
- 도서 지역(island) 학교: 카드에 "도서 지역 별도 정책 트랙" 표기, 권고는 maintain_monitor + `separate_track: true`
- 모든 규칙은 아래 결정 테이블 그대로 구현하고 `docs/policy_cards_rules.md`에 공개 문서화 ("행동 규칙은 행정 기준과 전문가 검토로 관리하며 생성형 AI가 임의로 정책을 결정하지 않는다")
- 작업 브랜치 `policy-reachability`. index.html 수정 시 `node scripts/check_inline_script.mjs` 통과. UTF-8은 Read/Edit 도구만

## 결정 테이블 (규칙 엔진 사양 — 구현은 이 표를 벗어나지 않는다)

### A. 모듈별 필요도
- `park_need`: case1→3, case2→2, case3→1, case4→0. 도서 지역 → 별도 트랙
- `reading_need`: direct_investment_first→3, school_hub_mobile→2, public_link→1, maintain_monitor→0, "추가 확인 필요"→null(카드에 `data_gap: reading` 표기, park 기준만으로 산출)
- `primary_module` = 필요도 높은 쪽 (동점 → park; 둘 다 0 → 유지·모니터링 카드)

### B. 기본(시나리오 중립) 우선 검토안
- park 기준: case1·case2 → `external_supply_new` / case3 → 보행부담(barrier flag) 있으면 `access_route_improvement`, 없으면 `maintain_monitor` / case4 → `maintain_monitor`
- reading 기준: `gap_type_actions` 매핑 그대로 (direct_investment_first→internal_investment / school_hub_mobile→mobile_service / public_link→institution_link / maintain_monitor→maintain_monitor)

### C. 조건부 대안 (기본 액션별 고정 매핑)
| 기본 액션 | 조건부 대안 | 근거 |
|---|---|---|
| external_supply_new | shared_hub | 부지 제약 대비 권역 공동활용 |
| internal_investment | mobile_service | 문서 원문: 공간·예산 제약 시 이동도서관·순회 |
| mobile_service | institution_link | 순회 운영 불가 시 기관 연계 |
| institution_link | mobile_service | 연계 기관 수용력 부족 시 이동형 |
| access_route_improvement | shared_hub | 경로 개선 불가 시 인근 자원 공동활용 |
| maintain_monitor | null ("해당 없음 — 정기 재진단") | 양호 |

### D. 시나리오 전환 규칙 (예산 {sufficient, moderate, constrained} × 부지 {available, unavailable} × 접근성 개선 {feasible, infeasible} = 12조합, 기본 = sufficient/available/feasible)
적용 순서: 부지 → 예산 → 접근성 (한 조합에서 여러 조건 발동 시 순서대로 연쇄 적용, 결과가 enum 밖이면 버그)
1. `external_supply_new` & site=unavailable → `shared_hub`
2. `external_supply_new` & budget=constrained → 보행부담 있으면 `access_route_improvement`, 없으면 `shared_hub`
3. `internal_investment` & (site=unavailable OR budget=constrained) → `mobile_service`
4. `access_route_improvement` & access=infeasible → `shared_hub`
5. 그 외 액션(mobile_service, institution_link, shared_hub, maintain_monitor)은 저비용·저제약이므로 조건 무관 유지
- budget=moderate는 전환 없음(sufficient와 동일 취급, 문서화)
- `stability` = 12조합 중 기본 액션과 동일한 비율 (예: 12/12=1.0)
- `transition_conditions` = 기본과 달라지는 조합들을 사람이 읽는 문장으로 집약 (예: "부지 확보 불가 시 권역 공동활용·거점화로 전환")

### E. 핵심 근거 3 (우선순위 풀에서 상위 3, 값은 실제 데이터 인용)
- primary_module 근거 2개 + 수요 근거 1개 (수요 상위 25% 아니면 secondary module 근거 1개로 대체)
- park 근거 풀(순서): ①도보 500m 내 활동규모 공원 없음(no_functional_park_flag) ②최근접 활동규모 공원 도보 Xm ③도보권 녹지비율 X% ④보행부담 동반(주요도로 횡단 등)
- reading 근거 풀(순서): ①도보 500m 내 공공도서관 0개(iso_public_library_count) ②사서 미배치(사서합계=0) ③1인당 장서수 X권(인천 중앙값 49.1권 대비) ④좌석 X석
- 수요 근거: 2029 예측수요 X명(상위 25%)

### F. 기관별 역할 (액션별 고정)
| 액션 | 교육청 | 지자체 | 학교 |
|---|---|---|---|
| external_supply_new | 수요 근거 제공 | 부지·조성 주관 | 활용 계획 |
| internal_investment | 예산·인력 배치 | — | 공간 확보·운영 |
| mobile_service | 운영 협약 | 차량·시설 지원 | 수요 조사·일정 |
| institution_link | 협약 지원 | 공공도서관 프로그램 | 연계 프로그램 운영 |
| access_route_improvement | 실태 근거 제공 | 도로·안전시설 개선 | 통학로 지도 관리 |
| shared_hub | 권역 협약 주관 | 거점 시설 지원 | 공동 이용 참여 |
| maintain_monitor | 정기 재진단 | — | 모니터링 협조 |

---

### Task 1: 규칙 엔진 (Python) → policy_action_cards.json

**Files:**
- Create: `scripts/policy_cards/build_policy_cards.py`
- Output: `data_processed/policy_action_cards.json`

**Interfaces:**
- Consumes: `data_processed/school_priority_with_functional_park_layer.csv`(Case·기능공원·보행부담 — 실제 컬럼명은 파일에서 확인: case 컬럼, no_functional_park_flag, nearest_functional_park_dist_m, display_green_ratio, 보행부담 관련 flag들, 도서 지역 구분), `school_library_access.csv`, `school_enrollment_forecast_20260418_model1.csv`(forecast_2029), `modules/reading.yaml`(gap_type_actions)
- Produces JSON 스키마 (학교당 1엔트리, 학교ID 키):

```json
{
  "generated_note": "규칙 기반 사전계산 — docs/policy_cards_rules.md 참조",
  "scenario_axes": { "budget": ["sufficient","moderate","constrained"], "site": ["available","unavailable"], "access": ["feasible","infeasible"] },
  "schools": {
    "B000...": {
      "학교명": "...", "separate_track": false, "data_gap": null,
      "primary_module": "reading", "park_need": 2, "reading_need": 3,
      "base": { "primary_action": "internal_investment", "alternative": "mobile_service" },
      "evidence": ["도보 500m 내 공공도서관 0개", "사서 미배치", "2029 예측수요 612명(상위 25%)"],
      "stability": 0.75,
      "transition_conditions": ["공간·예산 제약 시 이동도서관·순회로 전환"],
      "scenarios": { "sufficient|available|feasible": "internal_investment", "...": "..." },
      "roles": { "교육청": "예산·인력 배치", "지자체": "—", "학교": "공간 확보·운영" }
    }
  }
}
```

- [ ] **Step 1**: 입력 3개 CSV의 실제 컬럼명 확인 (특히 park CSV의 case 컬럼명·보행부담 flag·도서 지역 구분 컬럼) — 보고서에 기록. 도서 지역 판별이 컬럼에 없으면 CONTEXT.md의 도서 30개교 기준 확인 후 구/주소 기반 판별(옹진군·강화군 일부) — 사용한 기준을 문서화
- [ ] **Step 2**: 결정 테이블 A~F를 그대로 구현. "추가 확인 필요" 문자열 처리 명시(3값). 산출 후 자가 검증: 모든 액션이 enum 내, 272엔트리, scenarios 12키, stability 분포 출력
- [ ] **Step 3**: 검증 출력 기록 — 액션 분포(기본 시나리오), stability 히스토그램, separate_track 수, data_gap 수. **어떤 조합에서도 enum 밖 액션이 나오면 실패**
- [ ] **Step 4**: Commit — `P3: rule-based policy action cards (272 schools x 12 scenarios)`

### Task 2: 공개 규칙 문서

**Files:** Create: `docs/policy_cards_rules.md`

- [ ] 결정 테이블 A~F 전문 + 각 규칙의 근거(제출 문서 원문 인용 포함: 7유형 추상화 문장, 이동도서관 조건부 문장, "생성형 AI가 임의로 정책을 결정하지 않는다") + 산출 통계(액션 분포·stability) + 한계(예산 금액 미산정, 임계값 출처는 reading_module_thresholds.md 참조) + HITL 절차(담당자 승인 전 참고자료임을 명시)
- [ ] Commit — `P3: publish policy card rulebook`

### Task 3: UI — 행동 카드 + 시나리오 토글

**Files:**
- Modify: `index.html`, `scripts/deploy/build_vercel_static.mjs` (whitelist에 policy_action_cards.json)

- [ ] **Step 1**: PATHS·datasetLoaders·구조분해·`state.datasets.policyActionCards` 추가 (loadJSON)
- [ ] **Step 2**: 진단 패널에 "정책 행동 카드" 섹션 (독서교육 섹션 아래): 우선 검토안(액션 한국어 라벨+색), 조건부 대안, 근거 3(목록), 안정성(12조합 중 N 유지, % 표기), 전환조건 문장들, 기관별 역할 3행. separate_track이면 "도서 지역 별도 정책 트랙" 뱃지, data_gap이면 "독서 데이터 보완 필요" 표기. 액션 한국어 라벨: internal_investment=학교 내부 직접투자 / external_supply_new=외부 신규 공급 / institution_link=기관 연계 / mobile_service=이동형·순회 서비스 / access_route_improvement=접근경로·안전 개선 / shared_hub=권역 공동활용·거점화 / maintain_monitor=유지·모니터링
- [ ] **Step 3**: 시나리오 조건 토글 — 카드 섹션 상단에 소형 버튼 그룹 3개(예산: 충분/보통/제약, 부지: 확보 가능/불가, 접근성 개선: 가능/불가; 기본값 충분/가능/가능). 선택 변경 시 `scenarios["budget|site|access"]` 키로 표시 액션 갱신 + 기본과 다르면 "조건 변경으로 권고 전환됨" 강조. 상태는 state에 저장, 학교 변경 시 유지
- [ ] **Step 4**: 게이트 + 빌드 + 서버 스모크 (policy_action_cards.json 200)
- [ ] **Step 5**: Commit — `P3: policy action card UI + scenario toggles`

### Task 4: 챗봇 청크

**Files:** Create `docs/ai_explainer/08_policy_cards.md`; Modify `build_ai_explainer_chunks.mjs` requiredDocs, `api/ai-explainer-v2.js` detectTopic/topicForChunk

- [ ] `policy_` 접두 청크: 카드 정의, 7유형, 결정 규칙 요약, 시나리오·안정성·전환조건 해석법, 한계("권고는 참고자료, 확정은 담당자·행정 절차", 예산 산정 불가), 잘못된 해석 예. detectTopic에 정책 카드 어휘(행동 카드|정책 카드|우선 검토|조건부 대안|전환조건|시나리오|기관 역할). `npm run build:ai-chunks` 재생성·커밋
- [ ] Commit — `P3: AI explainer policy-card chunks + topic routing`

### Task 5: 통합 스모크

- [ ] 게이트 일괄(check_inline_script, validate:modules, build:vercel) + 서버 스모크 raw output + "가중치|합산 점수" 신규 코드 유입 없는지 grep 자가점검
- [ ] Commit (필요시)

## 완료 기준 (컨트롤러)

1. 태스크 리뷰 클린 + 최종 브랜치 리뷰
2. 컨트롤러 시각 검증: 학교 선택 → 행동 카드 표시, 시나리오 토글 → 권고 전환 + 전환 강조, separate_track/data_gap 케이스 각 1건 확인
3. 판정 기준 1 충족: 272개교 카드 + 전환조건 포함
