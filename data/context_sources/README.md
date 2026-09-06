# 학교 맥락 레이어 입력 (정규화 원천 사본)

`scripts/build_context_layers.py`가 읽는 자체 포함(self-contained) 입력입니다.
원본 수집·정규화·재현은 워크스페이스 루트 `outputs/source_research_20260906/`
(`README.md`, `REPRODUCE.md`, `reproduce_sources.py`, `reproduce_school_rosters.py`)에서 수행되며,
이 폴더는 그 산출물 중 앱에 필요한 소형 정규화 파일과, 2026-09-06 확장분(추가 명단 원문 + 좌표 보강)입니다.

## 지정·지원 명단 (빌더 `DESIGNATION_FILES`, 합계 804건 / 초등 매칭 176교)

| 파일 | 내용 | 원문 출처 |
|---|---|---|
| `school_designations_2026.csv` | 2026 AI·디지털 연구학교 3 + 선도학교 70 (초등 33교) | 인천광역시교육청 공고(2025-12-30 게시) |
| `school_ai_focus_2026.csv` | 2026 AI중점학교 107 (초등 36교) | 인천광역시교육청 공고(2026-02-09 게시) |
| `school_digital_tutor_2025.csv` | 2025 디지털튜터 운영교 87 (초등 51교, 과거 이력) | 인천광역시교육청 공고(2025-03-19 게시) |
| `school_edu_welfare_2026.csv` | 2026 교육복지우선지원사업 지원학교 212 (초등 99교) | 인천광역시교육청 공고(2026-01-16 게시) |
| `school_edu_welfare_2025.csv` | 2025 교육복지우선지원사업 지원학교 225 (초등 118교, 과거 이력) | 인천광역시교육청 공고(2025-03-06 게시) |
| `school_multicultural_2026.csv` | 2026 다문화교육 연구학교·한국어학급·선도학교 100 (초등 43교) | 인천광역시교육청 공고(2026-04-27 게시) |

원문 파일(xlsx/hwpx/hwp)은 `raw/` 에 그대로 보관하고, `raw/designation_raw_manifest.json` 이
url·제목·발행일·수집일·sha256·정규화 대상 여부를 남깁니다.
정규화 스크립트: `scripts/context/normalize_designations.py`.

## 시설 맥락

| 파일 | 내용 | 원문 출처 |
|---|---|---|
| `incheon_nightlife_geocoded.csv` | 유흥주점 971 + 단란주점 563 인허가(영업/정상). 좌표 1,532/1,534 | 행안부 LOCALDATA (data.go.kr 15045018/15045017) + Kakao Local API |
| `nightlife_kakao_geocode_log.json` | 위 파일의 좌표 보강 행별 증빙(질의·매칭 주소·address_type·좌표) | — |
| `construction_geocoded_exact.csv` | 연수구 착공신고 중 지번 정확일치 좌표 추정 15행 | 연수구 착공신고(15029299) + 소진공 상가정보(15083033) |
| `construction_geocoded_yeonsu_kakao.csv` | 연수구 정확일치 실패 59행 Kakao 재시도(좌표 35, 미해결 24) | 15029299 + Kakao Local API |
| `construction_geocoded_gyeyang.csv` | 계양구 착공·사용승인 1,684행(좌표 1,620, 미해결 64) | 계양구 건축착공사용승인현황(15038929) + Kakao |
| `construction_geocoded_michuhol.csv` | 미추홀구 착공신고 1,971행(좌표 1,851, 미해결 120) | 미추홀구 착공신고(15029300) + Kakao |
| `construction_*_kakao_match_report.json` | 구별 매칭 집계 + 미해결 전량 + 수용 표본 | — |
| `construction_yeonsu_exact_unmatched.csv` | 연수구 정확일치 실패 59행 원본(보존용, 빌더 미사용) | — |
| `construction_yeonsu_exact_match_report.json` | 소진공 좌표 매칭 집계 리포트 | — |
| `geocode_cache/kakao_cache.json` | Kakao 질의→응답 캐시(키 미포함). 있으면 네트워크 없이 동일 결과 재현 | — |
| `download_manifest.json` 외 manifest 3종 | 원문 URL·SHA-256·수집일 증빙 | — |

