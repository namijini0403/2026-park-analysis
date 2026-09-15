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
const table=require('../api/_school_table'),stats=require('../api/_indicator_stats'),built=table.build();
const elementary=built.rows.filter(s=>s.level==='초등학교');
assert.equal(green.coverage.total,elementary.length);
for(const [track,summary] of [['general',green.overall],['island',green.island]]){
 const cov=green.coverage[track];
 assert.equal(cov.total,cov.available+cov.missing_n,'분모 = 확보 + 미확보');
 assert.equal(cov.available,summary.n);
 assert.equal(cov.missing_n,cov.missing.reduce((n,m)=>n+m.n,0));
 assert(summary.min<=summary.q1&&summary.q1<=summary.median&&summary.median<=summary.q3&&summary.q3<=summary.max,'실제 분포 사분위 순서');
}
assert.equal(green.coverage.general.total+green.coverage.island.total,green.coverage.total);
assert.equal(green.selected.population_n,green.overall.n,'선택 학교의 비교 분모는 일반 학교 유효값');
assert.equal(green.selected.name,built.byId.get('B000002949').name);
assert.equal(green.island_histogram.reduce((n,b)=>n+b.count,0),green.island.n);
for(const g of green.gu){
 const rows=elementary.filter(s=>s.gu===g.name),values=rows.map(s=>s.green_ratio).filter(Number.isFinite).sort((a,b)=>a-b);
 assert.equal(g.total,rows.length);assert.equal(g.missing_n,rows.length-values.length);
 assert.equal(g.track,stats.isIsland(g.name)?'island':'general');
 assert.equal(g.min,values[0]);assert.equal(g.max,values.at(-1));
 assert.equal(g.q1,ds.quantile(values,.25));assert.equal(g.q3,ds.quantile(values,.75));
 assert.equal(g.median,ds.quantile(values,.5),'중앙값은 사분위와 동일한 원래 정밀도');
 assert.equal(g.mean,values.reduce((a,b)=>a+b,0)/values.length,'차트 평균을 사전 반올림하지 않는다');
}
const islandSchool=elementary.find(s=>stats.isIsland(s.gu)&&Number.isFinite(s.green_ratio));
const islandSelected=ds.domainStats({domain:'park',level:'초등학교',schoolId:islandSchool.id}).indicators.find(i=>i.column==='green_ratio');
assert.equal(islandSelected.selected.population_n,islandSelected.island.n,'도서 학교의 비교 분모는 도서 유효값');
assert.equal(islandSelected.selected.track,'island');
assert.equal(ds.domainStats({domain:'park',level:'중학교',schoolId:islandSchool.id}).indicators[0].selected,null,'다른 학교급 선택은 비교하지 않는다');

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
assert.equal(books.overall.q1,null);assert.equal(books.overall.q3,null);
assert(books.gu.every(g=>g.n===0&&g.median===null&&g.q1===null&&g.missing_n===g.total),'전체 미확보 군구도 제외하지 않고 명시');
assert.equal(books.coverage.general.missing_n+books.coverage.island.missing_n,369);

// 등급 정의가 충돌하는 PAPS는 어떠한 비교 분포에도 노출하지 않는다.
const papsDomain=table.COLUMNS.paps.domain,papsResult=ds.domainStats({domain:papsDomain,level:'초등학교'});
assert(!papsResult.indicators.some(i=>i.column==='paps'));
assert.equal(papsResult.excluded_indicators.find(i=>i.column==='paps').reason,'definition_conflict');

// 선형 보간 사분위는 관측값만 사용한다 (빈 값, 단일 값, 짝수·홀수 표본).
assert.equal(ds.quantile([],.25),null);
assert.equal(ds.quantile([7],.75),7);
assert.equal(ds.quantile([0,10,20,30],.25),7.5);
assert.equal(ds.quantile([0,10,20,30],.75),22.5);
assert.equal(ds.quantile([0,10,20,30,40],.25),10);

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

assert(!r.catalog.some(i=>i.column==='paps'));
assert(green.observations.every(o=>o.value===null||Number.isFinite(o.value)));
for(const track of ['general','island']){const rows=green.observations.filter(o=>o.track===track);assert.equal(rows.length,green.coverage[track].total);assert.equal(rows.filter(o=>Number.isFinite(o.value)).length,green.coverage[track].available);}
const narrow=ds.histogram([.00001,.00002]);assert(narrow.every(b=>b.to>b.from),'histogram keeps narrow range precision');
