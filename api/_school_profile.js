'use strict';
// 학교 1곳의 영역별 지표 프로필. 절대값 + 같은 학교급 안에서의 상대 위치(전체 / 군·구).
// 종합점수·영역 점수를 만들지 않는다. 미확보는 값이 아니라 사유로 남긴다.
const table=require('./_school_table'),stats=require('./_indicator_stats'),publicSources=require('./_public_sources');
const finite=Number.isFinite;
// 레이더 대표 지표: 영역마다 해당 학교급에 값이 있는 첫 번째를 고른다. paps는 정의 충돌(스펙 §9)로 제외한다.
const RADAR_PRIORITY={designation:['designations_current'],park:['green_ratio','parks_walk','nearest_park_m'],reading:['books_per_student','nearest_public_library_m','libraries_walk'],academy:['academies_per_km2','academies_500m'],safety:['child_accident_nearest_m','nightlife_500m','construction_500m'],boundary:['zone_walk_mismatch_pct','walk_area_ratio_to_circle'],trend:['forecast_change_pct_2031','student_change_pct','sen_slope'],school:['class_size','students','students_per_teacher'],development:['large_apt_500m','redev_active']};
// 공시 항목 자체가 달라 해당 없는 것
const NOT_APPLICABLE={유치원:['teachers','students_per_teacher','paps','afterschool','clubs']};
// 원자료가 존재하지 않는 것 (수집으로 채울 수 없음)
const NO_SOURCE={유치원:['zone_area_m2','zone_walk_mismatch_pct','zone_outside_walk_pct','walk_outside_zone_pct']};
const LEVELS=['유치원','초등학교','중학교','고등학교'];
const BASE_COLUMNS=['name','level','gu','island'];
function levelsWith(column,built){const cov=(built||table.build()).coverage[column]||{};return LEVELS.filter(l=>(cov[l]||0)>0);}
function missingFor(column,level,built){
 if((NOT_APPLICABLE[level]||[]).includes(column))return {reason:'not_applicable',detail:level+' 공시 항목에 없는 지표입니다.'};
 if((NO_SOURCE[level]||[]).includes(column))return {reason:'no_source',detail:'원자료에 '+level+' 경계가 없습니다. 수집으로 채울 수 없습니다.'};
 const have=levelsWith(column,built);
 if(!have.includes(level))return {reason:'level_not_covered',detail:have.length?have.join('·')+'만 산출되어 있습니다.':'아직 산출되지 않은 지표입니다.'};
 if(column==='construction_500m')return {reason:'not_collected',detail:'계양구·미추홀구·연수구만 수집되어 이 학교의 구는 자료가 없습니다.'};
 return {reason:'not_collected',detail:'이 학교의 값이 원자료에 없습니다.'};
}
function indicator(column,row,built){
 const t=built||table.build();
 const c=table.COLUMNS[column],base={column,label:c.label,unit:c.unit||'',direction:c.direction,kind:c.kind||'observation',note:c.note||null};
 const raw=row[column];
 if(c.type==='text'){const has=raw!=null&&raw!=='';return {...base,value:null,text:has?String(raw):null,overall:null,gu:null,missing:has?null:missingFor(column,row.level,t)};}
 if(!finite(raw))return {...base,value:null,text:null,overall:null,gu:null,missing:['park_route_m','park_detour_ratio'].includes(column)&&row.park_route_missing_detail?{reason:'route_unverified',detail:row.park_route_missing_detail}:missingFor(column,row.level,t)};
 const island=stats.isIsland(row.gu);
 const all=stats.population(column,row.level,{island,built:t});
 const overall={n:all.n,percentile:stats.percentile(all.values,raw),rank:stats.rank(all.values,raw),mean:all.mean,median:all.median,min:all.min,max:all.max};
 let gu=null;
 if(row.gu){const g=stats.guPopulation(column,row.level,row.gu,t);gu={name:row.gu,n:g.n,percentile:g.n>=stats.MIN_GU_N?stats.percentile(g.values,raw):null,rank:stats.rank(g.values,raw),mean:g.mean};}
 return {...base,value:raw,text:null,overall,gu,missing:null};
}
function profile(id){
 const t=table.build(),row=t.byId.get(id);
 if(!row)throw Error('선택 학교를 원장에서 찾을 수 없습니다.');
 const byDomain=new Map(table.DOMAINS.map(d=>[d.id,[]]));
 for(const [col,c] of Object.entries(table.COLUMNS)){
  if(BASE_COLUMNS.includes(col)||!c.domain)continue;
  byDomain.get(c.domain).push(indicator(col,row,t));
 }
 const domains=table.DOMAINS.map(d=>({id:d.id,label:d.label,indicators:byDomain.get(d.id)}));
 const all=domains.flatMap(d=>d.indicators);
 const axes=table.DOMAINS.map(d=>{
  const pick=(RADAR_PRIORITY[d.id]||[]).map(col=>all.find(i=>i.column===col)).filter(Boolean);
  const chosen=pick.find(i=>i.value!=null)||pick[0]||null;
  if(!chosen)return {domain:d.id,domain_label:d.label,column:null,label:null,unit:'',direction:'neutral',value:null,percentile_overall:null,percentile_gu:null,missing:{reason:'level_not_covered',detail:'이 영역의 대표 지표가 없습니다.'}};
  return {domain:d.id,domain_label:d.label,column:chosen.column,label:chosen.label,unit:chosen.unit,direction:chosen.direction,value:chosen.value,percentile_overall:chosen.overall?chosen.overall.percentile:null,percentile_gu:chosen.gu?chosen.gu.percentile:null,missing:chosen.missing};
 });
 const keys=[...new Set(all.filter(i=>i.missing==null).map(i=>table.COLUMN_SOURCE[i.column]).filter(Boolean))];
 const sources=keys.map(k=>({key:k,...t.sources[k],title:table.PUBLIC[k]}));
 const originals=[...new Map(sources.flatMap(s=>publicSources.forFile(s.path)).map(o=>[o.url,o])).values()];
 return {school:{id:row.id,name:row.name,level:row.level,gu:row.gu,island:stats.isIsland(row.gu)},track:stats.isIsland(row.gu)?'island':'general',data_year:row.data_year??null,domains,radar:{axes},coverage:{available:all.filter(i=>i.missing==null).length,missing:all.filter(i=>i.missing!=null).length},sources,originals};
}
module.exports={profile,indicator,RADAR_PRIORITY,NOT_APPLICABLE,NO_SOURCE};
