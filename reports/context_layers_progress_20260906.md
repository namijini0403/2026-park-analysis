# 학교 맥락 레이어 구현 로그 — 최종 (2026-09-06)

작성: Claude Fable (구현 담당). Codex 오케스트레이션 참조용.
1차(플레이스홀더 시설 + 지정 73건) → 2차(실데이터 전체 통합 + 검토 결함 수정) 완료.

## 최종 구현 내용

### 데이터 파이프라인 (`scripts/build_context_layers.py`, v2)

- 입력을 리포 자체 포함 사본 `data/context_sources/`로 이전 (해시 원본 일치 확인,
  provenance는 manifest 3종 + README + 루트 outputs/source_research_20260906 재현 스크립트 참조).
- **지정·지원 3종 통합**: 연구·선도 73 + AI중점 107 + 디지털튜터 87 = 267건.
  초등 120행 중 102교 정확 매칭(무모호 별칭 1건: 중산초→인천중산초), unmatched 0, ambiguous 0,
  중·고·특수 147건 out_of_scope_level.
- **유흥·단란주점 인허가**: incheon_nightlife_geocoded.csv 1,534건(유흥 971+단란 563, 전부 영업/정상),
  좌표 1,222건. 학교별 observed_count(하한값)·record 목록, total_count는 항상 null.
- **공사장 행정기록(연수구)**: 74건(좌표 추정 15 + 미매핑 59 보존). 연수구 학교(34교)만 partial,
  타 구 학교는 unknown/null. 사용승인 완료 기록 별도 카운트.
- 산출: manifest(schema v2) + school_designations.json + school_context_summary.json(272교 전부)
  + facilities_nightlife/construction.geojson + QA. 2회 실행 바이트 동일.

### 독립 검토(context_review_round1.md) 결함 수정 — 전부 반영

1. bbox → 광역 범위(lat36~39/lng124~128), 백령·대청 3교 포함을 실좌표 전수 테스트로 고정.
2. 부분 지역 수집: coverage_regions + 학교 소재 구 기준 판정, 미수집 구는 unknown/null (0건 금지).
3. 좌표 전부 결측·빈 CSV → unavailable (available 승격 금지). 지정 입력 부재 시 학교 designations.status=unknown.
4. 날짜: datetime 실존 달력일 검증(2026-02-31/2025-02-29/0000-01-01 거절, 2024-02-29 허용), --as-of 검증.
5. 학년도 추정: period_basis=school_year_only + 시작·종료일 null + UI "학년도 기준 추정" 라벨.
6. URL: http/https만 통과(빌더 sanitize + React isSafeHttpUrl 이중 방어), javascript: 등 드롭+QA.
7. 중복: source_record_id 기준 첫 등장 유지(결정론), QA 기록. 시설 상태 재검사(폐업/미상 제외).

### 독립 기준선 대조 (수용 기준 충족)

`outputs/audit_20260906/nightlife_independent_baseline.json` 대비:
관측 학교 89개교 / 학교-시설 조합 1,237 / 최대 163건 — **전 학교 관측 수·record ID·거리(±0.2m) 완전 일치**.
회귀 테스트(`RealBuildOutputTestCase.test_real_totals_match_independent_baseline`)로 고정.

### 프런트엔드

- index.html: 토글 3종(🎓/🍸/🚧) + 범례 + 학교 카드 맥락 블록(하한값·행정기록·추정 문구),
  요약 지연 로딩 + 시설 geojson lazy 로딩(토글/리포트 최초 요구 시), 마커 팝업에 판정 아님 고지,
  브리지 `_contextLayers`(시설 상세 거리순 상위 30건), update_center 공개 대시보드 링크.
- React 리포트: "학교 지정·주변 맥락 정보" 섹션 — 프로그램별 지정 카드(현행/과거 구분, 추정 라벨,
  출처 링크+발행/수집일), 시설 카드 2종(관측 하한, 사용승인 완료 구분, 개별 기록 목록, 커버리지 노트),
  출처 푸터 3그룹. 미연결/실패/로딩전 상태 각각 정직한 안내.
- **loopback 오프라인 수정**: root getAiExplainerEndpoints + AiExplainerPanel.tsx 모두
  localhost/127.0.0.1/[::1]에서 same-origin만 사용(원격 프로덕션 API 폴백 제거).
