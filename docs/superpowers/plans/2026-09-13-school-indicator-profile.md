# 학교 지표 프로필 패널 · 영역별 통계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도에서 학교를 선택하면 영역별 지표를 절대값과 상대 위치(군·구 기준 / 인천 전체 기준)로 하단 패널에 보여주고, 영역별 전체 분포를 별도 탭에서 확인한다.

**Architecture:** 이미 계산된 `api/_school_table.js`(917교 × 50열) 위에 계산 계층 3개(`_indicator_stats` → `_school_profile` / `_domain_stats`)를 얹고, HTTP 핸들러 2개와 브라우저 렌더 모듈 3개를 붙인다. 새 데이터 수집도, 새 원자료 파일도 없다.

**Tech Stack:** Node.js (의존성 없는 CommonJS 모듈), 브라우저 바닐라 JS 전역 객체, 인라인 SVG 차트, 테스트는 `node:assert/strict` + jsdom

**Spec:** `docs/superpowers/specs/2026-09-13-school-indicator-profile-design.md`

## Global Constraints

- **종합점수·가중합 순위를 만들지 않는다.** 영역 점수, 총점, 가중치 키를 어떤 응답에도 넣지 않는다 (AGENTS.md 필수 규칙).
- **미확보는 0이 아니다.** 값이 없으면 `value:null` + `missing:{reason,detail}`이며, 숫자 0과 같은 칸에 넣지 않는다.
- **백분위 정의는 고정이다:** `100 × (값이 더 작은 학교 수 + 0.5 × 동점 학교 수) / n`. 값이 클수록 크다. `direction`으로 뒤집지 않는다. 화면 라벨은 `백분위 (값이 큰 쪽)`.
- **비교 모집단은 항상 같은 학교급이며, 강화·옹진 도서지역과 육지를 분리한다.** 결측은 `n`에서 제외한다.
- **군·구 표본이 10개교 미만이면 `gu.percentile = null`** 로 두고 순위만 표시한다.
- **CDN 금지.** 외부 스크립트를 불러오지 않는다. 차트는 인라인 SVG로 직접 그린다.
- **`_relative_position.js`를 수정하지 않는다.** 지표 사전 통합과 `paps` 정의 충돌은 후속 과제다.
- **`paps`를 레이더 대표 지표로 쓰지 않는다.** 두 모듈이 정의를 반대로 갖고 있어 확인 전까지 보류한다.
- 모든 사용자 문구는 한국어다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `api/_school_table.js` (수정) | 컬럼 사전에 `domain`·`direction` 추가. 계산 로직은 건드리지 않음 |
| `api/_indicator_stats.js` (신규) | 모집단 구성·백분위·순위. 순수 계산, 학교 1곳을 모름 |
| `api/_school_profile.js` (신규) | 학교 1곳 → 영역별 지표 프로필 + 레이더 축 + 미확보 사유 |
| `api/_domain_stats.js` (신규) | 영역 1개 → 분포·군구별 비교·커버리지 |
| `api/school-profile.js` (신규) | GET 핸들러 |
| `api/domain-stats.js` (신규) | GET 핸들러 |
| `api/_school_summary.js` (수정) | `facts`·`options` 제거, `conditions`를 학교별 가변분만 남기고 `limits` 분리 |
| `assets/indicator-charts.js` (신규) | SVG 백분위 막대 · 히스토그램 · 레이더. 순수 문자열 반환 |
| `assets/school-profile.js` (신규) | 하단 패널 렌더 |
| `assets/domain-stats.js` (신규) | 05 영역별 통계 탭 렌더 |
| `assets/simple-app.js` (수정) | 패널 렌더 위임, `facts`/`options` 참조 제거 |
| `assets/simple-app.css` (수정) | 패널·차트 스타일 |
| `index.html` (수정) | 하단 섹션 교체, 05 탭 추가 |
| `server.js`, `vercel.json` (수정) | 라우트 2개 |
| `AGENTS.md`, `README.md` (수정) | 레이더 규칙 예외 기록, 수정 요약 |

## 테스트에 쓰는 실제 학교 (실측 확인 완료)

| 용도 | ID | 이름 |
|---|---|---|
| 초등·육지 | `B000002949` | 인천신흥초등학교 (중구) |
| 유치원 | `KLOCAL-000e957d3ab6431c` | 근산유치원 (부평구) |
| 도서지역 | `B000003173` | 길상초등학교 (강화군) |
| 소표본 군·구 (중학교 n=1) | `B000030928` | 인천검단가온중학교 (검단구) |
| `gu` 결측 | `B000025679` | 인천운남고등학교 |

근산유치원 실측: `green_ratio=6.2`, `books_per_student=null`, `zone_walk_mismatch_pct=null`, `designations_current=null`

---

### Task 1: 컬럼 사전에 영역과 방향 추가

**Files:**
- Modify: `api/_school_table.js` (COLUMNS 정의 블록)
- Test: `tests/test_indicator_dictionary.cjs`

