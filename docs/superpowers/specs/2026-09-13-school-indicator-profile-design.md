# 학교 지표 프로필 패널 · 영역별 통계 설계

작성일 2026-09-13 · 브랜치 `feat/all-school-levels-academy-public-metrics`

## 1. 목적

학교(유치원·초·중·고)를 지도에서 선택하면, 그 학교의 교육·환경 지표를 **절대값과 상대 위치(군·구 기준 / 인천 전체 기준)** 로 지도 하단에 보여준다. 영역별 전체 분포는 별도 통계 탭에서 확인한다.

이번 작업은 **새 데이터를 수집하지 않는다.** 이미 계산된 `api/_school_table.js`(917교 × 50열)만 사용하고, 비어 있는 칸은 화면에 `미확보`로 표시하며 채우는 방법을 [미확보 목록](../../../contest_plan/indicator_coverage_gaps_20260913.md)에 정리한다.

## 2. 범위 밖 (이번에 하지 않는 것)

- 유흥·단란주점, 지정사업, 학원 최근접 거리의 전 학교급 재계산 — 원자료는 있으나 별도 작업으로 분리
- KESS 중·고 학교도서관 현황 신규 수집, 미수집 7개 구 착공신고 수집
- 종합점수·가중합 순위 (AGENTS.md 금지 규칙)

## 3. 데이터 계층

### 3.1 컬럼 사전 통합

현재 지표 정의가 두 곳에 갈라져 있다.

- `api/_school_table.js`의 `COLUMNS` — 50열, 챗봇 도구용
- `api/_relative_position.js`의 `metrics` — 11개 안팎, 질문 매칭용 (파일 읽기·질문 정규식을 자체 보유)

`COLUMNS`를 단일 사전으로 삼고 컬럼마다 두 필드를 추가한다.

| 필드 | 값 | 용도 |
|---|---|---|
| `domain` | 아래 9개 영역 id | 패널 카드 묶음, 통계 탭 |
| `direction` | `up` / `down` / `neutral` | 값이 클수록 유리(`up`)·불리(`down`)·정책 판단 필요(`neutral`) |

`direction`은 **표시용 주석일 뿐 백분위를 뒤집지 않는다.** 방향으로 값을 뒤집으면 그 자체가 평가등급이 되어 AGENTS.md의 "공원과 독서 등급을 교환 가능한 숫자로 비교 금지"에 걸린다.

**`_relative_position.js`는 이번 작업에서 건드리지 않는다.** 착수 전 두 목록을 실제로 비교한 결과, 통합이 이 기능의 범위를 넘어선다:

- `_relative_position.js`의 지표 20개 중 **9개가 같은 뜻을 다른 id로 쓴다** (`route_distance_m`↔`nearest_park_m`, `green`↔`green_ratio`, `academy`↔`academies_500m`, `library`↔`libraries_walk`, `library_distance_m`↔`nearest_public_library_m`, `shared_area_per_student`↔`shared_park_m2_per_student`, `forecast_change_pct`↔`forecast_change_pct_2031`, `books_staff`↔`librarians`, `parks`↔`parks_walk`).
- 더 심각한 것: **`paps`는 id가 같은데 정의가 반대다.** `_school_table.js`는 `PAPS 체력 1·2등급 비율`, `_relative_position.js`는 `PAPS 4·5등급 비율`로 라벨링한다. 어느 쪽이 맞는지는 원자료 확인이 필요한 **별도 정합성 조사**다.
- 두 모듈은 읽는 경로도 다르다. `_relative_position.js`는 학교별 `observations`를 직접 읽고, `_school_table.js`는 여러 파일을 조인한다.

따라서 이번 작업은 `COLUMNS`에 `domain`·`direction`을 **추가만** 하고, 프로필은 `_school_table.js` 위에서만 만든다. 통합과 `paps` 정의 충돌은 후속 과제로 §9에 남긴다.

### 3.2 영역(domain) 구성

