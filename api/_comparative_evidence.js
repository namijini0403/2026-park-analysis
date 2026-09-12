const data=require('./_data_answers'),model=require('./_school_summary'),domains=require('./_comparison_domains'),observations=require('./_comparison_observations');
const finite=Number.isFinite,round=v=>finite(v)?Number(v.toFixed(2)):null;
const median=a=>{const s=a.filter(finite).sort((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;};
const thematic=[[/도서관|장서|독서|사서/,['library_access','books']],[/공원|녹지|야외|놀이터/,['schools','shared_parks','routes']],[/학원|사교육/,['clusters','schools']],[/학생|규모|수요|미래/,['schools','forecast','school_demand']],[/체력|체육|운동|PAPS/i,['indicators','athletics','services']],[/돌봄|복지/,['books','services']],[/방과후|동아리|장학금|학비/,['indicators']],[/보행|통행|출입구|경로/,['routes','route_review','hybrid','resilience']],[/공사|착공|유흥|단란/,['construction','nightlife','routes']],[/재개발|재건축|아파트|입주/,['redevelopment','apartments','forecast']],[/진학|취업/,['progression','schools']],[/공동교육|개설 과목/,['curriculum','curriculum_links','schools']]];
function run(q,p={}){
 if(/상관|회귀|보정/.test(q))return null;
 if(p.dataset_id&&!data.catalog.some(e=>e.id===p.dataset_id))throw Error('등록된 자료를 선택해 주세요.');
 if(!/근거|지원|비교|대비|수준|상대|분석|취약|보완|필요|어느 정도|얼마나|부족|보강|늘려|왜|강점|약점|어때|어떻/.test(q))return null;
 const registry=model.registry(),school=[...registry].sort((a,b)=>b.name.length-a.name.length).find(s=>q.includes(s.name))||registry.find(s=>{const alias=s.name.replace(/^인천/,'');return alias!==s.level&&alias.length>4&&q.includes(alias);})||registry.find(s=>s.id===p.school_id);
 if(!school)return null;
 const ids=p.dataset_id?[p.dataset_id]:[...new Set(thematic.filter(([re])=>re.test(q)).flatMap(([,ids])=>ids))];
 if(!p.dataset_id){
  if(/지역.*인구|주민등록|군.?구.*인구|인구.*전망|인구.*예측/.test(q)){if(!/학생|원아/.test(q))ids.splice(0,ids.length);for(const id of ['demography','regional_forecast','validation'])if(!ids.includes(id))ids.push(id);}
  if(/도서관.*시나리오|거리권.*인구/.test(q)&&!ids.includes('library_scenarios'))ids.push('library_scenarios');
  if(/격자|250m|후보지/.test(q)){for(const id of ['grid_demand',...(/경로/.test(q)?['candidate_routes']:[])])if(!ids.includes(id))ids.push(id);}
  if(/진급/.test(q)&&!ids.includes('cohort'))ids.push('cohort');
  if(/검증|성능|오차/.test(q)&&/예측|모형/.test(q)){const id=/학생|학교/.test(q)?'school_validation':'validation';if(!ids.includes(id))ids.unshift(id);}
  if(/도달권|보행권/.test(q)&&!ids.includes('walkshed'))ids.push('walkshed');
 }
 if(!ids.length){const e=p.dataset_id?data.catalog.find(e=>e.id===p.dataset_id):data.match(q);const context=({library:['library_access','books'],books:['library_access','books'],welfare:['books'],sports:['services','athletics'],park:['schools','shared_parks','routes']})[p.kind];if(context&&(!e||e.id==='schools'))ids.push(...context);else if(e)ids.push(e.id);}
 if(!ids.length)return null;
 const related={books:['library_access'],library_access:['books'],parks:['schools','shared_parks'],playgrounds:['schools','shared_parks'],services:/돌봄|복지/.test(q)?['books','schools']:/운동|체육|스포츠/.test(q)?['athletics','schools']:['library_access','books'],academies:['clusters','schools'],construction:['routes','schools'],nightlife:['routes','schools'],redevelopment:['forecast','apartments'],apartments:['forecast','redevelopment'],shared_parks:['schools','routes'],resilience:['routes','route_review'],clusters:['schools'],routes:['route_review','hybrid'],route_review:['routes','hybrid'],hybrid:['routes','route_review'],school_demand:['forecast'],indicators:['schools'],athletics:['sports_awards'],designations:['diffusion'],diffusion:['designations'],sports_awards:['athletics'],science_awards:['designations'],invention_awards:['designations'],library_scenarios:['library_access','books'],grid_demand:['school_demand'],demography:['regional_forecast'],regional_forecast:['demography','validation'],forecast:['school_validation'],cohort:['forecast','school_validation'],curriculum:['curriculum_links'],curriculum_links:['curriculum'],validation:['regional_forecast'],school_validation:['forecast'],similar:['schools','books'],zones:['walkshed','schools'],walkshed:['routes','schools'],candidate_routes:['grid_demand'],park_review:['shared_parks'],residential:['routes','hybrid'],progression:['schools']};for(const id of [...ids])for(const other of related[id]||[])if(!ids.includes(other))ids.push(other);
 const entry=id=>data.catalog.find(e=>e.id===id),read=id=>data.rowsFor(entry(id),data.read(entry(id)).data);
 const bookMap=new Map(read('books').map(r=>[r.id,r])),separate=s=>bookMap.has(s.id)?bookMap.get(s.id).separate_track:(['강화군','옹진군'].includes(s.gu)?'군지역 별도':'도시지역 잠정');
 const peers=registry.filter(s=>s.level===school.level&&s.id!==school.id&&separate(s)===separate(school));
 const explicitYear=Number(q.match(/20\d{2}/)?.[0])||null;const latestYear=Math.max(...registry.flatMap(s=>Object.keys(s.observations||{}).map(Number)));const year=explicitYear&&explicitYear<=latestYear?explicitYear:latestYear,size=s=>s.observations?.[year]?.students;
 const scalePeers=peers.filter(s=>finite(size(s))&&finite(size(school))&&size(school)>0&&Math.abs(size(s)/size(school)-1)<=.2);
 const envKeys=/도서관|장서|독서/.test(q)?['parks','green']:['library','academy'];
 const envPeers=peers.filter(s=>envKeys.every(k=>finite(s.environment?.[k])&&finite(school.environment?.[k])&&Math.abs(s.environment[k]-school.environment[k])<=(k==='green'?5:k==='academy'?10:1)));
 const groups=[['동급 학교',peers],['유사 규모',scalePeers],['유사 환경',envPeers]];
 const sections=[],sources=[],metrics=[],metricValues=[],notes=[`${school.level}끼리 비교하며 선택 학교는 제외합니다. 초등학교는 도서지역 별도 검토 표기를 적용합니다. 해당 표기가 없는 학교급은 강화·옹진군을 분리하는 잠정 기준이며 실제 도서 여부는 추가 확인합니다.`,`${year}년 학생 수 ±20%가 유사 규모 기준입니다. 유사 환경은 ${envKeys.map(k=>({parks:'공원 수 차이 1곳 이내',green:'녹지비율 차이 5%p 이내',library:'도서관 수 차이 1곳 이내',academy:'학원 수 차이 10곳 이내'})[k]).join(', ')}입니다. 같은 이용·안전 조건을 뜻하지 않습니다.`, '수치 차이는 지원 검토의 근거이며 지원 확정이나 투자 순위가 아닙니다. 결측·수집 누락은 부족 확정이나 0으로 바꾸지 않습니다. 이용 가능성·안전·운영·출입구 경로는 각각 확인해야 합니다.'];
 function metric(title,unit,values,sourceId,period){
  const own=values.get(school.id),stats=groups.map(([name,ss])=>{const vals=ss.map(s=>values.get(s.id)).filter(finite);return {name,n:vals.length,missing:ss.length-vals.length,median:round(median(vals)),below:finite(own)&&vals.length?round(vals.filter(v=>v<own).length/vals.length*100):null};});
  const rows=[[school.name,round(own)??'미확보',finite(own)?1:0,finite(own)?0:1,'—'],...stats.map(s=>[s.name,s.median??'미확보',s.n,s.missing,s.below??'미확보'])];
  const chart={kind:'bar',title,unit,points:[{name:school.name,value:own,selected:true},...stats.map(s=>({name:s.name+' 중앙값',value:s.median}))].filter(p=>finite(p.value))};
  sections.push({title:title+' · '+period,chart:chart.points.length?chart:null,table:{headers:['학교·비교집단',unit||'값','유효 학교','결측 학교','선택 학교보다 낮은 비율 %'],rows},notes:[`출처: ${sourceId}. 결측을 제외한 중앙값입니다. 낮은 비율은 우수성이나 지원 우선순위가 아닙니다.`]});
  metricValues.push({title,unit,values,period});
  metrics.push({title,unit,period,own:round(own),groups:stats,source:sourceId});
 }
 for(const id of ids){
  const e=entry(id);if(!e)continue;const bundle=data.read(e),all=read(id);
  sources.push({id:'comparative#'+id,title:id==='books'&&/돌봄|복지/.test(q)?'학교별 돌봄 접근 관측':e.title,source:e.file,body:['학교 ID·학교급·기준시점별 관측을 연결한 비교. 필터와 결측 수는 각 도표에 명시.',bundle.data.coverage,bundle.data.limitations,bundle.data.scope_note].flat().filter(v=>typeof v==='string').join('\n'),provenance:[{path:e.file,sha256:bundle.hash}]});
  if(!(id==='books'&&/돌봄|복지/.test(q)))observations.extend({id,school,metric,sections,sources,registry});if(['similar','walkshed'].includes(id)&&school.level==='초등학교')continue;
  if(domains.handle({id,all,bundle,school,peers,year,explicitYear,q,sections,metric,unique,read}))continue;
  if(['parks','playgrounds','academies','construction','nightlife','redevelopment','apartments','services'].includes(id)){
   const kinds=id==='services'?(/돌봄|복지/.test(q)?['welfare']:/체육|운동|스포츠/.test(q)?['sports']:/도서관|장서|독서/.test(q)?['library']:[...new Set(all.map(r=>r.kind))]):[null];
   const dist=(a,b)=>6371000*Math.hypot((a.lat-b.lat)*Math.PI/180,(a.lng-b.lng)*Math.PI/180*Math.cos(a.lat*Math.PI/180));
   for(const kind of kinds){const relevant=all.filter(r=>!kind||r.kind===kind),located=relevant.filter(r=>finite(r.lat)&&finite(r.lng)),title=e.title+(kind?' · '+({library:'도서관',welfare:'돌봄',sports:'운동'})[kind]:''),counts=new Map(),nearest=new Map();
    for(const s of [school,...peers]){const eligible=located.filter(r=>r.service_scope!=='enrolled_school');const supported=id!=='services'||located.some(r=>r.gu===s.gu||String(r.address||'').includes(s.gu));const distances=eligible.map(r=>dist(r,s));counts.set(s.id,supported&&eligible.length?distances.filter(d=>d<=500).length:null);nearest.set(s.id,supported&&distances.length?Math.min(...distances):null);}
    metric(title+' 직선 500m 내 수집 기록','건',counts,id,'수집 스냅샷');metric(title+' 최근접 수집 시설 직선거리','m',nearest,id,'수집 스냅샷');
    notes.push(title+': 위치 확보 '+located.length+'건 / 전체 '+relevant.length+'건. 지역별 전수조사가 아니므로 0건은 실제 시설 부재를 뜻하지 않습니다. 서비스 자료는 소재 군·구의 관측이 없는 학교를 결측 처리하며, 학교 재학생 전용 시설은 외부 자원 집계에서 제외합니다. 이용 가능성·잔여정원은 별도 확인합니다.');
   }continue;
  }
  if(id==='school_demand'){
   const ownRows=all.filter(r=>r.id===school.id&&r.level===school.level);
   if(!ownRows.length)sections.push({title:'생활권 연령 인구 추정',notes:['해당 학교의 연령 인구 추정 자료가 없어 비교를 보류합니다. 다른 학교 자료로 대체하지 않습니다.']});for(const group of [...new Set(ownRows.map(r=>r.group))]){const rows=all.filter(r=>r.level===school.level&&r.group===group&&r.year===ownRows[0].year);metric('생활권 연령 인구 추정 · '+({'straight_500m':'직선 500m','walkshed_500m':'분석 보행권 500m'})[group],'명',unique(rows.filter(r=>r.missing_parent_grids===0),'value'),id,ownRows[0].year+'년');}continue;
  }
  let fields=e.fields.filter(k=>!/(^id$|year|students_2026|lat|lng|horizon|probability)/.test(k)&&all.some(r=>finite(data.get(r,k))));
  if(id==='schools')fields=/공원|녹지/.test(q)?['parks','green']:['students','classes','teachers'];
  if(id==='books')fields=/돌봄|복지/.test(q)?['layers.welfare.access.network_count','layers.welfare.access.straight_count']:['books.per_student','books.staff'];
  if(id==='indicators'){
   const topics=['장학금','학비','동아리','방과후','체력'].filter(t=>q.includes(t));if(!topics.length&&/운동|체육|PAPS/i.test(q))topics.push('체력');const relevant=all.filter(r=>r.year===(explicitYear||year)&&(!topics.length||topics.some(t=>r.group.includes(t))));
   const labels=[...new Map(relevant.filter(r=>r.id===school.id).map(r=>[JSON.stringify([r.group,r.label,r.unit]),r])).entries()];
   for(const [key,record] of labels){const rows=relevant.filter(r=>JSON.stringify([r.group,r.label,r.unit])===key);metric(record.group+' · '+record.label,record.unit||'',unique(rows,'value'),id,(explicitYear||year)+'년');}
   if(!labels.length)sections.push({title:e.title,notes:[`${year}년 해당 학교·항목의 비교 가능한 공시 지표가 없습니다.`]});continue;
  }
  if(id==='forecast'){const rows=all.filter(r=>r.id===school.id);sections.push({title:'학생 수 관측과 미래 시나리오',chart:{kind:'line',x:['연도','년'],y:['학생 수','명'],points:rows.map(r=>({x:r.year,y:r.value,name:r.group})).filter(r=>finite(r.y))},notes:['관측과 예측을 구분합니다. 모형값은 확정 수요가 아닙니다.']});continue;}
  if(!fields.length){const r=data.run(q,{dataset_id:id,school_id:school.id});if(r?.visual)sections.push({...r.visual,title:e.title});continue;}
  for(const key of fields){let rows=all,period='수집 스냅샷';if(all.some(r=>r.year!=null)){rows=all.filter(r=>Number(r.year)===year);period=year+'년';}if(id==='books'&&!/돌봄|복지/.test(q)){const y=bookMap.get(school.id)?.books?.year;rows=rows.filter(r=>r.books?.year===y);period=(y||'미확인')+'년 장서 공시';}metric(({'layers.welfare.access.network_count':'분석 도달권 돌봄 시설 관측','layers.welfare.access.straight_count':'직선 500m 돌봄 시설 관측'})[key]||data.fieldLabel(key),unitFor(key),unique(rows,key),id,period);}
 }
 if(ids.includes('library_access')){
  const count=bookMap.get(school.id)?.layers?.library?.access?.network_count;
  notes.unshift(`분석 도달권에 포함된 도서관 ${count??'미확인'}곳. 대표점·도달권 포함 여부이며 실제 출입구 도보 검증이 아닙니다. 직선거리와 다른 측정값입니다.`);
  const e=entry('services'),distance=r=>6371000*Math.hypot((r.lat-school.lat)*Math.PI/180,(r.lng-school.lng)*Math.PI/180*Math.cos(school.lat*Math.PI/180));
  const near=read('services').filter(r=>r.kind==='library'&&finite(r.lat)&&finite(r.lng)).map(r=>({...r,distance:distance(r)})).sort((a,b)=>a.distance-b.distance).slice(0,5);
  sections.unshift({title:'주변 도서관과 학교 위치',map:[school,...near].map((r,i)=>({name:r.name,lat:r.lat,lng:r.lng,selected:i===0,detail:i===0?'선택 학교':'도서관'})),table:{headers:['시설','직선거리 m','출처'],rows:near.map(r=>[r.name,round(r.distance),{url:r.source_url,label:'원문'}])},notes:['시설 원장의 가까운 5곳입니다. 거리 비교 원장과 시설 범위·기준일이 다를 수 있습니다. 실제 도보 경로를 뜻하지 않습니다.']});
  sources.push({id:'comparative#services',title:e.title,source:e.file,provenance:[{path:e.file,sha256:data.read(e).hash}]});
 }
 const primary=metricValues.find(m=>m.title.includes('학생당 장서'))||metricValues.find(m=>!m.title.includes('학생 수'));
 if(primary&&finite(primary.values.get(school.id))){const points=[...peers,school].map(s=>({name:s.name,x:size(s),y:primary.values.get(s.id),selected:s.id===school.id})).filter(p=>finite(p.x)&&finite(p.y));sections.push({title:'학교 규모와 '+primary.title+'의 분포',chart:{kind:'scatter',x:[year+'년 학생 수','명'],y:[primary.title,primary.unit],points},table:{headers:['학교',year+'년 학생 수',primary.title,'구분'],rows:points.map(p=>[p.name,p.x,p.y,p.selected?'선택 학교':'비교 학교'])},notes:[primary.period+' 자료와 학생 수를 학교 ID로 연결했습니다. 황색 점이 선택 학교입니다. 연도가 다르면 같은 시점의 인과관계로 해석하지 않습니다.']});}
 const descriptive=sections.map(s=>s.summary).filter(Boolean);
 const comparisons=metrics.filter(m=>finite(m.own)).slice(0,6).map(m=>`${m.title} ${m.own}${m.unit}; 동급 중앙값 ${m.groups[0].median??'미확보'}, 유사 규모 중앙값 ${m.groups[1].median??'미확보'}, 유사 환경 중앙값 ${m.groups[2].median??'미확보'}.`);
 const interpretation=metrics.filter(m=>finite(m.own)&&finite(m.groups[1].median)&&!ids.includes('library_access')).slice(0,3).map(m=>{const ref=m.groups[1].median,delta=round(m.own-ref);return `${m.title}: 유사 규모 ${m.groups[1].n}개교 중앙값보다 ${delta===0?'':Math.abs(delta)+m.unit+' '}${delta<0?'낮습니다':delta>0?'높습니다':'차이가 없습니다'}.`;});
 if(ids.includes('library_access')){const distance=metrics.find(m=>m.title.includes('공공 어린이')),books=metrics.find(m=>m.title.includes('학생당 장서'));if(distance&&finite(distance.own)&&finite(distance.groups[0].median)&&distance.own<distance.groups[0].median)interpretation.push('공공·어린이도서관의 직선거리는 동급 중앙값보다 짧아, 이 값만으로 외부 도서관이 상대적으로 멀다고 주장할 수 없습니다. 분석 도달권 포함 여부와 실제 출입구 경로를 함께 확인해야 합니다.');if(books&&finite(books.own)&&finite(books.groups[1].median)&&books.own<books.groups[1].median)interpretation.push('학생당 장서는 유사 규모 집단보다 적으므로 장서 보강을 검토할 근거가 있습니다. 필요한 분야·노후도·대출 및 희망도서 수요를 확인해야 지원 규모를 정할 수 있습니다.');}
 const sourceMap=new Map();for(const source of sources){const prev=sourceMap.get(source.source);if(prev){if(!prev.title.includes(source.title))prev.title+=' · '+source.title;prev.alias_ids=[...(prev.alias_ids||[prev.id]),source.id];}else sourceMap.set(source.source,{...source});}
 const exportWidth=Math.max(1,...sections.filter(s=>s.table).map(s=>s.table.headers.length));
 const table={headers:['지표','기준','선택 학교','동급 중앙값','유사 규모 중앙값','유사 환경 중앙값'],rows:metrics.map(m=>[m.title,m.period,m.own??'미확보',...m.groups.map(g=>g.median??'미확보')])};
 return {answerable:true,mode:'comparative',school_id:school.id,summary:`${school.name}의 관련 근거를 ${sections.length}개 근거 묶음으로 연결했습니다.\n${comparisons.join('\n')}\n${interpretation.join('\n')}\n${descriptive.slice(0,4).join('\n')}\n차이가 있는 항목은 지원 필요성을 추가 확인할 출발점입니다. 이용량·운영조건과 실제 이용 가능한 외부 자원을 확인한 뒤 보강·연계 대안을 비교해야 합니다.`,sources:[...sourceMap.values()],comparison:{year,metrics,groups:groups.map(([name,ss])=>({name,ids:ss.map(s=>s.id)}))},visual:{title:school.name+' · 복합 비교 근거',sections,notes,table},export_table:{headers:['근거 묶음',...Array.from({length:exportWidth},(_,i)=>'항목 '+(i+1))],rows:sections.filter(s=>s.table).flatMap(s=>[s.table.headers,...s.table.rows].map(row=>[s.title,...row,...Array(Math.max(0,exportWidth-row.length)).fill('')]))}};
}
function unique(rows,key){const map=new Map();for(const r of rows){if(!r.id)continue;const v=data.get(r,key);if(map.has(r.id))map.set(r.id,null);else map.set(r.id,finite(v)?v:null);}return map;}
function unitFor(k){return /distance|nearest|_m$/.test(k)?'m':/area.*per_student/.test(k)?'㎡/명':/per_student/.test(k)?'권/명':/area/.test(k)?'㎡':/detour_ratio/.test(k)?'배':/share|ratio/.test(k)?'비율':/green|pct/.test(k)?'%':/student|staff|teacher|athlete/.test(k)?'명':'개';}
module.exports={run,median,unique};
