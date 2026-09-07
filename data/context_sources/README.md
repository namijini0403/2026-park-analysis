# 학교 맥락 레이어 입력 (정규화 원천 사본)

`scripts/build_context_layers.py`가 읽는 자체 포함(self-contained) 입력입니다.
원본 수집·정규화·재현은 워크스페이스 루트 `outputs/source_research_20260906/`
(`README.md`, `REPRODUCE.md`, `reproduce_sources.py`, `reproduce_school_rosters.py`)에서 수행되며,
이 폴더는 그 산출물 중 앱에 필요한 소형 정규화 파일만 해시 그대로 복사한 것입니다.

| 파일 | 내용 | 원문 출처 |
|---|---|---|
| `school_designations_2026.csv` | 2026 AI·디지털 연구학교 3 + 선도학교 70 (초등 33행) | 인천광역시교육청 공고(2025-12-30 게시) |
| `school_ai_focus_2026.csv` | 2026 AI중점학교 107 (초등 36행) | 인천광역시교육청 공고(2026-02-09 게시) |
| `school_digital_tutor_2025.csv` | 2025 디지털튜터 운영교 87 (초등 51행, 과거 이력) | 인천광역시교육청 공고(2025-03-19 게시) |
| `incheon_nightlife_geocoded.csv` | 유흥주점 971 + 단란주점 563 인허가(영업/정상), 좌표 1,222/1,534 | 행안부 LOCALDATA (data.go.kr 15045018/15045017) |
| `construction_geocoded_exact.csv` | 연수구 착공신고 중 지번 정확일치 좌표 추정 15행 | 연수구 착공신고(15029299) + 소진공 상가정보(15083033) |
| `construction_yeonsu_exact_unmatched.csv` | 연수구 착공신고 미매핑 59행 (보존) | 위와 동일 |
| `construction_yeonsu_exact_match_report.json` | 좌표 매칭 집계 리포트 | — |
| `download_manifest.json` 외 manifest 3종 | 원문 URL·SHA-256·수집일 증빙 | — |

## 주의 (데이터 의미)

- 유흥·단란주점: **행정 인허가 기록**이며 사고위험·불법행위·현장 영업 여부 판정이 아님.
  좌표 미확보 312행이 있어 학교별 수치는 **하한 관측치**이고 전체 수(total)는 미상.
  LOCALDATA 파일 스냅샷 기준일은 독립 확인되지 않아 `source_as_of`는 null (수집일 2026-09-06).
- 공사장: **착공·사용승인 행정기록**이며 현재 공사 진행 여부 미확인. 좌표는 상가 주소 기반
  추정 위치(공사현장 좌표 아님). 연수구만 수집 — 타 구 학교는 unknown으로 표시해야 함.
  계양(1,948행)·미추홀(1,971행) 원자료는 좌표 미확보로 미반영(루트 outputs에 보존).
- 지정 명단: 학년도만 있고 지정 시작·종료일이 없어 기간은 추정(`period_basis=school_year_only`).
  명단 미등재가 미지정 확정은 아님. 지원 금액은 원문에 없으므로 전부 null.

## 새 자료 추가 방법

같은 스키마의 정규화 CSV를 이 폴더에 두면 재빌드로 반영됩니다.
- 지정 명단: `school_designations_2026.csv`의 컬럼 규격에 행 추가 또는 동일 스키마 파일 추가 후
  `build_context_layers.py`의 `DESIGNATION_FILES`에 파일명 등록.
- 시설: `incheon_nightlife_geocoded.csv` 스키마(WGS84, `coordinate_status` 명시) 준수.
  좌표를 임의 생성·추측 배치하지 말 것. 부분 커버리지는 builder의 커버리지 규칙에 반영 필요.

```bash
python scripts/build_context_layers.py
python -m unittest discover -s tests -v
```
