# 교육자원 모듈 표준 데이터 계약 v1

제출 문서 근거: "모든 교육자원 모듈은 표준 데이터 계약을 따른다. 자원 유형·위치(또는 서비스 권역)·서비스 용량·이용 대상·운영시간·학교 내부 공급·외부 공급·수요 단위·접근·운영 제약·가능한 정책대안·데이터 기준일과 출처를 필수·선택 필드로 정의하며, 이 계약을 충족하는 데이터만 모듈로 온보딩된다."

## 필수 필드
| 필드 | 타입 | 설명 |
|---|---|---|
| `module` | string | 모듈 id (영문 소문자) |
| `resource_type` | string | 자원 유형 |
| `location` | object | `file`(데이터 파일 경로), `lat_key`, `lng_key`, `name_key` |
| `external_supply` | list | 외부 공급 지표: `{ metric, source }` |
| `demand_unit` | string | 수요 단위 (예: 학생 수) |
| `policy_actions` | list | 아래 7유형 enum의 부분집합 |
| `reference_date` | string | 데이터 기준일 (YYYY-MM-DD 또는 YYYY-MM) |
| `source` | list | 출처: `{ name, provider, license }` |
| `layer` | object | 지도 레이어: `id`, `button_label`, `panel_label`, `color` |

## 선택 필드
`internal_supply`(학교 내부 공급 지표 list), `capacity`(서비스 용량), `target_users`(이용 대상), `operating_hours`(운영시간), `constraints`(접근·운영 제약 list), `notes`

## 정책 행동 7유형 enum (P3 규칙 엔진과 공유)
`internal_investment`(학교 내부 직접투자) / `external_supply_new`(외부 신규 공급) / `institution_link`(기관 연계) / `mobile_service`(이동형·순회 서비스) / `access_route_improvement`(접근경로·안전환경 개선) / `shared_hub`(권역 공동활용·거점화) / `maintain_monitor`(유지·모니터링)

## 규칙
- 미확보 항목은 값 대신 문자열 `"추가 확인 필요"` 를 넣는다 (검증 통과, UI에 그대로 표기)
- 검증: `npm run validate:modules`