정규화·지오코딩 스크립트: `scripts/context/normalize_construction.py`, `scripts/context/geocode_missing_kakao.py`.

## 주의 (데이터 의미)

- 유흥·단란주점: **행정 인허가 기록**이며 사고위험·불법행위·현장 영업 여부 판정이 아님.
  좌표 미확보가 312행 → **2행**으로 줄었지만 0이 아니므로 학교별 수치는 여전히 **하한 관측치**이고
  전체 수(total)는 미상. LOCALDATA 파일 스냅샷 기준일은 독립 확인되지 않아 `source_as_of`는 null (수집일 2026-09-06).
- 공사장: **착공·사용승인 행정기록**이며 현재 공사 진행 여부 미확인. 좌표는 주소 기반 추정 위치
  (공사현장 좌표 아님). **연수·계양·미추홀구만 수집** — 타 구 학교는 unknown으로 표시해야 함.
  계양구는 착공처리일·사용승인일이 모두 없는 건축허가 행 264건을 제외했고(사유는 match report),
  번지 없는 개발지구 표기 208행은 좌표를 부여하지 않고 `unresolved`로 보존.
- 지정 명단: 학년도만 있고 지정 시작·종료일이 없어 기간은 추정(`period_basis=school_year_only`).
  명단 미등재가 미지정 확정은 아님. 지원 금액은 **교육복지우선지원 명단(원문 '지원액 계' 열)에서만**
  채워지고 나머지는 전부 null.
- 확보하지 못했거나 파싱을 보류한 사업(일반 연구학교 명단, 늘봄, IB, 자율학교, 결대로자람 등)은
  `designation_sources_backlog.md` 에 사유와 함께 기록되어 있고 산출물에는 반영되지 않았습니다.

## 좌표 출처 표기 (`coordinate_status` / `coordinate_source`)

| coordinate_status | coordinate_source 예 | 의미 |
|---|---|---|
| `official_coordinate` | `EPSG:5174 original transformed to EPSG:4326` | 원천 좌표 |
| `estimated_from_exact_parcel_address` | `소상공인시장진흥공단 상가주소 …` | 동일 지번 정확일치 추정 |
| `geocoded_kakao_road` / `_jibun` / `_keyword` | `kakao_local_api:address_road` 등 | Kakao 주소·키워드 매칭 추정 |
| `unresolved` | `kakao_local_api:unresolved` | 좌표 미확보(0건 아님, 집계 제외) |

## 새 자료 추가 방법

같은 스키마의 정규화 CSV를 이 폴더에 두면 재빌드로 반영됩니다.
- 지정 명단: `school_designations_2026.csv`의 컬럼 규격(11열)을 지켜 새 파일을 만들고
  `build_context_layers.py`의 `DESIGNATION_FILES`에 등록. 학교명은 원문 표기 그대로 두고,
  별칭이 필요하면 `SCHOOL_NAME_ALIASES`에 **무모호 확인 근거 주석과 함께** 명시 등록.
- 공사기록: 28열 스키마(`construction_geocoded_exact.csv`)를 그대로 쓰고 `CONSTRUCTION_FILES`에 등록.
  커버리지 구는 레코드 주소에서 자동 파생되므로 별도 상수 수정이 필요 없습니다.
- 시설: `incheon_nightlife_geocoded.csv` 스키마(WGS84, `coordinate_status` 명시) 준수.
  **좌표를 임의 생성·추측 배치하지 말 것.** 확인 불가한 행은 `unresolved`로 남깁니다.

```bash
python scripts/context/normalize_designations.py      # 원문 → 지정 CSV (openpyxl 필요)
python scripts/context/normalize_construction.py      # 원자료 → 28열 CSV + Kakao 좌표
python scripts/context/geocode_missing_kakao.py       # 유흥·단란주점 좌표 보강
python scripts/build_context_layers.py                # 재빌드 (stdlib only, 결정론)
python scripts/context/verify_context_baseline.py     # 공간조인 독립 재계산 대조
python -m unittest discover -s tests -v
```

Kakao REST 키는 환경변수 `KAKAO_REST_KEY` 또는 리포 **밖** 키 파일에서만 읽습니다.
이 리포의 어떤 파일에도(캐시 포함) 키를 저장하지 않습니다.
