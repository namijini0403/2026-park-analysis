# 정책 행동 카드 공개 규칙서

## 1. 목적 및 기본 원칙

본 문서는 공원·도서관 접근성 진단 시스템이 272개 인천 초등학교에 대해 정책 행동 카드를 산출하는 규칙을 공개한다.

### 정책 행동의 7가지 유형

제출 문서 원문(DATA_ROCK_범정부대회_v2.hwpx)에 따라, 정책대안은 다음의 공통 정책 행동 유형으로 추상화된다:

> 내부적으로 정책대안은 학교 내부 직접투자, 외부 신규 공급, 기관 연계, 이동형·순회 서비스, 접근경로·안전환경 개선, 권역 공동활용·거점화, 유지·모니터링의 7가지 공통 정책 행동 유형으로 추상화되며, 각 모듈이 자원별 대안으로 구체화한다.

- **내부투자(internal_investment)**: 학교 내부 직접투자 — 예산·인력 배치로 자체 시설 운영
- **신규공급(external_supply_new)**: 외부 신규 공급 — 부지 확보·조성으로 공원 또는 도서관 신규 건설
- **기관연계(institution_link)**: 기관 연계 — 공공도서관 등 인근 기관 프로그램 연계
- **이동형(mobile_service)**: 이동형·순회 서비스 — 이동도서관, 순회 프로그램 운영
- **경로개선(access_route_improvement)**: 접근경로·안전환경 개선 — 보행로·안전시설 정비
- **공동활용(shared_hub)**: 권역 공동활용·거점화 — 인근 다중 학교가 공동 이용
- **유지모니터링(maintain_monitor)**: 유지·모니터링 — 정기 재진단·현상 유지

### 공간·예산 제약 시 조건부 전환

공간·예산 제약이 확인되면, 다음과 같이 조건부 대안으로 전환된다:

> 공간·예산 제약이 확인되면 이동도서관·순회 독서프로그램을 조건부 대안으로 제시한다.

이는 자원 부족 상황에서도 학생들의 접근성을 보장하기 위한 실행 가능한 대안이다.

### 행정 기준과 HITL 관리 원칙

행동 규칙의 관리 방식은 다음과 같이 명시된다:

> 행동 규칙은 행정 기준과 전문가 검토로 관리하며 생성형 AI가 임의로 정책을 결정하지 않는다.

따라서:
- 본 규칙서는 행정 기준(case 분류, 접근성 지표 임계값)과 전문가 검토(근거 풀, 전환조건)로 구성된 결정 테이블을 공개한다.
- 카드의 권고사항은 담당자의 행정 절차 전 **참고 자료**이며, 최종 정책 결정은 교육청·지자체 담당자의 승인을 거친다.
- 생성형 LLM에 의한 자유 텍스트 권고는 어디에도 포함되지 않는다.

---

## 2. 결정 테이블 A~F (규칙 엔진 사양)

### A. 모듈별 필요도 산정

각 학교에 대해 공원 모듈과 독서 모듈이 별도로 필요도를 평가한다. 필요도가 높은 모듈이 **주 모듈(primary_module)**이 되고, 해당 모듈의 규칙으로 기본 행동을 결정한다.

| 입력 | 공원 필요도 (park_need) | 독서 필요도 (reading_need) |
|---|---|---|
| Case 1 (높은 결핍) | 3 | — |
| Case 2 (중간 결핍) | 2 | — |
| Case 3 (저 결핍) | 1 | — |
| Case 4 (양호) | 0 | — |
| reading_gap_type: direct_investment_first | — | 3 |
| reading_gap_type: school_hub_mobile | — | 2 |
| reading_gap_type: public_link | — | 1 |
| reading_gap_type: maintain_monitor | — | 0 |
| reading_gap_type: "추가 확인 필요" | — | null (data_gap) |

**Primary Module 선택 규칙:**
- `primary_module = 높은 필요도를 가진 모듈`
- 동점인 경우 → 공원 모듈 우선
- 둘 다 필요도 0 → 유지·모니터링 카드 (action: maintain_monitor)

