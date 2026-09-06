# AI 해설 v2 × schema_version 2 컨텍스트 근거 통합 (2026-09-06, 키 독립 백엔드)

담당: 독립 2번 Claude. 수정 범위는 `api/ai-explainer-v2.js`, 신규 헬퍼 `api/_context_evidence.js`(밑줄 접두어 —
Vercel 엔드포인트로 노출되지 않음), 테스트 `scripts/tests/test_context_ai_ops20260906.cjs`, 본 보고서뿐이다.
index.html/React/빌드는 무수정(메인 담당 소유), Vite 빌드는 실행하지 않았다.

## 동작

유흥·단란·공사·착공·연구학교·선도학교·AI중점·디지털튜터·특별지원·지정 계열 질문(`identified_school_explainer`
모드 한정)에서, 서버 로컬 `data_processed/context/` 의 schema v2 산출물(요약·manifest)로 선택 학교의 컴팩트 근거
chunk(`context_v2#school-<id>`)를 만들어 검색 결과 최상단에 주입한다.

- **학교 해석 권위**: `school_id` 우선, 없으면 **정확히 일치하고 유일한** `school_name`(현 UI가 이름을 보냄).
  미일치·동명 모호·자료 미탑재면 임의 해석하지 않고 명시적 blocked 사유로 차단한다.
- **클라이언트 불신뢰**: payload 의 수치·지정 필드는 근거로 쓰지 않는다(스푸핑 테스트로 확인).
- **근거 내용**: observed_count/total_count 요약, 최근접 관측 거리, 정확한 지정 프로그램·학년도, 출처 URL,
  기준일/수집일, 커버리지 주의. 개별 좌표 1,222쌍/전 레코드는 프롬프트에 덤프하지 않는다(chunk 4096자 미만).
- **정직성 규칙이 chunk 본문에 내장**: partial 의 0은 '없음' 확정 아님(하한 관측치), unknown 은 미수집이지 0건
  아님, 착공신고는 현재 공사 진행 여부 아님, 거리=직선거리, school_year ≠ 정확한 법적 기간, 지정 ≠ 지원금액 확인.
- **경로 공유**: 키 없는 기존 retrieval 폴백과 OpenAI `buildInput` 프롬프트가 **같은 chunk** 를 쓰며, 기존 인용
  검증(`validateAnswer`)이 `context_v2#…` ID 를 그대로 허용한다. 비식별 공개 모드에는 학교별 수치 미주입.
- 기존 Case/모델/차단 동작 불변. `DOMAIN_SIGNAL_PATTERN` 에 컨텍스트 주제 단어만 추가.

## 실행한 검증 (실호출 0회, .env 미열람)

```
node scripts/tests/test_context_ai_ops20260906.cjs → 총 27개 검증 통과
node scripts/smoke_ai_explainer_v2.mjs             → PASS (mock fetch)
node scripts/qa_ai_explainer_v2.mjs                → PASS (mock, 7케이스 기존 인용 유지)
```

신규 테스트 케이스(실데이터 기반): 지정학교(인천운서초 B000002953, 2026 AI중점 유형3) 키 없는 폴백 answerable,
유흥 관측(인천신광초 B000002950, 최소 관측 1건·최근접 434m·전수 아님), 연수구 밖 공사 unknown(인천신흥초,
"0건 확정이 아니라 미상"+진행여부 주의), 미일치 학교 차단, 동명 모호 fixture 해석 거부(id 는 정확 해석),
클라이언트 999 스푸핑 무시, Case 전체기준·오프도메인 기존 동작 보존, 공개 모드 미주입,
mock OpenAI 캡처(프롬프트 최상단 context chunk + 유형3·ice.go.kr 출처·주의 문구 포함, 인용 검증 통과).

## 한계·통합 메모

- 컨텍스트 chunk 는 요약 파일의 사전 계산 값을 그대로 전달한다. 거리 재계산·좌표 검증은 하지 않는다(그건
  update_center 검토 워크플로 몫). I-EEI·Case 분류 로직은 건드리지 않았다.
- 헬퍼는 프로세스 캐시를 쓰므로 컨텍스트 파일 교체 시 서버리스 콜드스타트/로컬 서버 재시작 후 반영된다.
  테스트 격리용 `AI_CONTEXT_DIR` 환경변수 지원.
- 동명 학교가 현 실데이터에는 없지만(272교 전수 확인), 이름 해석은 유일성 검사를 통과해야만 동작한다.
  UI 가 school_id 를 함께 보내면 더 견고하다 — 메인 담당 참고.
- 실제 OpenAI 응답 품질은 키 연결 후 별도 확인 필요. 본 작업 검증은 전부 mock/폴백 경로다.

## 최종 통합 보완 (Codex)

원자료 시점과 산출일을 구분하고 건축 원자료 기준일 2종, LOCALDATA 기준일 미확인 문구를 추가했다.
출처 목록의 6개 제한 때문에 빠질 수 있던 과거 튜터 출처를 보존했다. 미수집 지정 상태는 명단 미등재와
구분하고 서버 근거 우선 지시를 넣었다. 띄어쓴 '특별 지원', '연구 학교'와 건축행정 질문도 인식한다.
최종 `test_context_ai_ops20260906.cjs`는 **33개 검사 통과**(종료코드 0), 로그는
`reports/context_ai_final_tests_20260906.log`다. 별도 실제 로컬 HTTP 검사에서 학교 질문 3종도 통과했다.
