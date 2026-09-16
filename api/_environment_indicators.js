'use strict';
const model=require('./_school_summary'),data=require('./_data_answers');
const FILES={envNightlife:'data_processed/context/facilities_nightlife.geojson',envConstruction:'data_processed/context/facilities_construction.geojson',envAccidents:'data_processed/context/accidents_incheon.json',envApartments:'data_processed/large_apt_complexes_2025.csv',envRedevelopment:'data_processed/redevelopment_geocoded.csv',envPlaygrounds:'data_processed/geocoded_playground.csv'};
const PUBLIC={envNightlife:'LOCALDATA 유흥·단란주점 인허가·좌표 확보 기록',envConstruction:'계양·미추홀·연수구 착공·사용승인 행정기록',envAccidents:'도로교통공단 2024 어린이 보행사고 다발지역 중심점',envApartments:'2025 대단지 아파트 좌표 원장',envRedevelopment:'정비사업 주소 기반 좌표 원장',envPlaygrounds:'어린이 놀이시설 지오코딩 원장'};
const COLUMNS={},COLUMN_SOURCE={};
FILES.envDesignations='data_processed/context/school_designations.json';
PUBLIC.envDesignations='교육청 지정·지원사업 공식 명단·지정기간';
function column(id,label,unit,domain,source,note){COLUMNS[id]={label,unit,domain,group:domain==='designation'?'지정사업':domain==='park'?'공원·야외':domain==='development'?'개발·주거':'주변 환경',direction:'neutral',note};COLUMN_SOURCE[id]=source;}
column('nightlife_500m','직선 500m 안 유흥·단란주점 관측 수','곳','safety','envNightlife','정상 영업·좌표 확보 인허가 기록의 하한 관측치. 미좌표 기록 제외; 현재 영업·실제 접근·위험 미확인.');
column('nightlife_nearest_m','가장 가까운 관측 유흥·단란주점 직선거리','m','safety','envNightlife','500m로 제한하지 않은 보유 정상 영업·좌표 확보 원장 기준. 미좌표 업소가 더 가까울 수 있으므로 실제 최근접 거리는 미확인.');
column('construction_500m','직선 500m 안 착공·사용승인 기록 수','건','safety','envConstruction','계양·미추홀·연수구만 수집. 사용승인 완료도 포함한 행정기록이며 현재 공사 위험이 아님. 좌표 미확보 제외한 하한 관측치.');
column('construction_nearest_m','가장 가까운 관측 착공·사용승인 기록 직선거리','m','safety','envConstruction','수집 지역 학교만 산출. 보유 3개 구의 주소 추정 좌표 중 최근접 기록; 현재 공사·실제 현장 위치 미확인.');
column('child_accident_count_500m','직선 500m 안 어린이 보행사고 다발지점 수','곳','safety','envAccidents','2024 다발지역 중심점 원장 기준. 사고 건수·구역 중첩·현재 위험도가 아님.');
column('apartments_straight_500m','직선 500m 안 대단지 아파트 관측 수','곳','development','envApartments','2025 원장 대표 좌표 기준. 출입구·학구·실거주 학생 수 미확인.');
column('apartment_households_straight_500m','직선 500m 안 관측 대단지 세대수','세대','development','envApartments','원장 대표점이 500m 안인 단지 전체 세대수의 합. 실제 범위 안 세대·학생 수 아님. 세대수 결측 단지가 있으면 미산출.');
column('redevelopment_straight_500m','직선 500m 안 정비사업 관측 수','건','development','envRedevelopment','원장 전체 진행단계 포함. 사업 대표점 기준이며 현재 진행·미래 입주 확정 수 아님.');
column('redevelopment_area_straight_500m','직선 500m 안 관측 정비사업 전체 면적','㎡','development','envRedevelopment','대표점이 500m 안인 사업의 원장 전체 면적 합. 생활권과 겹친 면적 아님; 면적 결측 사업이 있으면 미산출.');
column('playgrounds_straight_500m','직선 500m 안 어린이 놀이시설 관측 수','곳','park','envPlaygrounds','지오코딩된 시설 원장의 대표 좌표 기준. 도보 접근·개방·이용자격 미확인.');
column('designations_current','현재 지정·지원사업 관측 수','건','designation','envDesignations','수집 공식 명단의 현재 기간 상태 기준. 2025년 등 이전 선정 사업도 지정기간이 현재이면 포함. 같은 사업명·유형이 여러 연도에 반복되면 최신 명단 한 건. 명단 미관측 0은 미지정 확정이 아님. 지원 자격·현재 실행·전체 사업 전수 여부 미확인.');
column('designation_selected_2026','2026 선정·공시 명단의 현재 지정사업 수','건','designation','envDesignations','현재 지정기간인 명단 중 school_year가 2026인 기록만 집계. 과거 선정 후 계속 지정 중인 사업은 현재 지정사업 수에서 확인.');
column('designation_names','현재 공식 명단 지정·지원사업명','','designation','envDesignations','학교 ID 우선, 없으면 같은 학교급의 유일한 정확한 이름으로 연결. 이전 선정 후 지정기간이 계속되는 사업 포함. 이름 중복은 판단 보류.');
COLUMNS.designation_names.type='text';
const normalizeName=v=>String(v||'').normalize('NFC').replace(/\s+/g,'');
const compatibleLevel=(source,target)=>source===target||target==='고등학교'&&['일반고','직업계고'].includes(source);
function designationMatches(schools,records){
 const registry=new Map(schools.map(s=>[s.id,s])),assigned=new Map(schools.map(s=>[s.id,new Map()])),ambiguous=new Set(),unresolved=[];
 for(const r of records){
  if(r.period_status!=='current'||r.verification_status!=='official_roster')continue;
  const linked=registry.get(r.match?.school_id);
  const matches=linked&&compatibleLevel(r.school_level,linked.level)?[linked]:schools.filter(s=>compatibleLevel(r.school_level,s.level)&&normalizeName(s.name)===normalizeName(r.school_name));
  if(matches.length!==1||!r.designation_id){for(const s of matches)ambiguous.add(s.id);unresolved.push({designation_id:r.designation_id,school_name:r.school_name,school_level:r.school_level,reason:matches.length>1?'ambiguous_exact_name':!r.designation_id?'missing_designation_id':'no_exact_registry_match',candidate_ids:matches.map(s=>s.id)});continue;}
  assigned.get(matches[0].id).set(r.designation_id,r);
 }
 return {assigned,ambiguous,unresolved};
}
const numeric=v=>v==null||typeof v==='boolean'||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
function valid(p){return Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;}
function distance(a,b){const rad=Math.PI/180,x=(b.lat-a.lat)*rad,y=(b.lng-a.lng)*rad,z=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(z),Math.sqrt(Math.max(0,1-z)));}
function points(features,predicate){return features.filter(f=>f.geometry?.type==='Point'&&f.properties?.coord_valid===true&&predicate(f.properties)).map(f=>({...f.properties,lng:numeric(f.geometry.coordinates[0]),lat:numeric(f.geometry.coordinates[1])})).filter(valid);}
function csvPoints(rows){return rows.map(r=>({...r,lat:numeric(r.위도),lng:numeric(r.경도)})).filter(valid);}
function nearby(s,records){if(!valid(s)||!records.length)return null;const all=records.map(r=>({record:r,d:distance(s,r)}));return {hits:all.filter(x=>x.d<=500),nearest:Math.min(...all.map(x=>x.d))};}
function sum(hits,key){const values=hits.map(x=>numeric(x.record[key]));return values.every(v=>v!=null&&v>=0)?values.reduce((a,b)=>a+b,0):null;}
function load(schools){
 const inputs={},sources={};for(const [key,file] of Object.entries(FILES)){const r=file.endsWith('.csv')?data.read({id:key,file}):model.read(file);inputs[key]=r.data;sources[key]={path:file,sha256:r.hash};}
 const nightlife=points(inputs.envNightlife.features,p=>p.is_active===true),construction=points(inputs.envConstruction.features,()=>true);
 const covered=new Set(construction.map(p=>p.gu).filter(Boolean)),accidents=inputs.envAccidents.rows.map(r=>({...r,lat:numeric(r.lat),lng:numeric(r.lng)})).filter(valid);
 const apartments=csvPoints(inputs.envApartments),redevelopment=csvPoints(inputs.envRedevelopment),playgrounds=csvPoints(inputs.envPlaygrounds),byId=new Map(),designation=designationMatches(schools,inputs.envDesignations.records);
 for(const s of schools){
  const n=nearby(s,nightlife),c=covered.has(s.gu)?nearby(s,construction):null,a=nearby(s,accidents),ap=nearby(s,apartments),re=nearby(s,redevelopment),pl=nearby(s,playgrounds);
  byId.set(s.id,{nightlife_500m:n?n.hits.length:null,nightlife_nearest_m:n?Math.round(n.nearest):null,construction_500m:c?c.hits.length:null,construction_nearest_m:c?Math.round(c.nearest):null,child_accident_count_500m:a?a.hits.length:null,apartments_straight_500m:ap?ap.hits.length:null,apartment_households_straight_500m:ap?sum(ap.hits,'세대수'):null,redevelopment_straight_500m:re?re.hits.length:null,redevelopment_area_straight_500m:re?sum(re.hits,'면적'):null,playgrounds_straight_500m:pl?pl.hits.length:null});
  const latest=new Map();for(const entry of designation.assigned.get(s.id).values()){const key=JSON.stringify([entry.program_name,entry.designation_type]);if(!latest.has(key)||(entry.school_year||0)>(latest.get(key).school_year||0))latest.set(key,entry);}
  const entries=[...latest.values()],deferred=designation.ambiguous.has(s.id);
  Object.assign(byId.get(s.id),{designations_current:deferred?null:entries.length,designation_selected_2026:deferred?null:entries.filter(r=>r.school_year===2026).length,designation_names:deferred||!entries.length?null:[...new Set(entries.map(r=>r.program_name||r.designation_type).filter(Boolean))].join(' · ')});
 }
 return {byId,sources,designation_report:{unresolved:designation.unresolved,ambiguous_school_ids:[...designation.ambiguous],matched_records:[...designation.assigned.values()].reduce((n,r)=>n+r.size,0)}};
}
module.exports={FILES,PUBLIC,COLUMNS,COLUMN_SOURCE,load};