### B. 기본 행동 (시나리오 중립, 기본값: sufficient/available/feasible)

각 primary_module에서 도출되는 **기본 행동(primary_action)**:

**공원 모듈 기준 (case_type 사용):**

| Case | 보행부담(barrier) | 기본 행동 |
|---|---|---|
| 1 (높은 결핍) | 유무 무관 | external_supply_new |
| 2 (중간 결핍) | 유무 무관 | external_supply_new |
| 3 (저 결핍) | 있음 (True) | access_route_improvement |
| 3 (저 결핍) | 없음 (False) | maintain_monitor |
| 4 (양호) | 유무 무관 | maintain_monitor |

**독서 모듈 기준 (reading_gap_type 사용, modules/reading.yaml gap_type_actions 매핑):**

| reading_gap_type | 기본 행동 |
|---|---|
| direct_investment_first | internal_investment |
| school_hub_mobile | mobile_service |
| public_link | institution_link |
| maintain_monitor | maintain_monitor |

### C. 조건부 대안 (기본 행동별 고정 매핑)

기본 행동이 정해지면, 조건부 대안(alternative action)이 고정된다. 대안은 기본 행동이 불가능할 때 담당자가 고려할 수 있는 차선책이다.

| 기본 행동 | 조건부 대안 | 근거 |
|---|---|---|
| external_supply_new | shared_hub | 부지 제약 대비 권역 공동활용 거점화 |
| internal_investment | mobile_service | 공간·예산 제약 시 이동도서관·순회 서비스 |
| mobile_service | institution_link | 이동형 운영 불가 시 기관 연계 |
| institution_link | mobile_service | 연계 기관 수용력 부족 시 이동형 |
| access_route_improvement | shared_hub | 경로 개선이 불가능할 시 인근 자원 공동활용 |
| maintain_monitor | —(해당 없음) | 양호 상태 유지 |

### D. 시나리오 전환 규칙 (12조합: 예산 × 부지 × 접근성)

3개 시나리오 축으로 총 12가지 조합이 형성된다. 각 조합마다 기본 행동이 조건에 따라 **전환(transition)**될 수 있다.

**시나리오 축:**
- 예산: sufficient(충분) / moderate(보통) / constrained(제약)
- 부지: available(확보 가능) / unavailable(불가)
- 접근성: feasible(가능) / infeasible(불가)
- **기본 시나리오**: sufficient | available | feasible

**전환 규칙 (적용 순서: 부지 → 예산 → 접근성, 연쇄 적용 가능):**

1. **부지 규칙**: `external_supply_new` & 부지=unavailable → `shared_hub`로 전환
2. **예산 규칙**: `external_supply_new` & 예산=constrained → 보행부담 있으면 `access_route_improvement`, 없으면 `shared_hub`로 전환
3. **내부투자 규칙**: `internal_investment` & (부지=unavailable OR 예산=constrained) → `mobile_service`로 전환
4. **접근성 규칙**: `access_route_improvement` & 접근성=infeasible → `shared_hub`로 전환
5. **저비용 안정성**: `mobile_service`, `institution_link`, `shared_hub`, `maintain_monitor`는 조건 무관, 전환 없음

**예산=moderate 처리:**
- sufficient와 동일하게 취급하며, 별도 전환 규칙 없음

**Stability(안정성):**
- 각 학교의 `stability = (12조합 중 기본 행동과 동일한 개수) / 12`
- 본 데이터셋의 실제값: 0.3333(141개교: external_supply_new/internal_investment 기본) 또는 1.0(131개교: mobile_service/institution_link/maintain_monitor 기본)

### E. 핵심 근거 3가지 (우선순위 풀)

각 학교의 카드에 표시되는 근거 3가지는 다음 우선순위 풀에서 상위부터 선택된다.

