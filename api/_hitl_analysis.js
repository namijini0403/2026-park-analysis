'use strict';
// Plans are rebuilt from the current catalog on every request. Client definitions and old scores are never trusted.
const data=require('./_data_answers'),model=require('./_school_summary'),joined=require('./_joined_analysis');
const VERSION=1;
const conclusion=require('../assets/question-conclusion');
const crypto=require('node:crypto');
const intent=require('./_question_intent');
function load(e){
 if(e.id!=='books')return data.read(e);
 const b=data.read(e),raw=data.read({id:'hitl-book-totals',file:'data_processed/school_library_access.csv'}),byId=new Map();
 for(const r of raw.data){if(byId.has(r.학교ID))byId.set(r.학교ID,null);else byId.set(r.학교ID,r);}
 return {...b,extraSource:{path:'data_processed/school_library_access.csv',sha256:raw.hash},data:{...b.data,schools:b.data.schools.map(s=>{const r=byId.get(s.id);return {...s,books:{...s.books,total:r?.matched===1&&String(r.기준일)===String(s.books?.year)?r.장서수:null,seats:r?.matched===1&&String(r.기준일)===String(s.books?.year)?r.좌석수:null}};})}};
}
const banned=/(score|rank|priority|grade|ieei|recommend|action|gap_type|risk_level|등급|점수|순위|위도|경도|latitude|longitude|^lat$|^lng$|(^|[._])id$|year|date|horizon|radius|probability)/i;
const evidenceOnly=new Set(['similar','diffusion','zones','walkshed','designations','sports_awards','science_awards','invention_awards','hybrid','route_review','park_review']);
const groups=['level','year','group','label','unit','kind','sport','category','event','discipline','radius_m','probability_per_edge','horizon','target_grade'];
const rules=['누락·중복·범위 미확인은 0으로 채우지 않고 판단을 보류합니다.','이용 대상·안전·실행·출입구 경로는 가중치로 상쇄할 수 없는 필수 확인 조건입니다.','도서지역은 별도 검토합니다. 직선거리·대표점 포함은 검증된 도보 접근이 아닙니다.','가중치는 고려 요소의 검토 비중입니다. 학교 투자 순위·종합점수로 합산하지 않습니다.'];
function layer(id){return /grid|candidate/.test(id)?'후보 관측':/forecast|cohort|demography|demand|diffusion|residential/.test(id)?'미래 수요·가정':/route|hybrid|resilience|construction|nightlife|access|walkshed/.test(id)?'접근·확인 조건':'현재 관측';}
function definitions(e){
 const b=load(e),rows=data.rowsFor(e,b.data);
 const fields=e.id==='books'?[...e.fields,'books.total','books.seats']:e.fields.length?e.fields:['value','area_m2','count_500m','park_count','green','n','mae','baseline_mae','wape','direction_accuracy'];
 const numeric=evidenceOnly.has(e.id)?[]:fields.filter(f=>!banned.test(f)&&rows.some(r=>Number.isFinite(data.get(r,f))));
 let result=numeric.map(field=>({id:e.id+':'+field,dataset:e.id,field,label:({'books.total':'장서 총수 (권)','books.seats':'도서관 좌석 수 (석)'})[field]||data.fieldLabel(field),layer:layer(e.id),method:'같은 단위·연도·학교급·시나리오별 관측 분포, 중앙값, 원값 백분위',missing:'결측·중복은 제외하고 제외 건수를 공개',directions:['observe','lower','higher'],source:e.file}));
 if(e.id==='indicators')result=[...new Map(rows.map(r=>{const selector={group:r.group,label:r.label,unit:r.unit},key=JSON.stringify(selector);return [key,{...result[0],id:e.id+':'+crypto.createHash('sha256').update(key).digest('hex').slice(0,16),label:r.group+' · '+r.label+' ('+r.unit+')',selector}];})).values()];
 const evidence={id:e.id+':evidence',dataset:e.id,field:null,label:'기록·지도·출처 확인',layer:layer(e.id),method:'기록과 확인 상태를 원자료 단위로 표시. 숫자 점수로 환산하지 않음',missing:'기록 미확인은 실제 부재가 아님',directions:['observe'],source:e.file};
 return [evidence,...(e.id==='services'?['도서관 목록','운동 시설','돌봄'].map((term,i)=>({...evidence,id:e.id+':service-'+i,label:term+' · 이용조건과 위치',query:term})):[]),...result];
}
function context(p){
 const q=String(p.question||'').trim();if(!q||q.length>500)throw Error('질문은 1~500자로 입력해 주세요.');
 const named=model.registry().filter(s=>q.includes(s.name));if(named.length>1)throw Error('선택 학교는 한 곳씩 지정해 주세요. 전체 분포는 함께 표시됩니다.');
 const school=named[0]|| (p.scope==='school'&&!intent.allScope(q)?model.registry().find(s=>s.id===p.school_id):null);
 if(p.scope==='school'&&!school&&!intent.allScope(q))throw Error('학교를 선택해 주세요.');
 const level=school?.level||['초등학교','중학교','고등학교','유치원'].find(l=>q.includes(l))||p.level||'초등학교';
 if(!['초등학교','중학교','고등학교','유치원','전체'].includes(level))throw Error('학교급을 확인해 주세요.');
 const year=p.year==null||p.year===''?Number(q.match(/20\d{2}/)?.[0])||null:Number(p.year);
 if(year!=null&&(!Number.isInteger(year)||year<2000||year>2100))throw Error('연도는 2000~2100 범위에서 선택해 주세요.');
 const gu=[...new Set(model.registry().map(s=>s.gu).filter(Boolean))].sort((a,b)=>b.length-a.length).find(g=>q.includes(g))||null;
 return {question:q,school_id:school?.id||null,school_name:school?.name||null,level,year,gu};
}
function purpose(q){
 const datasets=new Set(),checks=[];
 const add=(ids,items)=>{ids.forEach(id=>datasets.add(id));checks.push(...items);};
 if(/등교|하교|통학|안전인력|안전 인력|교통안전/.test(q))add(['schools','zones','construction','route_review'],['등하교 시간대 학생 통행량·사고 및 아차사고·횡단보도와 신호·기존 안전인력 배치 자료를 추가해 주세요.','보유 공원 보행 경로는 통학 경로가 아닙니다. 공사장 위치나 학생 수만으로 통학 위험·인력 부족을 확정하지 않습니다.']);
 if(/도서관|장서|독서/.test(q))add(['books','library_access','schools','services'],['장서 최신성·실제 대출 및 이용량·사서 근무시간·외부 도서관 개방과 아동 이용조건을 확인해 주세요.']);
 if(/공원|야외|녹지|놀이터/.test(q))add(['schools','shared_parks','routes','park_review'],['공원 출입구·통행 허용·안전·공동 이용 시간과 실제 수용 여건을 확인해 주세요.']);
 if(/돌봄|복지|방과후/.test(q))add(['services','schools','indicators','school_demand'],['돌봄 대기자·정원·운영시간·이용 자격·실제 이동경로 자료를 추가해 주세요.']);
 if(/미래|향후|예측|전망|증가|신설/.test(q))add(['forecast','school_validation','school_demand'],['관측과 예측을 구분하고 모형 오차·주거사업 일정·학구 조정 가능성을 함께 확인해 주세요.']);
 return {datasets:[...datasets],checks:checks.length?checks:['최신 기준일·자료 누락·실제 이용 대상·안전·실행 가능성·이동경로를 확인해 주세요.']};
}
function plan(p){
 const ctx=context(p),q=ctx.question,resolved=intent.resolve(q,p.dataset_id);
 if(!p.upload&&resolved.workflow!=='overlap'&&require('./_relative_position').detect(q).length){resolved.workflow='direct';resolved.summary='학교별 값과 전체·군·구 평균, 순위·백분위를 바로 계산합니다. 가중치는 필요하지 않습니다.';}
 const catalog=data.catalog.map(e=>({id:e.id,title:e.id==='schools'&&!/공원|녹지/.test(q)?'학생·학급·교원 관측':e.title,related:resolved.matches.has(e.id),reason:resolved.matches.get(e.id)||'직접 추가한 자료',layer:layer(e.id)}));
 if(resolved.workflow==='factors')for(const id of purpose(q).datasets)if(!resolved.matches.has(id))resolved.matches.set(id,'질문을 판단할 때 함께 확인할 관련 자료');
 const suggested=[...resolved.matches.keys()];
 const candidates=['factors','ordered'].includes(resolved.workflow)?suggested.flatMap(id=>{const e=data.catalog.find(e=>e.id===id);return definitions(e).filter(f=>(!f.query||!(/도서|독서|장서/.test(q))||f.query==='도서관 목록')&&(intent.relevantFactor(f,q)||(resolved.workflow==='factors'&&f.dataset==='schools'&&f.field==='students'))&&(resolved.workflow!=='ordered'||f.field)).map(f=>({...f,title:catalog.find(c=>c.id===id).title,reason:resolved.matches.get(id)}));}):[];
 return {version:VERSION,context:ctx,catalog,rules,workflow:resolved.workflow,candidates,checks:purpose(q).checks,summary:resolved.workflow==='factors'?'관련 변수를 체크하면 아래에 가중치 레버가 나타납니다. 레버를 조절하며 근거와 답변의 변화를 확인하세요.':resolved.summary,suggested,...(resolved.workflow==='overlap'?{criteria:require('./_boundary_comparison').criteria}:{})};
}
function factorOptions(p){const e=data.catalog.find(e=>e.id===p.dataset_id);if(!e)throw Error('등록된 자료를 선택해 주세요.');return {factors:definitions(e)};}
function comparisonSections(sections,ctx){
 const roster=model.registry().filter(s=>(ctx.level==='전체'||s.level===ctx.level)&&(!ctx.gu||s.gu===ctx.gu));
 const names=new Map(roster.map(s=>[s.name,s])),observations=[];
 for(const s of sections.filter(s=>s.statistics))for(const row of s.table.rows){const school=names.get(row[0]);if(school)observations.push({school,measure:s.title,value:row[1],percentile:row[4]});}
 if(!observations.length)return [];
 const separate=new Set(model.read('data_processed/student_services/priorities.json').data.schools.filter(s=>s.separate_track).map(s=>s.id));
 return [false,true].flatMap(island=>{const rows=observations.filter(r=>(separate.has(r.school.id)||/옹진|강화/.test(r.school.gu||''))===island).sort((a,b)=>(b.school.id===ctx.school_id)-(a.school.id===ctx.school_id)||a.school.name.localeCompare(b.school.name,'ko')).map(r=>[r.school.name,r.measure,r.value,r.percentile]);return rows.length?[{title:'학교별 선택 요소 함께 보기 · '+(island?'도서·농어촌 별도 검토':'일반 검토'),table:{headers:['학교','요소와 비교 범위','관측값','선택 방향의 검토 백분위 %'],rows},notes:['학교명 순서입니다. 같은 학교의 여러 요소를 함께 확인하되 서로 다른 연도·단위를 합산하지 않습니다.','백분위가 높다는 것은 선택한 방향에서 상대적으로 극단적인 관측이라는 뜻이며 지원 우선순위가 아닙니다. 유효값이 없는 요소는 아래 개별 결과에서 확인하세요.']}]:[];});
}
const round=n=>Number.isFinite(n)?Number(n.toFixed(3)):null;
function distribution(rows,field,direction,schoolId){
 const counts=new Map();for(const r of rows){const id=r.id??r.name;counts.set(id,(counts.get(id)||0)+1);}
 const valid=rows.filter(r=>Number.isFinite(data.get(r,field))&&counts.get(r.id??r.name)===1&&!(r.missing_cells>0||r.missing_parent_grids>0));
 const values=valid.map(r=>data.get(r,field)).sort((a,b)=>a-b),n=values.length;
 const tails=new Map();for(let i=0;i<n;){let j=i+1;while(j<n&&values[j]===values[i])j++;tails.set(values[i],[round(100*j/n),round(100*(n-i)/n)]);i=j;}
 const percentile=v=>tails.get(v)[0],top=v=>tails.get(v)[1];
 const table={headers:['대상','관측값','이 값 이하 비율 %','이 값 이상 비율 %','선택 방향의 검토 백분위 %'],rows:valid.map(r=>[r.name||r.id,round(data.get(r,field)),percentile(data.get(r,field)),top(data.get(r,field)),direction==='higher'?percentile(data.get(r,field)):direction==='lower'?top(data.get(r,field)):'양쪽 관점'])};
 const members=valid.map(r=>({id:r.id,name:r.name||r.id,value:round(data.get(r,field)),gu:r.gu}));
 const points=Array.from({length:n?8:0},(_,i)=>({name:'',value:0,members:[]}));
 if(n){const step=(values.at(-1)-values[0])/8||1;points.forEach((p,i)=>{p.name=`${round(values[0]+step*i)}~${round(values[0]+step*(i+1))}`;});for(const m of members){const p=points[Math.max(0,Math.min(7,Math.floor((m.value-values[0])/step)))];p.value++;p.members.push(m);}}
 const own=valid.find(r=>r.id===schoolId);
 return {n,excluded:rows.length-n,median:n?round((values[(n-1)>>1]+values[n>>1])/2):null,table,chart:{kind:'bar',unit:'건',points,members,measure:data.fieldLabel(field),axis_label:'가로 위치 = 원래 관측값 · 구간의 수 = 해당 값 범위에 속한 관측 건수'},selected:own?{name:own.name,value:data.get(own,field),percentile:percentile(data.get(own,field)),top_percent:top(data.get(own,field))}:null,direction};
}
async function run(p){
 if(Buffer.byteLength(JSON.stringify(p))>900000)throw Error('검토 요청 전체는 900KB 이내로 줄여 주세요. 첨부의 필요한 열·행만 선택해 주세요.');
 if(p.version!==VERSION)throw Error('검토안을 새로 만들어 주세요. 이전 저장값의 점수·추천은 복원하지 않습니다.');
 const ctx=context(p);if(!Array.isArray(p.factors)||!p.factors.length||p.factors.length>16)throw Error('고려 요소는 1~16개 선택해 주세요.');
 if(new Set(p.factors.map(f=>f.id)).size!==p.factors.length)throw Error('중복 요소를 제거해 주세요.');
 const validWeight=w=>w===null||(p.weight_scale===100?Number.isInteger(w)&&w>=0&&w<=100:[1,2,3].includes(w));
 const selected=p.factors.map(f=>{const e=data.catalog.find(e=>e.id===String(f.id).split(':')[0]);const def=e&&definitions(e).find(d=>d.id===f.id);if(!def)throw Error('현재 자료에서 지원하지 않는 요소입니다. 검토안을 다시 만들어 주세요.');if(!def.directions.includes(f.direction)||!validWeight(f.weight))throw Error('반영 방향·중요도를 확인해 주세요.');return {...def,direction:f.direction,weight:f.weight};});
 if(p.uploads!=null&&(!Array.isArray(p.uploads)||p.uploads.length>5))throw Error('첨부는 최대 5개입니다.');
 const uploadFactors=(p.uploads||[]).map((u,i)=>{joined.validate(u);const direction=u.hitl?.direction||'observe',weight=u.hitl?.weight??null;if(!['observe','lower','higher'].includes(direction)||!validWeight(weight))throw Error('첨부 요소의 반영 방향·중요도를 확인해 주세요.');return {id:'upload:'+i,label:u.headers[u.mapping.measure],source:u.name||'사용자 표',direction,weight,layer:'사용자 제공 관측',method:'연결 검증을 통과한 첨부값의 연도별 분포와 기존 지표 관계. 공식 검증 수치 아님'};});
 const allFactors=[...selected,...uploadFactors],weighted=allFactors.some(f=>f.weight!==null);if(weighted&&allFactors.some(f=>f.weight===null))throw Error('가중치를 사용하려면 첨부를 포함한 모든 선택 요소의 중요도를 지정해 주세요. 미설정 비교는 모두 미설정으로 두세요.');
 const total=allFactors.reduce((s,f)=>s+(f.weight||0),0),sections=[],sources=[],audit=[];if(weighted&&!total)throw Error('하나 이상의 변수 가중치를 1 이상으로 설정해 주세요.');
 for(const f of [...selected].sort((a,b)=>(b.weight||0)-(a.weight||0))){
  const e=data.catalog.find(e=>e.id===f.dataset),b=load(e);sources.push({id:'hitl#'+f.id,title:e.title,source:e.file,body:[f.method,...[b.data.scope,b.data.coverage,b.data.limitations].flat().filter(v=>typeof v==='string')].join('\n'),provenance:[{path:e.file,sha256:b.hash},...(b.extraSource?[b.extraSource]:[])]});
  const weight=weighted?round(f.weight/total*100):null;audit.push({...f,label:f.field||f.query?f.label:e.title,share_percent:weight,sha256:b.hash});
  if(!f.field){const result=data.run(`${ctx.level==='전체'?'':ctx.level} ${ctx.gu||''} ${ctx.year||''} ${f.query||ctx.question.replace(/20\d{2}/g,'')} 자료 보여줘`,{dataset_id:f.query?undefined:e.id,school_id:ctx.school_id});sections.push({title:e.title+' · '+f.label,...result.visual,notes:[...(result.visual.notes||[]),f.method]});continue;}
  let rows=data.rowsFor(e,b.data).filter(r=>(ctx.level==='전체'||!r.level||r.level===ctx.level)&&(!ctx.gu||r.gu===ctx.gu)&&(!f.selector||Object.entries(f.selector).every(([k,v])=>r[k]===v)));
  // Field-specific dates matter: enrollment and books in one row can have different publication years.
  const separateIds=new Set(model.read('data_processed/student_services/priorities.json').data.schools.filter(s=>s.separate_track).map(s=>s.id));
  rows=rows.map(r=>({...r,year:f.field.startsWith('books.')?r.books?.year:f.field==='students'&&e.id==='books'?r.student_year:r.year,hitl_island:separateIds.has(r.id)||/옹진|강화/.test(r.gu||'')?'도서·농어촌 별도 검토':'일반 검토'}));
  rows=rows.map(r=>({...r,year:r.year==null||!Number.isFinite(Number(r.year))?null:Number(r.year)}));
  if(ctx.year)rows=rows.filter(r=>r.year===ctx.year);
  const buckets=new Map();for(const r of rows){const key=[...groups.map(k=>r[k]??''),r.hitl_island].join(' · ');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
  if(!rows.length)sections.push({title:e.title+' · '+f.label,notes:['해당 범위의 자료가 없어 판단을 보류합니다.'],table:{headers:['확인 상태'],rows:[['미확보']]}});
  for(const [key,group] of buckets){const d=distribution(group,f.field,f.direction,ctx.school_id);sections.push({factor_id:f.id,comparison_year:group[0]?.year??null,comparison_track:group[0]?.hitl_island,title:e.title+' · '+f.label+' · '+key.split(' · ').filter(Boolean).join(' · '),chart:{...d.chart,measure:f.label},table:d.table,notes:[`유효 ${d.n}건 · 제외 ${d.excluded}건 · 중앙값 ${d.median??'계산 보류'}. ${group[0]?.year?group[0].year+'년 자료입니다.':'연도 없는 값은 보유 스냅샷이며 현재 시점 확인이 필요합니다.'}`,d.selected?`${d.selected.name}: ${d.selected.value}, 이 값 이하 ${d.selected.percentile}%, 이 값 이상 ${d.selected.top_percent}% (동점 포함).`:ctx.school_id?'선택 학교의 유효값을 확보하지 못해 해당 학교 판단을 보류합니다.':'백분위 분모는 이 표의 유효 관측 전체입니다. 전체 학교를 전수 확보했다는 뜻은 아닙니다.',f.direction==='lower'?'사용자 관점: 값이 작은 경우를 먼저 검토합니다. 부족 확정은 아닙니다.':f.direction==='higher'?'사용자 관점: 값이 큰 경우를 먼저 검토합니다. 지원 확정은 아닙니다.':'방향 미설정: 낮은 값·높은 값 양쪽 관점을 함께 확인합니다.','학교 투자 순위가 아닌 원값 분포입니다. 동점 포함 비율이므로 두 비율의 합이 100%를 넘을 수 있습니다.'],statistics:{n:d.n,excluded:d.excluded,median:d.median,selected:d.selected}});}
 }
 for(const [i,u] of (p.uploads||[]).entries()){
  const f=uploadFactors[i];audit.push({...f,share_percent:weighted?round(f.weight/total*100):null,sha256:crypto.createHash('sha256').update(JSON.stringify({headers:u.headers,rows:u.rows})).digest('hex')});
  const normalize=v=>String(v??'').trim().replace(/\s+/g,''),m=u.mapping;
  const scoped={...u,rows:u.rows.filter(r=>{const year=m.year==null?Number(m.defaultYear||2026):Number(String(r[m.year]).slice(0,4));if(ctx.year&&Number.isInteger(year)&&year!==ctx.year)return false;if(!ctx.gu)return true;const key=normalize(r[m.key]);if(m.type==='district')return key.replace(/^인천광역시|^인천시|^인천/,'')===ctx.gu;const matches=model.registry().filter(s=>m.type==='school_id'?s.id===key:normalize(s.name)===key||normalize(s.name.replace(/^인천/,''))===key);return matches.length!==1||matches[0].gu===ctx.gu;})};
  if(!scoped.rows.length){sections.push({title:f.label+' · 첨부 범위 확인',notes:['선택한 연도·지역에 해당하는 첨부 행이 없어 판단을 보류합니다.'],table:{headers:['원본 행','범위 제외'],rows:[[u.rows.length,u.rows.length]]}});continue;}
  const d=joined.run(ctx.question,{...ctx,scope:ctx.school_id?'school':'all',upload:scoped});d.visual.notes.push(`첨부 원본 ${u.rows.length}행 중 요청 연도·지역 범위 밖 ${u.rows.length-scoped.rows.length}행을 먼저 제외했습니다. 연결 상태의 원본 행 번호는 범위 필터 후 표 기준입니다.`);
  sections.push(...d.visual.sections,{title:u.name+' · 연결 확인',table:d.visual.table,notes:d.visual.notes});sources.push(...d.sources);
  const statusColumn=d.export_table.headers.indexOf('연결 상태');if(statusColumn<0)throw Error('첨부 연결 결과의 상태 열을 확인할 수 없습니다.');
  const rows=d.export_table.rows.filter(r=>r[statusColumn]==='연결'&&joined.numeric(r[3])!==null&&(!ctx.year||Number(r[2])===ctx.year));
  const separate=new Set(model.read('data_processed/student_services/priorities.json').data.schools.filter(s=>s.separate_track).map(s=>s.id)),buckets=new Map();
  for(const r of rows){const school=model.registry().find(s=>s.id===r[1]||s.name.replace(/\s+/g,'')===String(r[1]).replace(/\s+/g,''));const group=[r[2],school?.level||ctx.level,school?(separate.has(school.id)||/옹진|강화/.test(school.gu||'')?'도서·농어촌 별도 검토':'일반 검토'):'지역·연결단위 별도 검토'].join(' · ');if(!buckets.has(group))buckets.set(group,[]);buckets.get(group).push(r);}
  for(const [group,values] of buckets){const result=distribution(values.map(r=>({id:r[1],name:r[1],value:joined.numeric(r[3])})),'value',f.direction,null);sections.push({factor_id:f.id,comparison_year:group.split(' · ')[0],comparison_track:group.split(' · ').at(-1),statistics:{n:result.n,excluded:result.excluded,median:result.median,selected:result.selected},title:f.label+' · 사용자 자료 · '+group,table:result.table,chart:result.chart,notes:['기존 지표와 연결 검증을 통과한 첨부 행만 계산합니다. 첨부 범위의 분포이며 전체 학교 분포나 공공기관의 검증 결과가 아닙니다.','학교·지역 단위는 첨부 연결 정의를 따릅니다. 도서지역과 도시형 학교의 정책 비교·학교 순위는 산출하지 않습니다.']});}
 }
 if(p.notes!=null&&(typeof p.notes!=='string'||p.notes.length>5000))throw Error('추가 현장 메모는 5,000자 이내로 입력해 주세요.');
 if(p.notes)sections.push({title:'사용자가 추가한 현장 메모',table:{headers:['내용','반영 방법'],rows:[[p.notes,'확인할 조건으로 기록. 검증·수치·안전 통과로 자동 변환하지 않음']]}});
 const emphasis={headers:['고려 요소','반영 방향','중요도','검토 비중 %'],rows:audit.map(f=>[f.label,{observe:'양쪽 관점',lower:'낮은 값 검토',higher:'높은 값 검토'}[f.direction],f.weight??'미설정',f.share_percent??'미설정'])};
 sections.unshift({title:'질문에 답하기 전에 확인할 조건',table:{headers:['확인할 내용'],rows:purpose(ctx.question).checks.map(s=>[s])},notes:['이 자료를 확보하기 전에는 어느 학교에 지원할지 확정할 수 없습니다. 아래 관측과 사용자 자료를 현장 확인 계획에 활용하세요.']},...comparisonSections(sections,ctx));
 const synthesis=conclusion.build(audit,sections,ctx);
 return {conclusion:synthesis,answerable:true,mode:'hitl_analysis',school_id:ctx.school_id,summary:synthesis.headline+'\n'+synthesis.conclusion+'\n'+synthesis.checks,sources,review:{version:VERSION,context:ctx,factors:audit,decision:'deferred',gates:{eligibility:'unverified',safety:'unverified',execution:'unverified',route:'unverified'},notes:p.notes||'',upload_count:p.uploads?.length||0},visual:{title:'선택 요소에 따른 분석 근거',table:p.weight_scale===100?{headers:['변수','비중 %','확인된 관측','이 설정에서 할 일'],rows:synthesis.cards.map(c=>[c.label,c.share??'동일',c.observation,c.implication])}:emphasis,chart:weighted&&p.weight_scale!==100?{kind:'bar',unit:'%',points:audit.map(f=>({name:f.label,value:f.share_percent}))}:null,sections,notes:rules}};
}
module.exports={plan,factorOptions,run,distribution,definitions,context,VERSION};
