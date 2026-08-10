# 독서(도서관) 데이터 ui-preview 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 진단 패널에만 있는 독서교육 접근성·정책 카드 요약을 iframe 리포트(학교 진단 상세)와 시뮬레이션 페이지에 노출한다.

**Architecture:** index.html이 학교 클릭 시 localStorage(`parkAnalysis_school`)에 쓰는 enriched row에 `_readingContext` 사이드채널 객체를 추가(기존 `_redevelopmentProjects` 패턴). ui-preview의 라이브 루트 `PreviewWorkspaceSafe.tsx`가 이를 읽어 리포트 페이지(별도 SectionShell 섹션)와 시뮬레이션 페이지(헤더 컨텍스트 배지)에 전달한다. **녹지 지표와 분리** — KNN 비교군·MetricCard 그리드는 공원 기준 산출이므로 독서를 섞지 않고, 시뮬레이션 가중치 축에도 절대 추가하지 않는다(별도 정책 트랙 안내만).

**Tech Stack:** vanilla JS (index.html), React 18 + TS + Tailwind (ui-preview), Vite build.

## Global Constraints

- **시뮬레이션 가중치 체계(robust-XAI: benefit/schoolDistance/parkDistance) 변경 금지** — 독서는 표시용 컨텍스트만
- ui-preview 라이브 루트는 `PreviewWorkspaceSafe.tsx` (main.tsx가 마운트). `App.tsx`/`schoolDataMapper*.ts`는 데드 코드 — 수정 금지
- 독서 격차 라벨·색의 단일 정의처는 index.html의 `READING_GAP_META`(line ~3572) — React에 라벨 문자열 중복 정의 금지, `_readingContext`에 label/color를 담아 전달
- `internal_shortage`는 3값(True/False/"추가 확인 필요") — boolean 캐스팅 금지
- `_readingContext` 부재·matched=0이면 리포트 섹션은 "추가 확인 필요" 상태로 렌더(섹션 자체는 표시), 시뮬레이션 배지는 미표시
- 거리 표기는 항상 "직선 참고치" 명시, 지오코딩 좌표는 "좌표 근사" 병기 (기존 진단 패널 문구와 동일)
- ui-preview 수정 후 `npm --prefix ui-preview run build` + dist 커밋 필수
- 게이트: `node scripts/check_inline_script.mjs`, `npm run validate:modules`, `npm run build:vercel`
- 작업 브랜치 `policy-reachability` (worktree `park-railway-deploy`)

---

### Task 1: index.html — `_readingContext` 사이드채널

**Files:**
- Modify: `index.html` — 함수 1개 추가 + localStorage 쓰기 직전 1줄

**Interfaces:**
- Produces: `_enrichedRow._readingContext` 객체 (아래 스키마 — Task 2/3의 TS 타입과 필드명 일치해야 함)

**동작:** `buildRedevelopmentProjectList` 호출부 근처(line ~7643, `_enrichedRow._redevelopmentProjects` 세팅 옆)에 `_enrichedRow._readingContext = buildReadingContext(row);` 추가. 함수는 `renderSchoolPolicyCardSection`(line ~7141) 아래에 정의:

