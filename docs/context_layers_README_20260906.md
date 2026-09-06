# 학교 맥락 레이어 운영 가이드 (2026-09-06, 실데이터 통합판 · 확장 반영)

학교 지정·지원 프로그램 명단과 학교 주변 시설 맥락(유흥·단란주점 인허가, 공사장 행정기록)을
루트 지도와 학교 상세 리포트에 "참고 정보"로 표시하는 기능의 운영 문서입니다.
데이터 계약: `docs/context_layers_contract_20260906.md` · 입력 설명: `data/context_sources/README.md`
확보 실패·보류 자료: `data/context_sources/designation_sources_backlog.md`

## 실측 커버리지 (확장 전 → 확장 후)

| 레이어 | 확장 전 (초기 통합) | 확장 후 (현재 빌드) |
|---|---|---|
| 지정·지원 프로그램 | 3개 명단 267건, 초등 **102교** 매칭 | 6개 명단 **804건**, 초등 **176교** 매칭 (unmatched 0, ambiguous 0) |
| 유흥·단란주점 인허가 | 1,534건 중 좌표 **1,222**, 미확보 **312**<br>관측 학교 89, 학교-시설 조합 1,237, 최대 163 | 1,534건 중 좌표 **1,532**, 미확보 **2**<br>관측 학교 **111**, 조합 **1,459**, 최대 **163** |
| 공사장 행정기록 | 연수구만 74건 중 좌표 15<br>관측 학교 15, 조합 39 | **연수·계양·미추홀** 3,729건 중 좌표 **3,521**<br>관측 학교 **65**, 조합 **2,449**, 최대 130, 사용승인 완료 조합 2,183 |

레이어 상태는 셋 다 `partial`입니다. 공사기록 미수집 7개 구·군의 초등 188교는 계속 `unknown`이며 **0건이 아닙니다**.
`facilities_construction.geojson`이 82KB → 3.9MB로 커졌습니다(토글·리포트 최초 요구 시에만 지연 로딩).

### 지정·지원 명단 구성 (804건)

| 원문 | 사업 | 학년도 | 레코드 | 초등 매칭교 |
|---|---|---|---|---|
| `ice_digital_designations_2026.xlsx` | AI·디지털 연구학교·선도학교 | 2026 | 73 | 33 |
| `ice_ai_focus_2026.hwpx` | AI중점학교 (유형1/2/3) | 2026 | 107 | 36 |
| `ice_digital_tutor_2025.pdf` | 디지털튜터 운영교 (과거 이력) | 2025 | 87 | 51 |
| `ice_edu_welfare_2026_school_list.xlsx` | **교육복지우선지원사업** | 2026 | 212 | 99 |
| `ice_edu_welfare_2025_school_list.xlsx` | **교육복지우선지원사업** (과거 이력) | 2025 | 225 | 118 |
| `ice_multicultural_2026_research_korean_leading_schools.hwpx` | **다문화교육** 연구학교·한국어학급·선도학교 | 2026 | 100 | 43 |

교육복지우선지원 명단은 원문에 '지원액 계'가 있어 `financial_support_amount`가 **처음으로 채워진** 명단입니다
(예: `7,400,000원 (2026.3~2027.2 지원액 계, 원문 명시)`). 나머지 명단은 금액이 원문에 없어 전부 null입니다.

### 공사장 행정기록 구별 현황

| 구 | 원자료 | 정규화 레코드 | 좌표 확보 | 미해결 | 비고 |
|---|---|---|---|---|---|
| 연수구 | 15029299 (74행, 기준 2026-03-09) | 74 | 50 | 24 | 15건은 소진공 상가주소 정확일치, 35건은 Kakao |
| 계양구 | 15038929 (1,948행, 기준 2026-01-19) | 1,684 | 1,620 | 64 | 착공·사용승인 기록 없는 허가행 264건 제외 |
| 미추홀구 | 15029300 (1,971행, 기준 2025-09-25) | 1,971 | 1,851 | 120 | 제외 0 |

미해결은 대부분 `동춘1구역 16블럭 5로트` 같은 **번지 없는 개발지구 표기**입니다. 저해상도(법정동 중심점) 좌표를
공사 위치처럼 쓰지 않기 위해 좌표를 부여하지 않고 `unresolved`로 남깁니다.

## 갱신·빌드·실행 명령 (리포 루트)

