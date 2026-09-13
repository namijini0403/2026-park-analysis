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
