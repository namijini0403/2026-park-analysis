'use strict';
// One row per school (917), ~50 columns compiled from every analysis file. Built once and cached by file mtimes.
// The LLM never sees this table; it only sees the column dictionary and compact tool results.
const fs=require('node:fs'),path=require('node:path');
const model=require('./_school_summary'),data=require('./_data_answers');
const ROOT=path.join(__dirname,'..');
const FILES={
 dataset:'data_processed/education/analysis_dataset.json',
 priority:'data_processed/school_priority.csv',
 library:'data_processed/school_library_access.csv',
 libraryAccess:'data_processed/education/library_access_preview.json',
 sharedParks:'data_processed/education/shared_parks.json',
 boundary:'data_processed/education/boundary_comparison.json',
 walkshed:'data_processed/education/walkshed_500m.geojson',
 walkshedV3:'data_processed/school_walkshed_500m_v3.geojson',
 context:'data_processed/context/school_context_summary.json',
 academy:'data_processed/education/academy_school_context.json',
 clusters:'data_processed/education/academy_clusters.json',
 routes:'data_processed/education/school_routes.json',
 accidents:'data_processed/context/accidents_incheon.json',
 similar:'data_processed/school_similar_schools_top5.csv',
 forecastValidation:'data_processed/education/forecast_validation.json',
};
const PUBLIC={dataset:'학교알리미 공시·전국초중등학교위치표준데이터',priority:'도시공원표준데이터·OSM 보행망 분석',library:'초중고 학교도서관 현황(KESS)·전국도서관표준데이터',libraryAccess:'전국도서관표준데이터·주민등록 인구',sharedParks:'도시공원표준데이터·학교알리미',boundary:'한국교육시설안전원 학구도·OSM 보행망',walkshed:'OSM 보행망 500m 도달권',walkshedV3:'OSM 보행망 500m 도달권 v3',context:'인천교육청 지정사업·LOCALDATA 인허가·구별 착공신고',academy:'인천교육청 학원·교습소 등록',clusters:'인천교육청 학원·교습소 등록',routes:'도시공원표준데이터·OSM 보행망 경로',accidents:'도로교통공단 어린이 보행자 사고다발지역',similar:'학교알리미·정비사업·공동주택 자료(KNN)'};
// 영역(domain): 패널 카드와 통계 탭의 묶음 단위. direction: 값이 클수록 유리(up)·불리(down)·정책 판단 필요(neutral).
// direction은 표시용 주석이며 백분위를 뒤집지 않는다 (뒤집으면 그 자체가 평가등급이 된다).
const DOMAINS=[{id:'designation',label:'지정·지원사업'},{id:'park',label:'공원·야외'},{id:'reading',label:'도서·독서'},{id:'academy',label:'학원'},{id:'safety',label:'안전 환경'},{id:'boundary',label:'도보권·학구도'},{id:'trend',label:'학생 추세'},{id:'school',label:'학생·교원'},{id:'development',label:'주변 개발'}];
const DOMAIN_OF={designation:['designations_current','designation_names'],park:['parks_walk','green_ratio','nearest_park_m','park_route_m','park_detour_ratio','playgrounds_walk','shared_park_m2_per_student','park_sharing_schools','park_case'],reading:['books_total','books_per_student','library_seats','librarians','libraries_walk','nearest_public_library_m'],academy:['academies_500m','academies_per_km2'],safety:['nightlife_500m','nightlife_nearest_m','construction_500m','child_accident_nearest_m'],boundary:['walk_area_m2','walk_area_ratio_to_circle','zone_area_m2','zone_walk_mismatch_pct','zone_outside_walk_pct','walk_outside_zone_pct'],trend:['students_2020','student_change_pct','sen_slope','forecast_2029','forecast_2031','forecast_change_pct_2031'],school:['students','classes','teachers','class_size','students_per_teacher','paps','afterschool','clubs'],development:['large_apt_500m','large_apt_households_500m','redev_active']};
// 값이 클수록 유리한 것과 불리한 것만 적고, 나머지는 neutral로 둔다.
const UP=['green_ratio','parks_walk','playgrounds_walk','shared_park_m2_per_student','books_total','books_per_student','library_seats','librarians','libraries_walk','walk_area_m2','walk_area_ratio_to_circle','nightlife_nearest_m','child_accident_nearest_m','afterschool','clubs','teachers'];
const DOWN=['nearest_park_m','park_route_m','park_detour_ratio','park_sharing_schools','nearest_public_library_m','nightlife_500m','construction_500m','zone_walk_mismatch_pct','zone_outside_walk_pct','walk_outside_zone_pct','students_per_teacher'];
// Column dictionary: id → {label, unit, group, note}. Groups keep the system prompt short and scannable.
const COLUMNS={
 name:{label:'학교명',group:'기본',type:'text'},level:{label:'학교급',group:'기본',type:'text'},gu:{label:'군·구',group:'기본',type:'text'},island:{label:'도서·농어촌(강화·옹진)',group:'기본',type:'bool'},
 students:{label:'재학생 수',unit:'명',group:'학생·교원',note:'2026 공시'},classes:{label:'학급 수',unit:'개',group:'학생·교원'},teachers:{label:'교원 수',unit:'명',group:'학생·교원'},class_size:{label:'학급당 학생 수',unit:'명',group:'학생·교원'},students_per_teacher:{label:'교원 1인당 학생 수',unit:'명',group:'학생·교원'},
 paps:{label:'PAPS 체력 1·2등급 비율',unit:'%',group:'학생·교원',note:'초·중·고'},afterschool:{label:'방과후 프로그램 수',unit:'개',group:'학생·교원'},clubs:{label:'동아리 수',unit:'개',group:'학생·교원'},
 students_2020:{label:'2020 재학생 수',unit:'명',group:'추세·예측'},student_change_pct:{label:'2020→2026 재학생 변화율',unit:'%',group:'추세·예측'},sen_slope:{label:'연간 재학생 변화 기울기(Sen)',unit:'명/년',group:'추세·예측'},forecast_2029:{label:'2029 재학생 예측',unit:'명',group:'추세·예측',note:'모형 예측(오차 있음)'},forecast_2031:{label:'2031 재학생 예측',unit:'명',group:'추세·예측'},forecast_change_pct_2031:{label:'2026→2031 예측 변화율',unit:'%',group:'추세·예측'},
 parks_walk:{label:'도보 500m 공원 수',unit:'곳',group:'공원·야외',note:'보행망 도달권 안 공원 대표점'},green_ratio:{label:'도보권 녹지비율',unit:'%',group:'공원·야외'},nearest_park_m:{label:'가장 가까운 공원까지 거리',unit:'m',group:'공원·야외',note:'초등은 보행망 거리, 그 외 직선·경로 혼합'},park_route_m:{label:'공원 보행 경로 거리',unit:'m',group:'공원·야외',note:'중·고·유치원'},park_detour_ratio:{label:'공원 경로 우회율(경로÷직선)',unit:'배',group:'공원·야외'},playgrounds_walk:{label:'도보권 어린이 놀이시설 수',unit:'곳',group:'공원·야외',note:'초등'},shared_park_m2_per_student:{label:'공유 공원면적(학생 1인당)',unit:'㎡/명',group:'공원·야외',note:'여러 학교가 같은 공원을 나눠 쓴다고 가정'},park_sharing_schools:{label:'같은 공원을 공유하는 학교 수',unit:'개교',group:'공원·야외'},
 walk_area_m2:{label:'보행 500m 도달권 면적',unit:'㎡',group:'도보권·학구도'},walk_area_ratio_to_circle:{label:'도달권 면적÷직선 500m 원 면적',unit:'배',group:'도보권·학구도',note:'낮을수록 보행망이 끊겨 실제 도달 범위가 좁음'},zone_area_m2:{label:'학구도(통학구역) 면적',unit:'㎡',group:'도보권·학구도',note:'초·중 위주, 유치원 없음'},zone_walk_mismatch_pct:{label:'학구도와 도보권 불일치율',unit:'%',group:'도보권·학구도',note:'100×(1−겹침÷합집합). 클수록 두 구역 모양이 다름'},zone_outside_walk_pct:{label:'학구도 중 도보 500m 밖 비율',unit:'%',group:'도보권·학구도',note:'클수록 학구 학생 다수가 도보 500m 밖 거주 가능'},walk_outside_zone_pct:{label:'도보권 중 학구도 밖 비율',unit:'%',group:'도보권·학구도'},
 books_total:{label:'학교도서관 장서 수',unit:'권',group:'도서·독서',note:'2025'},books_per_student:{label:'학생 1인당 장서',unit:'권',group:'도서·독서'},library_seats:{label:'학교도서관 좌석 수',unit:'석',group:'도서·독서'},librarians:{label:'사서(교사+직원) 수',unit:'명',group:'도서·독서'},libraries_walk:{label:'도보권 공공·작은도서관 수',unit:'곳',group:'도서·독서'},nearest_public_library_m:{label:'가장 가까운 공공·어린이도서관 직선거리',unit:'m',group:'도서·독서'},
 academies_500m:{label:'직선 500m 안 학원·교습소 수',unit:'곳',group:'주변 환경'},academies_per_km2:{label:'학원 밀도(500m 반경)',unit:'곳/㎢',group:'주변 환경'},nightlife_500m:{label:'직선 500m 안 유흥·단란주점 수',unit:'곳',group:'주변 환경',note:'좌표 확보 기록 기준 하한치'},nightlife_nearest_m:{label:'가장 가까운 유흥·단란주점 거리',unit:'m',group:'주변 환경'},construction_500m:{label:'직선 500m 안 착공신고 공사장 수',unit:'곳',group:'주변 환경',note:'계양·미추홀·연수구만 수집, 그 외 null'},child_accident_nearest_m:{label:'가장 가까운 어린이 보행사고 다발지점 거리',unit:'m',group:'주변 환경',note:'2024 인천 11곳 기준'},large_apt_500m:{label:'500m 안 대단지 아파트 수',unit:'개',group:'주변 환경',note:'초등'},large_apt_households_500m:{label:'500m 안 대단지 세대수',unit:'세대',group:'주변 환경',note:'초등'},redev_active:{label:'주변 진행·예정 정비사업 수',unit:'건',group:'주변 환경',note:'초등'},
 designations_current:{label:'2026 지정·지원사업 수',unit:'건',group:'지정사업',note:'교육청 공개 명단 기준'},designation_names:{label:'2026 지정사업명',group:'지정사업',type:'text'},
 park_case:{label:'공원 접근 유형(Case)',group:'공원·야외',type:'text',note:'초등 · 이전 분석의 분류'},
};
for(const [domain,cols] of Object.entries(DOMAIN_OF))for(const c of cols)if(COLUMNS[c])COLUMNS[c].domain=domain;
for(const c of Object.keys(COLUMNS)){if(['name','level','gu','island'].includes(c))continue;COLUMNS[c].direction=UP.includes(c)?'up':DOWN.includes(c)?'down':'neutral';}
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const round=(v,d=1)=>v==null?null:Number(v.toFixed(d));
const hav=(a,b,c,d)=>{const R=6371000,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
let cache=null;
function stamp(){return Object.values(FILES).map(f=>{try{return fs.statSync(path.join(ROOT,f)).mtimeMs;}catch{return 0;}}).join('|');}
function build(){
 const key=stamp();if(cache?.key===key)return cache;
 const J=k=>model.read(FILES[k]),C=k=>data.read({id:'table:'+k,file:FILES[k]});
 const ds=J('dataset'),prio=C('priority'),lib=C('library'),libAccess=J('libraryAccess'),shared=J('sharedParks'),boundary=J('boundary'),walk=J('walkshed'),walkV3=J('walkshedV3'),ctx=J('context'),academy=J('academy'),clusters=J('clusters'),routes=J('routes'),accidents=J('accidents'),similar=C('similar');
 const by=(rows,k='학교ID')=>new Map(rows.map(r=>[r[k],r]));
 const prioBy=by(prio.data),libBy=new Map();for(const r of lib.data){if(libBy.has(r.학교ID))libBy.set(r.학교ID,null);else libBy.set(r.학교ID,r);}
 const libAccessBy=new Map(libAccess.data.schools.map(s=>[s.id,s])),sharedBy=new Map(shared.data.schools.map(s=>[s.id,s])),boundaryBy=new Map(boundary.data.rows.map(r=>[r.id,r]));
 const walkBy=new Map();for(const f of [...walk.data.features,...walkV3.data.features])if(!walkBy.has(f.properties.학교ID))walkBy.set(f.properties.학교ID,f.properties);
 const clusterBy=new Map((clusters.data.schools||[]).map(s=>[s.id,s])),simBy=by(similar.data);
 const acc=(accidents.data.rows||[]).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));
 const rows=ds.data.schools.map(s=>{
  const years=Object.keys(s.observations||{}).sort(),y=years.at(-1),o=s.observations?.[y]||{},p=prioBy.get(s.id),l=libBy.get(s.id),la=libAccessBy.get(s.id),sp=sharedBy.get(s.id),b=boundaryBy.get(s.id),w=walkBy.get(s.id),c=ctx.data.schools?.[s.id],a=academy.data[s.id],cl=clusterBy.get(s.id),rt=routes.data[s.id],sim=simBy.get(s.id);
  const hist=s.enrollment_trend?.observations||[],first=hist.find(h=>h.year===2020),f29=(s.forecast||[]).find(f=>f.year===2029),f31=(s.forecast||[]).find(f=>f.year===2031);
  const nearestAcc=acc.length&&Number.isFinite(s.lat)?Math.min(...acc.map(r=>hav(s.lat,s.lng,r.lat,r.lng))):null;
  const nightlife=c?.nightlife,cons=c?.construction,desig=c?.designations?.current||[];
  const nearestPark=p?num(p.nearest_park_dist_m):rt?.status==='available'?num(rt.route_distance_m):null;
  return {
   id:s.id,name:s.name,level:s.level,gu:s.gu||null,lat:s.lat??null,lng:s.lng??null,island:['강화군','옹진군'].includes(s.gu),data_year:y?Number(y):null,
   students:num(o.students),classes:num(o.classes),teachers:num(o.teachers),class_size:num(o.class_size),students_per_teacher:o.students&&o.teachers?round(o.students/o.teachers):null,paps:round(num(o.paps)),afterschool:num(o.afterschool),clubs:num(o.clubs),
   students_2020:num(first?.students),student_change_pct:first?.students&&o.students?round(100*(o.students-first.students)/first.students):null,sen_slope:round(num(s.enrollment_trend?.sen_slope_students_per_year)),forecast_2029:num(f29?.students),forecast_2031:num(f31?.students),forecast_change_pct_2031:f31?.students&&o.students?round(100*(f31.students-o.students)/o.students):null,
   parks_walk:num(s.environment?.parks),green_ratio:round(num(s.environment?.green)),nearest_park_m:nearestPark,park_route_m:rt?.status==='available'?round(num(rt.route_distance_m),0):null,park_detour_ratio:rt?.status==='available'?round(num(rt.detour_ratio),2):null,nearest_park_name:p?null:rt?.park_name||null,playgrounds_walk:p?num(p.iso_playground_count):null,shared_park_m2_per_student:sp?round(num(sp.shared_area_per_student)):null,park_sharing_schools:sp?num(sp.sharing_school_count):null,park_case:p?.case_label||null,
   walk_area_m2:w?Math.round(num(w.area_m2)):null,walk_area_ratio_to_circle:w?round(num(w.area_ratio_to_circle),2):null,zone_area_m2:b?.status==='computed'?Math.round(b.zone_m2):null,zone_walk_mismatch_pct:b?.status==='computed'?round(b.mismatch):null,zone_outside_walk_pct:b?.status==='computed'?round(b.zone_outside):null,walk_outside_zone_pct:b?.status==='computed'?round(b.walk_outside):null,zone_dates:b?.zone_dates||null,
   books_total:l?.matched===1?num(l.장서수):null,books_per_student:l?.matched===1?num(l.인당장서수):null,library_seats:l?.matched===1?num(l.좌석수):null,librarians:l?.matched===1?num(l.사서합계):null,libraries_walk:l?num(l.iso_library_count):num(s.environment?.library),nearest_public_library_m:la?round(num(la.nearest_m?.public_children),0):l?num(l.nearest_library_euclid_m):null,
   academies_500m:a?num(a.straight_500m_count):num(s.environment?.academy),academies_per_km2:cl?round(num(cl.facilities_per_km2_500m)):null,nightlife_500m:nightlife?.status==='partial'||nightlife?.status==='available'?num(nightlife.observed_count):nightlife?.observed_count??null,nightlife_nearest_m:num(nightlife?.nearest_observed_m),construction_500m:cons?.status==='unknown'?null:num(cons?.observed_count),child_accident_nearest_m:nearestAcc==null?null:Math.round(nearestAcc),large_apt_500m:sim?num(sim.large_apt_count_500m):null,large_apt_households_500m:sim?num(sim.large_apt_households_500m):null,redev_active:p?(num(p.redev_진행중수)||0)+(num(p.redev_예정수)||0):null,
   designations_current:c?desig.length:null,designation_names:desig.length?[...new Set(desig.map(d=>d.program_name||d.designation_type))].join(' · '):null,
  };
 });
 const coverage={};for(const col of Object.keys(COLUMNS)){coverage[col]={};for(const r of rows)if(r[col]!=null&&r[col]!=='')coverage[col][r.level]=(coverage[col][r.level]||0)+1;}
 const sources={dataset:{path:FILES.dataset,sha256:ds.hash},priority:{path:FILES.priority,sha256:prio.hash},library:{path:FILES.library,sha256:lib.hash},libraryAccess:{path:FILES.libraryAccess,sha256:libAccess.hash},sharedParks:{path:FILES.sharedParks,sha256:shared.hash},boundary:{path:FILES.boundary,sha256:boundary.hash},walkshed:{path:FILES.walkshed,sha256:walk.hash},walkshedV3:{path:FILES.walkshedV3,sha256:walkV3.hash},context:{path:FILES.context,sha256:ctx.hash},academy:{path:FILES.academy,sha256:academy.hash},clusters:{path:FILES.clusters,sha256:clusters.hash},routes:{path:FILES.routes,sha256:routes.hash},accidents:{path:FILES.accidents,sha256:accidents.hash},similar:{path:FILES.similar,sha256:similar.hash}};
 cache={key,rows,byId:new Map(rows.map(r=>[r.id,r])),coverage,sources};return cache;
}
// Which file backs each column (for source citations).
const COLUMN_SOURCE={students:'dataset',classes:'dataset',teachers:'dataset',class_size:'dataset',students_per_teacher:'dataset',paps:'dataset',afterschool:'dataset',clubs:'dataset',students_2020:'dataset',student_change_pct:'dataset',sen_slope:'dataset',forecast_2029:'dataset',forecast_2031:'dataset',forecast_change_pct_2031:'dataset',parks_walk:'dataset',green_ratio:'dataset',nearest_park_m:'priority',park_route_m:'routes',park_detour_ratio:'routes',playgrounds_walk:'priority',shared_park_m2_per_student:'sharedParks',park_sharing_schools:'sharedParks',park_case:'priority',walk_area_m2:'walkshed',walk_area_ratio_to_circle:'walkshed',zone_area_m2:'boundary',zone_walk_mismatch_pct:'boundary',zone_outside_walk_pct:'boundary',walk_outside_zone_pct:'boundary',books_total:'library',books_per_student:'library',library_seats:'library',librarians:'library',libraries_walk:'library',nearest_public_library_m:'libraryAccess',academies_500m:'academy',academies_per_km2:'clusters',nightlife_500m:'context',nightlife_nearest_m:'context',construction_500m:'context',child_accident_nearest_m:'accidents',large_apt_500m:'similar',large_apt_households_500m:'similar',redev_active:'priority',designations_current:'context',designation_names:'context'};
function dictionary(){
 const t=build(),groups={};
 for(const [id,c] of Object.entries(COLUMNS)){const cov=t.coverage[id]||{},covText=Object.entries(cov).map(([l,n])=>l.replace('학교','').replace('유치원','유')+n).join('/');(groups[c.group]||=[]).push(`${id}=${c.label}${c.unit?'('+c.unit+')':''}${c.note?' ※'+c.note:''} [${covText||'없음'}]`);}
 return Object.entries(groups).map(([g,cols])=>`[${g}] `+cols.join('; ')).join('\n');
}
function numericColumns(){return Object.keys(COLUMNS).filter(k=>!['text','bool'].includes(COLUMNS[k].type)&&k!=='name');}
function label(col){return COLUMNS[col]?.label||col;}
function unit(col){return COLUMNS[col]?.unit||'';}
function sourceFor(col){const t=build(),k=COLUMN_SOURCE[col]||'dataset';return {key:k,...t.sources[k],title:PUBLIC[k]};}
module.exports={build,COLUMNS,DOMAINS,dictionary,numericColumns,label,unit,sourceFor,FILES,PUBLIC,COLUMN_SOURCE};
