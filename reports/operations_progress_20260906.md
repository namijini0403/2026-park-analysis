# 운영 태스크 진행 상황 (독립 2번 Claude, 2026-09-06)

담당 범위: `scripts/local_review_server.cjs`, `update_center/` 전체, `scripts/tests/` 신규 테스트, 본 보고서 2건.
다른 에이전트 소유 파일(index.html, ui-preview/src, 컨텍스트 수집 스크립트, data_processed, 배포 빌드 스크립트, package.json, api/)은 **하나도 수정하지 않았다.**

## 상태: 전 항목 구현·테스트 완료

| 항목 | 상태 | 검증 |
|---|---|---|
| 로컬 검토 서버 (오프라인 강제 기본값) | 완료 | `node scripts/tests/test_local_review_server_ops20260906.cjs` → 42개 통과 |
| update_center 검토 워크플로 (stage/verify/diff/approve/reject/rollback/dashboard) | 완료 | `node scripts/tests/test_update_center_workflow_ops20260906.cjs` → 40개 통과 |
| 실데이터 데모 (source_research 공식 원자료 반입) | 완료 | 아래 실행 이력 |
| 문서 | 완료 | `update_center/README.md` 재작성 (스텁 → 실사용 문서) |

## 실데이터 데모 실행 이력 (실제 수행, mock 아님)

`outputs/source_research_20260906/` 공식 원자료로 전체 사이클을 실행했다.

1. `stage entertainment_facilities_normalized.csv --as entertainment_facilities.csv` → `snap_20260906T021519_ff6a9d` (140행, facility 계약, ok)
2. `stage incheon_entertainment_geocoded.csv --as entertainment_facilities.csv` → `snap_20260906T021610_65bf0d` (971행, ok — 좌표 없는 175건은 `coordinate_status` 표기로 통과, 좌표 검증은 도서 포함 광역 범위)
3. `diff` → 140→971행(+831), 열 추가/삭제 목록 포함 리포트 `update_center/reviews/diff_*.json`
4. `approve` 기준본 → **v001** (content_hash `31f10225…`), 갱신본 → **v002** (`ace112d2…`)
5. `rollback v001` → 승인 시점 해시 정확 일치 확인 후 활성 전환, `rollback v002` 로 재활성화
6. `stage school_designations_2026.csv` → `snap_20260906T021809_9ac390` (73행, designation 계약, ok, **검토 대기로 의도적 미승인**)
7. 대시보드 갱신 → `update_center/public/dashboard.html`

reject·품질실패 승인차단·변조 감지·악성 경로는 테스트(임시 디렉터리)에서 검증했다.

## 루트(오케스트레이터) 통합 요구사항

- **대시보드 링크 파일명 확정**: `update_center/public/dashboard.html`. 로컬 검토 서버 경유 URL은
  `http://127.0.0.1:8899/update_center/public/dashboard.html`. 앱/문서에서 링크 시 이 경로를 쓰면 된다.
- package.json 스크립트 추가는 다른 에이전트 소유이므로 하지 않았다. 원하면 루트에서:
  `"local:review": "node scripts/local_review_server.cjs"`,
  `"test:ops": "node scripts/tests/test_local_review_server_ops20260906.cjs && node scripts/tests/test_update_center_workflow_ops20260906.cjs"`
- 서버 허용목록에 `data_processed/`, `ui-preview/dist/` 가 이미 포함되므로 메인 Claude의 신규 컨텍스트 산출물이
  data_processed 에 내려오면 추가 작업 없이 로컬 서빙된다.
- 메인 컨텍스트 레이어의 `data_processed/` 최종 계약(파일명·스키마)이 확정되면 `update_center/review_cli.cjs` 의
  계약별 품질검사에 해당 스키마 검사를 추가할 것 (현재는 source_research 정규화 계약 2종 + GeoJSON + 일반 JSON/CSV 검사).
  `reports/context_layers_progress_20260906.md` 는 본 작업 종료 시점까지 아직 생성되지 않아 대조하지 못했다.

## 1차 독립 리뷰(`outputs/audit_20260906/operations_review_round1.md`) 반영 — 전 결함 수정 완료