```js
function buildReadingContext(row = {}) {
  const schoolId = getSchoolId(row);
  const all = state.datasets.schoolLibraryAccess || [];
  const rec = all.find((r) => r.학교ID === schoolId);
  if (!rec || !Number(rec.matched)) return { matched: false };

  // 시 전체 참조 통계 (272교 기준, 매칭된 행만)
  const matchedRows = all.filter((r) => Number(r.matched));
  const total = matchedRows.length;
  const externalShortageCount = matchedRows.filter((r) => String(r.external_shortage) === "True").length;
  const perCapitaValues = matchedRows
    .map((r) => Number(r.인당장서수))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const cityMedianPerCapita = perCapitaValues.length
    ? (perCapitaValues.length % 2
        ? perCapitaValues[(perCapitaValues.length - 1) / 2]
        : (perCapitaValues[perCapitaValues.length / 2 - 1] + perCapitaValues[perCapitaValues.length / 2]) / 2)
    : null;
  const noLibrarianCount = matchedRows.filter((r) => Number(r.사서합계) === 0).length;

  const gapMeta = getReadingGapMeta(rec.reading_gap_type);
  const card = (state.datasets.policyActionCards?.schools || {})[schoolId] || null;
  const primaryMeta = card ? getPolicyActionMeta(card.base.primary_action) : null;
  const altMeta = card && card.base.alternative ? getPolicyActionMeta(card.base.alternative) : null;

  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    matched: true,
    isoPublicLibraryCount: toNum(rec.iso_public_library_count),
    nearestLibraryName: rec.nearest_library_name || null,
    nearestLibraryType: rec.nearest_library_type || null,
    nearestLibraryDistM: toNum(rec.nearest_library_euclid_m),
    nearestLibraryCoordApprox: rec.nearest_library_coord_source === "지오코딩",
    bookCount: toNum(rec.장서수),
    perCapitaBooks: toNum(rec.인당장서수),
    seatCount: toNum(rec.좌석수),
    librarianTotal: toNum(rec.사서합계),
    studentCount: toNum(rec.학생수),
    externalShortage: String(rec.external_shortage) === "True",
    internalShortage: String(rec.internal_shortage),  // "True" | "False" | "추가 확인 필요"
    demandHigh: String(rec.demand_high) === "True",
    gapType: rec.reading_gap_type || null,
    gapLabel: gapMeta.label,
    gapColor: gapMeta.color,
    gapTextColor: gapMeta.textColor || "#ffffff",
    gapReason: rec.reading_gap_reason || null,
    baseDate: rec.기준일 || null,
    cityStats: {
      total,
      externalShortageCount,
      cityMedianPerCapita,
      noLibrarianCount,
    },
    policy: card ? {
      primaryAction: card.base.primary_action,
      primaryLabel: primaryMeta.label,
      primaryColor: primaryMeta.color,
      primaryTextColor: primaryMeta.textColor || "#ffffff",
      altAction: card.base.alternative || null,
      altLabel: altMeta ? altMeta.label : null,
      stability: toNum(card.stability),
      separateTrack: !!card.separate_track,
      dataGap: !!card.data_gap,
    } : null,
  };
}
```

- [ ] 구현 후 게이트: `node scripts/check_inline_script.mjs` 통과 (raw output)
- [ ] 검증: `node -e` 등으로 CSV 참조 통계 기대값 확인 — school_library_access.csv에서 matched 행 수(272), external_shortage=True 수(**251**), 사서합계=0 수, 인당장서수 중앙값(≈49.1)을 별도 스크립트로 계산해 함수 로직과 동일 산식임을 대조 (raw output)
- [ ] Commit — `reading-ui: build _readingContext bridge payload in index.html`

### Task 2: 진단 리포트 — 독서교육 접근성 섹션

**Files:**
- Modify: `ui-preview/src/schoolDataBridge.ts` — `ReadingContext` 타입 export
- Modify: `ui-preview/src/PreviewWorkspaceSafe.tsx` — `_readingContext` 읽기 + 전달
- Modify: `ui-preview/src/SchoolDetailReportPagePreview.tsx` — `ReadingAccessSection` 추가

**Interfaces:**
- Consumes: Task 1의 `_readingContext` 스키마 (필드명 그대로 camelCase)
- Produces: `export type ReadingContext` (schoolDataBridge.ts), `SchoolDetailReportProps.readingContext?: ReadingContext | null`

**동작:**
1. `schoolDataBridge.ts`에 Task 1 스키마 그대로 `export type ReadingContext = { matched: boolean; isoPublicLibraryCount?: number | null; ... }` 정의 (모든 필드 optional 허용, `internalShortage: string`)
2. `PreviewWorkspaceSafe.tsx`: `readRedevelopmentProjects` 패턴(line ~75)대로 `schoolRow._readingContext`를 안전 파싱하는 `readReadingContext(schoolRow): ReadingContext | null` 추가(객체 아니면 null). `detailProps`에 `readingContext` 주입
3. `SchoolDetailReportPagePreview.tsx`:
   - `SchoolDetailReportProps`에 `readingContext?: ReadingContext | null` 추가 (import type)
   - 새 `ReadingAccessSection({ readingContext })` — `SectionShell kicker="Reading" title="독서교육 접근성"`으로, `SchoolProfileGrid`(line ~1546)와 `ProblemSection` 사이에 삽입
   - 내용 (기존 Card/Badge 프리미티브 재사용):
     - 상단 격차 유형 배지: `Badge` tone 매핑 — `direct_investment_first→danger`, `school_hub_mobile→warning`, `public_link→caution`, `maintain_monitor→positive`, 그 외/null→`caution` + 라벨은 `gapLabel` 그대로. 배지 옆 회색 텍스트로 `gapReason`
     - 지표 그리드(2×2 Card): ① 도보 500m 공공도서관 `{isoPublicLibraryCount}개` + 보조문구 `인천 {cityStats.total}교 중 {cityStats.externalShortageCount}교가 0개` ② 학교도서관 1인당 장서 `{perCapitaBooks}권` + `시 중앙값 {cityStats.cityMedianPerCapita}권` ③ 사서 `{librarianTotal}명` — 0이면 danger 톤 "사서 미배치" + `시 전체 미배치 {cityStats.noLibrarianCount}교` ④ 열람좌석 `{seatCount}석` / 장서 `{bookCount}권`
     - 최근접 도서관 줄: `{nearestLibraryName} ({nearestLibraryType}, {nearestLibraryDistM}m 직선 참고치{nearestLibraryCoordApprox ? ", 좌표 근사" : ""})`
     - 정책 요약 줄(policy 있을 때만): `우선 검토안: {policy.primaryLabel}` + 대안 `{policy.altLabel ?? "해당 없음 — 정기 재진단"}` + 안정성 `12개 조건 조합 중 {Math.round(stability*12)}개 유지` + separateTrack/dataGap 시 회색/amber 칩. 하단 캡션: "세부 시나리오·기관별 역할은 지도 진단 패널의 정책 행동 카드 참고"
     - `readingContext`가 null이거나 `matched === false`면: 섹션은 유지하되 본문에 muted 텍스트 "추가 확인 필요 (학교-도서관 접근성 데이터 없음)"
     - 숫자 null은 전부 "자료 없음" 표기, `toLocaleString` 천단위
