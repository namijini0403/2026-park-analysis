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