| id | 이름 | 컬럼 |
|---|---|---|
| `designation` | 지정·지원사업 | designations_current, designation_names |
| `park` | 공원·야외 | parks_walk, green_ratio, nearest_park_m, park_route_m, park_detour_ratio, playgrounds_walk, shared_park_m2_per_student, park_sharing_schools, park_case |
| `reading` | 도서·독서 | books_total, books_per_student, library_seats, librarians, libraries_walk, nearest_public_library_m |
| `academy` | 학원 | academies_500m, academies_per_km2 |
| `safety` | 안전 환경 | nightlife_500m, nightlife_nearest_m, construction_500m, child_accident_nearest_m |
| `boundary` | 도보권·학구도 | walk_area_m2, walk_area_ratio_to_circle, zone_area_m2, zone_walk_mismatch_pct, zone_outside_walk_pct, walk_outside_zone_pct |
| `trend` | 학생 추세 | students_2020, student_change_pct, sen_slope, forecast_2029, forecast_2031, forecast_change_pct_2031 |
| `school` | 학생·교원 | students, classes, teachers, class_size, students_per_teacher, paps, afterschool, clubs |
| `development` | 주변 개발 | large_apt_500m, large_apt_households_500m, redev_active |

### 3.3 새 모듈 `api/_school_profile.js`

`profile(schoolId)` → 영역별로 묶인 지표 배열. 지표마다:

```
{ column, label, unit, direction, value, year,
  overall: { n, percentile, rank, median, mean, min, max },
  gu:      { name, n, percentile|null, rank, mean },
  missing: null | { reason, detail } }
```

**백분위 정의 (패널 전용, 챗봇과 다름)**

```
percentile = 100 × (값이 더 작은 학교 수 + 0.5 × 동점 학교 수) / n
```

값이 클수록 백분위가 크다. 방향과 무관하게 고정이다.

`_relative_position.js`의 백분위는 질문 방향에 따라 `이 값 이상` 또는 `이 값 이하` 학교 비율로 계산되어 **같은 학교·같은 지표라도 숫자가 다르다.** 두 화면이 충돌하지 않도록:

- 패널·통계 탭 라벨: `백분위 (값이 큰 쪽)`
- 챗봇 답변 라벨: 기존 문구 유지 (`이 값 이상 학교 비율`)
- 두 모듈이 같은 함수를 공유하지 않는다. 회귀 테스트로 정의가 섞이지 않는 것을 확인한다.

**비교 모집단**

- 항상 **같은 학교급** 안에서만 비교한다 (초등학교는 초등학교끼리).
- 강화·옹진 도서지역은 `_relative_position.js`의 기존 규칙대로 분리한다. 도서지역 학교는 도서지역 안에서, 육지 학교는 육지 안에서 순위를 매기고 패널에 어느 모집단인지 표시한다.
- 결측은 모집단 `n`에서 제외하며 0으로 취급하지 않는다.

**표본이 작은 군·구**

43개 (군·구 × 학교급) 조합 중 10개가 10개교 미만이다: 검단구 중학교 1, 동구 중학교 3, 동구 고등학교 3, 옹진군 중학교 5, 옹진군 고등학교 5, 동구 초등학교 8, 강화군 고등학교 8, 강화군 중학교 9, 옹진군 유치원 9, `gu=null` 고등학교 1.

`n < 10`이면 `gu.percentile = null`로 두고 화면에는 순위만 쓴다 (`8개교 중 3위`). 백분위 12.5% 같은 숫자는 표본을 오해하게 만든다.

`gu`가 null인 고등학교 1곳은 구 비교에서 제외하고 미확보 목록에 올린다.

**미확보 사유 구분**

| reason | 뜻 | 예 |
|---|---|---|
| `not_collected` | 수집 범위 밖 | 착공신고 (계양·미추홀·연수 외 7개 구) |
| `level_not_covered` | 해당 학교급 미산출 | 중·고 학교도서관 장서 |
| `not_applicable` | 해당 없음 | 유치원 학구도, 유치원 교원 수 |
| `no_source` | 원자료 자체 없음 | 유치원 학구도 경계 |

`미확보`는 `0`과 절대 같은 칸에 들어가지 않는다.

## 4. API

### `GET /api/school-profile?id=<학교ID>`

위 프로필 + 학교 기본정보 + 출처(파일 경로·sha256·공개 원문 URL) + 학교별로 실제 달라지는 확인 조건.

### `GET /api/domain-stats?domain=<id>&level=<학교급>&school=<학교ID?>`

