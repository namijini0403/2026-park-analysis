'use strict';
const table=require('./_school_table');

// A conclusion is linked only to schools actually returned by a data tool.
// Short names are accepted only when they identify a unique queried school.
function aliases(name){
 const full=String(name||'').replace(/\s/g,'');
 const short=full.replace(/초등학교(?=$|.+분교(?:장)?$)/,'초').replace(/중학교(?=$|.+분교(?:장)?$)/,'중').replace(/고등학교(?=$|.+분교(?:장)?$)/,'고');
 return [...new Set([full,full.replace(/^인천/,''),short,short.replace(/^인천/,'')])].filter(Boolean);
}
function mentioned(text,alias){
 const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 // Prevent a main school matching its branch, or an unrelated longer name.
 return new RegExp('(^|[^가-힣A-Za-z0-9])'+escaped+'(?![가-힣]*분교(?:장)?)(?=$|[^가-힣A-Za-z0-9]|입니다|였습니다|은|는|이|가|을|를|와|과|의|도|에|중)').test(text);
}
function additionalCandidates(evidence,primaryIds,toSchool){
 let pools=evidence.map(e=>e.candidate_pool).filter(Boolean);
 // A follow-up read of the five already chosen IDs is verification, not a new
 // wider candidate scope. Only broaden from an actual unrestricted query.
 if(pools.some(p=>!p.fixed_school_ids))pools=pools.filter(p=>!p.fixed_school_ids);
 const eligible=pools.map(p=>new Set(p.eligible_school_ids||[]));
 const grounded=primaryIds.length&&eligible.length&&primaryIds.every(id=>eligible.every(set=>set.has(id)));
 const candidateIds=grounded?[...new Set(pools.flatMap(p=>p.school_ids||[]))].filter(id=>!primaryIds.includes(id)&&eligible.every(set=>set.has(id))):[];
 const singleOrder=pools.length===1&&pools[0].sort_by;
 if(!singleOrder)candidateIds.sort((a,b)=>table.build().byId.get(a)?.name.localeCompare(table.build().byId.get(b)?.name||'','ko')||0);
 const followsPrimary=singleOrder&&pools[0].eligible_school_ids.slice(0,primaryIds.length).every(id=>primaryIds.includes(id));
 const schools=candidateIds.slice(0,10).map(id=>({...toSchool(id),...(followsPrimary?{metric_position:pools[0].eligible_school_ids.indexOf(id)+1}:{})}));
 const criteria=pools.map(p=>({label:p.label,sort_by:p.sort_by,order:p.order,where:p.where||[]}));
 return {status:schools.length?'available':'unavailable',title:'추가 비교 후보',ordering:followsPrimary?'subsequent_metric':singleOrder?'metric':'name',schools,criteria,notes:[schools.length?`답변의 ${primaryIds.length}개교 외에 동일 조회 조건을 충족한 ${schools.length}개교를 추가로 살펴볼 수 있습니다. 추가 지원 순위가 아닙니다.`:'동일 조회 조건에서 확인된 추가 후보가 없어 임의로 범위를 넓히지 않았습니다.',singleOrder?`${table.COLUMNS[singleOrder]?.label||singleOrder} 원값 ${pools[0].order==='asc'?'작은':'큰'} 순${followsPrimary?'으로 이어지는 조회 목록':'으로 정렬한 추가 비교 목록'}입니다. 이 기준만으로 지원 순위를 정하지 않습니다.`:'여러 조회 조건의 공통 범위에서 학교명순으로 표시합니다. 종합 점수나 6위 이후 순위는 산출하지 않습니다.','이용대상·안전·실행·출입구 경로 확인은 추가 후보에도 동일하게 필요합니다. 미확인 값을 부족으로 간주하지 않습니다.']};
}
function buildOverview(final,sections,ctx={}){
 const T=table.build(),evidence=sections.map(s=>s.evidence).filter(Boolean);
 const candidateIds=[...new Set(evidence.flatMap(e=>e.school_ids||[]))].filter(id=>T.byId.has(id));
 const candidates=candidateIds.map(id=>T.byId.get(id));
 const summary=String(final.summary||'');
 const aliasOwners=new Map();
 for(const r of candidates)for(const alias of aliases(r.name)){const owners=aliasOwners.get(alias)||[];owners.push(r.id);aliasOwners.set(alias,owners);}
 const named=new Set();
 for(const [alias,owners] of aliasOwners)if(owners.length===1&&mentioned(summary,alias))named.add(owners[0]);
 // The schema supplies an explicit focus; prose matching also supports fallback
 // summaries and rejects accidental IDs that are not part of the conclusion.
 const explicit=(final.focus_school_ids||[]).filter(id=>candidateIds.includes(id)&&named.has(id));
 const ids=[...new Set(Array.isArray(final.focus_school_ids)?explicit:candidateIds.filter(id=>named.has(id)))];
 const selected=(ctx.selected_variables||[]).map(value=>table.COLUMNS[value]?value:Object.keys(table.COLUMNS).find(id=>table.COLUMNS[id].label===value)||(value===ctx.extra?.label?ctx.extra.column:null)).filter(Boolean);
 const columnIds=[...new Set([...selected,...evidence.flatMap(e=>e.columns||[])])].filter(id=>!['name','gu','level','island','paps'].includes(id)&&(table.COLUMNS[id]||id===ctx.extra?.column));
 const columns=columnIds.map(id=>{const c=id===ctx.extra?.column?ctx.extra:table.COLUMNS[id];return {id,label:c.label,unit:c.unit||'',group:c.group||'첨부 자료',kind:c.kind||'observation',note:c.note||'',source_id:id===ctx.extra?.column?'user-upload':'table#'+table.sourceFor(id).key};});
 const toSchool=id=>{const r=T.byId.get(id);return {id,name:r.name,aliases:aliases(r.name),gu:r.gu,level:r.level,island:!!r.island,lat:r.lat,lng:r.lng,values:Object.fromEntries(columnIds.map(c=>[c,c===ctx.extra?.column?ctx.extra.values.get(id)??null:r[c]??null])),forecast_evidence:{status:r.forecast_status,origin_year:r.forecast_origin_year,model_version:r.forecast_model_version,limitations:r.forecast_limitations}};};
 const schools=ids.map(toSchool),additional_candidates=additionalCandidates(evidence,ids,toSchool);
 const status=schools.length?'focused':candidateIds.length?'unresolved':'aggregate';
 return {version:1,status,title:'답변의 종합 근거',summary,school_ids:ids,schools,columns,additional_candidates,
  notes:[schools.length?`종합결론에 명시된 ${schools.length}개교의 조회 변수 원값을 함께 보여줍니다. 표시 순서는 투자 순위가 아닙니다.`:candidateIds.length?'종합결론에서 학교를 특정하지 않아 지도에 임의의 학교를 표시하지 않습니다. 변수별 조회 결과는 세부 변수 탭에서 확인하세요.':'학교별 목록이 아닌 집계·설명 결과입니다. 세부 변수 탭에서 전체 범위의 근거를 확인하세요.','미확인은 0이나 부족을 의미하지 않습니다. 예측 학생 수는 모형 추정 또는 학교별 참고 시나리오입니다.',...schools.filter(r=>columnIds.some(c=>c.startsWith('forecast_'))&&r.forecast_evidence.status==='limited_history_constant_scenario').map(r=>`${r.name}: ${r.forecast_evidence.origin_year||'최근'}년 관측 기준 · ${r.forecast_evidence.limitations||'최근 학생 수 유지 참고 시나리오이며 검증된 추세 예측이 아닙니다.'}`)],
  constraints:['이용대상·안전·실행·출입구 경로는 별도로 확인해야 합니다. 다른 관측값으로 상쇄하지 않습니다.','직선거리와 보행 분석 범위는 검증된 출입구 접근성이나 통학 안전을 의미하지 않습니다.','도서 학교는 별도 여건을 확인합니다.']};
}
function buildVisual(final,sections,ctx={}){
 const overview=buildOverview(final,sections,ctx);
 return {title:'답변의 종합 근거',overview,map:overview.schools.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)).map(r=>({id:r.id,name:r.name,lat:r.lat,lng:r.lng,detail:r.gu||''})),geometries:[],sections:sections.map(s=>({...s,map:undefined,geometries:undefined,weights:undefined,evidence:undefined})),notes:[]};
}
function overviewSources(sources,visual,ctx={}){
 const out=new Map((sources||[]).map(s=>[s.id,s]));
 for(const c of visual.overview.columns){
  if(out.has(c.source_id))continue;
  if(c.id===ctx.extra?.column){out.set(c.source_id,{id:c.source_id,title:ctx.extra.name||'사용자 첨부 표',source:'사용자 제공 첨부 표',body:`첨부 열 ‘${ctx.extra.label}’ · 연결 ${ctx.extra.values.size}개교`});continue;}
  const s=table.sourceFor(c.id);
  out.set(c.source_id,{id:c.source_id,title:s.title,source:s.path,provenance:[{path:s.path,sha256:s.sha256}],body:visual.overview.columns.filter(x=>x.source_id===c.source_id).map(x=>x.label).join(', ')});
 }
 return [...out.values()];
}
module.exports={buildOverview,buildVisual,overviewSources};