- [ ] 검증: `npx tsc --noEmit` (ui-preview 디렉토리) 통과, `npm --prefix ui-preview run build` 성공 (raw output; dist 커밋은 Task 4에서)
- [ ] Commit — `reading-ui: reading access section in detail report page`

### Task 3: 시뮬레이션 페이지 — 독서 컨텍스트 배지

**Files:**
- Modify: `ui-preview/src/SimulationPage.tsx` — props + 헤더 배지
- Modify: `ui-preview/src/PreviewWorkspaceSafe.tsx` — SimulationPage에 prop 전달

**Interfaces:**
- Consumes: `ReadingContext` (schoolDataBridge.ts에서 import type)

**동작:**
1. `SimulationPageProps`(line ~87)에 `readingContext?: ReadingContext | null` 추가
2. 헤더 영역(line ~968-991)의 `casePolicyLabel` 필 옆에, `readingContext?.matched && readingContext.gapType`일 때만 인라인 필 추가: `📚 {gapLabel}` — 스타일은 기존 필과 동일 계열, 색상은 `gapColor`/`gapTextColor` 사용
3. 필 바로 아래(또는 인트로 패널 하단)에 한 줄 캡션: `독서 격차는 공원 후보지 점수·가중치에 반영되지 않는 별도 정책 트랙입니다 — 상세는 진단 리포트의 독서교육 접근성 섹션 참고` (SIM_COLORS.muted 계열 작은 글씨)
4. **WeightState·점수 계산·필터 로직은 어떤 것도 수정하지 않는다**
5. `PreviewWorkspaceSafe.tsx`의 SimulationPage 렌더(line ~283-299)에 `readingContext` 전달 (Task 2에서 만든 `readReadingContext` 결과 재사용)
- [ ] 검증: `npx tsc --noEmit` 통과, `npm --prefix ui-preview run build` 성공 (raw output)
- [ ] Commit — `reading-ui: reading gap context pill in simulation page`

### Task 4: dist 빌드 + 게이트 + 시각 검증

**Files:**
- Modify: `ui-preview/dist/*` (빌드 산출물 — 추적됨), 필요시 없음 그 외

**동작:**
1. `npm --prefix ui-preview run build` → dist 갱신
2. 게이트 일괄 (raw outputs): `node scripts/check_inline_script.mjs`, `npm run validate:modules`, `npm run build:vercel`
3. 시각 검증 (컨트롤러 수행 — 이 태스크의 구현자는 1·2까지만): 로컬 서버 + headless Chrome CDP로 localStorage에 실데이터 기반 school row(+`_readingContext`)를 시드하고 `/ui-preview` 리포트·시뮬레이션 화면 캡처 — 독서 섹션·배지 렌더 확인
- [ ] Commit — `reading-ui: rebuild ui-preview dist`

## 완료 기준 (컨트롤러)

1. 태스크 리뷰 클린 + 최종 브랜치 리뷰(opus)
2. 시각 검증 스크린샷: 리포트 독서교육 섹션(정상 + 데이터 없음 2상태), 시뮬레이션 헤더 배지
3. 시뮬레이션 가중치·점수 로직 diff 없음 확인
4. 머지(railway-deploy) 후 수동 배포 트리거 + 프로덕션 실클릭 검증