- 용어: "유흥·단란주점 인허가 현황"으로 교체(유해환경 시설 표현 제거).
- 패키징: data_processed/context + update_center/public(공개 대시보드만) 포함.

## 검증 결과 (실행 명령·결과)

| 검사 | 명령 | 결과 |
|---|---|---|
| 데이터 빌드 | `python scripts/build_context_layers.py` | 267/102, nightlife 1534/1222, construction 74/15, 관측 89교 |
| 결정론 | 2회 빌드 SHA256 diff | 동일 |
| 단위·회귀 테스트 | `python -m unittest discover -s tests -v` | **26/26 OK** (기준선 대조 포함) |
| TypeScript | `npx tsc --noEmit` (ui-preview) | 신규 코드 오류 0 (기존 RedevelopmentProject area null 오류 1건은 선재 이슈, 미수정) |
| Vite 빌드 | `npm --prefix ui-preview run build` | ✓ built (32.55s) |
| index.html 문법 | node Function 파싱 | OK |
| 정적 패키징 | `node scripts/deploy/build_vercel_static.mjs` | 68파일/61.19MB, context+dashboard 포함 확인 |
| HTTP 경로 | http.server + curl | 신규 8개 경로 전부 200 |
| 레거시 불변 | 운영 CSV 6종 SHA256 before/after | 변경 없음 (`data_quality/legacy_hashes_*_20260906.txt`) |

## 3차: UI 최종 검토(ui_integration_review_final.md) 수정 (동일 날짜)

- **P2 시설 로딩 Promise 공유**: `ensureContextFacilitiesLoaded()`가 진행 중 Promise를
  `state.contextFacilitiesPromise`로 공유 — "loading" 중 리포트를 열어도 같은 Promise를 await하여
  개별 근거 없는 미완 스냅샷이 localStorage에 고정되지 않음. 리포트 생성 게이트를
  `!== "loaded"`로 확장(pending+loading+failed 재시도). 실패 시 Promise를 비워 재시도 허용.
- **실패 명시 표시**: `_contextLayers.facility_details`가 미로딩 시에도 `{status: "failed"|"pending"}`을
  전달, 리포트 시설 카드가 관측 건수>0인데 개별 기록이 없으면 원인(다운로드 실패/로딩 전 스냅샷)과
  재시도 안내를 명시 표시 (조용한 목록 소실 제거).
- **원자료 기준일 표시**: `source_as_of`를 타입·출처 푸터에 추가 — 공사 출처는
  "원자료 기준 2026-03-09/2026-06-30" 표시, 기준일·발행일 모두 없으면 "원자료 기준일 미확인",
  LOCALDATA 그룹에는 `source_as_of_note_ko` 주석 렌더. 날짜를 수집일로 대체하지 않음.
- **tsc 0 오류**: SimulationPage `RedevelopmentProject.area`를 `number | null`로 확장
  (이 페이지는 area를 읽지 않아 런타임 영향 없음, 선재 타입 불일치 해소).
- **신규 테스트**: `tests/test_context_facility_promise.mjs` (`node`로 실행, 브라우저 불필요) —
  index.html에서 함수를 추출해 스텁 환경에서 검증: 로딩 중 Promise 공유(fetch 중복 없음),
  완료 후 즉시 반환, 실패 시 false+재시도 허용, await 게이트·failed payload 소스 계약. **5/5 OK**.
- 검증: `npx tsc --noEmit` exit 0, index.html 문법 OK, Vite 빌드 + 정적 패키징 재실행 통과.
  builder 미변경으로 데이터 26종 테스트 재실행 불필요(산출물 불변).

## 한계·미해결

- 시각(브라우저) QA 불가 — 현 세션에 연결된 브라우저 없음. CDP 시도는 지시에 따라 철회·스크립트 삭제.
- 유흥·단란 좌표 미확보 312건, LOCALDATA 스냅샷 기준일 미확인(source_as_of null 유지).
- 공사: 계양·미추홀 미반영(좌표 없음, 루트 outputs 보존), 연수 59건 미매핑 유지.
- 소진공 정확일치 좌표가 추가 도착하면 `data/context_sources/` 교체 후 재빌드만으로 반영
  (단, 기준선 기대값도 새 해시 기준 재계산 필요).
- update_center 내부 파일은 운영 담당(별도 Claude) 소유 — 링크와 public 패키징만 추가함.