```bash
# 0) (선택) 원천 좌표 보강 — Kakao Local API. 캐시가 있으면 네트워크 호출 없이 동일 결과 재현
export KAKAO_REST_KEY=...          # 또는 워크스페이스 루트 1.env 의 'rest:' 줄에서 자동 로드
python scripts/context/geocode_missing_kakao.py            # 유흥·단란주점 좌표 미확보 행
python scripts/context/normalize_construction.py           # 계양·미추홀 정규화 + 연수 미매핑 재시도
python scripts/context/normalize_designations.py           # raw/ 원문 → 지정 명단 CSV
#    --offline 을 붙이면 캐시만 사용(네트워크 금지). 캐시: data/context_sources/geocode_cache/kakao_cache.json
#    API 키는 어떤 리포 파일에도 저장하지 않는다.

# 1) 맥락 데이터 재빌드 (결정론적, 기존 data_processed 파일 불변)
python scripts/build_context_layers.py

# 2) 공간조인 독립 재계산 대조 (빌더를 import 하지 않고 CSV에서 다시 계산)
python scripts/context/verify_context_baseline.py

# 3) 자동 검증 (stdlib unittest 30개, 추가 의존성 없음)
python -m unittest discover -s tests -v

# 4) 상세 리포트(React) 빌드
npm --prefix ui-preview run build

# 5) 로컬 확인 (기본 모드는 OpenAI 호출 없이 근거 해설 제공)
node scripts/local_review_server.cjs   # http://127.0.0.1:8899/ (접속코드 2026)

# 6) 배포 패키징 — context 데이터 + update_center 공개 대시보드 자동 포함
node scripts/deploy/build_vercel_static.mjs
```

> `scripts/build_context_layers.py`(빌더)는 **표준 라이브러리만** 사용합니다.
> `scripts/context/normalize_designations.py`만 XLSX 파싱에 `openpyxl`을 씁니다(HWPX는 stdlib `zipfile`로 처리).

## 지오코딩 재실행 방법

1. 키 준비: `KAKAO_REST_KEY` 환경변수 또는 워크스페이스 루트 `1.env` 의 `rest: <키>` 줄.
   **키를 리포 안 파일에 쓰지 마세요.** 캐시 파일에도 질의·응답만 저장됩니다.
2. 초당 약 5회로 제한되고 429/5xx는 지수 백오프로 재시도합니다.
3. 캐시(`data/context_sources/geocode_cache/kakao_cache.json`)가 있으면 같은 질의는 호출 없이 재사용되므로
   `--offline` 로 **네트워크 없이 동일 결과를 재현**할 수 있습니다(실측: live 0 / cache 3,645).
4. 결과 증빙
   - 유흥·단란주점: `data/context_sources/nightlife_kakao_geocode_log.json` (행별 질의·매칭 주소·address_type·좌표)
   - 공사기록: 구별 `construction_*_kakao_match_report.json` (집계 + 미해결 전량 + 수용 표본).
     행별 증빙은 출력 CSV의 `match_reason` / `matched_address_key` / `coordinate_status` / `coordinate_source` 컬럼.

### 수용 규칙 (좌표를 만들어내지 않기 위한 방어선)

- `address_name`이 `인천`으로 시작하는 결과만 수용, 빌더와 동일한 광역 범위(lat 36~39 / lng 124~128) 안일 것.
- 원 주소의 구와 매칭 결과의 구가 같을 것(2026 행정구역 개편으로 신설된 영종·제물포·서해·검단구 포함).
- 후보가 복수면 상호 거리 100m 이하일 때만 수용, 초과 시 `ambiguous`로 거절.
- 공사기록은 **지번 본번·부번·산 여부까지 정확 일치**할 때만 수용. 번지 없는 주소는 질의조차 하지 않음.
- 유흥·단란주점 키워드 폴백은 같은 구 + 같은 법정동 또는 같은 도로명이 확인될 때만 수용(실제 수용 1건).

## 데이터 흐름

