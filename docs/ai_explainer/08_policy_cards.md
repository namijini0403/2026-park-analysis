# 08 Policy Cards

### [chunk: 08_policy_cards#policy_card_definition]
tags: 정책행동카드, 우선검토안, 조건부대안, 근거3가지, 안정성, 전환조건, 규칙기반사전계산, HITL

정의:
정책 행동 카드는 인천 초등 272개교 각각에 대해 우선 검토안(primary_action, 기본 행동) 1개, 조건부 대안(alternative) 1개, 핵심 근거 3가지, 안정성(stability) 값, 전환조건(transition_conditions)을 함께 표시하는 규칙 기반 사전계산 산출물이다.

해석:
우선 검토안은 학교의 주 모듈(공원 또는 독서) 필요도 조건으로 정해지는 기본 행동이며, 조건부 대안은 우선 검토안이 불가능할 때 담당자가 검토할 차선책이다. 근거 3가지는 공원·독서 모듈의 근거 풀과 2029년 예측수요 조건에서 우선순위대로 선택되고, 안정성은 예산·부지·접근성 12가지 시나리오 조합 중 우선 검토안과 같은 행동이 유지되는 비율이다. 전환조건은 어떤 시나리오 조건에서 우선 검토안이 다른 행동으로 바뀌는지를 설명하는 문장이다.

주의:
카드의 다섯 요소(우선 검토안, 조건부 대안, 근거 3가지, 안정성, 전환조건)는 모두 결정 테이블 A~F에 따라 결정론적으로 계산되며, 생성형 LLM이 자유 텍스트로 근거나 대안을 새로 만들지 않는다. 카드는 담당자의 행정 절차 전 참고 자료이며 그 자체로 정책을 확정하지 않는다.

잘못된 해석:
정책 행동 카드가 예산·설치를 자동으로 확정하는 최종 결정 문서라고 설명하면 안 된다. 카드는 교육청·지자체 담당자가 검토할 참고 자료이며, 최종 결정에는 별도의 행정 절차가 필요하다.

### [chunk: 08_policy_cards#policy_action_types]
tags: 7가지정책행동유형, internal_investment, external_supply_new, institution_link, mobile_service, access_route_improvement, shared_hub, maintain_monitor, 내부투자, 신규공급, 기관연계, 이동형, 경로개선, 공동활용, 유지모니터링

정의:
정책대안은 다음 7가지 공통 정책 행동 유형으로 추상화된다: 내부투자(internal_investment), 신규공급(external_supply_new), 기관연계(institution_link), 이동형(mobile_service), 경로개선(access_route_improvement), 공동활용(shared_hub), 유지모니터링(maintain_monitor).

해석:
내부투자는 학교 내부 직접투자(예산·인력 배치로 자체 시설 운영), 신규공급은 부지 확보·조성을 통한 공원 또는 도서관 신규 건설, 기관연계는 공공도서관 등 인근 기관 프로그램 연계, 이동형은 이동도서관·순회 프로그램 운영, 경로개선은 보행로·안전시설 정비, 공동활용은 인근 다중 학교의 권역 공동 이용·거점화, 유지모니터링은 정기 재진단과 현상 유지를 뜻한다.

주의:
7개 유형은 공원 모듈과 독서 모듈이 각자 자원별 대안으로 구체화하기 전의 공통 추상화 단계이며, 모든 생성된 행동(기본 행동·시나리오 전환 결과)은 반드시 이 7개 enum 안에 있어야 한다. enum을 벗어난 값은 검증 단계에서 오류로 처리된다.

잘못된 해석:
7가지 유형을 학교별로 자유롭게 조합하거나 새 유형을 임의로 만들어 설명하면 안 된다. 모든 카드의 행동값은 이 7개 유형 중 하나로만 표시된다.

### [chunk: 08_policy_cards#policy_decision_rules]
tags: 결정테이블, 모듈필요도, primary_module, park_need, reading_need, 기본행동, 조건부대안매핑, 도서지역, 강화군, 옹진군, 30개교, is_separate_bundle_tag

정의:
정책 행동은 (A) 모듈별 필요도 비교로 주 모듈(primary_module)을 정하고, (B) 주 모듈 규칙으로 기본 행동을 정하고, (C) 기본 행동에 고정된 조건부 대안을 매칭하는 3단계로 결정된다.

해석:
공원 필요도(park_need)는 Case 1~4를 3~0으로, 독서 필요도(reading_need)는 reading_gap_type을 direct_investment_first=3, school_hub_mobile=2, public_link=1, maintain_monitor=0으로 환산한다. 필요도가 높은 모듈이 주 모듈이 되며, 동점이면 공원 모듈을 우선하고, 둘 다 0이면 유지·모니터링 카드가 된다. 조건부 대안은 기본 행동별로 고정 매핑된다: external_supply_new→shared_hub, internal_investment→mobile_service, mobile_service→institution_link, institution_link→mobile_service, access_route_improvement→shared_hub, maintain_monitor→대안 없음(양호 상태 유지).

