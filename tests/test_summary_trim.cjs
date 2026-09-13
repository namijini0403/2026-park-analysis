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
