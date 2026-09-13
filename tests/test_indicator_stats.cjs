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