주의:
강화군 20개교·옹진군 10개교 총 30개교는 is_separate_bundle_tag='1'로 식별되는 도서 지역으로, case_type이 공란이고 park_need가 산출되지 않아(undefined) 별도 정책 트랙으로 운영된다. 이 30개교는 기본 행동이 항상 maintain_monitor이고 12개 시나리오 조합 전부 maintain_monitor로 고정되어 stability=1.0이다. 또한 KESS 미수록 신설교 1개교(인천신검단초등학교)는 reading_need=null(data_gap="reading")로 처리되며, 이 경우 primary_module은 공원 모듈로 강제된다.

잘못된 해석:
도서 지역 30개교를 일반 학교와 같은 방식(case_type, park_need 산출)으로 분류해 설명하면 안 된다. 이들은 별도 정책군으로 처음부터 maintain_monitor 고정 트랙에 속한다. 또한 data_gap=reading 학교를 4개 독서격차유형 중 하나로 임의 배정하면 안 된다.

### [chunk: 08_policy_cards#policy_scenario_axes]
tags: 시나리오축, 예산, 부지, 접근성, 12조합, sufficient, moderate, constrained, available, unavailable, feasible, infeasible, 안정성, stability, 141개교, 131개교, 0.3333, 1.0

정의:
정책 행동 카드의 시나리오는 예산(sufficient/moderate/constrained) × 부지(available/unavailable) × 접근성(feasible/infeasible) 3개 축의 조합으로 총 12가지가 형성되며, 기본 시나리오는 sufficient|available|feasible이다.

해석:
전환 규칙은 부지→예산→접근성 순서로 연쇄 적용된다: external_supply_new는 부지=unavailable이면 shared_hub로, 예산=constrained이면 보행부담 유무에 따라 access_route_improvement 또는 shared_hub로 전환된다. internal_investment는 부지=unavailable 또는 예산=constrained이면 mobile_service로 전환된다. access_route_improvement는 접근성=infeasible이면 shared_hub로 전환된다. mobile_service, institution_link, shared_hub, maintain_monitor는 조건과 무관하게 전환되지 않는다(저비용 안정 행동). 예산=moderate는 sufficient와 동일하게 취급하며 별도 전환 규칙이 없다. 안정성(stability)은 12개 조합 중 기본 행동과 동일한 개수를 12로 나눈 값이다.

주의:
본 데이터셋의 실제 안정성 분포는 두 값뿐이다: 기본 행동이 external_supply_new 또는 internal_investment인 141개교는 stability=0.3333(4/12 조합 유지), 기본 행동이 mobile_service·institution_link·maintain_monitor인 131개교는 stability=1.0(12/12 조합 유지)이다. 안정성이 낮다는 것은 그 카드의 우선 검토안이 예산·부지·접근성 여건 변화에 더 민감하게 바뀔 수 있다는 뜻이며, 정책 우선순위가 낮다는 뜻이 아니다.

잘못된 해석:
stability=1.0을 "이 학교는 정책이 이미 확정됐다"는 뜻으로 설명하면 안 된다. stability는 12개 시나리오 조합에서 행동이 얼마나 유지되는지를 나타낼 뿐이며, 담당자 승인 여부와는 별개다. 또한 안정성이 낮은(0.3333) 카드를 신뢰도가 낮은 카드로 오해하면 안 된다. 이는 규칙 계산 결과가 시나리오 조건에 더 민감함을 뜻할 뿐이다.

### [chunk: 08_policy_cards#policy_institution_roles]
tags: 기관역할, 교육청, 지자체, 학교, 협약, 역할분담, 행동유형별역할

정의:
정책 행동 카드는 행동 유형별로 교육청·지자체·학교의 역할을 고정 매핑해 함께 표시한다.

해석:
external_supply_new는 교육청이 수요 근거를 제공하고 지자체가 부지·조성을 주관하며 학교는 활용 계획을 세운다. internal_investment는 교육청이 예산·인력을 배치하고 학교가 공간을 확보·운영한다(지자체 역할 없음). mobile_service는 교육청이 운영 협약을, 지자체가 차량·시설 지원을, 학교가 수요 조사·일정 관리를 맡는다. institution_link는 교육청이 협약을 지원하고 지자체가 공공도서관 프로그램을 제공하며 학교가 연계 프로그램을 운영한다. access_route_improvement는 교육청이 실태 근거를 제공하고 지자체가 도로·안전시설을 개선하며 학교가 통학로 지도를 관리한다. shared_hub는 교육청이 권역 협약을 주관하고 지자체가 거점 시설을 지원하며 학교가 공동 이용에 참여한다. maintain_monitor는 교육청이 정기 재진단을 맡고 학교가 모니터링에 협조한다(지자체 역할 없음).

주의:
기관 역할은 행동 유형에 대해 고정된 매핑이며 학교별로 달라지지 않는다. 카드에 표시된 역할은 협의의 출발점이며, 실제 예산·인력 규모나 세부 협약 내용은 담당자 간 별도 협의로 정해야 한다.

잘못된 해석:
카드에 표시된 기관 역할을 이미 체결된 협약이나 확정된 예산 배정으로 설명하면 안 된다. 이는 행동 유형별로 사전 정의된 역할 분담 기준일 뿐이다.