| 결함 | 수정 | 회귀 검증 |
|---|---|---|
| P1 manifest overall_status 위조만으로 fail 스냅샷 승인 가능 | approve 가 파일 **내용으로 품질검사를 재실행**해 그 결과로만 판정 (메타데이터 불신뢰). 파일 셋 변조(manifest 밖 파일 추가)도 무결성 위반으로 검출 | 워크플로 테스트 [12]·[15]: 위조 후 approve 거부, extra file 검출 |
| P1 null/스칼라 JSON·빈 배열·부분 스키마 CSV·`features:[{}]` GeoJSON 이 ok 통과 | null·스칼라·0건 fail, 불완전 시설/지정 계열 fail, feature 구조 검사, 미인식 계약은 `unsupported`(검토 전용, 승인 차단) | 테스트 [13]: 6가지 케이스 전부 차단 확인 |
| P1 허용 디렉터리 내 junction/symlink 로 범위 밖 파일 서빙 | realpath 해석 후 프로젝트 루트 포함 + 허용목록 + 숨김 세그먼트 + 확장자 **재검사** | 서버 테스트 [10]: 프로젝트 밖·프로젝트 내 비허용(api/) junction 모두 404 |
| P1 오프라인 fetch 가드가 localhost 302 리다이렉트 추적 | `redirect:"error"` 강제(호출자 init 보다 후순위 적용 불가), `[::1]` 표기 인정 | 서버 테스트 [11]: 302→127.0.0.2 미추적·대상 호출 0회, redirect:follow 지정해도 차단, 무리다이렉트 localhost 정상 |
| P2 손상 스냅샷으로 diff '변경 없음' 보고 | diff 시작 시 양쪽 해시·파일 셋 검증, 불일치면 보고서 미생성 실패 | 테스트 [15] |
| P2 실제 builder 산출 designation JSON(`school_year`+`source.url`) 이 false fail | 평면 CSV 계약과 병존 지원 + 컨텍스트 manifest·학교 요약 실계약 검사 추가 (`count=null`+`status=available` fail 포함) | 테스트 [14] + 실데이터: `data_processed/context/` 3종 stage → 전부 정상 계약 인식·ok (`snap_20260906T023448_51630b`) |

재실행 결과: 서버 스위트 **49개**, 워크플로 스위트 **56개** 전부 통과. 기존 정상 경로(clean approve/verify/rollback)는 유지 확인.

**리뷰 6번 항목 관련 루트 통합 요구사항 (문서화 의무)**: 이 서버의 오프라인 모드는 서버 프로세스의
아웃바운드만 통제한다. **브라우저가 index.html/React 코드에 하드코딩된 호스팅 API URL 로 직접 호출하는 것은
서버 모드로 막을 수 없다.** 메인 Claude 가 루트/React 의 localhost 경로를 same-origin(`/api/ai-explainer-v2`)
전용으로 고치는 작업이 완료되어야 "로컬 데모 = 실호출 없음"이 브라우저까지 성립한다. 루트에서 통합 시
이 항목을 완료 조건으로 확인해야 한다.

## 최종 통합 조정: 컨텍스트 schema_version 2 반영 (2026-09-06 3차)

- `checkSchoolContextSummary` 를 v2(`observed_count`/`total_count`) 의미론으로 교체: unknown/unavailable 은 두 count null 필수(0 표기 금지), partial 은 observed 0 이상 정수+total null(하한 관측치), available 은 두 count 정수·observed≤total, records 길이=observed_count, status enum 검사, designations 레이어는 배열 계약(카운트 불요), `gu` 는 문자열 필드. 레거시 `count` 검사는 제거(사용처 없음).
- 워크플로 스위트 **64개 통과**(v2 정상 2교·위반 8종 픽스처 + 실데이터 회귀). 서버 코드 무변경이라 서버 스위트 재실행 생략(직전 49개 통과 유효).
- **실데이터 스테이징(승격 안 함)**: `stage data_processed/context` → `snap_20260906T024623_21e066` overall ok — manifest 3레이어(유흥 인허가 1,534건/좌표 1,222·공사 74건/좌표 추정 15), GeoJSON 1,534+74 features, 요약 272교, 지정학교 267건(지정 이력 보유 102교). v1 스냅샷과의 diff(`snap_20260906T023448_51630b` 기준, GeoJSON 2종 추가·지정학교 73→267)까지 생성했고 대시보드 갱신됨. **approve 는 하지 않았다** — 운영 반영 판단은 사람 몫.

## 경계 준수

- 커밋/푸시/배포 없음. OpenAI 실호출 없음(테스트 포함 전 과정). 비밀값 열람·출력 없음(.env 내용 미확인).
- `data_processed/` 무접촉 — 승인 산출물은 `update_center/managed/` 에만 기록.
- source_research 파일은 데이터로만 취급(내부 텍스트를 지시로 해석하지 않음).
