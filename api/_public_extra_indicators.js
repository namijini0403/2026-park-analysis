'use strict';
// Explicit public observations and separately labelled estimates/scenarios. No scores.
const model=require('./_school_summary');
const FILES={extraPublic:'data_processed/education/school_public_indicators.json',extraProgression:'data_processed/education/school_progression.json',extraCohort:'data_processed/education/grade_cohort_scenarios.json',extraAge:'data_processed/education/school_age_demand.json',extraForecast:'data_processed/education/analysis_dataset.json'};
const PUBLIC={extraPublic:'학교알리미 2026 장학·동아리·방과후 공시',extraProgression:'KESS 학교별 졸업 후 상황(2025·2026)',extraCohort:'학교알리미 학년별 재학생 관측·입학인원 유지 시나리오',extraAge:'2024 연령 인구 공간 배분 추정',extraForecast:'학교 재학생 모형 예측'};
const COLUMNS={},COLUMN_SOURCE={};
function add(id,label,unit,domain,source,note,kind='observation'){COLUMNS[id]={label,unit,group:domain==='trend'?'추세·예측':'학생·교원',domain,direction:'neutral',note,kind};COLUMN_SOURCE[id]=source;}
const publicMetrics=[
 ['scholarship_students_2026','55','SCHO_NMPR_FGR','장학금 수혜 인원','명'],
 ['scholarship_amount_2026','55','SCHO_AMT','장학금 금액','원'],
 ['tuition_support_students_2026','55','SCE_RDCTN_NMPR_FGR','학비 지원 인원','명'],
 ['tuition_support_amount_2026','55','SCE_RDCTN_AMT','학비 지원 금액','원'],
 ['creative_clubs_2026','56','CREAT_EXPER_ACT_CCCLU_FGR','창의적 체험활동 동아리 수','개'],
 ['creative_club_students_2026','56','CREAT_EXPER_ACT_STDNT_FGR','창의적 체험활동 동아리 참여 인원','명'],
 ['voluntary_clubs_2026','56','STDNT_SLCTL_CCCLU_FGR','학생 자율 동아리 수','개'],
 ['voluntary_club_students_2026','56','STDNT_SLCTL_FGR','학생 자율 동아리 참여 인원','명'],
 ['afterschool_subject_programs_2026','59','ASL_CURR_PGM_FGR','방과후 교과 프로그램 수','개'],
 ['afterschool_specialty_programs_2026','59','ASL_SPABL_APTD_PGM_FGR','방과후 특기적성 프로그램 수','개'],
 ['afterschool_subject_students_2026','59','ASL_CURR_REG_STDNT_FGR','방과후 교과 수강 인원','명'],
 ['afterschool_specialty_students_2026','59','ASL_SPABL_APTD_REG_STDNT_FGR','방과후 특기적성 수강 인원','명'],
 ['afterschool_participants_2026','59','ASL_PTPT_STDNT_FGR','방과후학교 참여 인원','명'],
];
for(const [id,item,field,label,unit] of publicMetrics)add(id,'2026 공시 '+label,unit,'school','extraPublic','공시연도와 실제 활동 기간은 다를 수 있음. 참여 인원끼리 합산하거나 재학생 수로 임의 비율을 만들지 않음. 미공시는 0 아님.');
for(let grade=1;grade<=6;grade++)add('grade'+grade+'_students_2026','2026 '+grade+'학년 재학생 수','명','school','extraCohort','2026 학교알리미 학년별 관측. 초등 1~6학년, 중·고 1~3학년만 해당. 특수학급 등 별도 인원은 학년 합계와 다를 수 있음.');
const outcomes=[['graduates','졸업자 수','명'],['advanced','진학 등록자 수','명'],['published_progression_pct','공시 진학률','%'],['employed','취업자 수','명'],['military','입대자 수','명'],['other','기타 졸업 후 상황 인원','명'],['domestic_junior_college','국내 전문대 진학자 수','명'],['domestic_university','국내 대학 진학자 수','명'],['overseas_junior_college','국외 전문대 진학자 수','명'],['overseas_university','국외 대학 진학자 수','명']];
for(const [field,label,unit] of outcomes)add('high_'+field+'_2025','2025 고등학교 '+label,unit,'school','extraProgression','2025년 2월 졸업자 기준 KESS 공개 관측. 학교 품질·성취 순위가 아님. 기타는 재수·미확인 등 복합 상황이며 실패가 아님. 취업률 임의 산출 금지.');
add('graduates_2026','2026 졸업자 수','명','school','extraProgression','2026년 2월 졸업자 기준. 고등학교의 졸업 후 상황 미공개와 졸업자 수를 구분. 미공개 상태의 0은 확인 보류.');
add('middle_advanced_2026','2026 중학교 진학 등록자 수','명','school','extraProgression','2026 KESS 공개 관측. 고등학교 진학 상황 미공개 값을 대신 사용하지 않음.');
add('middle_progression_pct_2026','2026 중학교 공시 진학률','%','school','extraProgression','2026 KESS 공개 진학률. 졸업자 0이면 비율 미산출. 학교 품질·성취 순위가 아님.');
for(const [scope,label] of [['straight_500m','직선 500m'],['walkshed_500m','보행 도달권 500m']])add('age_residents_'+scope+'_2024','2024 '+label+' 해당 학교급 연령 인구 추정','명','trend','extraAge','해당 학교급 연령대의 2024 공간 배분 추정. 재학생·미래 수요가 아님. 학교 권역이 겹치므로 학교 간 합산 금지. 미확보 소계로 전체 추정을 대체하지 않음. 실제 출입구 접근·안전 미검증.','estimate');
for(const year of [2027,2028,2030])add('forecast_'+year,year+' 재학생 모형 예측','명','trend','extraForecast','현재 앱과 동일한 모형 예측. 실제 재학생이나 확정 수요가 아니며 학구·입주·전입전출을 직접 예측하지 않음. 장기 예측 검증 한계 있음.','forecast');
for(const year of [2029,2031])add('cohort_scenario_'+year,year+' 입학인원 유지 재학생 시나리오','명','trend','extraCohort','2026 기준 최신 1학년 입학인원 유지 가정. 선택된 주 예측모형이 아니며 장기 검증 미확보. 전입전출·학구 변화 미반영. 관측·확정 수요와 구분.','scenario');
const numeric=v=>Number.isFinite(v)&&v>=0?v:null;
const unique=arr=>arr.length===1?arr[0]:null;
function load(schools){
 const loaded=Object.fromEntries(Object.entries(FILES).map(([key,path])=>[key,model.read(path)]));
 const sources=Object.fromEntries(Object.entries(FILES).map(([key,path])=>[key,{path,sha256:loaded[key].hash}]));
 const pub=loaded.extraPublic.data.schools||{},progress=loaded.extraProgression.data.schools||{},cohorts=loaded.extraCohort.data.schools||{},age=loaded.extraAge.data,forecastBy=new Map((loaded.extraForecast.data.schools||[]).map(s=>[s.id,s]));
 const byId=new Map();
 for(const school of schools){
  const values=Object.fromEntries(Object.keys(COLUMNS).map(id=>[id,null])),items=pub[school.id]||[],cohort=cohorts[school.id];
  for(const [id,item,field] of publicMetrics){
   const matches=items.filter(r=>r.item===item).flatMap(r=>(r.observations||[]).filter(o=>o.publication_year===2026&&o.status==='available').flatMap(o=>(o.metrics||[]).filter(m=>m.field===field)));
   values[id]=numeric(unique(matches)?.value);
  }
  const gradeCount=school.level==='초등학교'?6:['중학교','고등학교'].includes(school.level)?3:0;
  for(let grade=1;grade<=gradeCount;grade++)values['grade'+grade+'_students_2026']=numeric(cohort?.snapshots?.['2026']?.grades?.[grade-1]);
  const progression=progress[school.id]||[],current=unique(progression.filter(r=>r.year===2026)),past=unique(progression.filter(r=>r.year===2025));
  if(['중학교','고등학교'].includes(school.level)&&current){
   const count=numeric(current.metrics?.graduates);
   if(['available','no_graduates'].includes(current.status)||current.status==='progression_pending_publication'&&count>0)values.graduates_2026=count;
  }
  if(school.level==='중학교'&&['available','no_graduates'].includes(current?.status)){
   values.middle_advanced_2026=numeric(current.metrics?.advanced);
   if(current.metrics?.graduates>0){const pct=numeric(current.metrics?.published_progression_pct);values.middle_progression_pct_2026=pct<=100?pct:null;}
  }
  if(school.level==='고등학교'&&['available','no_graduates'].includes(past?.status))for(const [field] of outcomes){const value=numeric(past.metrics?.[field]);values['high_'+field+'_2025']=field==='published_progression_pct'?(past.metrics?.graduates>0&&value<=100?value:null):value;}
  if(age.base_year===2024)for(const scope of ['straight_500m','walkshed_500m']){const estimate=age.schools?.[school.id]?.[scope]?.levels?.[school.level];if(estimate?.status==='estimated')values['age_residents_'+scope+'_2024']=numeric(estimate.estimated_residents);}
  const forecasts=forecastBy.get(school.id)?.forecast||[];
  for(const year of [2027,2028,2030])values['forecast_'+year]=numeric(unique(forecasts.filter(f=>f.year===year))?.students);
  if(cohort?.base_year===2026&&cohort.status==='scenario_not_selected_model')for(const year of [2029,2031])values['cohort_scenario_'+year]=numeric(unique((cohort.forecast||[]).filter(f=>f.year===year))?.students);
  byId.set(school.id,values);
 }
 return {byId,sources};
}
module.exports={FILES,PUBLIC,COLUMNS,COLUMN_SOURCE,load};
