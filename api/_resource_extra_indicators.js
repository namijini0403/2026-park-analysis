'use strict';
// Additional source-backed resource fields. No school ranking, composite or inferred absence.
const model=require('./_school_summary');
const FILES={resourceLibraryDisclosure:'data_processed/education/library_indicators_2026.json',resourceLibraryAccess:'data_processed/education/library_access_preview.json',resourceSharedParks:'data_processed/education/shared_parks.json',resourceRoutes:'data_processed/education/school_routes.json',resourceBoundary:'data_processed/education/boundary_comparison.json',resourceAcademy:'data_processed/education/academy_school_context.json',resourceCurriculum:'data_processed/education/curriculum_network.json',resourceResidential:'data_processed/education/residential_scenario.json',resourceResilience:'data_processed/education/road_resilience.json'};
const PUBLIC={resourceLibraryDisclosure:'학교알리미 2026 학교도서관 현황(항목58)',resourceLibraryAccess:'전국도서관표준데이터·2024 공개 인구 거리권 분석',resourceSharedParks:'도시공원표준데이터·2026 공시 재학생 공유 가정',resourceRoutes:'도시공원표준데이터·OSM 보행망 경로',resourceBoundary:'한국교육시설안전원 학구도·OSM 도달권 교차',resourceAcademy:'인천교육청 학원·교습소 등록 위치',resourceCurriculum:'인천교육청 2026학년도 2학기 공동교육과정 공고',resourceResidential:'OSM 주거구역 내부 통행 가정',resourceResilience:'OSM 도로 구간 제거 가정'};
const COLUMNS={},COLUMN_SOURCE={},specs=[];
const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const at=(r,path)=>path.split('.').reduce((v,k)=>v?.[k],r);
function add(id,label,unit,domain,source,path,note,kind='observation',gate=null,transform=null){
 COLUMNS[id]={label,unit,group:({reading:'도서·독서',park:'공원·야외',academy:'학원',boundary:'도보권·학구도',development:'주변 개발',school:'공동교육과정'}[domain]||domain),domain,direction:'neutral',note,kind};COLUMN_SOURCE[id]=source;specs.push({id,source,path,gate,transform});
}
const libraryNote='학교알리미 2026 공시 항목58 · 초·중·고 자료. 기존 KESS2025 지표와 기준연도·정의가 다릅니다. 비공시·미확보는 0으로 계산하지 않습니다.';
for(const [id,label,unit,path] of [
 ['library_books_2026','학교도서관 도서자료(2026)','권','10.values.GNRL_BOKS_FGR'],
 ['library_nonbooks_2026','학교도서관 비도서자료(2026)','개','10.values.NN_BOS_DTA_FGR'],
 ['library_materials_2026','학교도서관 전체 자료(2026)','개','10.values.SUMCNT'],
 ['library_materials_per_student_2026','학생 1인당 장서·자료(2026 공시)','개/명','10.values.RATIO'],
 ['library_rooms_2026','학교도서관 수(2026)','개','20.values.LBRRY_FGR'],
 ['library_seats_2026','학교도서관 총좌석(2026)','석','20.values.BKRUM_FGR'],
 ['library_certified_staff_2026','도서관 사서자격증 보유 인력(2026)','명','20.values.LBRRY_CRQFC_RET_STAFF_FGR'],
 ['library_noncertified_staff_2026','도서관 사서자격증 미보유 인력(2026)','명','20.values.LBRRY_CRQFC_UN_RET_STAFF_FGR'],
 ['library_purchase_budget_2026','도서관 자료구입비 예산(2026)','원','20.values.PRTI_DTA_PHS_CST'],
 ['library_operating_budget_2026','도서관 운영비 예산(2026)','원','20.values.PRTI_LBRRY_OPER_CST'],
 ['library_annual_loans_2026','연간 학생 대출자료(2026 공시)','권','30.values.LBRRY_LN_DTA_FGR'],
 ['library_annual_borrowers_2026','연간 학생 대출자수(2026 공시)','명','30.values.LBRRY_LEND_STDNT_FGR'],
 ['library_loans_per_student_2026','학생 1인당 대출자료(2026 공시)','권/명','30.values.DATA1'],
])add(id,label,unit,'reading','resourceLibraryDisclosure',path,libraryNote+(path.startsWith('30')?' 공시 원값이며 전년도 학생수 기준; 실제 고유 이용자수·참여율로 재계산하지 않습니다.':''),'observation',r=>r?.[path.split('.')[0]]?.year===2026&&r[path.split('.')[0]].values?.PBAN_EXCP_YN==='N');
add('nearest_library_including_small_m','가장 가까운 도서관 직선거리(작은도서관 포함)','m','reading','resourceLibraryAccess','nearest_m.including_small','공공·어린이·작은도서관 포함 · 직선거리. 출입구·운영시간·아동 이용조건과 인천 밖 공급은 미확인.','estimate');
for(const supply of ['public_children','including_small'])for(const [index,radius] of [500,1000,1500,2000,2500].entries())add('libraries_'+supply+'_'+radius+'m','직선 '+radius+'m 도서관 수('+ (supply==='public_children'?'공공·어린이':'작은도서관 포함')+')','곳','reading','resourceLibraryAccess','counts_by_radius.'+supply+'.'+index,'수집한 위치 원장 기준 직선거리 집계. 도달권 포함·실제 이용 가능성을 뜻하지 않으며 공급 유형은 서로 동등하지 않습니다.');
for(const [index,label] of ['유치원','초등','중등','고등'].entries())add('resident_age_'+index+'_500m_estimate','직선500m '+label+' 연령 인구 추정','명','development','resourceLibraryAccess','age_population_500m.'+index,'2024 공개 인구를 100m 격자 중심점으로 집계한 추정. 1km 연령을 총인구 비중으로 배분. 등록학생·시설이용자 아님. 연령 결측 격자가 있으면 미산출.','estimate',r=>r?.missing_age_cells_500m?.[index]===0);
for(const [id,label,path,unit,scale] of [
 ['park_full_area_per_student_scenario','공원 전체면적÷해당학교 학생수 가정','full_area_per_own_student','㎡/명',1],
 ['park_same_level_area_per_student_scenario','동일 학교급끼리 공원 공유 가정 면적','same_level_shared_area_per_student','㎡/명',1],
 ['park_largest_loss_pct_scenario','최대 기여 공원 제거 시 면적 손실 비율','largest_park_loss_share','%',100]
])add(id,label,unit,'park','resourceSharedParks',path,'2026 재학생 기준 배분 가정. 공시 전체 공원면적은 실사용면적·수용량이 아님. 대표점은 출입구 아님. 제거 후 재배분 없음; 학생 수나 비교 분모가 없으면 계산을 보류합니다.','scenario',null,v=>v*scale);
for(const [id,label,path] of [['park_target_straight_m','경로 대상 공원까지 직선거리','straight_distance_m'],['park_origin_snap_m','학교 대표점·보행망 연결거리','origin_snap_m'],['park_destination_snap_m','공원 대표점·보행망 연결거리','destination_snap_m']])add(id,label,'m','park','resourceRoutes',path,'OSM 경로 계산의 동일 학교·공원 대표점 기준. 유효 경로만 표시. 연결선·출입구·통행허용·안전은 현장 미검증.','estimate',r=>r?.status==='available');
for(const [grade,label] of Object.entries({motorway:'고속도로급',trunk:'간선도로급',primary:'주요도로급',secondary:'보조간선급',tertiary:'집산도로급',other:'기타도로급',unknown:'등급 미확인'}))add('park_route_'+grade+'_m','공원 경로 '+label+' 구간 길이','m','park','resourceRoutes','road_exposure.groups.'+grade+'.length_m','선택된 OSM 최단경로의 highway 태그별 길이. 양끝 연결선 제외. 실제 횡단횟수·위험도·안전등급이 아니며 태그 누락·오류 가능.','estimate',r=>r?.status==='available');
add('zone_walk_intersection_m2','학구도·보행500m 도달권 겹침 면적','㎡','boundary','resourceBoundary','intersection_m2','학구도 원장과 OSM 도달권의 도형 교차 면적. 실제 거주학생·출입구 접근성·통학 안전을 확인한 결과가 아닙니다.','estimate',r=>r?.status==='computed');
add('academies_walkshed','보행 도달권 내 학원·교습소 관측','곳','academy','resourceAcademy','walkshed_count','좌표를 확보한 등록시설 대표점 포함 집계. 6,839개 중 좌표확보6,810개 원장 기준. 출입구 경로·참여율·교육품질 아님.');
add('academies_arts_sports_500m','직선500m 예술·체육 학원 관측','곳','academy','resourceAcademy','arts_sports_count','등록 교습분류의 예술·체육 시설 수. 위치 미확보 시설 제외. 학생 실제 이용·사교육 참여율 아님.');
for(const [id,label,unit,path] of [['curriculum_advertised_courses','공동교육과정 공고 과목수','과목','advertised_courses'],['curriculum_advertised_seats','공동교육과정 공고 모집인원 합','명','advertised_seats'],['curriculum_subject_groups','공동교육과정 공고 과목군 수','개','subject_groups'],['curriculum_hub_courses','공동교육과정 거점형 공고 과목수','과목','by_kind.거점형'],['curriculum_online_courses','공동교육과정 온라인형 공고 과목수','과목','by_kind.온라인형'],['curriculum_band_courses','공동교육과정 밴드형 공고 과목수','과목','by_kind.밴드형']])add(id,label,unit,'school','resourceCurriculum',path,'2026학년도 2학기 고등학교 공개 공고 원장 기준. 0은 수집 공고에서 미관측. 개설확정·실제 등록/고유 학생수 아님; 전수 사업목록 아님.');
for(const [id,label,unit,path] of [['residential_area_scenario','주거구역 내부통행 가정 도달영역','㎡','scenario.area_m2'],['residential_added_area_scenario','주거구역 내부통행 가정 추가영역','㎡','added_area_m2'],['residential_park_proxy_area_scenario','내부통행 가정 영역의 공원대체면적','㎡','scenario.park_proxy_area_m2'],['residential_park_proxy_pct_scenario','내부통행 가정 영역의 공원대체면적 비율','%','scenario.park_proxy_ratio_pct']])add(id,label,unit,'boundary','resourceResidential',path,'중·고·유치원 OSM 주거구역 내부통행 가정. 실제 500m 이동거리·출입허용·안전 미검증. 공원면적 원형 대체값 사용. 현재 도달권을 바꾸지 않음.','scenario',r=>['scenario_added','no_added_area_under_assumption'].includes(r?.status));
for(const [id,label,unit,path] of [['road_closure_tested_segments','도로구간 제거 가정 검사 구간수','개','tested_segments'],['road_closure_lost_access_segments','구간 제거 시 500m 공원 경로 미확보 수','개','segments_losing_500m_access'],['road_closure_max_extra_m','도로구간 제거 가정 최대 추가거리','m','max_extra_distance_m']])add(id,label,unit,'boundary','resourceResilience',path,'기초 공원 경로가500m 이내인 학교만 OSM 양끝노드 구간 제거 실험. 실제 폐쇄·확률·안전 아님. 기초경로 미확보는0 아님; 전체망 단절 아님.','scenario',r=>r?.status==='available');
function load(schools){
 const data={},sources={};for(const [key,path] of Object.entries(FILES)){const r=model.read(path);data[key]=r.data;sources[key]={path,sha256:r.hash};}
 // Resolve positional arrays from their source metadata before applying the fixed public columns.
 const access=data.resourceLibraryAccess,radii=[500,1000,1500,2000,2500],levels=['유치원','초등학교','중학교','고등학교'];
 const remap=(values,metadata,expected)=>expected.map(key=>{const index=Array.isArray(metadata)?metadata.indexOf(key):-1;return index>=0?values?.[index]??null:null;});
 const accessRows=access.schools.map(r=>({...r,counts_by_radius:Object.fromEntries(['public_children','including_small'].map(supply=>[supply,remap(r.counts_by_radius?.[supply],access.radii_m,radii)])),age_population_500m:access.base_year===2024?remap(r.age_population_500m,access.levels,levels):levels.map(()=>null),missing_age_cells_500m:remap(r.missing_age_cells_500m,access.levels,levels)}));
 const curriculumRows=data.resourceCurriculum.school_year===2026&&data.resourceCurriculum.semester===2?data.resourceCurriculum.schools:[];
 const maps={resourceLibraryDisclosure:new Map(data.resourceLibraryDisclosure.schools.map(r=>[r.id,r.internal_library])),resourceLibraryAccess:new Map(accessRows.map(r=>[r.id,r])),resourceSharedParks:new Map(data.resourceSharedParks.schools.map(r=>[r.id,r])),resourceRoutes:new Map(Object.entries(data.resourceRoutes)),resourceBoundary:new Map(data.resourceBoundary.rows.map(r=>[r.id,r])),resourceAcademy:new Map(Object.entries(data.resourceAcademy)),resourceCurriculum:new Map(curriculumRows.map(r=>[r.id,r])),resourceResidential:new Map(Object.entries(data.resourceResidential.schools)),resourceResilience:new Map(data.resourceResilience.schools.map(r=>[r.id,r]))};
 const byId=new Map();for(const school of schools){const values={};for(const spec of specs){const row=maps[spec.source].get(school.id);let value=row&&(!spec.gate||spec.gate(row))?finite(at(row,spec.path)):null;if(value!==null&&spec.transform)value=spec.transform(value);values[spec.id]=value;}byId.set(school.id,values);}return {byId,sources};
}
module.exports={FILES,PUBLIC,COLUMNS,COLUMN_SOURCE,load};
