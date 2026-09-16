'use strict';
// Rebuild only from the reviewed school-ID-linked disclosure records; never join names.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),registryPath='data_processed/education/analysis_dataset.json',defs='data/education_sources/disclosures/official_field_definitions.js';
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex'),rawRegistry=fs.readFileSync(path.join(root,registryPath));
const registry=JSON.parse(rawRegistry).schools,input_hashes={[registryPath]:hash(rawRegistry),[defs]:hash(fs.readFileSync(path.join(root,defs)))};
const schools=[],issues=[];
for(const school of registry){
 if(!['초등학교','중학교','고등학교'].includes(school.level))continue;
 const file='data_processed/education/disclosures/'+school.id+'.json',full=path.join(root,file),internal_library={};
 if(!fs.existsSync(full)){issues.push({id:school.id,reason:'linked_disclosure_missing'});schools.push({id:school.id,level:school.level,internal_library});continue;}
 const raw=fs.readFileSync(full);input_hashes[file]=hash(raw);
 const records=JSON.parse(raw).filter(r=>r.item==='58'&&r.year===2026);
 for(const depth of ['10','20','30']){
  const matches=records.filter(r=>r.depth===depth);
  if(matches.length!==1){issues.push({id:school.id,depth,reason:matches.length?'ambiguous_depth_records':'not_collected'});continue;}
  const r=matches[0];internal_library[depth]={year:r.year,values:r.values,source_file:r.source_file,source_url:r.source_url};
 }
 schools.push({id:school.id,level:school.level,internal_library});
}
const output={schema_version:1,publication_year:2026,method:'학교ID별 연결 완료된 학교알리미 항목58. 동일 학교·연도·depth 복수행은 비교 보류. 원값을 보존하며 비공시/누락 숫자를 0으로 대체하지 않음.',definitions_source:defs,input_hashes,issues,schools};
const dest=path.join(root,'data_processed/education/library_indicators_2026.json');fs.writeFileSync(dest,JSON.stringify(output));
console.log('library_indicators_2026:',schools.length,'schools,',issues.length,'missing/ambiguous depth records');
