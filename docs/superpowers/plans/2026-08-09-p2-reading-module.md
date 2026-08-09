# P2: 독서교육(도서관) 모듈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공원 모듈에서 검증한 공통 코어(외부 도달성 × 내부 공급 × 수요)를 독서교육 자원에 재적용: 📚 도서관 지도 레이어 + 학교 진단 패널 독서교육 섹션 + 격차 유형 산출 + `modules/reading.yaml` 데이터 계약 (본선 판정 기준 3 충족).

**Architecture:** Python 전처리(도서관 필터링·등시선 교차·학교 매칭·격차 분기) → `data_processed/*.csv` 정적 산출물 → P1의 LAYER_REGISTRY·datasetLoaders에 등록 → index.html 진단 패널에 독서 섹션 추가 → AI 챗봇 청크 확장. 기존 파이프라인 패턴(정적 CSV + 사전계산) 그대로.

**Tech Stack:** Python 3 (pandas; shapely 있으면 사용, 없으면 순수 파이썬 ray-casting 폴백), 바닐라 JS(index.html), Node(청크 빌드).

## Global Constraints

- **원천 데이터** (이미 확보됨, 스크래치패드): `C:\Users\Mijin\AppData\Local\Temp\claude\c--Users-Mijin-Desktop---------\1ad822fc-34c1-4911-87e5-04a2fa9f0bb3\scratchpad\p2data\`
  - `전국도서관표준데이터_인천.csv` (296행, UTF-8, 컬럼: LBRRY_NM, CTPRVN_NM, SIGNGU_NM, LBRRY_SE, SEAT_CO, BOOK_CO, LATITUDE, LONGITUDE, WEEKDAY_OPER_OPEN_HHMM/COLSE_HHMM, CLOSE_DAY, RDNMADR, REFERENCE_DATE 등) — 68행 좌표 결측(주로 작은도서관)
  - `학교도서관현황_인천초등_2025.csv` (273행, UTF-8, 컬럼: 학교명, KEDI학교코드, 도로명주소, 학생수, 도서관(실)수, 좌석수, 장서수_계, 사서교사_사서교사_계, 직원(사서자격증보유여부)_직원수_계, 1인당장서수, 좌석당학생수 등)
- **직선거리를 도달성 지표로 쓰지 않는다** — 이 프로젝트의 핵심 철학. 외부 도달성 판정은 반드시 기존 `data_processed/school_isochrone_500m.geojson`(실제 도보 500m 등시선, properties["학교ID"]) 교차 기반. 직선거리는 `_euclid_m` 접미사 + "참고치(직선)" 라벨로만 표기
- **비식별 유지**: 새 산출물·UI에 학교명은 기존 앱이 이미 표시하는 수준까지만 (앱은 학교명 표시 중이므로 동일 수준 허용), 새로운 개인 단위 정보 금지
- 미확보 항목은 값 `"추가 확인 필요"` 로 표기 (계약 규칙)
- 격차 분기 로직은 제출 문서 원문 준수: 외부·내부 모두 부족 & 미래수요 높음 → `direct_investment_first`(학교도서관 직접투자 우선, 제약 시 이동·순회 조건부) / 외부만 부족 → `school_hub_mobile`(학교 거점·이동형) / 내부만 부족 → `public_link`(공공도서관 연계) / 양호 → `maintain_monitor`(유지·모니터링)
- 작업 브랜치 `policy-reachability`, 디렉토리 `c:\Users\Mijin\Desktop\공공데이터공모전\park-railway-deploy`. UTF-8 파일은 Read/Edit 도구만
- index.html 수정 후 매번 `node scripts/check_inline_script.mjs` 통과
- **P1 이월 체크**: ① 새 레이어 CSV에 `구` 컬럼 필수(없으면 구 선택 시 마커 전체 소실), ② cssColor 첫 사용 — off 상태는 무채색(테두리만 색), on 상태만 배경색 확인

---

### Task 1: 도서관 데이터 전처리 (Python)

**Files:**
- Create: `scripts/reading_module/build_library_layer.py`
- Create: `data/raw_library/전국도서관표준데이터_인천.csv`, `data/raw_library/학교도서관현황_인천초등_2025.csv` (스크래치패드에서 복사, 원본 보존용)
- Output: `data_processed/libraries.csv`, `data_processed/school_library_access.csv`, `data/raw_library/matching_report.md`

**Interfaces:**
- Produces: `libraries.csv` 컬럼 = `도서관명, 유형(공공/어린이/작은), 구, 위도, 경도, 장서수, 열람좌석수, 평일운영, 휴관일, 기준일` / `school_library_access.csv` 컬럼 = `학교ID, 학교명, iso_library_count, iso_public_library_count, nearest_library_name, nearest_library_euclid_m, 장서수, 좌석수, 사서교사수, 사서직원수, 사서합계, 학생수, 인당장서수, 좌석당학생수, matched, 기준일` — Task 2·3이 이 스키마를 소비

- [ ] **Step 1**: python 환경 확인 — `py -c "import pandas; print(pandas.__version__)"`, `py -c "import shapely; print(shapely.__version__)"`. pandas 없으면 BLOCKED 보고. shapely 없으면 순수 파이썬 ray-casting으로 point-in-polygon 구현 (MultiPolygon 처리 포함 — geojson coordinates 직접 순회)
- [ ] **Step 2**: 원천 CSV 2개를 `data/raw_library/`로 복사
- [ ] **Step 3**: `build_library_layer.py` 작성·실행:
  - 도서관: 좌표 있는 행만 레이어에 포함 (`위도/경도` 결측 68행은 별도 카운트만 기록), LBRRY_SE → 유형 매핑, SIGNGU_NM → `구` (예: "인천광역시 미추홀구" 형태면 구명만 추출)
  - 학교 목록: `data_processed/schools.csv`(학교ID·학교명·위도·경도) 기준
  - 등시선 교차: `school_isochrone_500m.geojson`의 각 학교 폴리곤(properties["학교ID"] 매칭)에 도서관 포인트 포함 여부 → `iso_library_count`(전 유형), `iso_public_library_count`(공공+어린이만)
  - 최근접: 전 유형 대상 직선거리 최솟값 → `nearest_library_name`, `nearest_library_euclid_m` (정수 m). **컬럼명에 euclid 명시 — 참고치**
  - KESS 매칭: 학교명 정규화(공백 제거, "초등학교"→"초", 분교장 표기 통일) 후 앱 학교명과 조인. 1차 정확 매칭 → 2차 정규화 매칭 → 미매칭은 `matched=0` + `추가 확인 필요` 값. `matching_report.md`에 매칭률·미매칭 목록 기록 (273 vs 272 차이·분교장 8곳 처리 방식 포함)
  - 사서합계 = 사서교사수 + 사서직원수
- [ ] **Step 4**: 검증 실행 출력 기록 — 전체 학교 수(=schools.csv 행수와 일치), iso_library_count 분포(0인 학교 수), 매칭률(목표 ≥95%, 미달 시 DONE_WITH_CONCERNS로 미매칭 목록 보고), 인코딩 UTF-8(BOM 없이) 확인
- [ ] **Step 5**: Commit — `P2: build library layer + school library access data`

### Task 2: 격차 유형 산출 + 임계값 근거 문서 (Python)

**Files:**
- Create: `scripts/reading_module/apply_reading_gap_types.py`, `docs/reading_module_thresholds.md`
- Modify: `data_processed/school_library_access.csv` (컬럼 추가: `external_shortage, internal_shortage, demand_high, reading_gap_type, reading_gap_reason`)

**Interfaces:**
- Produces: `reading_gap_type` ∈ {`direct_investment_first`, `school_hub_mobile`, `public_link`, `maintain_monitor`} + 한국어 라벨 매핑은 Task 3 UI가 정의

- [ ] **Step 1**: 분포 산출 — 인당장서수·좌석당학생수·사서합계·iso_public_library_count의 사분위, 학생수/기존 미래수요(`school_enrollment_forecast_20260418_model1.csv`와 학교ID 조인 가능하면 예측 수요 사용, 불가하면 학생수) 분포
- [ ] **Step 2**: 임계값 확정 및 문서화 (`docs/reading_module_thresholds.md`) — 기본 제안(분포 확인 후 조정 가능, 조정 시 근거 기록):
  - `external_shortage` = `iso_public_library_count == 0` (실제 도보 500m 내 공공·어린이도서관 없음)
  - `internal_shortage` = `사서합계 == 0` **또는** `인당장서수 < 인천 초등 중앙값의 50%` (사서 미배치 35%는 학교도서관진흥법의 전담인력 배치 취지 대비 명백한 결핍 — 문서에 법령 취지 인용)
  - `demand_high` = 수요 지표 상위 25%
  - 각 임계값에 "데이터 분포와 정책기준 검토 후 확정한다"는 제출 문서 문구 인용 + 실제 분포 수치 첨부
- [ ] **Step 3**: 분기 적용 — Global Constraints의 4유형 매핑 그대로. `reading_gap_reason`은 근거 요약 문자열 (예: "도보500m 내 공공도서관 0개·사서 미배치·수요 상위 25%")
- [ ] **Step 4**: 검증 — 유형별 학교 수 분포 출력(어느 유형이 0개면 임계값 재검토 후 근거 기록), 전 행 유형 배정 확인
- [ ] **Step 5**: Commit — `P2: reading gap classification + threshold rationale`

### Task 3: UI — 레이어 + 진단 패널 독서 섹션 + 데이터 계약

**Files:**
- Modify: `index.html` (LAYER_REGISTRY 항목, PATHS, datasetLoaders, loadData 대입, 진단 패널 섹션)
- Modify: `scripts/deploy/build_vercel_static.mjs` (requiredDataFiles에 `libraries.csv`, `school_library_access.csv`)
- Create: `modules/reading.yaml`

**Interfaces:**
- Consumes: Task 1·2의 CSV 스키마, P1의 LAYER_REGISTRY/datasetLoaders/계약 검증기

- [ ] **Step 1**: LAYER_REGISTRY에 추가 (parks 항목 뒤):
```js
      {
        id: "library", buttonLabel: "📚 도서관", panelLabel: "도서관",
        toggleId: "toggleLibrary", overlayKey: "libraryMarkers",
        kind: "point", datasetKey: "libraries", defaultOn: false,
        cssColor: "#7C3AED",
        point: { latKey: "위도", lngKey: "경도", titleKey: "도서관명", fallbackTitle: "도서관", color: "#7C3AED" }
      },