**Interfaces:**
- Consumes: 없음
- Produces: `COLUMNS[col].domain` (문자열 9종), `COLUMNS[col].direction` (`'up'|'down'|'neutral'`), `table.DOMAINS` (순서 있는 `[{id,label}]`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_indicator_dictionary.cjs`:

```js
const assert=require('node:assert/strict'),table=require('../api/_school_table');
const DOMAIN_IDS=table.DOMAINS.map(d=>d.id);
assert.deepEqual(DOMAIN_IDS,['designation','park','reading','academy','safety','boundary','trend','school','development']);
// 기본 4열(name/level/gu/island)을 뺀 모든 컬럼이 영역과 방향을 갖는다
for(const [id,c] of Object.entries(table.COLUMNS)){
 if(['name','level','gu','island'].includes(id))continue;
 assert(DOMAIN_IDS.includes(c.domain),`${id}: domain 없음 또는 알 수 없는 값 (${c.domain})`);
 assert(['up','down','neutral'].includes(c.direction),`${id}: direction 없음 (${c.direction})`);
}
// 방향 표본: 거리는 멀수록 유리·불리가 갈리고, 학원은 정책 판단이라 중립이다
assert.equal(table.COLUMNS.green_ratio.direction,'up');
assert.equal(table.COLUMNS.nearest_park_m.direction,'down');
assert.equal(table.COLUMNS.nearest_public_library_m.direction,'down');
assert.equal(table.COLUMNS.child_accident_nearest_m.direction,'up');
assert.equal(table.COLUMNS.nightlife_500m.direction,'down');
assert.equal(table.COLUMNS.academies_500m.direction,'neutral');
assert.equal(table.COLUMNS.class_size.direction,'neutral');
assert.equal(table.COLUMNS.zone_walk_mismatch_pct.direction,'down');
// 영역 배정 표본
assert.equal(table.COLUMNS.books_per_student.domain,'reading');
assert.equal(table.COLUMNS.designations_current.domain,'designation');
assert.equal(table.COLUMNS.construction_500m.domain,'safety');
assert.equal(table.COLUMNS.large_apt_500m.domain,'development');
console.log('test_indicator_dictionary: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_indicator_dictionary.cjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'map')` (`table.DOMAINS` 없음)

- [ ] **Step 3: 구현**

`api/_school_table.js`의 `const COLUMNS={...}` 바로 위에 추가:

```js
// 영역(domain): 패널 카드와 통계 탭의 묶음 단위. direction: 값이 클수록 유리(up)·불리(down)·정책 판단 필요(neutral).
// direction은 표시용 주석이며 백분위를 뒤집지 않는다 (뒤집으면 그 자체가 평가등급이 된다).
const DOMAINS=[{id:'designation',label:'지정·지원사업'},{id:'park',label:'공원·야외'},{id:'reading',label:'도서·독서'},{id:'academy',label:'학원'},{id:'safety',label:'안전 환경'},{id:'boundary',label:'도보권·학구도'},{id:'trend',label:'학생 추세'},{id:'school',label:'학생·교원'},{id:'development',label:'주변 개발'}];
const DOMAIN_OF={designation:['designations_current','designation_names'],park:['parks_walk','green_ratio','nearest_park_m','park_route_m','park_detour_ratio','playgrounds_walk','shared_park_m2_per_student','park_sharing_schools','park_case'],reading:['books_total','books_per_student','library_seats','librarians','libraries_walk','nearest_public_library_m'],academy:['academies_500m','academies_per_km2'],safety:['nightlife_500m','nightlife_nearest_m','construction_500m','child_accident_nearest_m'],boundary:['walk_area_m2','walk_area_ratio_to_circle','zone_area_m2','zone_walk_mismatch_pct','zone_outside_walk_pct','walk_outside_zone_pct'],trend:['students_2020','student_change_pct','sen_slope','forecast_2029','forecast_2031','forecast_change_pct_2031'],school:['students','classes','teachers','class_size','students_per_teacher','paps','afterschool','clubs'],development:['large_apt_500m','large_apt_households_500m','redev_active']};
// 값이 클수록 유리한 것과 불리한 것만 적고, 나머지는 neutral로 둔다.
const UP=['green_ratio','parks_walk','playgrounds_walk','shared_park_m2_per_student','books_total','books_per_student','library_seats','librarians','libraries_walk','walk_area_m2','walk_area_ratio_to_circle','nightlife_nearest_m','child_accident_nearest_m','afterschool','clubs','teachers'];
const DOWN=['nearest_park_m','park_route_m','park_detour_ratio','park_sharing_schools','nearest_public_library_m','nightlife_500m','construction_500m','zone_walk_mismatch_pct','zone_outside_walk_pct','walk_outside_zone_pct','students_per_teacher'];
```

`COLUMNS` 정의 **다음 줄**에 사전을 채우는 코드를 넣는다 (COLUMNS 리터럴을 손으로 고치지 않는다 — 50줄을 다시 쓰면 오타가 난다):

```js
for(const [domain,cols] of Object.entries(DOMAIN_OF))for(const c of cols)if(COLUMNS[c])COLUMNS[c].domain=domain;
for(const c of Object.keys(COLUMNS)){if(['name','level','gu','island'].includes(c))continue;COLUMNS[c].direction=UP.includes(c)?'up':DOWN.includes(c)?'down':'neutral';}
```

`module.exports`에 `DOMAINS`를 추가한다:

```js
module.exports={build,COLUMNS,DOMAINS,dictionary,numericColumns,label,unit,sourceFor,FILES,PUBLIC,COLUMN_SOURCE};
```

- [ ] **Step 4: 통과 확인**

Run: `node tests/test_indicator_dictionary.cjs`
Expected: `test_indicator_dictionary: OK`

- [ ] **Step 5: 기존 회귀 확인**

Run: `npm run test:analysis && npm run test:agent`
Expected: 모두 통과. `dictionary()`가 LLM 프롬프트에 쓰이므로 문구가 깨지지 않았는지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add api/_school_table.js tests/test_indicator_dictionary.cjs
git commit -m "feat(table): 컬럼 사전에 영역·방향 추가"
```

---

### Task 2: 상대 위치 계산 모듈

**Files:**
- Create: `api/_indicator_stats.js`
- Test: `tests/test_indicator_stats.cjs`

**Interfaces:**
- Consumes: `table.build()`, `table.COLUMNS`
- Produces:
  - `population(column, level, {island})` → `{n, values, mean, median, min, max}` (`values`는 오름차순 숫자 배열)
  - `guPopulation(column, level, gu)` → 같은 형태
  - `summarize(sortedValues)` → 같은 형태
  - `percentile(values, v)` → `number|null`
  - `rank(values, v)` → `number|null` (1 = 가장 큰 값, 동점 같은 순위)
  - `isIsland(gu)` → `boolean`
  - `MIN_GU_N` → `10`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_indicator_stats.cjs`:

```js
const assert=require('node:assert/strict'),s=require('../api/_indicator_stats');
// 백분위: 값이 클수록 크다. 동점은 절반씩 나눈다.
assert.equal(s.percentile([1,2,3,4],4),87.5);
assert.equal(s.percentile([1,2,3,4],1),12.5);
assert.equal(s.percentile([5,5,5,5],5),50);
assert.equal(s.percentile([],3),null);
// 순위: 1 = 가장 큰 값, 동점은 같은 순위
assert.equal(s.rank([1,2,3,4],4),1);
assert.equal(s.rank([1,2,3,4],1),4);
assert.equal(s.rank([3,3,1],3),1);
assert.equal(s.rank([3,3,1],1),3);
// 모집단: 같은 학교급 + 같은 육지/도서 구분, 결측 제외
const main=s.population('green_ratio','초등학교',{island:false});
const isl=s.population('green_ratio','초등학교',{island:true});
assert.equal(main.n+isl.n,272,'초등 272교가 육지·도서로 나뉜다');
assert(isl.n>0&&main.n>isl.n);
assert.equal(main.values.length,main.n);
assert(main.values.every((v,i)=>i===0||v>=main.values[i-1]),'오름차순');
// 결측을 0으로 세지 않는다: 유치원 장서는 전부 결측
assert.equal(s.population('books_per_student','유치원',{island:false}).n,0);
assert.equal(s.population('books_per_student','유치원',{island:false}).mean,null);
// 군·구 모집단
assert.equal(s.guPopulation('class_size','중학교','검단구').n,1,'검단구 중학교는 1개교');
assert(s.guPopulation('class_size','초등학교','남동구').n>=30);
assert.equal(s.guPopulation('class_size','초등학교',null).n,0,'구가 없으면 빈 모집단');
assert.equal(s.MIN_GU_N,10);
assert.equal(s.isIsland('강화군'),true);
assert.equal(s.isIsland('옹진군'),true);
assert.equal(s.isIsland('부평구'),false);
assert.equal(s.isIsland(null),false);
console.log('test_indicator_stats: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_indicator_stats.cjs`
Expected: FAIL — `Cannot find module '../api/_indicator_stats'`

- [ ] **Step 3: 구현**

`api/_indicator_stats.js`:

```js
'use strict';
// 지표 하나의 상대 위치. 모집단은 언제나 "같은 학교급 + 같은 육지/도서 구분"이며 결측은 제외한다(0이 아니다).
// 백분위는 방향과 무관하게 고정이다: 값이 클수록 크다. _relative_position.js의 질문 방향 백분위와 다른 값이다.
const table=require('./_school_table');
const ISLAND_GU=['강화군','옹진군'],MIN_GU_N=10;
const finite=Number.isFinite;
const isIsland=gu=>ISLAND_GU.includes(gu||'');
const round=(v,d=1)=>finite(v)?Number(v.toFixed(d)):null;
function summarize(values){
 const n=values.length;
 if(!n)return {n:0,values:[],mean:null,median:null,min:null,max:null};
 const mid=n/2,median=n%2?values[(n-1)/2]:(values[mid-1]+values[mid])/2;
 return {n,values,mean:round(values.reduce((a,b)=>a+b,0)/n,2),median:round(median,2),min:values[0],max:values[n-1]};
}
function collect(filter,column){return summarize(table.build().rows.filter(r=>filter(r)&&finite(r[column])).map(r=>r[column]).sort((a,b)=>a-b));}
function population(column,level,opts={}){const island=!!opts.island;return collect(r=>r.level===level&&isIsland(r.gu)===island,column);}
function guPopulation(column,level,gu){if(!gu)return summarize([]);return collect(r=>r.level===level&&r.gu===gu,column);}
function percentile(values,v){
 if(!values.length||!finite(v))return null;
 let below=0,ties=0;
 for(const x of values){if(x<v)below++;else if(x===v)ties++;}
 return round(100*(below+0.5*ties)/values.length,1);
}
function rank(values,v){
 if(!values.length||!finite(v))return null;
 let above=0;for(const x of values)if(x>v)above++;
 return above+1;
}
module.exports={population,guPopulation,percentile,rank,summarize,isIsland,ISLAND_GU,MIN_GU_N};
```

- [ ] **Step 4: 통과 확인**

Run: `node tests/test_indicator_stats.cjs`
Expected: `test_indicator_stats: OK`

- [ ] **Step 5: 커밋**

```bash
git add api/_indicator_stats.js tests/test_indicator_stats.cjs
git commit -m "feat(api): 지표 상대 위치 계산 모듈 - 고정 백분위·도서지역 분리"
```

---

### Task 3: 학교 프로필 모듈

**Files:**
- Create: `api/_school_profile.js`
- Test: `tests/test_school_profile.cjs`

**Interfaces:**
- Consumes: Task 1의 `table.DOMAINS`·`COLUMNS[col].domain/direction`, Task 2의 `_indicator_stats`
- Produces:
  - `profile(schoolId)` →
    ```
    {school:{id,name,level,gu,island}, track:'general'|'island', data_year,
     domains:[{id,label,indicators:[Indicator]}],
     radar:{axes:[Axis]},
     coverage:{available,missing}, sources:[{key,path,sha256,title}], originals:[{url,title,provider}]}
    ```
  - `Indicator` = `{column,label,unit,direction,note,value,text,overall,gu,missing}`
    - `overall` = `{n,percentile,rank,mean,median,min,max}` 또는 `null`
    - `gu` = `{name,n,percentile,rank,mean}` 또는 `null`
    - `missing` = `null` 또는 `{reason,detail}`, `reason`은 `'not_applicable'|'no_source'|'level_not_covered'|'not_collected'`
  - `Axis` = `{domain,domain_label,column,label,unit,direction,value,percentile_overall,percentile_gu,missing}`
  - `indicator(column, row)` — Task 4가 커버리지 사유를 셀 때 재사용한다
  - `RADAR_PRIORITY` — Task 9가 같은 대표 지표를 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_school_profile.cjs`:

```js
const assert=require('node:assert/strict'),p=require('../api/_school_profile'),stats=require('../api/_indicator_stats');
const flat=pr=>pr.domains.flatMap(d=>d.indicators);
const get=(pr,col)=>flat(pr).find(i=>i.column===col);

// 1) 전 학교급에서 예외 없이 생성된다
const ids={초등:'B000002949',유치원:'KLOCAL-000e957d3ab6431c',도서:'B000003173',소표본:'B000030928',구없음:'B000025679'};
const profiles={};for(const [k,id] of Object.entries(ids))profiles[k]=p.profile(id);
for(const [k,pr] of Object.entries(profiles)){
 assert.equal(pr.domains.length,9,k+': 영역 9개');
 assert(pr.school.name,k+': 학교명');
 assert(flat(pr).length>30,k+': 지표가 채워진다');
}

// 2) 미확보가 0으로 새지 않는다
const kg=profiles.유치원;
for(const col of ['books_per_student','zone_walk_mismatch_pct','designations_current']){
 const ind=get(kg,col);
 assert.equal(ind.value,null,col+': 값이 null');
 assert(ind.missing,col+': missing 사유가 있다');
 assert(['not_applicable','no_source','level_not_covered','not_collected'].includes(ind.missing.reason),col+': 사유 enum');
 assert(ind.missing.detail&&ind.missing.detail.length>2,col+': 사람이 읽는 사유');
 assert.equal(ind.overall,null,col+': 미확보에 상대 위치를 만들지 않는다');
}
assert.equal(get(kg,'zone_walk_mismatch_pct').missing.reason,'no_source','유치원 학구도는 원자료 자체가 없다');
assert.equal(get(kg,'teachers').missing.reason,'not_applicable','유치원 교원 수는 공시 항목이 다르다');
assert.equal(get(kg,'books_per_student').missing.reason,'level_not_covered','중·고·유치원 장서는 미산출');
// 값이 있는 지표는 정상
assert.equal(get(kg,'green_ratio').value,6.2);
assert(get(kg,'green_ratio').overall.n>0);

// 3) 종합점수를 만들지 않는다
const blob=JSON.stringify(profiles.초등);
for(const bad of ['"score"','"total_score"','"composite"','"weight"','"weighted"','종합점수','우선순위점수'])assert(!blob.includes(bad),'금지 키 발견: '+bad);
for(const d of profiles.초등.domains)assert(!('score' in d)&&!('grade' in d),'영역 점수를 만들지 않는다');

// 4) 소표본 군·구는 백분위를 숨기고 순위만 쓴다
const small=get(profiles.소표본,'class_size');
assert.equal(small.gu.n,1,'검단구 중학교 n=1');
assert.equal(small.gu.percentile,null,'표본 10 미만은 백분위 없음');
assert.equal(small.gu.rank,1,'순위는 남긴다');
const big=get(profiles.초등,'class_size');
assert(big.gu.n>=10&&typeof big.gu.percentile==='number','표본이 충분하면 백분위가 있다');

// 5) 도서지역은 분리된 모집단을 쓴다
const island=profiles.도서,main=profiles.초등;
assert.equal(island.track,'island');
assert.equal(main.track,'general');
assert(get(island,'green_ratio').overall.n<get(main,'green_ratio').overall.n,'도서 모집단이 더 작다');
assert.equal(get(island,'green_ratio').overall.n+get(main,'green_ratio').overall.n,272);

// 6) 백분위 정의가 고정이다 — 두 번 불러도 같고 direction과 무관하다
assert.deepEqual(p.profile(ids.초등).radar,profiles.초등.radar);
for(const i of flat(main).filter(i=>i.overall&&i.direction!=='neutral')){
 const expected=stats.percentile(stats.population(i.column,'초등학교',{island:false}).values,i.value);
 assert.equal(i.overall.percentile,expected,i.column+': 방향과 무관한 고정 백분위');
}

// 7) 레이더 축: 영역당 1개, 미확보는 null, paps는 쓰지 않는다
const r=profiles.초등.radar;
assert.equal(r.axes.length,9,'영역당 축 1개');
assert.equal(new Set(r.axes.map(a=>a.domain)).size,9);
assert(!r.axes.some(a=>a.column==='paps'),'paps는 정의 충돌로 대표 지표에서 제외');
const kgMissing=profiles.유치원.radar.axes.filter(a=>a.missing);
assert(kgMissing.length>0,'유치원은 미확보 축이 있다');
for(const a of kgMissing){assert.equal(a.percentile_overall,null,'미확보 축은 0이 아니라 null');assert.equal(a.value,null);}

// 8) gu가 없는 학교는 구 비교를 하지 않는다
assert.equal(profiles.구없음.school.gu,null);
assert.equal(get(profiles.구없음,'class_size').gu,null,'구 비교 없음');
assert(get(profiles.구없음,'class_size').overall,'전체 비교는 그대로');

// 9) 출처가 붙는다
assert(profiles.초등.sources.length>0);
assert(profiles.초등.sources.every(s=>s.path&&s.sha256));

// 10) 없는 학교는 한국어 오류
assert.throws(()=>p.profile('없는ID'),/원장/);
console.log('test_school_profile: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_school_profile.cjs`
Expected: FAIL — `Cannot find module '../api/_school_profile'`

- [ ] **Step 3: 구현**

`api/_school_profile.js`:

```js
'use strict';
// 학교 1곳의 영역별 지표 프로필. 절대값 + 같은 학교급 안에서의 상대 위치(전체 / 군·구).
// 종합점수·영역 점수를 만들지 않는다. 미확보는 값이 아니라 사유로 남긴다.
const table=require('./_school_table'),stats=require('./_indicator_stats'),publicSources=require('./_public_sources');
const finite=Number.isFinite;
// 레이더 대표 지표: 영역마다 해당 학교급에 값이 있는 첫 번째를 고른다. paps는 정의 충돌(스펙 §9)로 제외한다.
const RADAR_PRIORITY={designation:['designations_current'],park:['green_ratio','parks_walk','nearest_park_m'],reading:['books_per_student','nearest_public_library_m','libraries_walk'],academy:['academies_per_km2','academies_500m'],safety:['child_accident_nearest_m','nightlife_500m','construction_500m'],boundary:['zone_walk_mismatch_pct','walk_area_ratio_to_circle'],trend:['forecast_change_pct_2031','student_change_pct','sen_slope'],school:['class_size','students','students_per_teacher'],development:['large_apt_500m','redev_active']};
// 공시 항목 자체가 달라 해당 없는 것
const NOT_APPLICABLE={유치원:['teachers','students_per_teacher','paps','afterschool','clubs']};
// 원자료가 존재하지 않는 것 (수집으로 채울 수 없음)
const NO_SOURCE={유치원:['zone_area_m2','zone_walk_mismatch_pct','zone_outside_walk_pct','walk_outside_zone_pct']};
const LEVELS=['유치원','초등학교','중학교','고등학교'];
const BASE_COLUMNS=['name','level','gu','island'];
function levelsWith(column){const cov=table.build().coverage[column]||{};return LEVELS.filter(l=>(cov[l]||0)>0);}
function missingFor(column,level){
 if((NOT_APPLICABLE[level]||[]).includes(column))return {reason:'not_applicable',detail:level+' 공시 항목에 없는 지표입니다.'};
 if((NO_SOURCE[level]||[]).includes(column))return {reason:'no_source',detail:'원자료에 '+level+' 경계가 없습니다. 수집으로 채울 수 없습니다.'};
 const have=levelsWith(column);
 if(!have.includes(level))return {reason:'level_not_covered',detail:have.length?have.join('·')+'만 산출되어 있습니다.':'아직 산출되지 않은 지표입니다.'};
 if(column==='construction_500m')return {reason:'not_collected',detail:'계양구·미추홀구·연수구만 수집되어 이 학교의 구는 자료가 없습니다.'};
 return {reason:'not_collected',detail:'이 학교의 값이 원자료에 없습니다.'};
}
function indicator(column,row){
 const c=table.COLUMNS[column],base={column,label:c.label,unit:c.unit||'',direction:c.direction,note:c.note||null};
 const raw=row[column];
 if(c.type==='text'){const has=raw!=null&&raw!=='';return {...base,value:null,text:has?String(raw):null,overall:null,gu:null,missing:has?null:missingFor(column,row.level)};}
 if(!finite(raw))return {...base,value:null,text:null,overall:null,gu:null,missing:missingFor(column,row.level)};
 const island=stats.isIsland(row.gu);
 const all=stats.population(column,row.level,{island});
 const overall={n:all.n,percentile:stats.percentile(all.values,raw),rank:stats.rank(all.values,raw),mean:all.mean,median:all.median,min:all.min,max:all.max};
 let gu=null;
 if(row.gu){const g=stats.guPopulation(column,row.level,row.gu);gu={name:row.gu,n:g.n,percentile:g.n>=stats.MIN_GU_N?stats.percentile(g.values,raw):null,rank:stats.rank(g.values,raw),mean:g.mean};}
 return {...base,value:raw,text:null,overall,gu,missing:null};
}
function profile(id){
 const t=table.build(),row=t.byId.get(id);
 if(!row)throw Error('선택 학교를 원장에서 찾을 수 없습니다.');
 const byDomain=new Map(table.DOMAINS.map(d=>[d.id,[]]));
 for(const [col,c] of Object.entries(table.COLUMNS)){
  if(BASE_COLUMNS.includes(col)||!c.domain)continue;
  byDomain.get(c.domain).push(indicator(col,row));
 }
 const domains=table.DOMAINS.map(d=>({id:d.id,label:d.label,indicators:byDomain.get(d.id)}));
 const all=domains.flatMap(d=>d.indicators);
 const axes=table.DOMAINS.map(d=>{
  const pick=(RADAR_PRIORITY[d.id]||[]).map(col=>all.find(i=>i.column===col)).filter(Boolean);
  const chosen=pick.find(i=>i.value!=null)||pick[0]||null;
  if(!chosen)return {domain:d.id,domain_label:d.label,column:null,label:null,unit:'',direction:'neutral',value:null,percentile_overall:null,percentile_gu:null,missing:{reason:'level_not_covered',detail:'이 영역의 대표 지표가 없습니다.'}};
  return {domain:d.id,domain_label:d.label,column:chosen.column,label:chosen.label,unit:chosen.unit,direction:chosen.direction,value:chosen.value,percentile_overall:chosen.overall?chosen.overall.percentile:null,percentile_gu:chosen.gu?chosen.gu.percentile:null,missing:chosen.missing};
 });
 const keys=[...new Set(all.filter(i=>i.missing==null).map(i=>table.COLUMN_SOURCE[i.column]).filter(Boolean))];
 const sources=keys.map(k=>({key:k,...t.sources[k],title:table.PUBLIC[k]}));
 const originals=[...new Map(sources.flatMap(s=>publicSources.forFile(s.path)).map(o=>[o.url,o])).values()];
 return {school:{id:row.id,name:row.name,level:row.level,gu:row.gu,island:stats.isIsland(row.gu)},track:stats.isIsland(row.gu)?'island':'general',data_year:row.data_year??null,domains,radar:{axes},coverage:{available:all.filter(i=>i.missing==null).length,missing:all.filter(i=>i.missing!=null).length},sources,originals};
}
module.exports={profile,indicator,RADAR_PRIORITY,NOT_APPLICABLE,NO_SOURCE};
```

- [ ] **Step 4: 통과 확인**

Run: `node tests/test_school_profile.cjs`
Expected: `test_school_profile: OK`

- [ ] **Step 5: 전 학교급 훑기 (예외 없는지)**

Run:
```bash
node -e "const p=require('./api/_school_profile'),t=require('./api/_school_table');let n=0,bad=0;for(const r of t.build().rows){try{p.profile(r.id);n++}catch(e){bad++;console.log(r.id,r.name,e.message)}}console.log('성공',n,'실패',bad)"
```
Expected: `성공 917 실패 0`

- [ ] **Step 6: 커밋**

```bash
git add api/_school_profile.js tests/test_school_profile.cjs
git commit -m "feat(api): 학교 지표 프로필 - 영역별 절대값·상대위치·미확보 사유"
```

---

### Task 4: 영역 통계 모듈

**Files:**
- Create: `api/_domain_stats.js`
- Test: `tests/test_domain_stats.cjs`

**Interfaces:**
- Consumes: Task 1의 `table.DOMAINS`, Task 2의 `_indicator_stats`, Task 3의 `indicator(column,row)`
- Produces: `domainStats({domain, level, schoolId})` →
  ```
  {domain, label, level, school_id, indicators:[{
     column, label, unit, direction, note,
     overall:{n,mean,median,min,max},        // 육지 기준
     island:{n,mean,median},                  // 강화·옹진
     histogram:[{from,to,count}],
     gu:[{name,n,mean,median}],
     coverage:{available, missing:[{reason,detail,n}]},
     selected:{value,percentile,rank,track}|null}]}
  ```
  `histogram(values)`도 export 한다 (테스트용).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_domain_stats.cjs`:

```js
const assert=require('node:assert/strict'),ds=require('../api/_domain_stats');
const r=ds.domainStats({domain:'park',level:'초등학교',schoolId:'B000002949'});
assert.equal(r.domain,'park');assert.equal(r.label,'공원·야외');assert.equal(r.level,'초등학교');
const green=r.indicators.find(i=>i.column==='green_ratio');
assert(green.overall.n>0&&green.histogram.length>0);
assert.equal(green.histogram.reduce((a,b)=>a+b.count,0),green.overall.n,'히스토그램 합 = 육지 유효 학교 수');
assert(green.histogram.every(b=>b.to>=b.from));
assert(green.gu.length>=8&&green.gu.every(g=>g.n>0));
assert(green.selected&&typeof green.selected.percentile==='number','선택 학교 위치');
assert.equal(green.selected.track,'general');
assert.equal(green.island.n+green.overall.n,272,'육지 + 도서 = 초등 272');

// 텍스트 컬럼은 분포를 만들지 않는다
assert(!r.indicators.some(i=>i.column==='park_case'),'텍스트 컬럼 제외');

// 커버리지: 미확보를 사유별로 센다
const kgReading=ds.domainStats({domain:'reading',level:'유치원'});
const books=kgReading.indicators.find(i=>i.column==='books_per_student');
assert.equal(books.overall.n,0,'유치원 장서는 유효값 0');
assert.equal(books.overall.mean,null,'유효값이 없으면 평균도 없다');
assert.equal(books.coverage.available,0);
assert.equal(books.coverage.missing.reduce((a,b)=>a+b.n,0),369,'유치원 369곳 전부 미확보');
assert.equal(books.coverage.missing[0].reason,'level_not_covered');
assert.deepEqual(books.histogram,[],'유효값이 없으면 히스토그램도 없다');
assert.equal(books.selected,null,'선택 학교를 주지 않으면 null');

// 히스토그램 경계
assert.deepEqual(ds.histogram([]),[]);
assert.deepEqual(ds.histogram([5,5,5]),[{from:5,to:5,count:3}],'값이 모두 같으면 구간 1개');
assert.equal(ds.histogram([1,2,3,4,5,6,7,8,9,10,11,12,13]).reduce((a,b)=>a+b.count,0),13);

// 종합점수 없음
const blob=JSON.stringify(r);
for(const bad of ['"score"','"composite"','"weight"','종합점수']) assert(!blob.includes(bad),'금지 키: '+bad);

// 잘못된 입력
assert.throws(()=>ds.domainStats({domain:'없는영역',level:'초등학교'}),/영역/);
assert.throws(()=>ds.domainStats({domain:'park',level:'대학교'}),/학교급/);
console.log('test_domain_stats: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_domain_stats.cjs`
Expected: FAIL — `Cannot find module '../api/_domain_stats'`

- [ ] **Step 3: 구현**

`api/_domain_stats.js`:

```js
'use strict';
// 영역 1개의 전체 분포. 학교급 안에서 육지 통계를 기본으로 하고 도서지역(강화·옹진)은 따로 센다.
// 미확보는 분포·평균에서 제외하고 사유별로 센다.
const table=require('./_school_table'),stats=require('./_indicator_stats'),profileModel=require('./_school_profile');
const finite=Number.isFinite,LEVELS=['유치원','초등학교','중학교','고등학교'],BINS=12;
const round=(v,d=1)=>finite(v)?Number(v.toFixed(d)):null;
function histogram(values){
 if(!values.length)return [];
 const min=values[0],max=values[values.length-1];
 if(min===max)return [{from:min,to:max,count:values.length}];
 const width=(max-min)/BINS,bins=[];
 for(let i=0;i<BINS;i++)bins.push({from:round(min+width*i,2),to:round(min+width*(i+1),2),count:0});
 for(const v of values){let i=Math.floor((v-min)/width);if(i>=BINS)i=BINS-1;if(i<0)i=0;bins[i].count++;}
 return bins;
}
function coverageOf(column,rows){
 const missing=new Map();let available=0;
 for(const r of rows){
  if(finite(r[column])){available++;continue;}
  const m=profileModel.indicator(column,r).missing||{reason:'not_collected',detail:'이 학교의 값이 원자료에 없습니다.'};
  if(!missing.has(m.reason))missing.set(m.reason,{reason:m.reason,detail:m.detail,n:0});
  missing.get(m.reason).n++;
 }
 return {available,missing:[...missing.values()].sort((a,b)=>b.n-a.n)};
}
function domainStats({domain,level,schoolId=null}){
 const meta=table.DOMAINS.find(d=>d.id===domain);
 if(!meta)throw Error('알 수 없는 영역입니다: '+domain);
 if(!LEVELS.includes(level))throw Error('알 수 없는 학교급입니다: '+level);
 const t=table.build(),levelRows=t.rows.filter(r=>r.level===level);
 const selected=schoolId?t.byId.get(schoolId):null;
 const columns=Object.entries(table.COLUMNS).filter(([,c])=>c.domain===domain&&c.type!=='text'&&c.type!=='bool').map(([col])=>col);
 const indicators=columns.map(column=>{
  const c=table.COLUMNS[column];
  const main=stats.population(column,level,{island:false}),isl=stats.population(column,level,{island:true});
  const guMap=new Map();
  for(const r of levelRows){if(!r.gu||!finite(r[column]))continue;if(!guMap.has(r.gu))guMap.set(r.gu,[]);guMap.get(r.gu).push(r[column]);}
  const gu=[...guMap.entries()].map(([name,vals])=>{const s=stats.summarize(vals.sort((a,b)=>a-b));return {name,n:s.n,mean:s.mean,median:s.median};}).sort((a,b)=>b.n-a.n);
  let sel=null;
  if(selected&&selected.level===level&&finite(selected[column])){
   const island=stats.isIsland(selected.gu),pop=island?isl:main;
   sel={value:selected[column],percentile:stats.percentile(pop.values,selected[column]),rank:stats.rank(pop.values,selected[column]),track:island?'island':'general'};
  }
  return {column,label:c.label,unit:c.unit||'',direction:c.direction,note:c.note||null,
   overall:{n:main.n,mean:main.mean,median:main.median,min:main.min,max:main.max},
   island:{n:isl.n,mean:isl.mean,median:isl.median},
   histogram:histogram(main.values),gu,coverage:coverageOf(column,levelRows),selected:sel};
 });
 return {domain,label:meta.label,level,school_id:schoolId,indicators};
}
module.exports={domainStats,histogram};
```

- [ ] **Step 4: 통과 확인**

Run: `node tests/test_domain_stats.cjs`
Expected: `test_domain_stats: OK`

- [ ] **Step 5: 모든 영역 × 학교급 훑기**

Run:
```bash
node -e "const ds=require('./api/_domain_stats'),t=require('./api/_school_table');let n=0;for(const d of t.DOMAINS)for(const l of ['유치원','초등학교','중학교','고등학교']){ds.domainStats({domain:d.id,level:l});n++}console.log('조합',n,'개 통과')"
```
Expected: `조합 36 개 통과`

- [ ] **Step 6: 커밋**

```bash
git add api/_domain_stats.js tests/test_domain_stats.cjs
git commit -m "feat(api): 영역별 분포·군구 비교·커버리지 통계"
```

---

### Task 5: HTTP 핸들러와 라우트

**Files:**
- Create: `api/school-profile.js`, `api/domain-stats.js`
- Modify: `server.js`, `vercel.json`
- Test: `tests/test_profile_http.cjs`

**Interfaces:**
- Consumes: Task 3의 `profile(id)`, Task 4의 `domainStats({domain,level,schoolId})`
- Produces: `GET /api/school-profile?id=`, `GET /api/domain-stats?domain=&level=&school=`. 오류는 `400 {error:'한국어 문구'}`, 비 GET은 `405`.

- [ ] **Step 1: 기존 라우트 방식 확인**

Run: `grep -n "school-summary" server.js vercel.json`
새 라우트는 이 패턴을 그대로 따른다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/test_profile_http.cjs`:

```js
const assert=require('node:assert/strict');
const profileApi=require('../api/school-profile'),domainApi=require('../api/domain-stats');
function call(handler,url,method='GET'){return new Promise(res=>{const fake={statusCode:200,setHeader(){},end(b){res({status:this.statusCode,body:b?JSON.parse(b):null});}};handler({method,url},fake);});}
(async()=>{
 const ok=await call(profileApi,'/api/school-profile?id=B000002949');
 assert.equal(ok.status,200);assert.equal(ok.body.school.name,'인천신흥초등학교');assert.equal(ok.body.domains.length,9);
 const bad=await call(profileApi,'/api/school-profile?id=없는학교');
 assert.equal(bad.status,400);assert(bad.body.error);
 const noId=await call(profileApi,'/api/school-profile');
 assert.equal(noId.status,400);
 const post=await call(profileApi,'/api/school-profile?id=B000002949','POST');
 assert.equal(post.status,405);
 const d=await call(domainApi,'/api/domain-stats?domain=park&level=초등학교&school=B000002949');
 assert.equal(d.status,200);assert.equal(d.body.domain,'park');assert(d.body.indicators.length>0);
 const dDefault=await call(domainApi,'/api/domain-stats?domain=park');
 assert.equal(dDefault.status,200);assert.equal(dDefault.body.level,'초등학교','학교급 기본값');
 const dBad=await call(domainApi,'/api/domain-stats?domain=없음&level=초등학교');
 assert.equal(dBad.status,400);
 console.log('test_profile_http: OK');
})();
```

- [ ] **Step 3: 실패 확인**

Run: `node tests/test_profile_http.cjs`
Expected: FAIL — `Cannot find module '../api/school-profile'`

- [ ] **Step 4: 핸들러 구현**

`api/school-profile.js`:

```js
const model=require('./_school_profile');
module.exports=(req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'GET 요청만 지원합니다.'}));return;}try{const u=new URL(req.url,'http://localhost'),id=u.searchParams.get('id');if(!id)throw Error('학교를 선택해 주세요.');res.end(JSON.stringify(model.profile(id)));}catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}};
```

`api/domain-stats.js`:

```js
const model=require('./_domain_stats');
module.exports=(req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'GET 요청만 지원합니다.'}));return;}try{const u=new URL(req.url,'http://localhost');res.end(JSON.stringify(model.domainStats({domain:u.searchParams.get('domain'),level:u.searchParams.get('level')||'초등학교',schoolId:u.searchParams.get('school')||null})));}catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}};
```

- [ ] **Step 5: 통과 확인**

Run: `node tests/test_profile_http.cjs`
Expected: `test_profile_http: OK`

- [ ] **Step 6: 라우트 등록**

`server.js`에서 `/api/school-summary`를 등록한 곳과 같은 형식으로 `/api/school-profile`, `/api/domain-stats`를 추가한다. `vercel.json`의 라우트 목록에도 같은 형식으로 두 줄을 추가한다.

- [ ] **Step 7: 서버 확인**

Run:
```bash
npm start &
sleep 3
curl -s "http://localhost:3000/api/school-profile?id=B000002949" | head -c 200
curl -s "http://localhost:3000/api/domain-stats?domain=reading&level=중학교" | head -c 200
kill %1
```
Expected: 두 응답 모두 JSON. 프로필은 `{"school":{"id":"B000002949"...`로 시작한다.

- [ ] **Step 8: 커밋**

```bash
git add api/school-profile.js api/domain-stats.js server.js vercel.json tests/test_profile_http.cjs
git commit -m "feat(api): 학교 프로필·영역 통계 라우트"
```

---

### Task 6: SVG 차트 모듈

**Files:**
- Create: `assets/indicator-charts.js`
- Test: `tests/test_indicator_charts.cjs`

**Interfaces:**
- Consumes: 없음 (순수 함수, DOM을 만지지 않는다)
- Produces: `window.IndicatorCharts = {percentileBar, histogram, radar}` — 모두 SVG 문자열을 반환한다.
  - `percentileBar({percentile, guPercentile, guName, value, unit, rank, n})` → `string`
  - `histogram({bins, selectedValue, unit})` → `string` (`bins`가 비면 `''`)
  - `radar({axes, basis})` → `string`. `basis`는 `'overall'` 또는 `'gu'`. `axes`는 Task 3의 `Axis` 배열.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_indicator_charts.cjs`:

```js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id=x></div>',{runScripts:'outside-only'}),w=dom.window;
w.eval(fs.readFileSync(path.join(__dirname,'..','assets/indicator-charts.js'),'utf8'));
const C=w.IndicatorCharts;

// 백분위 막대
const bar=C.percentileBar({percentile:72.5,guPercentile:40,guName:'중구',value:6.2,unit:'%',rank:41,n:262});
assert(bar.startsWith('<svg'),'SVG 문자열');
assert(bar.includes('72.5'),'백분위 표시');
assert(bar.includes('262개교 중 41위'),'순위 표시');
assert(bar.includes('class="gu-mark"'),'구 눈금');
const noGu=C.percentileBar({percentile:50,guPercentile:null,guName:'중구',value:1,unit:'',rank:2,n:5});
assert(!noGu.includes('class="gu-mark"'),'구 백분위가 없으면 눈금을 그리지 않는다');
assert(!/NaN/.test(noGu),'NaN 없음');
// 이스케이프
assert(C.percentileBar({percentile:1,guPercentile:null,guName:'<b>',value:1,unit:'<i>',rank:1,n:1}).includes('&lt;'),'HTML 이스케이프');

// 히스토그램
const h=C.histogram({bins:[{from:0,to:5,count:3},{from:5,to:10,count:7}],selectedValue:6,unit:'%'});
assert(h.startsWith('<svg'));
assert(h.includes('selected'),'선택 학교 구간 표시');
assert(!C.histogram({bins:[{from:0,to:5,count:3}],selectedValue:null,unit:''}).includes('selected'));
assert.equal(C.histogram({bins:[],selectedValue:null,unit:''}),'','빈 분포는 빈 문자열');

// 레이더: 미확보 축은 0이 아니라 끊어진 축
const axes=[{domain_label:'공원·야외',label:'녹지비율',direction:'up',percentile_overall:80,percentile_gu:60,missing:null},
            {domain_label:'도서·독서',label:'학생당 장서',direction:'up',percentile_overall:null,percentile_gu:null,missing:{reason:'level_not_covered',detail:'초등만'}},
            {domain_label:'안전 환경',label:'사고 거리',direction:'up',percentile_overall:30,percentile_gu:null,missing:null}];
const rad=C.radar({axes,basis:'overall'});
assert(rad.startsWith('<svg')&&rad.includes('class="radar"'));
assert(rad.includes('stroke-dasharray'),'미확보 축은 점선');
assert(!/NaN/.test(rad),'NaN 좌표 없음');
assert(rad.includes('공원·야외')&&rad.includes('도서·독서'));
assert(rad.includes('↑'),'방향 표시');
assert.notEqual(C.radar({axes,basis:'gu'}),rad,'기준을 바꾸면 그림이 달라진다');
// 구 기준인데 구 백분위가 없는 축도 끊어진 축이 된다
assert(C.radar({axes,basis:'gu'}).includes('stroke-dasharray'));
// 값이 하나도 없으면 안내 문구
const empty=C.radar({axes:axes.map(a=>({...a,percentile_overall:null,percentile_gu:null,missing:{reason:'x',detail:'y'}})),basis:'overall'});
assert(empty.includes('표시할 값이 없습니다'));
console.log('test_indicator_charts: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_indicator_charts.cjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'percentileBar')`

- [ ] **Step 3: 구현**

`assets/indicator-charts.js`를 만들고 `window.IndicatorCharts`에 세 함수를 붙인다. 이스케이프 헬퍼는 `assets/simple-app.js`와 같은 것을 쓴다:

```js
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
```

요구사항:

- **`percentileBar`**: 가로 막대. 트랙 전체 폭 대비 `percentile`%만큼 채운다. `guPercentile`이 유한한 숫자일 때만 그 위치에 `<line class="gu-mark">`를 그리고 `${guName} 백분위 NN%` 텍스트를 붙인다. 텍스트로 `값+단위`, `백분위 (값이 큰 쪽) NN%`, `N개교 중 K위`를 넣는다. 모든 텍스트는 `esc`를 통과시킨다.
- **`histogram`**: `bins`가 비면 `''`을 반환한다. 막대 높이는 최대 `count` 기준으로 정규화한다. `selectedValue`가 유한하고 어떤 구간의 `[from,to]`에 들어가면 그 막대에 `class="bar selected"`를 붙인다 (마지막 구간은 `to`를 포함).
- **`radar`**: 값이 있는 축(`basis==='gu' ? percentile_gu : percentile_overall`이 유한한 축)을 먼저 고른다. 그런 축이 0개면 `<svg class="radar">` 안에 `표시할 값이 없습니다.` 텍스트만 넣어 반환한다. 축은 전체 개수 기준 등각 배치한다. 값이 있는 축만 이어 다각형 경로를 만들고, 값이 없는 축은 축선을 `stroke-dasharray="3 3"`로 그린 뒤 다각형에서 제외한다. 축 라벨은 `domain_label`과 방향 기호(`up`→`↑`, `down`→`↓`, `neutral`→`·`)를 함께 쓴다. 좌표 계산 전에 값 없는 축을 걸러내 `NaN`이 들어가지 않게 한다.

- [ ] **Step 4: 통과 확인**

Run: `node tests/test_indicator_charts.cjs`
Expected: `test_indicator_charts: OK`

- [ ] **Step 5: 커밋**

```bash
git add assets/indicator-charts.js tests/test_indicator_charts.cjs
git commit -m "feat(ui): 백분위 막대·히스토그램·레이더 SVG 차트"
```

---

### Task 7: 지도 하단 패널

**Files:**
- Create: `assets/school-profile.js`
- Modify: `index.html` (`.observation-section` 블록과 스크립트 목록), `assets/simple-app.js` (`select()` 안 `try` 블록), `assets/simple-app.css`
- Test: `tests/test_school_profile_ui.cjs`, 그리고 기존 스텁 7개

**Interfaces:**
- Consumes: `GET /api/school-profile`, Task 6의 `window.IndicatorCharts`
- Produces: `window.SchoolProfile = {render(el, data), clear(el)}`. `data`는 Task 3의 프로필에 `conditions`(배열)와 `limits`(배열)를 덧붙인 객체다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_school_profile_ui.cjs`:

```js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),profile=require('../api/_school_profile');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.eval(fs.readFileSync(path.join(root,'assets/indicator-charts.js'),'utf8'));
w.eval(fs.readFileSync(path.join(root,'assets/school-profile.js'),'utf8'));
const host=d.getElementById('summary');

w.SchoolProfile.render(host,{...profile.profile('B000002949'),conditions:['도서 아님 조건'],limits:['관측 0은 확정 부족이 아닙니다.']});
assert.equal(host.querySelectorAll('.domain-card').length,9,'영역 카드 9장');
assert(host.querySelector('svg.radar'),'레이더 1장');
assert.equal(host.querySelectorAll('.radar-basis button').length,2,'구 기준 / 인천 전체 기준 토글');
assert(host.textContent.includes('모양 비교용'),'레이더 고지 문구');
assert(host.textContent.includes('백분위 (값이 큰 쪽)'),'백분위 정의를 화면에 쓴다');
assert.equal(host.querySelectorAll('[data-domain-stats]').length,9,'영역마다 통계 링크');
// 제거된 것
for(const gone of ['확인된 사실','검토할 선택지','기존 공원과 연결 검토'])assert(!host.textContent.includes(gone),gone+' 제거');

// 토글이 실제로 다시 그린다
const before=host.querySelector('svg.radar').outerHTML;
host.querySelectorAll('.radar-basis button')[1].dispatchEvent(new w.Event('click',{bubbles:true}));
assert.notEqual(host.querySelector('svg.radar').outerHTML,before,'기준 전환이 반영된다');

// 미확보 표기
w.SchoolProfile.render(host,{...profile.profile('KLOCAL-000e957d3ab6431c'),conditions:[],limits:[]});
const missing=[...host.querySelectorAll('.indicator.missing')];
assert(missing.length>0,'유치원은 미확보 지표가 보인다');
assert(missing.every(el=>el.querySelector('.indicator-value').textContent.trim()==='미확보'),'미확보 칸에 0을 쓰지 않는다');
assert(missing.every(el=>!el.querySelector('svg')),'미확보에 막대를 그리지 않는다');

// 도서지역 배지
w.SchoolProfile.render(host,{...profile.profile('B000003173'),conditions:[],limits:[]});
assert(host.textContent.includes('도서지역'),'도서지역 표시');

// 소표본 군·구는 순위만
w.SchoolProfile.render(host,{...profile.profile('B000030928'),conditions:[],limits:[]});
const cls=[...host.querySelectorAll('.indicator')].find(el=>el.textContent.includes('학급당 학생 수'));
assert(cls.textContent.includes('1개교 중 1위'),'순위는 쓴다');
assert(!/검단구 백분위/.test(cls.textContent),'소표본 구 백분위는 쓰지 않는다');

// 빈 상태
w.SchoolProfile.clear(host);
assert(host.textContent.includes('학교를 선택하면'));
console.log('test_school_profile_ui: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_school_profile_ui.cjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'render')`

- [ ] **Step 3: `assets/school-profile.js` 구현**

`window.SchoolProfile.render(el, data)`가 다음 순서로 그린다. 상태(현재 `basis`)는 모듈 내부 변수로 들고, 토글 클릭 시 레이더만 다시 그린다.

1. **머리말** — 학교명 · 학교급 · 군·구 · `data.track==='island'`면 `도서지역 별도 검토` 배지 · `기준 ${data.data_year}년` · `확보 ${coverage.available} · 미확보 ${coverage.missing}`
2. **레이더 블록**
   - `<div class="radar-basis">`에 버튼 2개: `인천 전체 기준`(`basis='overall'`), `${gu} 기준`(`basis='gu'`). `data.school.gu`가 없으면 전체 버튼만 그린다.
   - `IndicatorCharts.radar({axes:data.radar.axes, basis})`
   - 고정 문구: `모양 비교용이며 순위·종합점수가 아닙니다. 축마다 단위와 성격이 다릅니다. 미확보 축은 값이 없어 끊어진 축으로 그립니다.`
3. **영역 카드 9장** — `<details class="domain-card">`. `<summary>`에 영역명과 `확보 N · 미확보 M`, 그리고 `<button data-domain-stats="{영역id}">이 영역 전체 통계 →</button>`. 안에 지표 한 줄씩 `<div class="indicator">`:
   - 값 있음: `.indicator-label`(지표명 + 방향 기호), `.indicator-value`(`값 단위`), `IndicatorCharts.percentileBar({percentile:overall.percentile,guPercentile:gu&&gu.percentile,guName:gu&&gu.name,value,unit,rank:overall.rank,n:overall.n})`, 구 표본이 `MIN_GU_N` 미만이면 `${gu.name} ${gu.n}개교 중 ${gu.rank}위` 텍스트를 대신 붙인다.
   - 텍스트 지표(`text`가 있는 것, 예: `designation_names`): 막대 없이 값만 쓴다.
   - 값 없음: `class="indicator missing"`, `.indicator-value`에 정확히 `미확보`, 옆에 `missing.detail`. 막대를 그리지 않는다.
   - 방향 기호: `up`→`많을수록 유리 ↑`, `down`→`많을수록 불리 ↓`, `neutral`→`해석에 정책 판단 필요 ·`
4. **더 확인할 조건** — `(data.conditions||[])`가 비면 섹션 자체를 그리지 않는다.
5. **출처** — `<details>` 안에 `data.originals` 링크. 접힌 기술 정보로 `data.sources`의 `path`·`sha256` 앞 12자.
6. **분석의 한계** — `<details>` 안에 `(data.limits||[])`.

`clear(el)`은 `학교를 선택하면 지표 프로필이 표시됩니다.` 빈 상태 마크업으로 되돌린다.

모든 삽입 값은 `esc`를 통과시킨다.

- [ ] **Step 4: `index.html` 연결**

`</body>` 앞 스크립트 목록에서 `assets/simple-app.js`보다 **먼저** 두 줄을 넣는다:

```html
<script src="/assets/indicator-charts.js"></script>
<script src="/assets/school-profile.js"></script>
```

`.observation-section`의 제목 옆 설명과 `#summary` 빈 상태 문구를 새 패널에 맞게 바꾼다 (`확인된 사실, 더 확인할 조건, 검토할 선택지를 자원별로 보여줍니다.` → `영역별 지표의 절대값과 상대 위치를 보여줍니다.`).

- [ ] **Step 5: `assets/simple-app.js` 연결**

`select()` 안 `try` 블록에서 3카드 템플릿 문자열을 지우고 다음으로 바꾼다:

```js
try{const [s0,p0]=await Promise.all([get(`/api/school-summary?id=${encodeURIComponent(id)}&kind=${encodeURIComponent(kind)}`),get(`/api/school-profile?id=${encodeURIComponent(id)}`)]);if(ticket!==request)return;current={...s0,profile:p0};
window.SchoolProfile.render($('summary'),{...p0,conditions:s0.conditions,limits:s0.limits,originals:p0.originals&&p0.originals.length?p0.originals:s0.originals});
$('summary').querySelectorAll('[data-domain-stats]').forEach(b=>b.onclick=()=>window.DomainStats&&window.DomainStats.open(b.dataset.domainStats));
$('download-school').disabled=false;
}
```

`catch` 블록과 학교 미선택 분기는 그대로 두되, 미선택 분기의 `innerHTML` 대입을 `window.SchoolProfile.clear($('summary'))`로 바꾼다.

`current`에 `profile`이 들어가므로 `assets/hitl-workspace.js:44`의 검토 기록에 프로필이 함께 저장된다 (별도 수정 불필요).

- [ ] **Step 6: 통과 확인**

Run: `node tests/test_school_profile_ui.cjs`
Expected: `test_school_profile_ui: OK`

- [ ] **Step 7: 기존 테스트 스텁 수정**

`model.summary`를 fetch 스텁으로 쓰는 파일마다 `/api/school-profile`도 처리하도록 한 줄을 추가한다. 대상 7개 파일: `tests/test_simple_app.cjs`, `tests/test_school_map.cjs`, `tests/test_chat_agent_ui.cjs`, `tests/test_saved_conversations.cjs`, `tests/test_hitl_workspace.cjs`, `tests/serve_policy_studio.cjs`, `tests/verify_hitl_browser.cjs`, `tests/verify_hitl_release.cjs`.

각 파일의 `/api/school-summary` 처리 지점 바로 앞에 넣는다:

```js
if(u.pathname==='/api/school-profile')return {ok:true,json:async()=>require('../api/_school_profile').profile(u.searchParams.get('id'))};
```

(`serve_policy_studio.cjs`·`verify_hitl_*.cjs`는 실제 http 서버이므로 `res.end(JSON.stringify(require('../api/_school_profile').profile(u.searchParams.get('id'))))` 형식으로 맞춘다.)

`tests/test_simple_app.cjs`의 3카드 단언을 바꾼다:

```js
change('school','B000002949');await tick();
assert.equal(d.querySelectorAll('.domain-card').length,9);
assert.match(d.querySelector('#summary').textContent,/백분위 \(값이 큰 쪽\)/);
assert(!d.querySelector('#summary').textContent.includes('검토할 선택지'));
```

`assert.match(...,/전수|없다는 뜻/)`처럼 `kind` 전환 후 `facts` 문구를 보던 단언은 지운다 (그 정보는 이제 패널에 없다).

- [ ] **Step 8: 회귀 확인**

Run: `npm run test:simple && npm run test:map && npm run test:hitl`
Expected: 모두 통과. 실패하면 스텁 누락부터 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add assets/school-profile.js assets/simple-app.js assets/simple-app.css index.html tests/
git commit -m "feat(ui): 지도 하단 지표 프로필 패널 - 영역 카드·백분위 막대·레이더"
```

---

### Task 8: 정보량 없는 요약 제거

**Files:**
- Modify: `api/_school_summary.js` (`summary()` 함수)
- Test: `tests/test_summary_trim.cjs`

**Interfaces:**
- Consumes: 없음
- Produces: `summary()` 반환에서 `facts`·`options` 제거. `conditions`는 학교별 가변분만. `limits`(고정 문구 배열) 신설. 나머지 키(`school,kind,label,status,status_label,separate_track,facilities,sources,originals`)는 유지.

**근거 (실측):** 초등 60개교 × 자원 4종을 돌린 결과 `options`가 **모든 학교에서 완전히 동일**했다 (서로 다른 조합 1개). `facts` 3줄은 Task 7의 패널이 모두 포함한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_summary_trim.cjs`:

```js
const assert=require('node:assert/strict'),model=require('../api/_school_summary');
const a=model.summary('B000002949','park'),b=model.summary('KLOCAL-000e957d3ab6431c','park'),isl=model.summary('B000003173','park');
for(const s of [a,b,isl]){
 assert.equal(s.facts,undefined,'facts 제거');
 assert.equal(s.options,undefined,'options 제거');
 assert(Array.isArray(s.conditions));
 assert(Array.isArray(s.limits),'고정 문구는 limits로 분리');
 assert(s.limits.length>0);
 for(const k of ['school','kind','label','status_label','separate_track','facilities','sources','originals'])assert(k in s,k+' 유지');
}
// conditions는 학교마다 달라야 의미가 있다
assert(isl.conditions.some(c=>c.includes('도서')),'도서지역 조건은 남는다');
assert(!a.conditions.some(c=>c.includes('도서')));
assert(!a.conditions.some(c=>c.includes('이용자격·개방시간')),'모든 학교에 같은 문구는 limits로 옮긴다');
assert(a.limits.some(c=>c.includes('이용자격·개방시간')));
assert(a.limits.some(c=>c.includes('관측 0')),'관측 0 해석 규칙은 남긴다');
// 검증 묶음이 없는 자원은 여전히 학교별 조건을 남긴다
const books=model.summary('KLOCAL-000e957d3ab6431c','books');
assert(books.conditions.length>0,'미확보 안내는 조건으로 남는다');
console.log('test_summary_trim: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_summary_trim.cjs`
Expected: FAIL — `facts 제거`

- [ ] **Step 3: 구현**

`api/_school_summary.js`의 `summary()`에서:

- `const facts=[{label:'재학생',...}]` 선언과 이후 모든 `facts.push(...)` 호출을 지운다.
- `options` 변수 선언과 두 대입(`options=[{name:'기존 공원과 연결 검토',...}]`, `options=(l.alternatives||[]).map(...)`)을 지운다.
- 초기화 줄을 바꾼다:

```js
const limits=['이용자격·개방시간·안전·실행 여건과 실제 출입구 경로를 확인해야 합니다.','수집 범위와 현장 이용을 확인하기 전에는 관측 0을 확정 부족으로 판단하지 않습니다.'];
let conditions=[],facilities=[];
```

- `kind==='park'` 분기의 `conditions.push('수집 범위와 현장 이용을...')` 줄을 지운다 (limits로 옮겼다).
- 반환문을 바꾼다:

```js
return {school:{id:school.id,name:school.name,level:school.level,gu:school.gu},kind,label:labels[kind],status:'pending',status_label:'추가 확인 후 판단',separate_track:separate,conditions:[...new Set(conditions)],limits,facilities,sources,originals};
```

- [ ] **Step 4: 통과 확인**

Run: `node tests/test_summary_trim.cjs`
Expected: `test_summary_trim: OK`

- [ ] **Step 5: 저장된 과거 기록이 깨지지 않는지 확인**

Run: `node tests/test_observation_restore.cjs`
Expected: 통과. 실패하면 과거 기록의 `facts`/`options`를 참조하는 코드를 `?.`로 방어한다. **없는 키를 근거로 옛 추천을 되살리지 않는다** (AGENTS.md 회귀 요건).

- [ ] **Step 6: 전체 회귀**

Run: `npm run test:simple && npm run test:analysis && npm run test:hitl && npm run test:relative`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add api/_school_summary.js tests/
git commit -m "refactor(summary): 학교별로 동일했던 검토 선택지·중복 사실 카드 제거"
```

---

### Task 9: 05 영역별 통계 탭

**Files:**
- Create: `assets/domain-stats.js`
- Modify: `index.html` (탭 버튼 + `<section id="workspace-stats">` + 스크립트), `assets/simple-app.css`
- Test: `tests/test_domain_stats_ui.cjs`

**Interfaces:**
- Consumes: `GET /api/domain-stats`, Task 6의 `IndicatorCharts.histogram`
- Produces: `window.DomainStats = {init(), open(domainId)}`. `open()`은 Task 7의 `[data-domain-stats]` 버튼이 부른다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_domain_stats_ui.cjs`:

```js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),ds=require('../api/_domain_stats');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.fetch=async url=>{const u=new URL(url,'http://localhost');return {ok:true,json:async()=>ds.domainStats({domain:u.searchParams.get('domain'),level:u.searchParams.get('level'),schoolId:u.searchParams.get('school')||null})};};
w.eval(fs.readFileSync(path.join(root,'assets/indicator-charts.js'),'utf8'));
w.eval(fs.readFileSync(path.join(root,'assets/domain-stats.js'),'utf8'));
const tick=()=>new Promise(r=>setTimeout(r,30));
(async()=>{
 const host=d.getElementById('workspace-stats');
 assert(host,'05 탭 섹션이 있다');
 assert(d.querySelector('[data-page="stats"]'),'탭 버튼이 있다');
 w.DomainStats.init();
 assert.equal(d.querySelectorAll('#stats-domain option').length,9,'영역 9개');
 w.DomainStats.open('reading');await tick();
 assert.equal(d.getElementById('stats-domain').value,'reading');
 assert(host.querySelectorAll('svg').length>0,'분포 차트');
 assert(host.textContent.includes('군·구별'),'군구 비교');
 assert(host.textContent.includes('확보')&&host.textContent.includes('미확보'),'커버리지');
 // 학교급을 유치원으로 바꾸면 장서가 전부 미확보로 표시된다
 const sel=d.getElementById('stats-level');sel.value='유치원';sel.dispatchEvent(new w.Event('change'));await tick();
 assert(host.textContent.includes('미확보 369'),'유치원 장서 369곳 미확보');
 assert(host.textContent.includes('관측된 값이 없습니다'),'유효값 0이면 차트 대신 안내');
 assert(!/평균 0권/.test(host.textContent),'미확보를 0으로 요약하지 않는다');
 console.log('test_domain_stats_ui: OK');
})();
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_domain_stats_ui.cjs`
Expected: FAIL — `05 탭 섹션이 있다`

- [ ] **Step 3: `index.html` 탭과 섹션 추가**

기존 탭 버튼 목록(`01 학교 찾기` … `04 저장된 대화`)에 같은 형식으로 `05 영역별 통계` 버튼(`data-page="stats"`)을 추가하고, `#workspace-saved` 섹션 다음에 넣는다:

```html
<section id="workspace-stats" class="workspace-page stats-section" hidden aria-labelledby="stats-title">
<p class="eyebrow">05 영역별 통계</p><h2 id="stats-title">영역별 전체 분포</h2>
<p class="muted">선택한 영역의 지표가 인천 전체에서 어떻게 분포하는지 봅니다. 학교급 안에서만 비교하며 강화·옹진 도서지역은 따로 셉니다.</p>
<div class="stats-controls">
<label>영역 <select id="stats-domain"></select></label>
<label>학교급 <select id="stats-level"><option>초등학교</option><option>유치원</option><option>중학교</option><option>고등학교</option></select></label>
<p id="stats-status" class="muted" role="status"></p></div>
<div id="stats-body"></div>
<p class="fine">분포는 관측된 값만 셉니다. 미확보는 0이 아니며 평균·중앙값 계산에서 제외합니다.</p>
</section>
```

`</body>` 앞 스크립트 목록에 `<script src="/assets/domain-stats.js"></script>`를 추가한다.

- [ ] **Step 4: `assets/domain-stats.js` 구현**

```js
const DOMAIN_OPTIONS=[['designation','지정·지원사업'],['park','공원·야외'],['reading','도서·독서'],['academy','학원'],['safety','안전 환경'],['boundary','도보권·학구도'],['trend','학생 추세'],['school','학생·교원'],['development','주변 개발']];
```

- `init()`: `#stats-domain`을 위 목록으로 채우고, 두 `<select>`의 `change`에 재조회를 건다. 이미 채워져 있으면 다시 채우지 않는다.
- `open(domainId)`: `#stats-domain` 값을 바꾸고 `stats` 페이지를 연 뒤 조회한다.
- 조회: `fetch('/api/domain-stats?domain=&level=&school=')`. 선택 학교가 있으면(`document.getElementById('school').value`) `school`을 함께 보낸다. 실패하면 `#stats-status`에 한국어 오류를 쓴다.
- 렌더 (`#stats-body`): 지표마다 `<article class="stat-indicator">`
  - 제목 = `label (unit)` + 방향 문구
  - `overall.n === 0`이면 차트 대신 `관측된 값이 없습니다. 아래 미확보 사유를 확인하세요.`
  - 아니면 `IndicatorCharts.histogram({bins:i.histogram,selectedValue:i.selected&&i.selected.value,unit:i.unit})`
  - 요약 줄 = `유효 N개교 · 평균 X · 중앙값 Y · 범위 min~max`
  - 선택 학교가 있으면 = `선택 학교 값 V · 백분위 (값이 큰 쪽) P% · N개교 중 K위`
  - `island.n > 0`이면 = `강화·옹진 N개교 · 평균 X · 중앙값 Y (별도 집계)`
  - `군·구별` 표 = 이름 / 개교 수 / 평균 / 중앙값
  - 커버리지 줄 = `확보 ${coverage.available} · 미확보 ${총합}` + 사유별 `${detail} ${n}곳`
- 모든 삽입 값은 `esc`를 통과시킨다.

- [ ] **Step 5: 탭 전환 연결**

Run: `grep -rn "data-page\|workspace-page" assets/*.js | head`
찾은 전환 코드의 페이지 목록에 `stats`를 추가한다. Task 7에서 붙인 `[data-domain-stats]` 핸들러가 `window.DomainStats.open()`을 부르므로, `DomainStats.init()`이 페이지 로드 시 한 번 실행되게 한다.

- [ ] **Step 6: 통과 확인**

Run: `node tests/test_domain_stats_ui.cjs`
Expected: `test_domain_stats_ui: OK`

- [ ] **Step 7: 눈으로 확인**

Run: `npm start` 후 `http://localhost:3000`에서 학교를 하나 선택해 패널을 보고, 영역 카드의 `이 영역 전체 통계 →`를 눌러 05 탭으로 넘어가는지 확인한다. 유치원을 선택해 미확보 표시가 `0`이 아닌지 본다.

- [ ] **Step 8: 커밋**

```bash
git add assets/domain-stats.js index.html assets/simple-app.css tests/test_domain_stats_ui.cjs
git commit -m "feat(ui): 05 영역별 통계 탭 - 분포·군구 비교·커버리지"
```

---

### Task 10: 규칙 예외 기록과 문서 갱신

**Files:**
- Modify: `AGENTS.md` (워크트리 **상위** 폴더에 있다), `README.md`, `package.json`
- Test: `tests/test_profile_guardrails.cjs`

**Interfaces:**
- Consumes: Task 1~9 전부
- Produces: `npm run test:profile`

- [ ] **Step 1: 통합 가드레일 테스트 작성**

`tests/test_profile_guardrails.cjs`:

```js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=require('../api/_school_profile'),ds=require('../api/_domain_stats'),table=require('../api/_school_table');
// 1) 917교 전부 예외 없이 프로필이 생긴다
let ok=0;for(const r of table.build().rows){profile.profile(r.id);ok++;}
assert.equal(ok,917);
// 2) 어떤 응답에도 종합점수가 없다
const BAD=['"score"','"total_score"','"composite"','"weight"','"weighted"','종합점수','가중합'];
for(const id of ['B000002949','KLOCAL-000e957d3ab6431c','B000003173']){const b=JSON.stringify(profile.profile(id));for(const k of BAD)assert(!b.includes(k),id+' 금지 키: '+k);}
for(const d of table.DOMAINS){const b=JSON.stringify(ds.domainStats({domain:d.id,level:'초등학교'}));for(const k of BAD)assert(!b.includes(k),d.id+' 금지 키: '+k);}
// 3) 미확보가 평균에 섞이지 않는다 — 유효값 수 = 확보 개교 수
for(const d of table.DOMAINS)for(const i of ds.domainStats({domain:d.id,level:'유치원'}).indicators){
 assert.equal(i.overall.n+i.island.n,i.coverage.available,i.column+': 유효값 합 = 확보 개교 수');
 if(i.overall.n===0)assert.equal(i.overall.mean,null,i.column+': 유효값이 없으면 평균도 없다');
}
// 4) 레이더에 paps가 대표로 오지 않는다
for(const r of table.build().rows)assert(!profile.profile(r.id).radar.axes.some(a=>a.column==='paps'));
// 5) AGENTS.md에 레이더 규칙 예외가 기록되어 있다
const agents=fs.readFileSync(path.join(root,'..','AGENTS.md'),'utf8');
assert(/radar|레이더/i.test(agents),'AGENTS.md에 예외 기록 필요');
assert(/broken axes|끊어진 축/i.test(agents),'완화 장치도 함께 기록');
console.log('test_profile_guardrails: OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/test_profile_guardrails.cjs`
Expected: FAIL — `AGENTS.md에 예외 기록 필요`

- [ ] **Step 3: `AGENTS.md`에 예외 기록**

`## Non-negotiable policy and UX rules (user confirmed 2026-09-12)` 섹션 끝에 추가:

```markdown
### Recorded exception (user-approved 2026-09-13): indicator radar chart

The school indicator profile panel draws a radar chart whose axes are relative percentiles of indicators from different domains. This partially conflicts with "Do not compare park and reading ordinal grades as interchangeable numbers." The user reviewed the conflict and chose the chart. It ships only with these mitigations, which are regression-tested in `tests/test_profile_guardrails.cjs`:

- Each axis is a single representative indicator, never an aggregate of a domain. No domain score exists.
- Percentile is direction-independent (larger value → larger percentile). `direction` is an annotation (↑ favourable / ↓ unfavourable / · policy judgement) and never flips a value.
- Missing indicators render as broken axes (끊어진 축), never as zero.
- The chart carries a fixed caption saying it is a shape comparison, not a ranking or composite score.
- The composite-score prohibition itself is unchanged and still enforced everywhere else.
```

- [ ] **Step 4: `package.json` 스크립트 등록**

```json
"test:profile": "node tests/test_indicator_dictionary.cjs && node tests/test_indicator_stats.cjs && node tests/test_school_profile.cjs && node tests/test_domain_stats.cjs && node tests/test_profile_http.cjs && node tests/test_indicator_charts.cjs && node tests/test_school_profile_ui.cjs && node tests/test_domain_stats_ui.cjs && node tests/test_summary_trim.cjs && node tests/test_profile_guardrails.cjs"
```

`test:simple`의 끝에 ` && node tests/test_profile_guardrails.cjs`를 덧붙인다.

- [ ] **Step 5: `README.md` 수정 요약 추가**

`## 2026-09-13 수정 요약` 아래에 추가한다:

```markdown
- 지표 프로필: 학교를 선택하면 지도 아래에 영역 9개(지정사업·공원·도서·학원·안전·도보권/학구도·학생추세·학생교원·주변개발)의 절대값과 상대 위치(군·구 기준 / 인천 전체 기준)가 뜬다. 백분위는 값이 큰 쪽 기준 고정 정의이며, 표본 10개교 미만 군·구는 순위만 쓴다. 레이더는 영역 대표 지표 1개씩을 축으로 삼고 합산하지 않는다. `npm run test:profile`
- 영역별 통계: `05 영역별 통계` 탭에서 영역·학교급을 골라 분포·군구별 비교·커버리지를 본다.
- 학교 요약 정리: 모든 학교에서 문구가 같던 ‘검토할 선택지’와 패널에 중복되던 ‘확인된 사실’ 카드를 없앴다. 고정 안내는 접힌 ‘분석의 한계’로 옮겼다.
- 미확보 정리: 학교급별로 비는 칸과 채우는 방법을 [미확보 목록](contest_plan/indicator_coverage_gaps_20260913.md)에 정리했다. 이번 작업은 새 자료를 수집하지 않았다.
```

- [ ] **Step 6: 통과 확인**

Run: `npm run test:profile`
Expected: 10개 테스트 모두 통과

- [ ] **Step 7: 전체 회귀**

Run: `npm run test:simple && npm run test:analysis && npm run test:map && npm run test:hitl && npm run test:relative && npm run test:agent && npm run validate:modules`
Expected: 모두 통과. 실패가 있으면 **여기서 멈추고 원인을 보고한다.** 테스트를 지우거나 단언을 약화시켜 통과시키지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add AGENTS.md README.md package.json tests/test_profile_guardrails.cjs
git commit -m "docs: 레이더 규칙 예외 기록·프로필 회귀 스크립트 등록"
```

---

## 자체 점검 결과

**스펙 대응 확인:**

| 스펙 | 대응 태스크 |
|---|---|
| §3.1 사전에 domain·direction 추가 | Task 1 |
| §3.3 프로필·고정 백분위·도서지역 분리·소표본·미확보 사유 4종 | Task 2, 3 |
| §4 API 2개 | Task 5 |
| §5.1 facts·options 제거 | Task 8 |
| §5.2 conditions 축소·limits 분리 | Task 8 |
| §5.3 패널 구성 | Task 7 |
| §5.4 레이더 (대표 지표·방향 미반전·끊어진 축·고지) | Task 6, 7 |
| §5.4 규칙 예외 기록 | Task 10 |
| §5.5 소비자 7개 파일 | Task 7 Step 7 |
| §6 05 통계 탭 | Task 9 |
| §8 검증 7항목 | Task 3(1~7), Task 10(통합) |

**주의 지점:**

- Task 7 Step 7이 테스트 스텁 8개를 건드린다. 가장 깨지기 쉬운 지점이므로 Step 8 회귀를 건너뛰지 않는다.
- `AGENTS.md`는 워크트리(`park-railway-deploy/`)가 아니라 **상위 작업 폴더**에 있다. Task 10 테스트가 `path.join(root,'..','AGENTS.md')`로 읽는 이유다.
- Task 4의 `coverageOf`가 Task 3의 `indicator()`를 학교마다 부른다. 유치원 369교 × 컬럼 수만큼 도는데, `indicator()`는 값이 없으면 모집단을 만들지 않고 바로 반환하므로 비용이 낮다. Task 4 Step 5의 36개 조합 훑기가 체감상 느리면(10초 초과) `missingFor(column, level)`만 따로 부르도록 바꾼다.
