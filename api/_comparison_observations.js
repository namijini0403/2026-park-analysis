const data=require('./_data_answers');
// Only these observed fields are exposed from the legacy elementary-school files.
const files={books:'data_processed/school_library_access.csv',similar:'data_processed/school_similar_schools_top5.csv',walkshed:'data_processed/school_walkshed_500m_v3.geojson',routes:'data_processed/school_nearest_park.csv'};
function load(id){const file=files[id];if(!file)return null;const b=data.read({id:'comparison-extra-'+id,file});return {...b,file};}
function extend({id,school,metric,sections,sources,registry}){
 if(school.level!=='초등학교'||!files[id])return;
 const b=load(id);sources.push({id:'observations#'+id,title:({books:'학교도서관 공시 원장',similar:'기존 유사학교 비교 기준',walkshed:'초등학교 분석 보행 도달권',routes:'초등학교 최근접 공원 거리 관측'})[id],source:b.file,body:'기존 초등학교 관측 자료. 파생 점수·우선순위·부족 분류는 사용하지 않습니다.',provenance:[{path:b.file,sha256:b.hash}]});
 if(id==='books'){
  const own=b.data.find(r=>r.학교ID===school.id),year=own?.기준일;
  for(const [field,title,unit] of [['장서수','학교 장서 총수','권'],['좌석수','학교도서관 좌석','석']]){
   const values=new Map(b.data.filter(r=>r.기준일===year&&r.matched===1).map(r=>[r.학교ID,Number.isFinite(r[field])?r[field]:null]));metric(title,unit,values,'observations#books',(year||'미확인')+'년 공시');
  }
 }
 if(id==='routes'){
  metric('최근접 공원 거리 관측','m',new Map(b.data.map(r=>[r.학교ID,r.nearest_park_dist_m])),'observations#routes','초등학교 기존 거리 원장');
  sections.at(-1).notes.push('이 원장에는 경로 산출 방법과 출입구 검증이 함께 기록되어 있지 않아 검증된 도보거리로 단정하지 않습니다.');
 }
 if(id==='similar'){
  const own=b.data.find(r=>r.학교ID===school.id);if(!own)return;
  const rows=[];for(let i=1;i<=5;i++){const sid=own['similar_school_'+i+'_id'];if(!sid)continue;const s=registry.find(s=>s.id===sid);rows.push([s?.name||own['similar_school_'+i+'_name'],s?.gu,own['similar_school_'+i+'_nearest_park_dist_m'],own['similar_school_'+i+'_iso_green_ratio'],own['similar_school_'+i+'_iso_playground_count']]);}
  sections.push({title:'기존 유사학교 · 서로 다른 관측 항목',table:{headers:['학교','지역','공원 거리 m','녹지비율 %','놀이시설 관측 수'],rows},chart:{kind:'bar',unit:'m',points:rows.filter(r=>Number.isFinite(r[2])).map(r=>({name:r[0],value:r[2]}))},notes:['기존 학생 규모·추세·주거개발 조건으로 선정한 이웃입니다. 현재 답변의 학생 수 ±20% 비교집단과 다른 집단입니다. 각 관측값은 합산하지 않습니다.','선정 변수: '+own.selection_features]});
 }
 if(id==='walkshed'){
  const features=b.data.features.filter(f=>f.properties.학교ID===school.id||f.properties.school_id===school.id||f.properties.id===school.id);
  sections.push({title:'초등학교 500m 분석 보행 도달권',geometries:features.map(f=>({type:'Feature',geometry:f.geometry,properties:{name:school.name}})),map:[{name:school.name,lat:school.lat,lng:school.lng,selected:true}],notes:['보행망 기반 분석 폴리곤이며 학교·시설 실제 출입구와 통행 허용·안전을 확인한 경계가 아닙니다.'],table:{headers:['학교','확보 도형 수'],rows:[[school.name,features.length]]}});
 }
}
module.exports={extend,files};
