'use strict';
const assert=require('node:assert/strict'),model=require('../api/_school_summary'),env=require('../api/_environment_indicators');
const schools=model.registry(),result=env.load(schools),context=model.read('data_processed/context/school_context_summary.json').data;
assert.equal(result.byId.size,917);
for(const [id,column] of Object.entries(env.COLUMNS)){assert(env.FILES[env.COLUMN_SOURCE[id]]);assert(column.note&&(column.unit||column.type==='text')&&column.direction==='neutral');}
const differences=[];
for(const school of schools){
 const r=result.byId.get(school.id);
 assert(Number.isFinite(r.nightlife_nearest_m));
 assert.equal(r.nightlife_500m>0,r.nightlife_nearest_m<=500);
 if(!['계양구','미추홀구','연수구'].includes(school.gu)){assert.equal(r.construction_500m,null);assert.equal(r.construction_nearest_m,null);}
 else assert(Number.isFinite(r.construction_nearest_m));
 for(const key of ['child_accident_count_500m','apartments_straight_500m','redevelopment_straight_500m','playgrounds_straight_500m'])assert(Number.isInteger(r[key])&&r[key]>=0);
 assert(!Object.hasOwn(r,'large_apt_500m')&&!Object.hasOwn(r,'redev_active'),'New explicit scopes do not overwrite legacy fields');
 if(school.level==='초등학교')for(const [column,node] of [['nightlife_500m','nightlife'],['construction_500m','construction']]){
  const before=context.schools[school.id]?.[node]?.observed_count;
  if(r[column]!==before)differences.push({id:school.id,column,before,after:r[column]});
 }
}
assert.deepEqual(differences,[],'Elementary counts preserve the original context builder semantics');
const absent=env.load([{id:'missing',gu:'연수구',lat:null,lng:null}]).byId.get('missing');
assert(Object.entries(absent).filter(([key])=>!key.startsWith('designation')).every(([,v])=>v===null),'Unknown school coordinate must not produce observed zero');
for(const source of Object.values(result.sources))assert.match(source.sha256,/^[a-f0-9]{64}$/);
console.log('PASS environment indicators: 917 schools; elementary nightlife/construction counts unchanged; uncovered/missing coordinates remain null');
const official=model.read(env.FILES.envDesignations).data.records;
for(const school of schools){const r=result.byId.get(school.id);assert(r.designations_current===null||Number.isInteger(r.designations_current));}
const originalRead=model.read;
try{
 const fixture=[{designation_id:'a',school_name:'검증 중학교',school_level:'중학교',school_year:2026,period_status:'current',verification_status:'official_roster',program_name:'교육지원',match:{}},{designation_id:'b',school_name:'검증 중학교',school_level:'중학교',school_year:2025,period_status:'current',verification_status:'official_roster',match:{}}];
 model.read=file=>file===env.FILES.envDesignations?{data:{records:[...fixture,fixture[0]]},hash:'fixture'}:originalRead(file);
 const unique=env.load([{id:'test',name:'검증중학교',level:'중학교'}]);assert.equal(unique.byId.get('test').designations_current,2,'Current prior-year designations persist; duplicate IDs count once');assert.equal(unique.byId.get('test').designation_selected_2026,1,'Selection year is independent from current designation status');
 const ambiguous=env.load([{id:'one',name:'검증중학교',level:'중학교'},{id:'two',name:'검증 중학교',level:'중학교'}]);assert.equal(ambiguous.byId.get('one').designations_current,null);assert.equal(ambiguous.byId.get('two').designations_current,null);assert(ambiguous.designation_report.unresolved.every(r=>r.reason==='ambiguous_exact_name'));
}finally{model.read=originalRead;}
const designationDifferences=schools.filter(s=>s.level==='초등학교').map(s=>({id:s.id,name:s.name,before:context.schools[s.id]?.designations?.current?.length??null,after:result.byId.get(s.id).designations_current})).filter(s=>s.before!==s.after);
assert.deepEqual(designationDifferences,[],'Preserve prior-year ongoing elementary designations and deduplicate repeated program/type years');
console.log(JSON.stringify({designation_report:result.designation_report,elementary_count_differences:designationDifferences}));
