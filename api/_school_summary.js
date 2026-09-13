const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.join(__dirname,'..');
const cache=new Map();
function read(rel){const file=path.join(ROOT,rel),stamp=fs.statSync(file).mtimeMs;if(cache.get(rel)?.stamp!==stamp){const raw=fs.readFileSync(file);cache.set(rel,{stamp,data:JSON.parse(raw),hash:crypto.createHash('sha256').update(raw).digest('hex')});}return cache.get(rel);}
const labels={park:'공원·야외활동',library:'도서관',books:'학교 장서',sports:'운동',welfare:'돌봄'};
function registry(){return read('data_processed/education/analysis_dataset.json').data.schools;}
function list(){return registry().map(s=>({id:s.id,name:s.name,level:s.level,gu:s.gu,lat:Number.isFinite(s.lat)?s.lat:null,lng:Number.isFinite(s.lng)?s.lng:null})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));}
function verified(v){return ['use','safety','execution','route'].every(k=>v?.verification?.[k]==='verified'&&/^https?:\/\//.test(v.evidence?.[k]?.source_url||''))&&v.comparison_eligible===true;}
function summary(id,kind='park'){
 if(!Object.hasOwn(labels,kind))throw Error('확인할 자원을 선택해 주세요.');
 const school=registry().find(s=>s.id===id);if(!school)throw Error('선택 학교를 원장에서 찾을 수 없습니다.');
 const bundle=read('data_processed/student_services/priorities.json'),d=bundle.data;
 const s=d.schema_version===2?d.schools.find(s=>s.id===id):null;
 // 학교마다 같은 문구는 conditions가 아니라 limits로 둔다 (판단을 복잡하게만 한다).
 const limits=['이용자격·개방시간·안전·실행 여건과 실제 출입구 경로를 확인해야 합니다.','수집 범위와 현장 이용을 확인하기 전에는 관측 0을 확정 부족으로 판단하지 않습니다.'];
 let conditions=[],facilities=[];
 const sources=[{path:'data_processed/education/analysis_dataset.json',row:id,sha256:read('data_processed/education/analysis_dataset.json').hash}];
 if(kind!=='park'&&s?.layers?.[kind]){
  const l=s.layers[kind];
  conditions=[...conditions,...(l.reasons||[])];
  facilities=d.facilities.filter(f=>(l.access?.facility_ids||[]).includes(f.id)).map(f=>({name:f.name,lat:f.latitude??null,lng:f.longitude??null,address:f.address||'주소 미확보',condition:f.eligibility_note||'이용조건 미확보',url:f.source_url||null}));
  sources.push({path:'data_processed/student_services/priorities.json',row:id,sha256:bundle.hash});
 }else if(kind!=='park')conditions.push('이 학교·자원의 검증된 관측 묶음을 확보하지 못했습니다. 다른 학교 자료로 대신 판단하지 않습니다.');
 const separate=!!s?.separate_track||['강화군','옹진군'].includes(school.gu);
 if(separate)conditions.unshift('도서·농어촌 지역 학교입니다. 도시형 학교와 분리해 이동·운영 여건을 검토합니다.');
 const publicSources=require('./_public_sources'),extraFiles={park:['data_processed/parks.csv'],books:['data_processed/school_library_access.csv'],library:['data_processed/libraries.csv','data_processed/student_services/facilities.json'],sports:['data_processed/student_services/facilities.json'],welfare:['data_processed/student_services/facilities.json']}[kind]||[];
 const originals=[...new Map([...sources.map(src=>src.path),...extraFiles].flatMap(f=>publicSources.forFile(f)).map(o=>[o.url,o])).values()];
 return {school:{id:school.id,name:school.name,level:school.level,gu:school.gu},kind,label:labels[kind],status:'pending',status_label:'추가 확인 후 판단',separate_track:separate,conditions:[...new Set(conditions)],limits,facilities,sources,originals};
}
module.exports={read,registry,list,summary,verified,labels};
