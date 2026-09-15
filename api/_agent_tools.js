'use strict';
// Deterministic tools the chat agent can call. Each returns {llm: compact JSON for the model, visual: UI section, sources}.
const table=require('./_school_table'),data=require('./_data_answers');
const LEVELS=['초등학교','중학교','고등학교','유치원'];
const round=(v,d=1)=>v==null||!Number.isFinite(v)?null:Number(v.toFixed(d));
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return (s[(s.length-1)>>1]+s[s.length>>1])/2;};
const quantile=(s,q)=>{if(!s.length)return null;const i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function ranks(v){const a=v.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),r=[];for(let i=0;i<a.length;){let j=i+1;while(j<a.length&&a[j].v===a[i].v)j++;for(let k=i;k<j;k++)r[a[k].i]=(i+j-1)/2+1;i=j;}return r;}
function pearson(x,y){const a=mean(x),b=mean(y),xx=x.map(v=>v-a),yy=y.map(v=>v-b),den=Math.sqrt(xx.reduce((s,v)=>s+v*v,0)*yy.reduce((s,v)=>s+v*v,0));return den?xx.reduce((s,v,i)=>s+v*yy[i],0)/den:null;}

// Models sometimes send the strings "null"/"전체"/"" instead of JSON null; treat those as unset.
const unset=v=>v==null||v===''||v==='null'||v==='undefined'||v==='전체'||v==='인천 전체'||v==='전체 지역';
function resolveGu(value){
 if(unset(value))return null;
 const all=[...new Set(table.build().rows.map(r=>r.gu).filter(Boolean))],q=String(value).trim();
 const hit=all.find(g=>g===q)||all.find(g=>g.replace(/[구군]$/,'')===q.replace(/[구군]$/,''))||all.find(g=>q.includes(g));
 if(!hit)throw Error(`군·구 이름을 확인해 주세요: ${q}. 사용 가능한 값: ${all.join(', ')}`);
 return hit;
}
function scope(ctx,p){
 const T=table.build();let rows=T.rows;
 if(ctx.extra)rows=rows.map(r=>({...r,...(ctx.extra.values.get(r.id)!=null?{[ctx.extra.column]:ctx.extra.values.get(r.id)}:{})}));
 const asked=unset(p.level)?null:String(p.level).trim();
 const level=asked||(unset(ctx.level)?null:ctx.level);
 if(level&&!LEVELS.includes(level))throw Error('학교급은 초등학교·중학교·고등학교·유치원·전체 중 하나입니다.');
 if(level)rows=rows.filter(r=>r.level===level);
 const gu=resolveGu(p.gu);
 if(gu)rows=rows.filter(r=>r.gu===gu);
 const island=unset(p.island)?null:p.island;
 if(island==='exclude')rows=rows.filter(r=>!r.island);if(island==='only')rows=rows.filter(r=>r.island);
 if(Array.isArray(p.school_ids)&&p.school_ids.length){const set=new Set(p.school_ids.filter(id=>!unset(id)));if(set.size)rows=rows.filter(r=>set.has(r.id));}
 return {rows,level,gu,island,label:`${level||'전체 학교급'} · ${gu||'인천 전체'}${island==='exclude'?' · 도서지역 제외':island==='only'?' · 도서지역만':''}`};
}
function col(ctx,c){if(ctx.extra&&c===ctx.extra.column)return {label:ctx.extra.label,unit:ctx.extra.unit||'',user:true};if(c==='paps')throw Error('PAPS 등급 정의 확인 전에는 비교할 수 없습니다.');if(!table.COLUMNS[c])throw Error(`알 수 없는 열: ${c}`);return table.COLUMNS[c];}
function sourcesFor(ctx,cols){const seen=new Map();for(const c of cols){if(ctx.extra&&c===ctx.extra.column){seen.set('upload',{id:'user-upload',title:ctx.extra.name||'사용자 첨부 표',source:'사용자 제공 첨부 표',body:`첨부 열 ‘${ctx.extra.label}’ · 연결 ${ctx.extra.values.size}개교`});continue;}const s=table.sourceFor(c);if(!seen.has(s.key))seen.set(s.key,{id:'table#'+s.key,title:s.title,source:s.path,provenance:[{path:s.path,sha256:s.sha256}],body:[...new Set(cols.filter(x=>(table.COLUMN_SOURCE[x]||'dataset')===s.key).map(x=>table.label(x)))].join(', ')});}return [...seen.values()];}
function points(rows){return rows.filter(r=>Number.isFinite(r.lat)).slice(0,60).map(r=>({id:r.id,name:r.name,lat:r.lat,lng:r.lng,detail:r.gu||''}));}
function geometries(ids,kinds){
 const out=[],set=new Set(ids);
 for(const kind of kinds){const e=data.catalog.find(e=>e.id===(kind==='zone'?'zones':'walkshed'));const b=data.read(e);
  for(const f of b.data.features){const hit=kind==='zone'?f.properties.schools?.some(s=>set.has(s.id)):set.has(f.properties.학교ID);if(!hit)continue;
   out.push({type:'Feature',geometry:f.geometry,properties:{name:(kind==='zone'?'학구도 · ':'보행 500m · ')+(f.properties.name||f.properties.학교명),color:kind==='zone'?'#8359ae':'#25866d'}});}}
 return out;
}
const show=v=>typeof v==='boolean'?(v?'예':'아니오'):v;
const tools_level=q=>/초$|초등/.test(q)?'초등학교':/중$|중학/.test(q)?'중학교':/고$|고등/.test(q)?'고등학교':/유치원/.test(q)?'유치원':null;
function fmtRow(ctx,r,cols){const o={name:r.name};for(const c of cols)if(c!=='name'){const v=r[c];o[c]=typeof v==='number'?round(v,Math.abs(v)>=100?0:Math.abs(v)>=10?1:2):v;}return o;}