**공원 모듈 근거 풀 (순서):**
1. 도보 500m 내 활동규모 공원 없음 (no_functional_park_flag)
2. 최근접 활동규모 공원 도보 X m
3. 도보권 녹지비율 X %
4. 보행부담 동반 (주요도로 횡단·대형 교차로 등)

**독서 모듈 근거 풀 (순서):**
1. 도보 500m 내 공공도서관 0개 (iso_public_library_count)
2. 사서 미배치 (사서합계=0)
3. 1인당 장서수 X권 (인천 중앙값 49.1권 대비)
4. 좌석 X석

**수요 근거:**
- 2029년 예측수요 X명 (상위 25% 기준: forecast_2029 ≥ 550.25, 정수 기준 551명 이상)

**근거 선택 규칙:**
- Primary module 근거 2개 + 수요 근거 1개
- 수요가 상위 25%가 아닐 경우: primary module 근거 2개 + secondary module 근거 1개로 대체

### F. 기관별 역할 (액션별 고정)

각 행동 유형별로 교육청, 지자체, 학교의 역할이 정해진다.

| 행동 유형 | 교육청 | 지자체 | 학교 |
|---|---|---|---|
| external_supply_new | 수요 근거 제공 | 부지·조성 주관 | 활용 계획 |
| internal_investment | 예산·인력 배치 | — | 공간 확보·운영 |
| mobile_service | 운영 협약 | 차량·시설 지원 | 수요 조사·일정 |
| institution_link | 협약 지원 | 공공도서관 프로그램 | 연계 프로그램 운영 |
| access_route_improvement | 실태 근거 제공 | 도로·안전시설 개선 | 통학로 지도 관리 |
| shared_hub | 권역 협약 주관 | 거점 시설 지원 | 공동 이용 참여 |
| maintain_monitor | 정기 재진단 | — | 모니터링 협조 |

---

## 3. 구현 확정 사항

### 도서 지역(Island) 판별 기준

**사용 기준**: `is_separate_bundle_tag = '1'` (CSV 컬럼)

이는 다음 30개 학교를 식별한다:
- 강화군: 20개교
- 옹진군: 10개교 (진정한 해상도서 포함)

**근거**: CONTEXT.md "별도 정책군" 규정에 따라 이들 학교는:
- case_type이 공란 (case1~4 분류 제외)
- 공원 모듈의 park_need가 undefined (none)
- 별도 정책 트랙으로 운영 (기본 행동 = maintain_monitor, 모든 12조합 = maintain_monitor, stability = 1.0)

카드에 "도서 지역(강화군/옹진군) — 별도 정책 트랙" 표기.

도서 지역 학교 중 22곳은 reading_need=3(직접투자 우선급)이나 별도 트랙 정책으로 카드에는 유지·모니터링과 공원 근거만 표시되며, 독서 결핍은 school_library_access.csv에서 별도 확인 가능.

### reading_gap_type의 3값 처리

`reading_gap_type` 컬럼은 다음 5가지 값을 가진다:
- `direct_investment_first` → reading_need = 3
- `school_hub_mobile` → reading_need = 2
- `public_link` → reading_need = 1
- `maintain_monitor` → reading_need = 0
- `추가 확인 필요` → reading_need = null (data_gap 발생)

**"추가 확인 필요" 처리**:
- reading_need = null로 설정 (숫자 0이 아님, truthy 체크 금지)
- `data_gap = "reading"` 표기
- 근거 3의 3번째 슬롯에 "독서환경 데이터 추가 확인 필요(KESS 학교도서관현황 미매칭)" 표시
- primary_module은 park으로 강제 (park 기준만으로 산출)

### gap_type_actions 매핑 로드

`modules/reading.yaml`의 `gap_type_actions` 섹션에서 읽음 (PyYAML 6.0.3 사용).
모든 매핑된 액션을 POLICY_ACTION_ENUM과 검증.

### 액션 enum 검증

모든 생성된 기본 행동과 12조합 시나리오 행동이 다음 7개 enum 내에 있는지 확인:
- internal_investment
- external_supply_new
- institution_link
- mobile_service
- access_route_improvement
- shared_hub
- maintain_monitor

