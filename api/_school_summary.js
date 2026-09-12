const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.join(__dirname,'..');
const cache=new Map();
function read(rel){const file=path.join(ROOT,rel),stamp=fs.statSync(file).mtimeMs;if(cache.get(rel)?.stamp!==stamp){const raw=fs.readFileSync(file);cache.set(rel,{stamp,data:JSON.parse(raw),hash:crypto.createHash('sha256').update(raw).digest('hex')});}return cache.get(rel);}
const labels={park:'공원·야외활동',library:'도서관',books:'학교 장서',sports:'운동',welfare:'돌봄'};
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:1}):'미확보';
function registry(){return read('data_processed/education/analysis_dataset.json').data.schools;}
function list(){return registry().map(s=>({id:s.id,name:s.name,level:s.level,gu:s.gu,lat:Number.isFinite(s.lat)?s.lat:null,lng:Number.isFinite(s.lng)?s.lng:null})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));}
function verified(v){return ['use','safety','execution','route'].every(k=>v?.verification?.[k]==='verified'&&/^https?:\/\//.test(v.evidence?.[k]?.source_url||''))&&v.comparison_eligible===true;}
function summary(id,kind='park'){
 if(!Object.hasOwn(labels,kind))throw Error('확인할 자원을 선택해 주세요.');
 const school=registry().find(s=>s.id===id);if(!school)throw Error('선택 학교를 원장에서 찾을 수 없습니다.');
 const bundle=read('data_processed/student_services/priorities.json'),d=bundle.data;
 const s=d.schema_version===2?d.schools.find(s=>s.id===id):null;
 const years=Object.keys(school.observations||{}).sort(),year=years.at(-1),students=school.observations?.[year]?.students;
 const facts=[{label:'재학생',value:fmt(students)+(students==null?'':'명'),note:year?`${year}년 공시`:'기준연도 미확보'}];
 let conditions=['이용자격·개방시간·안전·실행 여건과 실제 출입구 경로를 확인해야 합니다.'],options=[],facilities=[];
 const sources=[{path:'data_processed/education/analysis_dataset.json',row:id,sha256:read('data_processed/education/analysis_dataset.json').hash}];
 if(kind==='park'){
  facts.push({label:'분석 도보권 공원',value:fmt(school.environment?.parks)+(school.environment?.parks==null?'':'곳'),note:'보행망 분석 관측값 · 출입구 경로는 미확인'}, {label:'추정 녹지비율',value:fmt(school.environment?.green)+(school.environment?.green==null?'':'%'),note:'현장 이용 가능 면적과 다를 수 있습니다.'});
  conditions.push('수집 범위와 현장 이용을 확인하기 전에는 관측 0을 확정 부족으로 판단하지 않습니다.');
  options=[{name:'기존 공원과 연결 검토',condition:'출입구·보행 경로·개방시간 확인'},{name:'학교 활동공간 보완 검토',condition:'활동면적·안전·운영인력·예산 확인'}];
 }else if(s?.layers?.[kind]){
  const l=s.layers[kind];
  if(kind==='books')facts.push({label:'학생당 장서',value:fmt(s.books?.per_student)+(s.books?.per_student==null?'':'권'),note:s.books?.year?`${s.books.year}년 자료`:'기준연도 미확보'},{label:'사서',value:fmt(s.books?.staff)+(s.books?.staff==null?'':'명'),note:'운영 여건은 별도 확인'});
  else facts.push({label:'지도 도달권 안 시설 관측',value:fmt(l.access?.network_count)+(l.access?.network_count==null?'':'곳'),note:'시설 대표점 포함 · 출입구 보행 확인 아님'});
  conditions=[...conditions,...(l.reasons||[])];options=(l.alternatives||[]).map(o=>({name:o.name,condition:o.condition}));
  facilities=d.facilities.filter(f=>(l.access?.facility_ids||[]).includes(f.id)).map(f=>({name:f.name,lat:f.latitude??null,lng:f.longitude??null,address:f.address||'주소 미확보',condition:f.eligibility_note||'이용조건 미확보',url:f.source_url||null}));
  sources.push({path:'data_processed/student_services/priorities.json',row:id,sha256:bundle.hash});
 }else conditions.push('이 학교·자원의 검증된 관측 묶음을 확보하지 못했습니다. 다른 학교 자료로 대신 판단하지 않습니다.');
 const separate=!!s?.separate_track||['강화군','옹진군'].includes(school.gu);
 if(separate)conditions.unshift('도서·농어촌 지역 학교입니다. 도시형 학교와 분리해 이동·운영 여건을 검토합니다.');
 const publicSources=require('./_public_sources'),extraFiles={park:['data_processed/parks.csv'],books:['data_processed/school_library_access.csv'],library:['data_processed/libraries.csv','data_processed/student_services/facilities.json'],sports:['data_processed/student_services/facilities.json'],welfare:['data_processed/student_services/facilities.json']}[kind]||[];
 const originals=[...new Map([...sources.map(src=>src.path),...extraFiles].flatMap(f=>publicSources.forFile(f)).map(o=>[o.url,o])).values()];
 return {school:{id:school.id,name:school.name,level:school.level,gu:school.gu},kind,label:labels[kind],status:'pending',status_label:'추가 확인 후 판단',separate_track:separate,facts,conditions:[...new Set(conditions)],options,facilities,sources,originals};
}
module.exports={read,registry,list,summary,verified,labels};