영역 1개의 전체 분포. 지표마다 히스토그램 구간, 군·구별 평균·중앙값·개교 수, 커버리지(확보/미확보 개교 수와 사유별 내역). `school`을 주면 그 학교의 위치를 표시용으로 함께 반환한다.

두 API 모두 `_school_table.js`의 mtime 캐시를 그대로 타며 자체 캐시를 두지 않는다.

## 5. 지도 하단 패널

현재 `index.html`의 `선택 학교` 섹션(`#summary`)을 다음으로 바꾼다.

### 5.1 제거하는 것

실제 출력을 확인한 결과:

- **확인된 사실 3줄** (재학생 / 도보권 공원 / 녹지비율) — 새 패널이 모두 포함하고 더 많이 보여준다. 중복.
- **검토할 선택지** — 갑룡초등학교와 간석유치원의 값이 전혀 다른데 출력 문구가 글자 하나까지 같다 (`기존 공원과 연결 검토` / `학교 활동공간 보완 검토`). 학교별 정보량이 없고 판단만 복잡하게 한다.

### 5.2 남기는 것

**더 확인할 조건** — 학교마다 실제로 달라지는 항목만 남긴다 (도서지역 여부, 미확보 영역이 있는 경우 그 사유 등). 모든 학교에 동일하게 붙는 고정 문구는 접힌 `분석의 한계`로 옮긴다. AGENTS.md가 요구하는 판단 보류 장치이므로 없애지 않는다.

### 5.3 새 구성

1. **레이더 한 장** — 아래 5.4
2. **영역 카드 9개** (접이식) — 카드마다 지표 한 줄씩:
   `지표명 · 절대값(단위) · 백분위 막대 · 구 평균 눈금 · n개교 중 k위`
   미확보 지표는 막대 없이 `미확보 · <사유>`
   카드 우측 `이 영역 전체 통계 →` (통계 탭으로 이동, 해당 영역 선택 상태)
3. **더 확인할 조건** (압축)
4. **출처** (접힘, 기존 형식 유지)

### 5.4 레이더

- **축 = 각 영역의 대표 지표 1개.** 영역 안 지표를 합치지 않는다 (합치면 영역 점수가 되어 금지 규칙에 걸린다).
- 대표 지표는 영역별 우선순위 목록에서 **해당 학교급에 값이 있는 첫 번째**를 고른다. 사용자가 카드에서 다른 지표로 바꿀 수 있다.
- 기본 대표 지표: designation→designations_current, park→green_ratio, reading→books_per_student, academy→academies_per_km2, safety→child_accident_nearest_m, boundary→zone_walk_mismatch_pct, trend→forecast_change_pct_2031, school→class_size, development→large_apt_500m
- 반지름 = 백분위 (바깥쪽 = 값이 큼). 축마다 `많을수록 유리 ↑ / 불리 ↓ / 판단 필요 ·` 표시를 붙이고 방향으로 값을 뒤집지 않는다.
- 토글 2개: `군·구 기준` / `인천 전체 기준`
- 미확보 축은 0이 아니라 **끊어진 축**(점선, 값 없음)으로 그린다.
- 차트 아래 고정 문구: `모양 비교용이며 순위·종합점수가 아닙니다. 축마다 단위와 성격이 다릅니다.`

**규칙 예외 기록**: AGENTS.md는 서로 다른 성격의 지표를 교환 가능한 숫자로 비교하지 말 것을 요구한다. 레이더는 이 규칙과 부분적으로 충돌하며, 사용자가 충돌을 확인한 뒤 2026-09-13에 명시적으로 선택했다. 위의 완화 장치(영역 합산 없음, 방향 미반전, 끊어진 축, 고정 고지)를 함께 구현하는 조건으로 둔다. AGENTS.md에 이 예외를 기록한다.

## 6. 영역별 통계 탭

기존 탭(01 학교 찾기 / 02 자료에 묻기 / 03 검토 기록 / 04 저장된 대화)에 **`05 영역별 통계`** 를 추가한다.

- 영역 선택 → 학교급 선택
- 지표마다: 분포 히스토그램(선택 학교 위치 ★ 표시), 군·구별 평균 비교 막대, 커버리지 표(확보 개교 / 미확보 개교 + 사유)
- 도서지역은 별도 구간으로 분리 표시
- 차트는 **인라인 SVG**. 이 앱은 CDN 스크립트를 쓰지 않으며 `assets/vendor`에 차트 라이브러리가 없다.