// ---- tools ----
function query_schools(ctx,p){
 const s=scope(ctx,p);let rows=s.rows;const usedCols=new Set(['name','gu']);
 for(const w of (p.where||[]).filter(w=>w&&!unset(w.column)&&!unset(w.op))){col(ctx,w.column);usedCols.add(w.column);const v=w.value,v2=w.value2;
  rows=rows.filter(r=>{const x=r[w.column];switch(w.op){case 'is_null':return x==null;case 'not_null':return x!=null;case 'contains':return String(x??'').includes(String(v));case '==':return x==v;case '!=':return x!=v;case '>':return x!=null&&x>Number(v);case '>=':return x!=null&&x>=Number(v);case '<':return x!=null&&x<Number(v);case '<=':return x!=null&&x<=Number(v);case 'between':return x!=null&&x>=Number(v)&&x<=Number(v2);default:throw Error('지원하지 않는 조건: '+w.op);}});}
 const matched=rows.length;
 if(p.aggregate&&!unset(p.aggregate.by)&&!unset(p.aggregate.column)){
  const by=p.aggregate.by,c=p.aggregate.column;col(ctx,c);usedCols.add(c);const groups=new Map();
  for(const r of rows){const k=by==='island'?(r.island?'도서·농어촌':'도시'):r[by]||'미확인';if(r[c]==null)continue;(groups.get(k)||groups.set(k,[]).get(k)).push(r[c]);}
  const out=[...groups].map(([k,v])=>({group:k,n:v.length,mean:round(mean(v)),median:round(median(v)),min:round(Math.min(...v)),max:round(Math.max(...v)),sum:round(v.reduce((a,b)=>a+b,0),0)})).sort((a,b)=>(b[p.aggregate.stat||'mean']??0)-(a[p.aggregate.stat||'mean']??0));
  const stat=p.aggregate.stat||'mean',unit=col(ctx,c).unit||'';
  return {llm:{scope:s.label,column:c,groups:out},sources:sourcesFor(ctx,[...usedCols]),visual:{title:`${by==='gu'?'군·구':by==='level'?'학교급':'지역 유형'}별 ${table.label(c)} (${{mean:'평균',median:'중앙값',sum:'합계',min:'최솟값',max:'최댓값'}[stat]||stat})`,chart:{kind:'bar',unit,points:out.map(g=>({name:g.group,value:g[stat]}))},table:{headers:['구분','학교 수','평균','중앙값','최솟값','최댓값','합계'],rows:out.map(g=>[g.group,g.n,g.mean,g.median,g.min,g.max,g.sum])},notes:[`${s.label} · 값이 있는 학교만 집계 (${out.reduce((n,g)=>n+g.n,0)}개교).`]}};
 }
 const sortBy=unset(p.sort_by)?null:p.sort_by;if(sortBy){col(ctx,sortBy);usedCols.add(sortBy);rows=rows.filter(r=>r[sortBy]!=null).sort((a,b)=>(p.order==='asc'?1:-1)*(a[sortBy]-b[sortBy])||a.name.localeCompare(b.name,'ko'));}
 const excluded=matched-rows.length,limit=Math.min(50,Math.max(1,Number(p.limit)||15));
 const cols=[...new Set(['name','gu',...(sortBy?[sortBy]:[]),...(p.columns||[]).filter(c=>!unset(c)&&c!=='name')])].slice(0,9);cols.forEach(c=>{col(ctx,c);usedCols.add(c);});
 const shown=rows.slice(0,limit),all=sortBy?rows.map(r=>r[sortBy]):[];
 const stats=sortBy&&all.length?{n:all.length,median:round(median(all)),min:round(Math.min(...all)),max:round(Math.max(...all))}:null;
 const numericCols=cols.filter(c=>c!=='name'&&c!=='gu'&&shown.some(r=>typeof r[c]==='number'));
 const chartCol=sortBy||numericCols[0];
 const wantBoundary=cols.some(c=>/^zone_|^walk_/.test(c))||p.map==='boundaries';
 const visual={title:sortBy?`${table.label(sortBy)} ${p.order==='asc'?'낮은':'높은'} 순 · ${s.label}`:`${s.label} 학교 목록`,map:points(shown),geometries:wantBoundary&&shown.length<=25?geometries(shown.map(r=>r.id),['zone','walkshed']):[],
  chart:chartCol&&shown.length>1?{kind:'bar',unit:col(ctx,chartCol).unit||'',title:table.label(chartCol),points:shown.map(r=>({name:r.name,value:r[chartCol],selected:r.id===ctx.school_id}))}:null,
  table:{headers:cols.map(c=>c==='name'?'학교':c==='gu'?'군·구':`${col(ctx,c).label}${col(ctx,c).unit?' ('+col(ctx,c).unit+')':''}`),rows:shown.map(r=>cols.map(c=>show(r[c])??'—'))},
  notes:[`조건에 맞는 학교 ${matched}개교${excluded?` 중 ${sortBy?table.label(sortBy):'정렬 기준'} 값이 없는 ${excluded}개교 제외`:''} · 표시 ${shown.length}개교.`,...(stats?[`${table.label(sortBy)} 중앙값 ${stats.median}${col(ctx,sortBy).unit||''} · 범위 ${stats.min}~${stats.max}.`]:[]),...(wantBoundary?['보라색 면은 공식 학구도, 초록색 면은 보행망 500m 도달권입니다.']:[])]};
 return {llm:{scope:s.label,matched,excluded_missing:excluded,shown:shown.length,stats,rows:shown.map(r=>fmtRow(ctx,r,cols))},visual,sources:sourcesFor(ctx,[...usedCols])};
}
function school_profile(ctx,p){
 const T=table.build();let r=p.school_id?T.byId.get(p.school_id):null;
 if(!r&&p.name){const q=String(p.name).replace(/\s/g,'');let hits=T.rows.filter(x=>x.name.replace(/\s/g,'').includes(q)||x.name.replace(/^인천/,'').replace(/\s/g,'')===q);
  const exact=hits.filter(x=>[x.name,x.name.replace(/^인천/,'')].map(n=>n.replace(/\s/g,'')).includes(q));if(exact.length)hits=exact;
  if(hits.length>1&&ctx.level&&hits.some(x=>x.level===ctx.level))hits=hits.filter(x=>x.level===ctx.level);
  if(hits.length>1){const level=tools_level(q);if(level&&hits.some(x=>x.level===level))hits=hits.filter(x=>x.level===level);}
  if(hits.length===1)r=hits[0];else if(hits.length>1)return {llm:{error:'여러 학교가 일치합니다. 하나를 고르세요.',candidates:hits.slice(0,8).map(h=>({id:h.id,name:h.name,level:h.level,gu:h.gu}))},visual:null,sources:[]};}
 if(!r)throw Error('학교를 찾지 못했습니다. 학교명을 정확히 적어 주세요.');
 const peers=T.rows.filter(x=>x.level===r.level),cols=((p.columns||[]).filter(c=>!unset(c)).length?p.columns.filter(c=>!unset(c)):['students','class_size','student_change_pct','forecast_change_pct_2031','parks_walk','green_ratio','nearest_park_m','walk_area_ratio_to_circle','zone_walk_mismatch_pct','zone_outside_walk_pct','books_per_student','librarians','nearest_public_library_m','academies_500m','nightlife_500m','child_accident_nearest_m','large_apt_households_500m','designations_current']).filter(c=>c!=='paps'&&table.COLUMNS[c]&&!['text','bool'].includes(table.COLUMNS[c].type)&&r[c]!=null);
 const rows=cols.map(c=>{const vals=peers.map(x=>x[c]).filter(v=>v!=null).sort((a,b)=>a-b);const below=vals.filter(v=>v<r[c]).length,ties=vals.filter(v=>v===r[c]).length;const pct=round(100*(below+ties/2)/vals.length,0);return {column:c,label:table.label(c),unit:table.unit(c),value:r[c],level_median:round(median(vals)),percentile:pct,n:vals.length};});
 const sim=data.read({id:'table:similar',file:table.FILES.similar}).data.find(x=>x.학교ID===r.id);
 const similar=sim?[1,2,3,4,5].map(i=>sim[`similar_school_${i}_name`]).filter(Boolean):[];
 const llm={id:r.id,name:r.name,level:r.level,gu:r.gu,island:r.island,indicators:rows.map(x=>({[x.column]:x.value,level_median:x.level_median,percentile_in_level:x.percentile})),designations:r.designation_names,park_case:r.park_case,nearest_park_name:r.nearest_park_name,similar_schools:similar};
 const visual={title:`${r.name} 지표 프로필 · 같은 ${r.level} ${peers.length}개교 대비`,map:[{name:r.name,lat:r.lat,lng:r.lng,detail:'선택 학교',selected:true}],geometries:geometries([r.id],['zone','walkshed']),
  chart:{kind:'bar',unit:'%',title:'같은 학교급 내 백분위(값이 큰 쪽 기준)',points:rows.map(x=>({name:x.label,value:x.percentile}))},
  table:{headers:['지표','이 학교','학교급 중앙값','백분위(%)','비교 학교 수'],rows:rows.map(x=>[x.label+(x.unit?' ('+x.unit+')':''),x.value,x.level_median,x.percentile,x.n])},
  notes:['백분위는 같은 학교급에서 이 값보다 작은 학교의 비율입니다(동점 절반 반영). 지표마다 좋고 나쁨의 방향이 다릅니다.',...(similar.length?[`KNN 유사학교(학생 규모·추세·주변 개발 기준): ${similar.join(', ')}`]:[]),...(r.designation_names?[`2026 지정·지원사업: ${r.designation_names}`]:[])]};
 return {llm,visual,sources:sourcesFor(ctx,cols.concat(similar.length?['large_apt_500m']:[]))};
}
function correlate(ctx,p){
 const s=scope(ctx,p);col(ctx,p.x);col(ctx,p.y);const rows=s.rows.filter(r=>r[p.x]!=null&&r[p.y]!=null);
 if(rows.length<3)throw Error('두 변수 값이 모두 있는 학교가 3개 미만입니다.');
 const x=rows.map(r=>r[p.x]),y=rows.map(r=>r[p.y]),r=pearson(x,y),rho=pearson(ranks(x),ranks(y));
 const llm={scope:s.label,n:rows.length,x:p.x,y:p.y,pearson_r:round(r,3),spearman_rho:round(rho,3),interpretation:Math.abs(rho??0)<0.2?'거의 관계 없음':Math.abs(rho)<0.4?'약한 관계':Math.abs(rho)<0.6?'중간 관계':'강한 관계',extremes:{top_x:rows.slice().sort((a,b)=>b[p.x]-a[p.x]).slice(0,3).map(r=>[r.name,r[p.x],r[p.y]]),top_y:rows.slice().sort((a,b)=>b[p.y]-a[p.y]).slice(0,3).map(r=>[r.name,r[p.x],r[p.y]])}};
 const visual={title:`${table.label(p.x)} × ${table.label(p.y)} · ${s.label}`,chart:{kind:'scatter',x:[table.label(p.x),table.unit(p.x)],y:[table.label(p.y),table.unit(p.y)],points:rows.map(r=>({name:r.name,x:r[p.x],y:r[p.y],selected:r.id===ctx.school_id}))},table:{headers:['학교 수','Pearson r','Spearman ρ','해석'],rows:[[rows.length,llm.pearson_r,llm.spearman_rho,llm.interpretation]]},notes:['관측된 상관이며 인과관계가 아닙니다. 점을 누르면 학교와 값이 보입니다.']};
 return {llm,visual,sources:sourcesFor(ctx,[p.x,p.y])};
}
function distribution(ctx,p){
 const s=scope(ctx,p);col(ctx,p.column);const rows=s.rows.filter(r=>Number.isFinite(r[p.column])),vals=rows.map(r=>r[p.column]).sort((a,b)=>a-b);
 if(!vals.length)throw Error('값이 있는 학교가 없습니다.');
 const lo=vals[0],hi=vals.at(-1),bins=lo===hi?1:8,step=(hi-lo)/bins;
 const hist=Array.from({length:bins},(_,i)=>({from:lo+step*i,to:i===bins-1?hi:lo+step*(i+1),value:0,members:[]}));
 for(const r of rows){const index=step?Math.min(bins-1,Math.max(0,Math.floor((r[p.column]-lo)/step))):0;hist[index].value++;hist[index].members.push(r.id);}
 for(const h of hist)h.name=h.from===h.to?String(h.from):`${h.from}~${h.to}`;
 const own=ctx.school_id?rows.find(r=>r.id===ctx.school_id):null,pct=own?round(100*(vals.filter(v=>v<own[p.column]).length+vals.filter(v=>v===own[p.column]).length/2)/vals.length,1):null;
 const llm={scope:s.label,column:p.column,n:vals.length,total:s.rows.length,missing:s.rows.length-vals.length,min:round(lo),q1:round(quantile(vals,.25)),median:round(median(vals)),q3:round(quantile(vals,.75)),max:round(hi),mean:round(mean(vals)),histogram:hist.map(h=>[h.name,h.value]),selected_school:own?{name:own.name,value:own[p.column],percentile:pct}:null,lowest:rows.slice().sort((a,b)=>a[p.column]-b[p.column]).slice(0,5).map(r=>[r.name,r[p.column]]),highest:rows.slice().sort((a,b)=>b[p.column]-a[p.column]).slice(0,5).map(r=>[r.name,r[p.column]])};
 const visual={title:`${table.label(p.column)} 분포 · ${s.label}`,chart:{kind:'bar',unit:'개교',title:'구간별 학교 수',points:hist.map(h=>({name:h.name,value:h.value,selected:!!own&&h.members.includes(own.id)}))},table:{headers:['학교 수','최솟값','1사분위','중앙값','3사분위','최댓값','평균'],rows:[[llm.n,llm.min,llm.q1,llm.median,llm.q3,llm.max,llm.mean]]},notes:[`대상 ${llm.total}개교 · 유효값 ${llm.n}개교 · 미확보 ${llm.missing}개교. 미확보는 0으로 집계하지 않습니다.`,own?`${own.name}: ${own[p.column]}${table.unit(p.column)} · 값 크기 기준 백분위 ${pct}% (동점 절반 반영).`:'구간은 왼쪽 경계를 포함하고 오른쪽 경계를 제외하며 마지막 구간만 양쪽을 포함합니다.',...(vals.length<10?['유효 학교가 10개 미만이므로 분포 해석에 주의가 필요합니다.']:[])]};
 return {llm,visual,sources:sourcesFor(ctx,[p.column])};
}
function weighted_rank(ctx,p){
 const criteria=(p.criteria||[]).filter(c=>c&&!unset(c.column)).map(c=>({...c}));
 if(!criteria.length||criteria.length>8)throw Error('기준은 1~8개입니다.');
 criteria.forEach(c=>{col(ctx,c.column);if(!Number.isFinite(Number(c.weight))||Number(c.weight)<0)throw Error('비중은 0 이상의 숫자여야 합니다.');c.weight=Number(c.weight);});
 const total=criteria.reduce((n,c)=>n+c.weight,0);if(!total)throw Error('가중치 합이 0입니다.');
 const weights=criteria.map(c=>({...c,share_pct:round(100*c.weight/total,1)}));
 const results=weights.filter(c=>c.weight>0).sort((a,b)=>b.weight-a.weight).map(c=>{
  const r=query_schools(ctx,{...p,sort_by:c.column,order:c.prefer==='low'?'asc':'desc',columns:criteria.map(x=>x.column),limit:p.limit||10});
  r.visual.notes.push(`관심 비중 ${c.share_pct}% · 기준별 원값을 따로 확인합니다. 학교 종합점수·투자 순위가 아닙니다.`);
  return r;
 });
 const sections=results.map(r=>r.visual);sections[0].weights=weights;
 return {llm:{scope:scope(ctx,p).label,weights,method:'관심 비중에 따라 기준별 관측 패널의 표시 순서만 변경. 합산 점수 없음.',observations:results.map(r=>r.llm),constraints:'이용대상·안전·실행·출입구 경로는 별도 필수 확인. 미확인 조건은 가중치로 상쇄하지 않음. 도서 학교는 별도 검토.'},visual:sections[0],sections,sources:[...new Map(results.flatMap(r=>r.sources).map(s=>[s.id,s])).values()]};
}
function guide(ctx,p){
 const hits=require('./_guide_chunks').retrieve(p.topic||'').slice(0,2);
 return {llm:{chunks:hits.map(c=>({id:c.id,title:c.title,body:c.body.slice(0,1200)}))},visual:null,sources:hits.map(c=>({id:c.id,title:c.title,source:c.source,body:c.body.slice(0,2000)}))};
}
function ask_user(ctx,p){return {llm:{acknowledged:true},needs_input:{prompt:p.prompt,options:p.options||[],multi:!!p.multi,weights:p.weights||[]},visual:null,sources:[]};}