---

## 4. 산출 통계 (272개교 × 12시나리오 = 3,264개 행동 계산)

### 기본 시나리오(sufficient|available|feasible) 기준 행동 분포

| 행동 유형 | 개수 | 비율 |
|---|---|---|
| external_supply_new | 58 | 21.3% |
| internal_investment | 83 | 30.5% |
| mobile_service | 87 | 32.0% |
| maintain_monitor | 40 | 14.7% |
| institution_link | 4 | 1.5% |
| access_route_improvement | 0 | 0% |
| shared_hub | 0 | 0% |

(P5 Kakao 지오코딩 정밀화로 school_library_access.csv의 reading_gap_type 분포가
바뀌면서 위 표는 2026-08-09 최초 산출값에서 갱신됐고, 곧이어 원천 데이터의 도서관
중복 등록 행 제거(43쌍/86행 → 43행 제거, `build_library_layer.py` dedupe) 이후
다시 한 번 갱신됐다(mobile_service 85→87, maintain_monitor 42→40; 나머지 행동은
불변). access_route_improvement=0건은 두 차례 재검증 후에도 동일하다.)

**주목:**
- `access_route_improvement`는 기본 행동으로 나타나지 않음 (case3+barrier인 7개교 모두 reading_need가 park_need를 초과하여 reading 모듈 우선).
- 규칙상 도달 가능하지만 현재 데이터에서는 산출 0건 (외부 신규 공급 학교 58곳 모두 보행부담 플래그 없음 — 보행부담 학교 15곳은 전부 독서 모듈이 기본 모듈로 선택됨).
- `shared_hub`도 기본 행동으로 나타나지 않음 (부지/예산 제약 없는 기본 시나리오에서는 external_supply_new가 더 우선).

### 안정성(Stability) 분포

| Stability | 개수 | 기본 행동 |
|---|---|---|
| 0.3333 (4/12 조합 안정) | 141 | external_supply_new, internal_investment |
| 1.0 (12/12 조합 안정) | 131 | mobile_service(87), institution_link(4), maintain_monitor(40 — 이 중 30개교는 도서 지역 별도 트랙) |

### 특수 분류

| 분류 | 개수 |
|---|---|
| 도서 지역(separate_track) | 30 |
| 독서 데이터 누락(data_gap=reading) | 1 |

---

## 5. 한계 및 참고사항

### 예산 금액 미산정

본 규칙서는 다음을 포함하지 않는다:
- 각 행동별 예상 예산 규모
- 부지 조성 비용
- 인력 배치 규모

**이유**: 2024년 현재 자료가 불충분하며, 지역·여건별 편차가 크기 때문에 정책 결정 단계에서 담당자와 협력하여 추정해야 함.

### 임계값 출처

- **공원 모듈**: 도보거리 500m, 접근성 평가 기준 → `docs/park_module_thresholds.md` 참조
- **독서 모듈**: 공공도서관 도보거리 500m, 사서 배치 기준, 1인당 장서수 중앙값 49.1권 (인천 초등), 좌석 기준 → `docs/reading_module_thresholds.md` 참조
- **Case 분류**: 공원 기능성·접근성 종합 평가 → `modules/park.yaml` 참조

### 권고의 성격

**카드의 행동 권고는 행정 승인 전 참고 자료이다.**

- 담당자는 카드의 기본 행동·조건부 대안·전환조건을 검토 자료로 사용
- 최종 정책 결정은 교육청·지자체의 행정 절차(예: 교육청 정책회의, 지자체 협의)를 거쳐야 함
- 카드에 표시된 stability와 transition_conditions는 결정 시 고려 사항이지, 자동 집행 지시가 아님
- 별도 정책군(도서 지역)은 특별 검토 대상

### 생성형 AI의 역할

