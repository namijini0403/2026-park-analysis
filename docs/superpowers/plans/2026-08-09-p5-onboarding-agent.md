# P5: 모듈 온보딩 에이전트 시제품 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /update-center에 "신규 모듈 제안" 기능: 담당자 자연어 요청 → LLM이 모듈 설계안 + `modules/*.yaml` 초안 생성 → 규칙 코드가 표준 데이터 계약·철학 체크 검사 → 승인 전 운영 미반영 원칙으로 제안만 저장. (제출 문서의 "신규 데이터·모듈 온보딩 에이전트 [본선 구현]" 범위)

**Architecture:** P4 인프라 재사용 — 새 엔드포인트 `POST /api/update-center/onboarding`이 OpenAI(있으면)로 설계안+YAML 초안을 생성하고, P1의 계약 검증 로직(리팩터링해 export)으로 초안을 기계 검사, 철학 체크리스트(도보권 네트워크 기준·target leakage 금지·낙인 방지)를 함께 반환. 제안은 data_events(kind=onboarding_proposal, risk=yellow)로 저장되어 이벤트 목록·감사 로그에 편입. **어떤 경로로도 modules/ 디렉토리나 운영 데이터에 자동 쓰기 없음.**

**Tech Stack:** 기존 스택 그대로 (Node, js-yaml, OpenAI Responses API 패턴).

## Global Constraints

- **승인 전 운영 미반영**: 온보딩 제안은 이벤트·감사 기록으로만 존재. modules/*.yaml 파일 생성은 사람이 초안을 복사해 수행 (UI에 명시 문구 + 다운로드/복사 버튼만)
- LLM 출력은 제안일 뿐 — 계약 검사(코드)가 초안의 구조적 유효성을 판정하고, 철학 체크는 "검토 필요 항목"으로 표시 (AI가 자체 통과 선언 금지)
- OPENAI_API_KEY 없으면 결정론 폴백: 요청 키워드를 삽입한 계약 준수 템플릿 YAML + "[AI 미사용 폴백]" 표기 — 데모는 키 없이도 성립
- 7-action enum·필수 필드는 기존 `scripts/validate_module_contract.mjs`가 단일 진실 — 검사 로직 중복 금지 (export 리팩터링으로 재사용)
- 토큰 게이트·감사 기록은 P4 패턴 그대로. index.html 수정 없음
- 작업 브랜치 `policy-reachability`

---

### Task 1: 계약 검증기 export 리팩터링 + 온보딩 API

**Files:**
- Modify: `scripts/validate_module_contract.mjs` — 검사 로직을 `export function checkModuleDoc(doc, { registryBlock } = {})` → `{ failures: string[], warnings: string[] }` 로 추출 (CLI 동작 완전 동일 유지 — CLI는 이 함수를 호출; `npm run validate:modules` 출력 불변 확인). POLICY_ACTION_ENUM도 export
- Modify: `api/update-center.js` — `POST /api/update-center/onboarding` {request_text (10~2000자, 검증)} 추가
- Modify: `scripts/update_center/store.mjs` — 변경 불필요 예상 (data_events 재사용) — 확인만

**동작:**
1. OpenAI 경로: 프롬프트 = 표준 데이터 계약 필수/선택 필드 목록 + 7-action enum + park.yaml/reading.yaml 예시 구조 요약 + 사용자 요청 → strict JSON 응답 {design_summary(한국어 3-5문장), yaml_draft(string), suggested_datasets(관련 공공데이터 검색 키워드 배열), philosophy_notes(도보권/leakage/낙인 관련 검토 필요사항 배열)}. 기존 ai-explainer-v2의 요청 패턴(모델 env·타임아웃·재시도·json_schema strict) 재사용
2. 폴백 경로: 요청 텍스트에서 자원명 추출(첫 명사구 휴리스틱 또는 요청 전문 삽입) → 템플릿 YAML(모든 필수 필드, 값은 "추가 확인 필요" 다수) + design_summary "[AI 미사용 폴백] ..."
3. 기계 검사: yaml_draft를 js-yaml CORE_SCHEMA로 파싱(실패도 결과에 표기) → `checkModuleDoc(doc)` → failures/warnings. registry parity 검사는 신규 모듈에 해당 없음이므로 registryBlock 생략 시 skip되게
4. 저장: data_events에 kind="onboarding_proposal", risk="yellow", status="pending", summary=요청 요약, diff_json={request_text, design_summary, yaml_draft, contract_check, philosophy_notes, ai_source} + audit "onboarding_proposal_created" (source openai|fallback)
5. 응답: 전체 결과 JSON. **철학 체크리스트 3항목은 항상 "human 검토 필요" 상태로 반환** (자동 통과 없음)

- [ ] 검증 (raw output): `npm run validate:modules` 출력 리팩터링 전후 동일; 서버 기동 후 curl — 폴백 경로(키 제거 env로) 제안 생성→이벤트 저장→audit 확인; 키 있으면 실제 OpenAI 경로 1회(체육시설 모듈 요청 예시)→yaml_draft가 계약 검사 통과 또는 실패 목록 정확히 표시; 401/400(짧은 입력) 케이스
- [ ] Commit — `P5: onboarding agent API + contract checker export`

### Task 2: 관리 화면 온보딩 섹션

**Files:**
- Modify: `update-center.html` — ⑦ 섹션 "신규 모듈 제안 (온보딩 에이전트)"

**동작:** textarea(자연어 요청, placeholder 예: "관내 체육시설 접근 격차도 분석하고 싶어요") + 제출 버튼 → 로딩 → 결과 카드: design_summary, yaml_draft `<pre>`(복사 버튼), 계약 검사 결과(통과 ✅ / 실패 항목 빨간 목록), 철학 체크리스트(각 항목 "human 검토 필요" 배지), suggested_datasets 태그, ai_source 표기([AI 미사용 폴백] 구분), 고지 문구 "이 제안은 저장만 되며 승인·파일 생성 전까지 운영에 반영되지 않습니다". 이벤트 목록에서 kind=onboarding_proposal은 보라 계열 배지. esc() 전면 적용 (yaml_draft 포함 — pre 안에서도 escape)

- [ ] 검증: vm.Script 구문 검사, 서버 기동 → 폴백 제안 제출 → 결과 렌더 DOM 확인 + 이벤트 목록 노출 확인 (raw output)
- [ ] Commit — `P5: onboarding agent admin UI`

### Task 3: 문서 + 통합 스모크

**Files:**
- Modify: `docs/update_center.md` — §온보딩 에이전트 추가 (동작·API 명세·철학 체크·승인 전 미반영 원칙·폴백 모드·한계: 검색 키워드는 제안일 뿐 실제 포털 검색 미연동[로드맵], YAML 초안은 human 검토 필수)

- [ ] 게이트 일괄: check_inline_script, validate:modules(출력 불변), build:vercel, node --check 전체, store selftest, 서버 스모크(온보딩 왕복 포함) — raw outputs
- [ ] Commit — `P5: onboarding agent docs + smoke`

## 완료 기준 (컨트롤러)

1. 태스크 리뷰 클린 + 최종 브랜치 리뷰 (P5는 소규모 — 최종 리뷰에 Task 3 문서 검토 포함)
2. 컨트롤러 시각 검증: 온보딩 섹션 제출→결과 카드 스크린샷
3. 문서 약속 충족: 자연어 요청→설계안+YAML 초안→계약 검사→승인 전 미반영
