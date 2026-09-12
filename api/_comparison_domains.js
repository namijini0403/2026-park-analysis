// Domain-specific observation units. Do not average years, scenarios or award categories together.
const finite=Number.isFinite;
const clean=v=>finite(v)?Number(v.toFixed(2)):v;
const labels={public_children:'공공·어린이',including_small:'작은도서관 포함',straight_500m:'직선 500m',walkshed_500m:'분석 보행권 500m',footprint:'격자 내부'};
function handle({id,all,bundle,school,peers,year,explicitYear,q,sections,metric,unique,read}){
 const add=(title,headers,rows,chart,notes=[])=>sections.push({title,table:{headers,rows},chart,notes});
 const missing=title=>{add(title,['확인 상태'],[['해당 범위의 비교 자료를 확보하지 못했습니다.']],null,['수집 자료가 없다는 이유로 실제 활동·시설이 없다고 판단하지 않습니다.']);sections.at(-1).summary=title+'의 해당 학교·기간 자료가 없어 판단을 보류합니다.';};
 const members=new Set([school.id,...peers.map(s=>s.id)]);
 if(id==='designations'||/_awards$/.test(id)){
  const designation=id==='designations',normalized=all.map(r=>({...r,id:r.id||r.match?.school_id,year:r.year||r.school_year,category:designation?r.designation_type:[r.event,r.category||r.discipline].filter(Boolean).join(' · '),url:r.source_url||r.source?.url}));
  const latest=explicitYear||Math.max(...normalized.filter(r=>members.has(r.id)).map(r=>r.year).filter(finite));
  const rows=normalized.filter(r=>r.year===latest&&members.has(r.id));
  const categories=[...new Set(rows.map(r=>r.category))].sort();
  if(!categories.length){missing(designation?'지정사업 비교':'대회 기록 비교');return true;}
  const table=categories.map(c=>{const r=rows.filter(r=>r.category===c);return [c,r.filter(r=>r.id===school.id).length,new Set(r.filter(r=>r.id!==school.id).map(r=>r.id)).size];});
  add(`${latest}년 ${designation?'지정사업':'동일 대회·부문'} 관측`,['사업·부문','선택 학교 기록','비교집단 기록 학교 수'],table,{kind:'bar',unit:'개교',points:table.map(r=>({name:r[0],value:r[2]}))},['명단·보도자료 수집 범위의 관측입니다. 기록 미확인은 미지정·무실적을 뜻하지 않습니다. 다른 대회·부문 결과를 하나의 점수로 합치지 않습니다.']);
  const own=rows.filter(r=>r.id===school.id);sections.at(-1).summary=`${latest}년 같은 명단·대회 범위에서 선택 학교 ${own.length}건, 비교집단 ${new Set(rows.filter(r=>r.id!==school.id).map(r=>r.id)).size}개교의 기록을 확인했습니다. 기록 수는 참여·수상 총실적이 아닙니다.`;add('선택 학교 원문 근거',['학교','사업·부문','결과·프로그램','원문'],own.map(r=>[r.name,r.category,r.result||r.program_name,{url:r.url,label:'원문'}]),null,['선택 학교 기록이 없는 경우에도 위 도표의 비교집단 범위와 수집 기준을 확인하세요.']);return true;
 }
 if(id==='athletics'){
  // The same team can publish several posts. Adopt its latest dated post; ties remain missing.
  const rows=all.filter(r=>String(r.posted_date||'').startsWith(String(explicitYear||year))),sports=[...new Set(rows.filter(r=>r.id===school.id).map(r=>r.sport))];
  if(!sports.length){missing('학교 운동부 · 해당 연도');return true;}
  for(const sport of sports){const latest=new Map();for(const r of rows.filter(r=>r.sport===sport)){const prev=latest.get(r.id);if(!prev||r.posted_date>prev.posted_date)latest.set(r.id,r);else if(r.posted_date===prev.posted_date&&r.post_id!==prev.post_id)latest.set(r.id,{...r,athletes:null});}metric(sport+' 공시 선수 인원','명',unique([...latest.values()],'athletes'),id,year+'년 최신 게시');}
  sections.at(-1).notes.push('종목별 최신 게시만 채택하며 같은 날짜 중복은 결측 처리합니다. 종목별 인원을 전체 운동부 성과로 합산하지 않습니다.');return true;
 }
 if(id==='curriculum'||id==='curriculum_links'){
  const courses=id==='curriculum'?all:read('curriculum'),edges=id==='curriculum_links'?all:read('curriculum_links');
  const rows=courses.filter(r=>members.has(r.id));
  const counts=new Map();for(const sid of members){const matches=rows.filter(r=>r.id===sid);counts.set(sid,matches.length?new Set(matches.map(r=>r.number+'|'+r.kind)).size:null);}
  metric('공동교육과정 개설 과목 관측','과목',counts,'curriculum',`${bundle.data.school_year}년 ${bundle.data.semester||''}학기`);
  const relevant=edges.filter(r=>r.provider_id===school.id||r.eligible_school_id===school.id);
  const uniqueEdges=[...new Map(relevant.map(r=>[r.provider_id+'|'+r.eligible_school_id,r])).values()];
  add('공고에 명시된 제공·참여 연결',['제공 학교','참여 가능 학교','직선거리 m'],uniqueEdges.map(r=>[r.provider_name,r.eligible_name,r.straight_distance_m]),{kind:'bar',unit:'개 연결',points:[{name:'제공 학교로 연결',value:uniqueEdges.filter(r=>r.provider_id===school.id).length},{name:'참여 가능 학교로 연결',value:uniqueEdges.filter(r=>r.eligible_school_id===school.id).length}]},['공고상 참여 가능 연결이며 실제 참여·교육효과·도보 경로가 아닙니다. 개설 학교 명단에 없는 학교는 과목 수 0으로 대체하지 않았습니다.']);
  add('선택 학교 개설 분야',['교과군','과목','학년','공고 정원'],courses.filter(r=>r.id===school.id).map(r=>[r.subject_group,r.subject,r.target_grade,r.advertised_seats]),null);return true;
 }
 if(['forecast','cohort'].includes(id)){
  const own=all.filter(r=>r.id===school.id),observed=own.filter(r=>r.group==='관측'),future=own.filter(r=>r.group!=='관측'),target=explicitYear&&future.some(r=>r.year===explicitYear)?explicitYear:Math.max(...future.map(r=>r.year));
  if(!own.length){missing('학교별 관측·시나리오');return true;}
  for(const group of [...new Set(own.map(r=>r.group))]){const r=own.filter(r=>r.group===group).sort((a,b)=>a.year-b.year);add(group+' · 학교 학생 수',['연도','학생 수','구분'],r.map(r=>[r.year,r.value,r.group]),{kind:'line',x:['연도','년'],y:['학생 수','명'],points:r.map(r=>({x:r.year,y:r.value,name:r.group}))},[group==='관측'?'공시 관측입니다.':'가정에 따른 시나리오이며 확정 수요가 아닙니다.']);}
  for(const group of [...new Set(future.map(r=>r.group))])metric(target+'년 '+group+' 학생 수','명',unique(all.filter(r=>r.year===target&&r.group===group),'value'),id,target+'년 시나리오');
  return true;
 }
 if(['demography','regional_forecast'].includes(id)){
  const scoped=all.filter(r=>r.level===school.level),local=scoped.filter(r=>r.gu===school.gu),latest=explicitYear||Math.max(...scoped.map(r=>r.year));
  if(!local.length){missing('학교 소재 지역 인구');return true;}
  add(school.gu+' · 해당 학교급 연령 인구',['연도','인구','구분'],local.map(r=>[r.year,r.value,r.group]),{kind:'line',x:['연도','년'],y:['주민등록 연령 인구','명'],points:local.map(r=>({x:r.year,y:r.value,name:r.group})).sort((a,b)=>a.x-b.x)},['행정구역의 해당 연령 인구입니다. 학교 재학생이나 학교 생활권 인구가 아닙니다.']);
  const localLatest=local.filter(r=>r.year===latest);if(localLatest.length)sections.at(-1).summary=`${school.gu}의 ${latest}년 ${school.level} 연령 인구는 ${clean(localLatest[0].value)}명(${localLatest[0].group})입니다. 학교 재학생 수와 구분해 수요 배경으로 검토합니다.`;const rows=scoped.filter(r=>r.year===latest&&r.gu!=='인천광역시');add(latest+'년 군·구 비교',['군·구','해당 연령 인구','구분'],rows.map(r=>[r.gu,r.value,r.group]),{kind:'bar',unit:'명',points:rows.map(r=>({name:r.gu,value:r.value,selected:r.gu===school.gu}))},['군·구 면적·인구 규모가 다릅니다. 인구 총량은 지역의 부족도나 정책 순위가 아닙니다.']);return true;
 }
 if(['validation','school_validation'].includes(id)){
  const rows=all.filter(r=>r.level===school.level||r.school_level===school.level);
  const model=id==='validation'?'selected_mae':'mae',base=id==='validation'?'persistence_mae':'baseline_mae';
  for(const r of rows)add(`${school.level} · ${r.horizon}년 선행 검증`,['모형','평균절대오차 명','검증 수'],[['선택모형',clean(r[model])??'미확보',r.n],['유지 기준모형',clean(r[base])??'미확보',r.n]],{kind:'bar',unit:'명',points:[{name:'선택모형',value:r[model]},{name:'유지 기준모형',value:r[base]}].filter(p=>finite(p.value))},['같은 학교급·선행기간의 오차를 비교합니다. 검증 수 0 또는 결측이면 성능이 입증되지 않았습니다.']);return true;
 }
 if(id==='library_scenarios'){
  const rows=all.filter(r=>r.level===school.level);
  for(const group of [...new Set(rows.map(r=>r.group))]){const r=rows.filter(r=>r.group===group);add((labels[group]||group)+' 거리권 시나리오',['반경 m','권역 밖 연령 인구 추정','인구 결측 셀'],r.map(r=>[r.radius_m,r.value??'미확보',r.missing_cells]),{kind:'line',x:['거리권 반경','m'],y:['미포함 인구 추정','명'],points:r.filter(r=>finite(r.value)&&r.missing_cells===0).map(r=>({x:r.radius_m,y:r.value,name:'시나리오'}))},['인천 전체의 거리권 가정 비교이며 해당 학교의 결핍 인구가 아닙니다. 결측 셀이 있는 시나리오는 그래프에서 제외합니다. 겹치는 권역은 합산하지 않습니다.']);}return true;
 }
 if(id==='diffusion'){
  for(const radius of [...new Set(all.map(r=>r.radius_m))]){const rows=all.filter(r=>r.radius_m===radius);add(radius+'m 연결 가정 · 지정 확산',['연결 확률 가정','선택 학교 도달 빈도','전체 최종 평균'],rows.map(r=>[r.probability_per_edge,clean(r.school_reach_frequency?.[school.id])??'미확보',clean(r.simulation?.mean_by_round?.at(-1))]),{kind:'line',x:['연결 확률 가정',''],y:['학교 도달 빈도','0~1'],points:rows.map(r=>({x:r.probability_per_edge,y:r.school_reach_frequency?.[school.id],name:'시나리오'})).filter(p=>finite(p.y))},['전파 확률을 가정한 반복 시뮬레이션 빈도입니다. 실제 지정 확률·사업 효과가 아니며 연결 반경별로 따로 비교합니다.']);}return true;
 }
 if(id==='grid_demand'){
  const rows=all.filter(r=>r.level===school.level);
  for(const group of [...new Set(rows.map(r=>r.group))]){const vals=rows.filter(r=>r.group===group&&r.missing_parent_grids===0&&finite(r.value)),sorted=vals.map(r=>r.value).sort((a,b)=>a-b);if(!sorted.length){missing((labels[group]||group)+' 격자 인구');continue;}const quant=p=>sorted[Math.floor((sorted.length-1)*p)];add((labels[group]||group)+' · 전체 후보 격자 수요 분포',['범위','유효 격자','결측·제외','중앙값 명'],[[labels[group]||group,vals.length,rows.filter(r=>r.group===group).length-vals.length,quant(.5)]],{kind:'box',y:['연령 인구 추정','명'],groups:[{name:labels[group]||group,min:sorted[0],q1:quant(.25),median:quant(.5),q3:quant(.75),max:sorted.at(-1),n:vals.length}]},['학교에 귀속되지 않은 전체 후보 격자 분포입니다. 중첩 영역을 합산하거나 지원 순위로 바꾸지 않습니다.']);sections.at(-1).summary=`${labels[group]||group} 인구 추정은 유효 격자 ${vals.length}개의 중앙값 ${clean(quant(.5))}명입니다. 학교 배정 인구나 후보 우선순위가 아닙니다.`;}return true;
 }
 if(id==='candidate_routes'){
  const own=all.filter(r=>r.id===school.id),byGrid=new Map();for(const r of own){if(byGrid.has(r.grid_id))byGrid.set(r.grid_id,null);else byGrid.set(r.grid_id,r);}
  const rows=[...byGrid.values()].filter(Boolean);add('학교에서 후보 격자까지의 기존 경로 관측',['격자','경로 길이 m','기록 한계'],rows.map(r=>[r.grid_id,r.route_length_m,r.note]),{kind:'bar',unit:'m',points:rows.filter(r=>finite(r.route_length_m)).map(r=>({name:r.grid_id,value:r.route_length_m}))},['격자별 길이를 비교하며 순위나 우선안을 정하지 않습니다. 출입구·통행 허용·안전·토지 이용 적합성은 별도 확인해야 합니다. 구형 격자와 새 인구 격자의 ID 체계가 다르면 연결하지 않습니다.']);
  if(!rows.length)sections.at(-1).notes.push('해당 학교의 후보 연결 경로를 확보하지 못했습니다.');return true;
 }
 if(id==='park_review'){
  const own=all.filter(r=>r.schools?.some(s=>s.id===school.id));
  add('학교와 연결된 공원 확인 범위',['공원','상태','연결 학교 수','분석 학교 수'],own.map(r=>[r.park_name,r.status,r.linked_schools,r.analyzed_schools]),{kind:'bar',unit:'개교',points:own.map(r=>({name:r.park_name,value:r.linked_schools}))},['연결 학교 수는 공동 확인 범위이며 투자 점수·현장 안전 검증 완료가 아닙니다. 과거 우선순위 파생값은 사용하지 않습니다.']);return true;
 }
 return false;
}
module.exports={handle};