본 규칙 엔진은:
- ✅ **포함되는 것**: 기준 문서(case 분류, 임계값)와 결정 테이블(A~F)에 따른 결정론적(deterministic) 규칙 실행
- ✅ **검증되는 것**: 모든 산출값의 enum 내 검증, 시나리오 key 개수·형식 검증
- ❌ **포함되지 않는 것**: 자유 텍스트 근거 생성, 가중치 합산 점수, 정책의 자의적 재해석

---

## 6. 재현 방법

### 규칙 엔진 재실행

정책 행동 카드는 독립 실행 스크립트가 아니라, 다음의 파이프라인 순서를 전제로 한다. 3)이 4)보다 먼저 실행되어야 하며, 그렇지 않으면 school_library_access.csv에 reading_gap_type/demand_high 컬럼이 없어 4)에서 즉시 실패한다:

```bash
python scripts/reading_module/geocode_missing_libraries.py   # 1) 선택
python scripts/reading_module/build_library_layer.py         # 2)
python scripts/reading_module/apply_reading_gap_types.py     # 3) — 4)보다 먼저 실행 필수
python scripts/policy_cards/build_policy_cards.py             # 4) 272개교의 정책 행동 카드 재계산
```

**출력:**
- `data_processed/policy_action_cards.json` — 272개 학교, 각 학교당 12개 시나리오 조합 (3,264개 행동)
- 콘솔 리포트: 액션 분포, 안정성 히스토그램, 도서지역/데이터누락 개수

### JSON 스키마 (각 학교)

```json
{
  "학교명": "...",
  "separate_track": false,
  "data_gap": null,
  "primary_module": "reading",
  "park_need": 2,
  "reading_need": 3,
  "base": {
    "primary_action": "internal_investment",
    "alternative": "mobile_service"
  },
  "evidence": [
    "도보 500m 내 공공도서관 0개",
    "사서 미배치",
    "2029 예측수요 612명(상위 25%)"
  ],
  "stability": 0.3333,
  "transition_conditions": ["공간·예산 제약 시 이동도서관·순회로 전환"],
  "scenarios": {
    "sufficient|available|feasible": "internal_investment",
    "sufficient|available|infeasible": "internal_investment",
    ...
    "constrained|unavailable|infeasible": "mobile_service"
  },
  "roles": {
    "교육청": "예산·인력 배치",
    "지자체": "—",
    "학교": "공간 확보·운영"
  }
}
```

### 검증 체크리스트

규칙 엔진 재실행 후 다음을 확인:
- [ ] 272개 학교 엔트리
- [ ] 각 학교당 12개 시나리오 key
- [ ] 모든 액션이 7개 enum 내 (enum 위반 시 즉시 FAIL)
- [ ] `separate_track=1` 학교 30개, 모두 `maintain_monitor` 기본 행동
- [ ] `data_gap="reading"` 학교 1개 (인천신검단초등학교 B000026471)
- [ ] stability 분포: 0.3333 (141개), 1.0 (131개)

---

## 참고 자료 및 문헌

1. **제출 문서**: DATA_ROCK_범정부대회_v2.hwpx (범정부 판정 기준 충족 문서)
2. **기술 명세**:
   - `docs/superpowers/plans/2026-08-09-p3-policy-cards.md` — 전체 설계 및 결정 테이블
   - `modules/reading.yaml` — gap_type_actions 매핑
   - `modules/park.yaml` — case 분류 기준, 보행부담 정의
3. **임계값 기준**:
   - `docs/reading_module_thresholds.md` — 독서 모듈 수치 기준
   - `docs/park_module_thresholds.md` — 공원 모듈 수치 기준
4. **구현 코드**: `scripts/policy_cards/build_policy_cards.py` (272개교 카드 생성 엔진)
5. **CONTEXT.md** — "별도 정책군(is_separate_bundle_tag)" 정의

---

**문서 버전**: 2026-08-09  
**생성 방식**: 규칙 기반 사전계산 (결정 테이블 A~F 충실한 구현)  
**최종 승인 대상**: 교육청 · 지자체 정책담당자