```
outputs/source_research_20260906/*.csv (원자료, 읽기 전용)   data/context_sources/raw/*.xlsx|hwpx (원문 사본)
        │ scripts/context/normalize_construction.py                  │ scripts/context/normalize_designations.py
        ▼                                                             ▼
data/context_sources/*.csv  (+ geocode_cache/, *_geocode_log.json, *_match_report.json)
        │  python scripts/build_context_layers.py   (stdlib only, 결정론)
        ▼
data_processed/context/{manifest,school_designations,school_context_summary}.json
data_processed/context/facilities_{nightlife,construction}.geojson
data_quality/context_layers_qa_20260906.json
        │  scripts/context/verify_context_baseline.py 로 공간조인 독립 재계산 대조
        │  index.html: loadContextLayers() 지연 로딩 / 시설 geojson은 토글·리포트 최초 요구 시
        ▼
지도 토글 🎓 지정·연구학교 · 🍸 유흥·단란주점 · 🚧 공사장 행정기록 + 범례 + 학교 카드
        │  localStorage 브리지 row._contextLayers (시설 상세는 거리순 상위 30건)
        ▼
ui-preview: schoolDataBridge.ts → SchoolDetailReportPagePreview.tsx "학교 지정·주변 맥락 정보" 섹션
```

## 정직성 규칙 (테스트로 고정된 UI 불변식)

- 미수집 레이어·미수집 구·좌표 미상 학교: unknown/null — **0건으로 표기 금지**.
- 좌표 부분 확보 레이어: 학교별 수치는 `observed_count` 하한값, `total_count`는 항상 null.
  유흥·단란주점 좌표 미확보가 312 → 2로 줄었어도 **0이 아니므로 하한 관측치 성격은 그대로**입니다.
- 지오코딩 좌표는 **주소 기반 추정 위치**이며 현장 실측 좌표가 아님(`coordinate_status`로 원천 좌표와 구분).
- 지정 기간: 학년도 명단 기준 **추정**(`period_basis=school_year_only`), 확정 시작·종료일 아님.
  2025 디지털튜터·2025 교육복지우선지원은 과거 이력(historical)로 구분 표시.
- 유흥·단란주점은 "인허가 현황" 표기 — 사고위험·불법·현장 영업 여부 판정 아님.
- 공사 기록은 "착공·사용승인 행정기록 / 주소 기반 추정 위치 / 현재 공사 여부 미확인" 표기,
  사용승인 완료 기록 수 별도 표기(현재 공사 위험 아님).
- 거리·반경은 직선거리 기준 표기, 도보 경로 주장 금지. 법정 정화구역 판정에 사용 금지.
- 지원 예산은 원문 명시 시에만 표시(현재 교육복지우선지원 명단만 해당). 출처 링크는 http/https만 렌더.

## OpenAI 키 없이 동작

본 기능은 정적 JSON + 결정론 렌더링이며 AI explainer와 독립. loopback 호스트
(localhost/127.0.0.1/[::1])에서는 root와 ui-preview 모두 same-origin API만 시도하고
원격 호스팅 API로 폴백하지 않는다. 위 로컬 서버의 기본 모드는 OpenAI 호출을 차단하고
근거 해설을 제공한다. 지도 타일·외부 CDN·출처 링크는 인터넷 연결이 필요할 수 있으므로
앱 전체의 무인터넷 작동을 보장하는 것은 아니다. API 키는 서버 환경변수로만 관리.
Kakao 지오코딩은 **빌드 시점 1회**만 필요하며 앱 런타임에는 호출하지 않는다.

## 알려진 외부 데이터 블로커

- 유흥·단란주점 좌표 미확보 **2건**: 원 LOCALDATA 좌표 결측 + Kakao에도 해당 지번/도로명 없음
  (`3540000-103-1996-00009 부평동 431-21`, `3561000-102-2011-00001 승학로 지하 256-1`).
  파일 스냅샷 기준일 미확인(`source_as_of` null) 상태는 변함 없음.
- 공사기록 미해결 208건: 번지 없는 개발지구·블록/로트 표기. 추측 좌표 부여 금지 원칙에 따라 보존.
- 공사기록 나머지 7개 구·군(중구·동구·부평구·남동구·서구·강화군·옹진군, 초등 188교)은 원자료 미확보 → `unknown`.
  (`data_processed/schools.csv`의 구 표기는 2026 행정구역 개편 이전 명칭이며, 수집 3개 구는 개편 영향이 없다.)
- 지정 명단: 인천 일반 **연구학교 지정 명단**은 공개 원문 자체가 없음(첨부는 절차 문서, 학교명 0건).
  늘봄·IB·디지털 선도·학교숲 등도 교육청 공표 명단 없음. 자율학교·결대로자람 원문은 확보했으나
  병합 셀·매트릭스·약칭 표기로 파싱 보류 — 상세는 `designation_sources_backlog.md`.
- 브라우저 시각 QA는 현 세션에서 불가(연결된 브라우저 없음) — 정적 빌드·데이터·HTTP 검증으로 대체.