### 5.5 소비자 확인 (실측)

`/api/school-summary`의 `facts`·`options`를 **실제로 그리는 곳은 `assets/simple-app.js:14` 한 곳뿐이다.** 다른 모듈은 응답 전체를 통째로 넘길 뿐 개별 키를 읽지 않는다. 따라서 응답에서 두 키를 제거하는 변경은 국소적이다.

단, `assets/hitl-workspace.js:44`가 `observation: current`로 **요약 응답 객체 전체를 검토 기록에 직렬화**한다. 새 프로필이 `current`에 들어가야 검토 기록에 지표 프로필이 함께 남는다. 반대로 제거한 키가 과거 기록에 남아 있을 수 있으므로, 저장된 기록을 다시 불러올 때 없는 키를 참조하지 않도록 한다 (`tests/test_observation_restore.cjs` 범위).

`model.summary()`를 fetch 스텁으로 쓰는 테스트가 여러 개다 (`test_simple_app`, `test_school_map`, `test_chat_agent_ui`, `test_saved_conversations`, `test_hitl_workspace`, `test_relative_position`, `verify_simple_http` 등). 응답 형태를 바꾸면 이들이 함께 영향을 받는다.

## 7. 파일

| 파일 | 변경 |
|---|---|
| `api/_school_table.js` | COLUMNS에 domain·direction 추가 |
| `api/_school_profile.js` | 신규 — 프로필·영역 통계 계산 |
| `api/school-profile.js` | 신규 — GET 핸들러 |
| `api/domain-stats.js` | 신규 — GET 핸들러 |
| `api/_school_summary.js` | facts·options 제거, conditions 축소 |
| `assets/school-profile.js` | 신규 — 패널 렌더 + 레이더/막대 SVG |
| `assets/domain-stats.js` | 신규 — 통계 탭 |
| `assets/simple-app.css` | 패널·차트 스타일 |
| `index.html` | 하단 섹션 교체, 05 탭 추가 |
| `server.js`, `vercel.json` | 새 라우트 2개 |

## 8. 검증

기존: `npm run test:simple`, `npm run test:analysis`가 3카드 구조를 검증하므로 함께 수정한다.

신규 회귀 테스트 `tests/test_school_profile.cjs`:

1. 미확보가 0으로 새지 않는다 — 유치원의 학구도·장서 지표가 `value:0`이 아니라 `missing.reason`을 갖는다
2. 종합점수가 생기지 않는다 — 응답 어디에도 영역 점수·총점·가중합 키가 없다
3. 표본 10개 미만 군·구는 `gu.percentile === null`이고 순위만 있다 (검단구 중학교 n=1로 확인)
4. 도서지역 분리 — 강화군 학교의 `overall.n`이 육지 모집단과 다르다
5. 백분위 정의가 고정이다 — 같은 학교·지표를 두 번 호출해도 같고, `direction`을 바꿔도 백분위가 바뀌지 않는다
6. 레이더 축 데이터에 미확보 축이 `null`로 들어간다 (0 아님)
7. 전 학교급(유치원·초·중·고) 각 1곳에서 프로필이 예외 없이 생성된다

`npm run test:profile`로 등록하고 `test:simple`에 포함한다.

## 9. 후속 과제 (이번 범위 밖)

- **`paps` 정의 충돌** — `_school_table.js`는 `1·2등급 비율`, `_relative_position.js`는 `4·5등급 비율`로 같은 id를 반대로 라벨링한다. 원자료로 어느 쪽이 맞는지 확인하고 한쪽을 고쳐야 한다. 확인 전까지 패널은 `_school_table.js`의 라벨을 그대로 쓰되, 이 지표를 레이더 대표 지표로 쓰지 않는다.
- **지표 사전 통합** — 두 모듈의 중복 9건을 한 사전으로 합치는 별도 리팩터링. 착수 시 `npm run test:relative`로 질문 매칭 회귀를 확인한다.
- `gu`가 null인 고등학교 1곳의 원인 — 미확보 목록에서 추적
