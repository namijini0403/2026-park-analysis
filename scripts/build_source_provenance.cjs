// Compile published source metadata without inventing missing upstream URLs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),yaml=require('js-yaml');
const root=path.resolve(__dirname,'..'),catalog=require('../api/_data_catalog'),out=path.join(root,'data_processed/source_provenance');fs.mkdirSync(out,{recursive:true});
const registered=yaml.load(fs.readFileSync(path.join(root,'data_sources.yaml'),'utf8')).sources;
const safeURL=v=>{try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||[...u.searchParams.keys()].some(k=>/key|token|secret|password/i.test(k)))return null;return u.href;}catch{return null;}};
const dependencies={
 'student_services/priorities.json':['student_services/facilities.json','libraries.csv','school_library_access.csv'],
 'education/analysis_dataset.json':['education/school_statistics.json','parks.csv'],
 'education/library_access_preview.json':['libraries.csv'],
 'education/academies.json':['education/academies_manifest.json'],
 'education/academy_clusters.json':['education/academies_manifest.json'],
 'education/enrollment_forecasts.json':['education/school_statistics.json'],
 'education/grade_cohort_scenarios.json':['education/school_statistics.json'],
 'education/school_public_indicators.json':['education/public_indicators_manifest.json'],
 'education/school_analysis.json':['education/analysis_manifest.json'],
};
const files=new Set([...catalog.map(e=>e.file),...registered.map(s=>s.local_file).filter(f=>f?.startsWith('data_processed/')),'data_processed/school_walkshed_500m_v3.geojson',...Object.values(dependencies).flat().map(f=>'data_processed/'+f)]);
const index={version:1,files:{}};
for(const file of files){
 const filename=path.join(root,file);if(!fs.existsSync(filename))continue;
 const buf=fs.readFileSync(filename),sha=crypto.createHash('sha256').update(buf).digest('hex'),refs=new Map();
 function add(v,record,locator,kind='recorded'){
  const url=safeURL(v);if(!url)return;
  if(!refs.has(url))refs.set(url,{url,title:record.title||record.provider||record.source_title||'자료에 기록된 원문',provider:record.provider||record.institution||null,reference_date:record.reference_date||record.source_as_of||record.evidence_date||null,retrieved_at:record.retrieved_at||null,raw_path:typeof record.raw_file==='string'&&/^(data|data_processed)\//.test(record.raw_file)?record.raw_file:null,locator,kind});
 }
 for(const s of registered.filter(s=>s.local_file===file))add(s.source_url,s,'data_sources.yaml → '+s.dataset,'registered');
 function walk(v,trail){
  if(!v||typeof v!=='object')return;
  if(Array.isArray(v)){v.forEach((r,i)=>walk(r,trail+'['+i+']'));return;}
  for(const k of ['source_url','url','download_url','attachment_url','source','reviewed_source'])if(typeof v[k]==='string')add(v[k],v,trail+'.'+k);
  for(const [k,child] of Object.entries(v))if(child&&typeof child==='object'&&!['geometry','coordinates','route_coordinates','source_hashes','source_disclosure_hashes'].includes(k))walk(child,trail+'.'+k);
 }
 if(file.endsWith('.json')||file.endsWith('.geojson')){const d=JSON.parse(buf.toString('utf8').replace(/^\uFEFF/,''));
  // Context manifest combines unrelated layers; each target only inherits its own layer.
  if(file.endsWith('context_layers_manifest.json'))walk(d.layers,'$.layers');else walk(d,'$');
 }
 const id=crypto.createHash('sha256').update(file).digest('hex').slice(0,16),entry={file,sha256:sha,originals:[...refs.values()],upstream:(dependencies[file.replace(/^data_processed\//,'')]||[]).map(f=>'data_processed/'+f),scope:'자료집에 기록된 원본 경로입니다. 개별 주장과 모든 링크가 일대일 대응하는 것은 아닙니다.'};
 fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(entry,null,2));index.files[file]={id,sha256:sha};
}
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(index,null,2));console.log('Source registry:',Object.keys(index.files).length,'input files');
