'use strict';
const assert=require('node:assert/strict');
const extra=require('../api/_resource_extra_indicators'),model=require('../api/_school_summary');
const schools=model.registry(),result=extra.load(schools),cols=Object.keys(extra.COLUMNS);
assert.equal(cols.length,57);assert.equal(result.byId.size,917);
for(const id of cols){const c=extra.COLUMNS[id];assert(c.label&&c.unit&&c.domain&&c.note);assert.equal(c.direction,'neutral');assert(['observation','estimate','scenario'].includes(c.kind));assert(result.sources[extra.COLUMN_SOURCE[id]]?.sha256);}
const analysis=model.read(extra.FILES.resourceLibraryDisclosure).data.schools;
for(const school of schools){const row=result.byId.get(school.id);assert(Object.values(row).every(v=>v===null||Number.isFinite(v)));if(school.level==='유치원')assert.equal(row.library_books_2026,null);}
const library=analysis.find(r=>r.internal_library?.['10']&&r.internal_library?.['20']&&r.internal_library?.['30']);
const row=result.byId.get(library.id);assert.equal(row.library_books_2026,library.internal_library['10'].values.GNRL_BOKS_FGR);assert.equal(row.library_materials_2026,library.internal_library['10'].values.SUMCNT);assert.equal(row.library_certified_staff_2026,library.internal_library['20'].values.LBRRY_CRQFC_RET_STAFF_FGR);assert(!('librarians' in row),'different staffing definition must not overwrite the legacy count');
const resilience=model.read(extra.FILES.resourceResilience).data.schools;
for(const r of resilience){const values=result.byId.get(r.id);if(r.status!=='available'){assert.equal(values.road_closure_tested_segments,null);assert.equal(values.road_closure_lost_access_segments,null);}else assert.equal(values.road_closure_lost_access_segments,r.segments_losing_500m_access);}
const shared=model.read(extra.FILES.resourceSharedParks).data.schools;
for(const r of shared){assert.equal(result.byId.get(r.id).park_largest_loss_pct_scenario,r.largest_park_loss_share===null?null:r.largest_park_loss_share*100);}
const population=model.read(extra.FILES.resourceLibraryAccess).data.schools;
for(const r of population)for(let i=0;i<4;i++)assert.equal(result.byId.get(r.id)['resident_age_'+i+'_500m_estimate'],r.missing_age_cells_500m[i]===0?r.age_population_500m[i]:null);
const original=model.read;
try{
 const fakeAnalysis=structuredClone(analysis),r=fakeAnalysis.find(r=>r.id===library.id);
 r.internal_library['10'].year=2025;r.internal_library['20'].values.PBAN_EXCP_YN='Y';r.internal_library['30'].values.LBRRY_LN_DTA_FGR='';
 model.read=path=>path===extra.FILES.resourceLibraryDisclosure?{data:{schools:fakeAnalysis},hash:'fixture'}:original(path);
 const values=extra.load([{id:library.id}]).byId.get(library.id);
 assert.equal(values.library_books_2026,null,'2025 must not be silently relabeled as 2026');assert.equal(values.library_seats_2026,null,'excluded disclosures must stay missing');assert.equal(values.library_annual_loans_2026,null,'blank is not zero');
}finally{model.read=original;}
// Source metadata may reorder dimensions; never attach another radius/age/year's values to a fixed label.
const accessSource=original(extra.FILES.resourceLibraryAccess).data,curriculumSource=original(extra.FILES.resourceCurriculum).data;
function withMetadata(access,curriculum,run){try{model.read=path=>path===extra.FILES.resourceLibraryAccess?{data:access,hash:'access-fixture'}:path===extra.FILES.resourceCurriculum?{data:curriculum,hash:'curriculum-fixture'}:original(path);run();}finally{model.read=original;}}
const reordered=structuredClone(accessSource);reordered.radii_m.reverse();reordered.levels.reverse();
for(const r of reordered.schools){for(const counts of Object.values(r.counts_by_radius))counts.reverse();r.age_population_500m.reverse();r.missing_age_cells_500m.reverse();}
withMetadata(reordered,curriculumSource,()=>{const reorderedResult=extra.load(schools);for(const school of schools)for(const col of cols.filter(c=>/^(libraries_|resident_age_)/.test(c)))assert.equal(reorderedResult.byId.get(school.id)[col],result.byId.get(school.id)[col],'reordering must preserve '+col);});
const missing=structuredClone(accessSource),radiusIndex=missing.radii_m.indexOf(500),ageIndex=missing.levels.indexOf('초등학교');
missing.radii_m.splice(radiusIndex,1);missing.levels.splice(ageIndex,1);
for(const r of missing.schools){for(const counts of Object.values(r.counts_by_radius))counts.splice(radiusIndex,1);r.age_population_500m.splice(ageIndex,1);r.missing_age_cells_500m.splice(ageIndex,1);}
withMetadata(missing,curriculumSource,()=>{for(const values of extra.load(schools).byId.values()){assert.equal(values.libraries_public_children_500m,null);assert.equal(values.libraries_including_small_500m,null);assert.equal(values.resident_age_1_500m_estimate,null);}});
withMetadata({...accessSource,base_year:2025},curriculumSource,()=>{for(const values of extra.load(schools).byId.values())for(let i=0;i<4;i++)assert.equal(values['resident_age_'+i+'_500m_estimate'],null,'changed population year must not retain 2024 labels');});
withMetadata({...accessSource,radii_m:undefined,levels:undefined},curriculumSource,()=>{for(const values of extra.load(schools).byId.values())for(const col of cols.filter(c=>/^(libraries_|resident_age_)/.test(c)))assert.equal(values[col],null,'absent dimension metadata must defer');});
for(const changed of [{...curriculumSource,school_year:2025},{...curriculumSource,semester:1}])withMetadata(accessSource,changed,()=>{for(const values of extra.load(schools).byId.values())for(const col of cols.filter(c=>c.startsWith('curriculum_')))assert.equal(values[col],null,'different curriculum term must not retain 2026 semester 2 labels');});
assert(!cols.some(id=>/rank|score|crossing/.test(id)));
console.log('PASS 57 resource indicators: source provenance, school-level joins, disclosure gates, scenario validity, missing values, and no score/rank');