const TOOLS=[
 {name:'query_schools',description:'학교 표를 조건으로 거르고 정렬해 상위 N개를 보거나(sort_by), 군·구/학교급별로 집계(aggregate)합니다. 목록·순위·상위/하위·차이·비교·군구별 통계 질문에 사용. 결과 표·차트·지도는 자동으로 사용자에게 표시됩니다.',parameters:{type:'object',properties:{level:{type:['string','null'],enum:['초등학교','중학교','고등학교','유치원','전체',null]},gu:{type:['string','null'],description:'군·구 이름(예: 부평구) 또는 null'},island:{type:['string','null'],enum:['include','exclude','only',null]},school_ids:{type:['array','null'],items:{type:'string'}},where:{type:['array','null'],items:{type:'object',properties:{column:{type:'string'},op:{type:'string',enum:['>','>=','<','<=','==','!=','between','contains','is_null','not_null']},value:{type:['number','string','null']},value2:{type:['number','null']}},required:['column','op','value','value2'],additionalProperties:false}},sort_by:{type:['string','null'],description:'정렬 열 id'},order:{type:['string','null'],enum:['desc','asc',null]},limit:{type:['integer','null'],description:'기본 15, 최대 50'},columns:{type:['array','null'],items:{type:'string'},description:'함께 보여줄 열 id(최대 6개)'},map:{type:['string','null'],enum:['points','boundaries',null],description:'boundaries면 학구도·도보권 면을 지도에 함께 표시'},aggregate:{type:['object','null'],properties:{by:{type:'string',enum:['gu','level','island']},column:{type:'string'},stat:{type:['string','null'],enum:['mean','median','sum','min','max',null]}},required:['by','column','stat'],additionalProperties:false}},required:['level','gu','island','school_ids','where','sort_by','order','limit','columns','map','aggregate'],additionalProperties:false},strict:true},
 {name:'school_profile',description:'한 학교의 주요 지표와 같은 학교급 내 백분위·중앙값, 유사학교, 지정사업을 봅니다. 특정 학교 질문·“이 학교”·상대 위치 질문에 사용.',parameters:{type:'object',properties:{school_id:{type:['string','null']},name:{type:['string','null']},columns:{type:['array','null'],items:{type:'string'},description:'보고 싶은 열 id. null이면 기본 18개'}},required:['school_id','name','columns'],additionalProperties:false},strict:true},
 {name:'correlate',description:'두 수치 열의 상관(Pearson·Spearman)과 산점도.',parameters:{type:'object',properties:{level:{type:['string','null']},gu:{type:['string','null']},x:{type:'string'},y:{type:'string'}},required:['level','gu','x','y'],additionalProperties:false},strict:true},
 {name:'distribution',description:'한 열의 분포(사분위·히스토그램·최저/최고 학교)와 선택 학교의 백분위.',parameters:{type:'object',properties:{level:{type:['string','null']},gu:{type:['string','null']},column:{type:'string'}},required:['level','gu','column'],additionalProperties:false},strict:true},
 {name:'weighted_rank',description:'사용자가 명시한 관심 비중에 따라 기준별 관측 패널의 표시 순서만 바꿉니다. 합산 점수나 투자 순위를 계산하지 않습니다. 기준별 원값·표·차트를 제공합니다. 기본 비중을 임의로 제안하지 마세요.',parameters:{type:'object',properties:{level:{type:['string','null']},gu:{type:['string','null']},island:{type:['string','null'],enum:['include','exclude','only',null]},criteria:{type:'array',items:{type:'object',properties:{column:{type:'string'},prefer:{type:'string',enum:['high','low']},weight:{type:'number'}},required:['column','prefer','weight'],additionalProperties:false}},limit:{type:['integer','null']}},required:['level','gu','island','criteria','limit'],additionalProperties:false},strict:true},
 {name:'guide',description:'분석 방법·자료 범위·판단 원칙 설명 문서를 찾습니다. “어떻게 계산했나”, “무엇을 돕는 서비스인가”, 방법론 질문에만 사용.',parameters:{type:'object',properties:{topic:{type:'string'}},required:['topic'],additionalProperties:false},strict:true},
 {name:'ask_user',description:'질문이 모호해 결과가 크게 달라질 때만 사용자에게 선택지를 제시합니다(예: 비교 기준 열이 여러 개일 때, 가중치를 사용자가 정해야 할 때). 당연한 판단은 직접 내리고 이 도구를 쓰지 마세요. 호출하면 대화가 사용자에게 넘어갑니다.',parameters:{type:'object',properties:{prompt:{type:'string'},options:{type:['array','null'],items:{type:'object',properties:{id:{type:'string'},label:{type:'string'},description:{type:['string','null']}},required:['id','label','description'],additionalProperties:false}},multi:{type:['boolean','null']},weights:{type:['array','null'],description:'가중치 슬라이더로 보여줄 기준 제안',items:{type:'object',properties:{column:{type:'string'},prefer:{type:'string',enum:['high','low']},weight:{type:'number'}},required:['column','prefer','weight'],additionalProperties:false}}},required:['prompt','options','multi','weights'],additionalProperties:false},strict:true},
];
const IMPL={query_schools,school_profile,correlate,distribution,weighted_rank,guide,ask_user};
function run(name,ctx,args){if(!IMPL[name])throw Error('알 수 없는 도구: '+name);return IMPL[name](ctx,args||{});}
module.exports={TOOLS,run,scope,geometries,LEVELS};
