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