### [chunk: 08_policy_cards#policy_output_distribution]
tags: 산출분포, 기본시나리오행동분포, external_supply_new58, internal_investment83, mobile_service87, maintain_monitor40, institution_link4, 272개교, 3264개행동

정의:
기본 시나리오(sufficient|available|feasible) 기준 272개교의 우선 검토안 분포는 external_supply_new 58개교(21.3%), internal_investment 83개교(30.5%), mobile_service 87개교(32.0%), maintain_monitor 40개교(14.7%), institution_link 4개교(1.5%)이며, access_route_improvement와 shared_hub는 기본 행동으로는 0개교다.

해석:
272개교 × 12개 시나리오 조합 = 총 3,264개 행동이 계산된다. access_route_improvement가 기본 행동으로 나타나지 않는 이유는 저 결핍(Case 3)이면서 보행부담이 있는 7개교 모두 독서 필요도(reading_need)가 공원 필요도(park_need)보다 높아 독서 모듈이 주 모듈로 선택되기 때문이다. shared_hub도 기본 행동으로는 나타나지 않는데, 부지·예산 제약이 없는 기본 시나리오에서는 external_supply_new가 더 우선하기 때문이다. shared_hub는 시나리오 전환 단계(부지 불가, 예산 제약 등)에서 실제로 나타나지만, access_route_improvement는 규칙상 시나리오 전환으로 도달 가능한 경로가 있음에도 현재 데이터에서는 3,264건 중 0건이다 — 외부 신규 공급(external_supply_new) 기본 학교 58곳 전부가 보행부담 플래그를 갖지 않아 예산 제약 전환이 shared_hub로만 흐르고, 보행부담이 있는 15개교는 전부 독서 모듈이 기본 모듈로 선택되어 애초에 access_route_improvement가 기본 행동이 되지 않기 때문이다.

주의:
maintain_monitor 40개교 중 30개교는 도서 지역(강화군·옹진군) 별도 정책 트랙에 속한 학교이며, 나머지 10개교는 공원·독서 모두 양호(Case 4 또는 reading_gap_type=maintain_monitor)로 판정된 일반 학교다. 이 둘을 같은 근거로 설명하면 안 되며, 도서 지역은 case_type 자체가 없다는 점을 구분해야 한다.

잘못된 해석:
access_route_improvement·shared_hub가 기본 행동 분포에 0개로 나온다고 해서 이 두 행동이 규칙 자체에서 배제되어 있다고 설명하면 안 된다. 다만 access_route_improvement는 현재 272개교 데이터에서는 3,264개 행동(기본+시나리오 전환 전체) 중 실제로 0건이라는 사실을 숨기고 "시나리오 전환 단계에서는 나타난다"고 설명해서도 안 된다. shared_hub만 시나리오 전환 단계(464건)에서 실제로 나타난다. (P5 Kakao 지오코딩 정밀화 및 후속 중복 도서관 행 제거로 reading_gap_type 분포가 두 차례 바뀌면서 이 절의 수치는 갱신됐으나, access_route_improvement=0건이라는 결론 자체는 두 차례 재검증 후에도 변하지 않았다.)

### [chunk: 08_policy_cards#policy_limitations]
tags: 한계, 예산산정불가, 규칙기반사전계산, 생성형AI, 정책결정, 담당자승인, HITL, 잘못된해석

정의:
정책 행동 카드의 권고는 결정 테이블 A~F에 따른 규칙 기반 사전계산이며, 담당자 승인 전 참고 자료다. 생성형 AI가 정책을 임의로 결정하지 않는다.

해석:
행동 규칙은 행정 기준(case 분류, 접근성 지표 임계값)과 전문가 검토(근거 풀, 전환조건)로 관리되는 결정론적 규칙 실행이며, 모든 산출값은 7개 행동 enum 내 검증과 시나리오 key 개수·형식 검증을 거친다. 카드는 자유 텍스트 근거 생성, 가중치 합산 점수, 정책의 자의적 재해석을 포함하지 않는다. 최종 정책 결정은 교육청·지자체 담당자의 승인과 행정 절차(정책회의, 지자체 협의 등)를 거쳐야 한다.

주의:
정책 행동 카드는 각 행동별 예상 예산 규모, 부지 조성 비용, 인력 배치 규모를 산정하지 않는다. 2024년 현재 자료가 불충분하고 지역·여건별 편차가 크기 때문이며, 예산 추정은 정책 결정 단계에서 담당자와 협력해 별도로 수행해야 한다. 카드에 표시된 stability와 전환조건은 결정 시 고려 사항일 뿐, 자동 집행 지시가 아니다.

잘못된 해석:
"정책 행동 카드가 예산을 확정한다"거나 "카드에 표시된 행동이 자동으로 집행된다"고 설명하면 안 된다. 또한 "생성형 AI가 실시간으로 정책을 재판단해 카드를 만든다"고 설명하면 안 된다. 카드의 모든 값은 사전에 공개된 결정 테이블 A~F로 계산된 것이며, 챗봇은 이미 계산된 값을 설명하는 역할에 한정된다.
