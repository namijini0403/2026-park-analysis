# 학교 맥락 레이어 운영 가이드 (2026-09-06, 실데이터 통합판)

학교 지정·지원 프로그램(연구·선도 73, AI중점 107, 디지털튜터 87)과 학교 주변 시설 맥락
(유흥·단란주점 인허가 1,534건, 연수구 공사장 행정기록 74건)을 루트 지도와 학교 상세 리포트에
"참고 정보"로 표시하는 기능의 운영 문서입니다.
데이터 계약: `docs/context_layers_contract_20260906.md` · 입력 설명: `data/context_sources/README.md`

## 실측 커버리지 (2026-09-06 빌드 기준)

| 레이어 | 상태 | 규모 |
|---|---|---|
| 지정·지원 프로그램 | available | 267건 명단(3개 사업), 초등 102교 정확 매칭, unmatched 0 |
| 유흥·단란주점 인허가 | partial | 영업/정상 1,534건 중 좌표 1,222건. 500m 관측 학교 89개교, 학교-시설 조합 1,237, 최대 163건 |
| 공사장 행정기록 | partial (연수구만) | 74건 중 좌표 추정 15건. 타 구 학교는 unknown 표시 |

유흥·단란주점 공간조인은 독립 기준선(`outputs/audit_20260906/nightlife_independent_baseline.json`)과
학교별 관측 수·record ID·거리(±0.2m) 전부 일치 확인됨.

## 갱신·빌드·실행 명령 (리포 루트 `2026-park-analysis/`)

```bash
# 1) 맥락 데이터 재빌드 (결정론적, 기존 data_processed 파일 불변)
python scripts/build_context_layers.py

# 2) 자동 검증 (stdlib unittest 26개, 추가 의존성 없음. 독립 기준선 대조 포함)
python -m unittest discover -s tests -v

# 3) 상세 리포트(React) 빌드
npm --prefix ui-preview run build

# 4) 로컬 확인 (기본 모드는 OpenAI 호출 없이 근거 해설 제공)
node scripts/local_review_server.cjs   # http://127.0.0.1:8899/ (접속코드 2026)

# 5) 배포 패키징 — context 데이터 + update_center 공개 대시보드 자동 포함
node scripts/deploy/build_vercel_static.mjs
```

## 데이터 흐름

```
data/context_sources/*.csv  (정규화 원천 사본; 원본·재현은 루트 outputs/source_research_20260906/)
        │  python scripts/build_context_layers.py
        ▼
data_processed/context/{manifest,school_designations,school_context_summary}.json
data_processed/context/facilities_{nightlife,construction}.geojson
data_quality/context_layers_qa_20260906.json
        │  index.html: loadContextLayers() 지연 로딩 / 시설 geojson은 토글·리포트 최초 요구 시
        ▼
지도 토글 🎓 지정·연구학교 · 🍸 유흥·단란주점 · 🚧 공사기록(연수) + 범례 + 학교 카드
        │  localStorage 브리지 row._contextLayers (시설 상세는 거리순 상위 30건)
        ▼
ui-preview: schoolDataBridge.ts → SchoolDetailReportPagePreview.tsx "학교 지정·주변 맥락 정보" 섹션
```

## 정직성 규칙 (테스트로 고정된 UI 불변식)

- 미수집 레이어·미수집 구·좌표 미상 학교: unknown/null — **0건으로 표기 금지**.
- 좌표 부분 확보 레이어: 학교별 수치는 `observed_count` 하한값, `total_count`는 항상 null.
- 지정 기간: 학년도 명단 기준 **추정**(`period_basis=school_year_only`), 확정 시작·종료일 아님.
  2025 디지털튜터는 과거 이력(historical)로 구분 표시.
- 유흥·단란주점은 "인허가 현황" 표기 — 사고위험·불법·현장 영업 여부 판정 아님.
- 공사 기록은 "착공·사용승인 행정기록 / 주소 기반 추정 위치 / 현재 공사 여부 미확인" 표기,
  사용승인 완료 기록 수 별도 표기(현재 공사 위험 아님).
- 거리·반경은 직선거리 기준 표기, 도보 경로 주장 금지. 법정 정화구역 판정에 사용 금지.
- 지원 예산은 원문 명시 시에만 표시. 출처 링크는 http/https만 렌더.

## OpenAI 키 없이 동작

본 기능은 정적 JSON + 결정론 렌더링이며 AI explainer와 독립. loopback 호스트
(localhost/127.0.0.1/[::1])에서는 root와 ui-preview 모두 same-origin API만 시도하고
원격 호스팅 API로 폴백하지 않는다. 위 로컬 서버의 기본 모드는 OpenAI 호출을 차단하고
근거 해설을 제공한다. 지도 타일·외부 CDN·출처 링크는 인터넷 연결이 필요할 수 있으므로
앱 전체의 무인터넷 작동을 보장하는 것은 아니다. API 키는 서버 환경변수로만 관리.

## 알려진 외부 데이터 블로커

- 유흥·단란주점 좌표 미확보 312건: 원 LOCALDATA 좌표 결측. 파일 스냅샷 기준일 미확인(source_as_of null).
- 공사장: 계양(1,948행)·미추홀(1,971행) 원자료는 좌표 미확보로 미반영(루트 outputs 보존).
  연수구 59건 미매핑 유지(추측 매칭 금지). 좌표 있는 매핑도 상가 주소 기반 추정 위치.
- 지정 명단의 실제 지정기간·예산은 공개 원문에 없음 — 후속 공문 확보 시 반영.
- 브라우저 시각 QA는 현 세션에서 불가(연결된 브라우저 없음) — 정적 빌드·데이터·HTTP 검증으로 대체.