```
- [ ] **Step 2**: `PATHS.libraries = "./data_processed/libraries.csv"`, `PATHS.schoolLibraryAccess = "./data_processed/school_library_access.csv"` 추가; `datasetLoaders`에 `libraries`, `schoolLibraryAccess` 2항목; loadData 구조분해와 `state.datasets.schoolLibraryAccess = schoolLibraryAccess;` 대입 추가 (`libraries`는 registry datasetKey 시딩+구조분해 패턴 그대로 — Task 3 구현자는 P1의 15항목 패턴을 17항목으로 확장)
- [ ] **Step 3**: 진단 패널 독서교육 섹션 — 학교 상세 렌더 함수(`renderDetailPanel`)에서 학교 모드일 때 독서교육 블록 추가. 표시 항목:
  - 외부: `도보 500m 내 공공도서관 N개` (iso_public_library_count), `최근접 도서관: 이름 (직선 Xm, 참고치)`
  - 내부: `장서 N권 (1인당 N권)`, `좌석 N석`, `사서 N명` — 사서 0명이면 강조 표기
  - 격차 유형 뱃지: direct_investment_first="학교도서관 직접투자 우선" / school_hub_mobile="학교 거점·이동형 지원" / public_link="공공도서관 연계" / maintain_monitor="유지·모니터링" (색: 빨강/주황/노랑/초록 계열, 기존 Case 뱃지 스타일 재사용)
  - `matched=0`이면 전 항목 "추가 확인 필요"
  - 데이터 조회: `state.datasets.schoolLibraryAccess.find((r) => r.학교ID === getSchoolId(row))` — 못 찾으면 섹션에 "추가 확인 필요"
- [ ] **Step 4**: `modules/reading.yaml` — 계약 필수 필드 전부 채우기 (Task 1 메타데이터: 전국도서관표준데이터 UDDI uddi:b385489f-f5a7-4668-a067-ab2124d7963d·문화체육관광부·연간·2026-05-11 / KESS 15040972 uddi:8c403b97-69c0-44a4-a0cc-9b021d9bf597·교육부/KEDI·수시·기준 2026-04-01, 라이선스: KEDI 출처표시), `policy_actions: [internal_investment, mobile_service, institution_link, maintain_monitor]`, layer.id=library·color="#7C3AED". `npm run validate:modules` 통과 (parity 검사 포함)
- [ ] **Step 5**: 검증 — 구문 게이트, validate:modules, `npm run build:vercel`, 서버 스모크(GET /data_processed/libraries.csv 200, school_library_access.csv 200). **cssColor 수용 검사**: 헤드리스로 도서관 버튼 off 상태(무채색 테두리만 보라)와 on 상태(보라 배경) 스크린샷 — 컨트롤러가 최종 확인
- [ ] **Step 6**: Commit — `P2: library layer + reading section in school panel + reading.yaml`

### Task 4: AI 챗봇 독서 모듈 청크

**Files:**
- Create: `docs/ai_explainer/07_reading_module.md`
- Modify: `scripts/build_ai_explainer_chunks.mjs` (requiredDocs), `api/ai-explainer-v2.js` (`detectTopic()` 정규식 + `topicForChunk()`)

- [ ] **Step 1**: 청크 문서 작성 — 기존 청크 형식(`### [chunk: id] title` + `tags:`) 준수. 내용: 독서 모듈 정의(재사용성 검증), 지표 정의(iso_public_library_count는 실제 도보 500m 등시선 기준·직선 아님, euclid는 참고치), 4개 격차 유형과 분기 규칙, 임계값 근거(사서 미배치 35% 등 실측치), 한계(작은도서관 좌표 결측 23%, KESS 기준일 4월 1일, 운영시간 미반영), "권고는 규칙 기반이며 생성형 AI가 정책을 결정하지 않음"
- [ ] **Step 2**: `detectTopic()`에 reading 토픽 추가 (`/도서관|독서|장서|사서|열람|독서교육/` 계열), `topicForChunk()` 매핑, requiredDocs에 07 파일 추가 → `npm run build:ai-chunks` 재생성 → `api/ai_explainer_chunks.json` 갱신 커밋
- [ ] **Step 3**: 스모크 — `node scripts/smoke_ai_explainer_v2.mjs` 실행 (OPENAI_API_KEY 없으면 검색 게이트만 확인되는 수준까지; 결과 원문 기록)
- [ ] **Step 4**: Commit — `P2: AI explainer reading-module chunks + topic routing`

### Task 5: 통합 스모크 + 마무리

- [ ] 전체 게이트 일괄: check_inline_script, validate:modules, build:vercel, 서버 스모크 (raw output)
- [ ] `modules/CONTRACT.md`·스펙 문서와 어긋난 것 없는지 grep 자가 점검 (직선거리를 도달성으로 표기한 UI 문자열 없는지: "직선" 검색 → 참고치 라벨만 존재해야 함)
- [ ] Commit — `P2: integration smoke`

## 완료 기준 (컨트롤러)

1. 5개 태스크 리뷰 클린 + 최종 브랜치 리뷰
2. 컨트롤러 시각 검증: 📚 토글 on/off (off 무채색/on 보라), 도서관 마커 + 구 필터 연동, 학교 클릭 → 독서교육 섹션 표시(외부/내부/뱃지), 사서 0명 학교 강조 확인
3. 판정 기준 3 충족 확인: reading.yaml 계약 검증 통과 + 273개교 격차 유형 산출
