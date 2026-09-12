const data=require('./_data_answers');
const finite=Number.isFinite,round=v=>Number(v.toFixed(2));
function run(q,p){
 if(!p.school_id&&(p.level==='전체'||/학교급별|모든 학교급/.test(q))&&/상관|관계|연관/.test(q)){
  const analysis=require('./analysis'),engine=require('./_analysis_engine'),visuals=require('./_chat_visuals'),dataset=analysis.dataset(),sections=[],summaries=[];
  for(const level of ['초등학교','중학교','고등학교','유치원']){const plan=analysis.localPlan(q,{level,school_id:null},dataset);plan.level=level;plan.school_id=null;if(plan.method!=='relationship')continue;const calculation=engine.analyze(dataset,plan);const result=visuals.enrich({calculation,sources:[]},null,q);sections.push({...result.visual,title:level+' 관계 분석'});summaries.push(level+': '+calculation.summary);}
  if(sections.length)return {answerable:true,mode:'population',school_id:null,summary:summaries.join('\n'),sources:[{id:'population#relationship',title:'학교 공시·환경 관측',source:'data_processed/education/analysis_dataset.json'}],visual:{title:'학교급별 관계 분석',sections,notes:['학교급을 섞은 상관계수는 계산하지 않습니다. 인과관계·정책 우선순위를 뜻하지 않습니다.']}};
 }

 if(p.school_id||/목록|어떤.*자료|보유.*데이터|사용법|확인 조건|상관|회귀|보정|지니|공간|중구와|추세|증감/.test(q))return null;
 if(p.scope!=='all'&&!/전체.*통계|기초통계|군.?구별|학교급별|지역별/.test(q))return null;
 const selected=data.catalog.find(e=>e.id===p.dataset_id)||data.match(q);if(!selected)return null;
 const ids=!p.dataset_id&&/도서관|장서/.test(q)?['library_access','books']:[selected.id];
 const level=['초등학교','중학교','고등학교','유치원'].find(l=>q.includes(l))||(/학교급별|모든 학교급/.test(q)?'전체':p.level||'초등학교');
 const gu=/군.?구별|지역별/.test(q),year=Number(q.match(/20\d{2}/)?.[0])||null,sections=[],sources=[],summaries=[];
 for(const id of ids){const e=data.catalog.find(e=>e.id===id),b=data.read(e);let rows=data.rowsFor(e,b.data);if(level!=='전체')rows=rows.filter(r=>!r.level||r.level===level);const district=[...new Set(rows.map(r=>r.gu).filter(Boolean))].sort((a,b)=>b.length-a.length).find(g=>q.includes(g));if(district)rows=rows.filter(r=>r.gu===district);
  const rowYear=r=>r.year??(id==='books'?r.books?.year:undefined);const years=rows.map(r=>Number(rowYear(r))).filter(Number.isFinite),chosenYear=year||Math.max(...years);if(years.length)rows=rows.filter(r=>Number(rowYear(r))===chosenYear);
  let fields=e.fields.filter(k=>!/year|lat|lng|^id$|위도|경도/.test(k)&&rows.some(r=>finite(data.get(r,k))));if(!fields.length&&rows.some(r=>finite(r.value)))fields=['value'];
  const key=fields.find(k=>q.includes(data.fieldLabel(k)))||({schools:/학급/.test(q)?'classes':/교사|교원/.test(q)?'teachers':/공원/.test(q)?'parks':/녹지/.test(q)?'green':'students',books:/사서/.test(q)?'books.staff':'books.per_student',library_access:'nearest_m.public_children',shared_parks:'shared_area_per_student'})[id]||fields[0];
  if(!key){const r=data.run(q+(level==='전체'?'':' '+level),{dataset_id:id,school_id:null});if(r?.visual){sections.push(r.visual);sources.push(...r.sources);summaries.push(r.summary);}continue;}
  const groups=new Map();for(const r of rows){const label=[r.level||'자료 전체',gu?r.gu||'지역 미확인':null,r.label,r.unit,r.group].filter(Boolean).join(' · ');groups.set(label,[...(groups.get(label)||[]),r]);}
  const table={headers:['범위','유효 건수','결측 건수','평균','중앙값','최솟값','최댓값'],rows:[]};
  for(const [name,rs] of groups){const v=rs.map(r=>data.get(r,key)).filter(finite).sort((a,b)=>a-b),n=v.length;table.rows.push([name,n,rs.length-n,n?round(v.reduce((a,b)=>a+b,0)/n):'미확보',n?round((v[(n-1)>>1]+v[n>>1])/2):'미확보',n?v[0]:'미확보',n?v.at(-1):'미확보']);}
  const period=years.length?chosenYear+'년':id==='books'?'장서 공시연도별 자료':'보유 스냅샷';
  sections.push({title:e.title+' · '+data.fieldLabel(key)+' · '+period,table,chart:{kind:'bar',unit:'',points:table.rows.filter(r=>finite(r[4])).slice(0,40).map(r=>({name:r[0],value:r[4]}))},notes:['막대는 범위별 중앙값입니다. 학교급·연도·지표 단위가 다른 관측은 합산하지 않습니다. 결측은 평균과 분포에서 제외합니다.']});
  summaries.push(...table.rows.slice(0,8).map(r=>`${e.title} / ${r[0]}: ${r[1]}건, ${data.fieldLabel(key)} 평균 ${r[3]}, 중앙값 ${r[4]} (${period}).`));
  if(groups.size===1){const v=rows.map(r=>data.get(r,key)).filter(finite).sort((a,b)=>a-b);if(v.length){const lo=v[0],step=(v.at(-1)-lo)/8||1,points=Array.from({length:8},(_,i)=>({name:`${round(lo+i*step)}~${round(lo+(i+1)*step)}`,value:0}));for(const x of v)points[Math.min(7,Math.floor((x-lo)/step))].value++;sections.push({title:data.fieldLabel(key)+' 분포',chart:{kind:'bar',unit:'건',points},notes:['동일 범위의 유효 관측 분포입니다. 학교의 품질·투자 순위가 아닙니다.']});}}
  sources.push({id:'population#'+id,title:e.title,source:e.file,body:JSON.stringify({field:key,year:years.length?chosenYear:null,level,group_by:gu?'학교급·군구':'학교급'}),provenance:[{path:e.file,sha256:b.hash}]});
 }
 const table={headers:['분석','범위','유효 건수','결측 건수','평균','중앙값','최솟값','최댓값'],rows:sections.filter(s=>s.table?.headers[0]==='범위').flatMap(s=>s.table.rows.map(r=>[s.title,...r]))};
 return {answerable:true,mode:'population',school_id:null,summary:`${level==='전체'?'학교급별':level+' 전체'} 통계입니다.\n${summaries.length?summaries.join('\n'):'해당 조건의 비교 가능한 자료를 확보하지 못했습니다.'}`,sources,visual:{title:'전체 통계 · 질문별 분석',sections,table,notes:['학교를 선택했더라도 전체 범위 요청에는 그 학교로 필터링하지 않습니다. 수집 자료의 통계이며 미확보는 부족 확정이 아닙니다.']},export_table:table};
}
module.exports={run};
