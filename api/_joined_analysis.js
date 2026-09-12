const data=require('./_data_answers'),model=require('./_school_summary'),crypto=require('node:crypto');
const numeric=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string')return null;const t=v.trim();if(t.includes(',')&&!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?$/.test(t))return null;const clean=t.replaceAll(',','');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?%?$/.test(clean))return null;const n=Number(clean.replace(/%$/,''));return Number.isFinite(n)?n:null;};
const mean=a=>a.length?a.reduce((s,v)=>s+v/a.length,0):null;
const round=v=>v==null?null:Number(v.toFixed(4));
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;};
const normalize=v=>String(v??'').trim().replace(/\s+/g,'');
function options(){
 const ids=['schools','books','library_access','shared_parks','clusters','routes','route_review','resilience','residential','progression'];
 const result=ids.flatMap(id=>{const e=data.catalog.find(e=>e.id===id);return e.fields.filter(f=>!/(name$|^id$|year|level|gu|status|source|method|park_name|basis|date|verified)/.test(f)&&!['books.year'].includes(f)).map(field=>({id:id+':'+field,label:e.title+' · '+data.fieldLabel(field),dataset:id,field}));});
 return [{id:'school:level',label:'학교급',category:'level'},{id:'school:gu',label:'군·구',category:'gu'},...result,{id:'forecast:value',label:'학교 학생 수 예측 · 연도별 모형값',dataset:'forecast',field:'value',group:'예측'}];
}
function base(option){const e=data.catalog.find(e=>e.id===option.dataset);const bundle=data.read(e);return {rows:data.rowsFor(e,bundle.data),source:{id:'join#'+e.id,title:e.title,source:e.file,provenance:[{path:e.file,sha256:bundle.hash}]}};}
function validate(upload){
 if(!upload||!Array.isArray(upload.headers)||!Array.isArray(upload.rows))throw Error('첨부 표의 형식을 확인해 주세요.');
 if(upload.headers.length<2||upload.headers.length>40||upload.rows.length<1||upload.rows.length>3000||Buffer.byteLength(JSON.stringify(upload))>850000)throw Error('첨부 표는 3,000행·40열·전송 데이터 850KB 이내로 줄여 주세요.');
 if(upload.headers.some(h=>typeof h!=='string'||!h.trim()||h.length>100)||new Set(upload.headers).size!==upload.headers.length)throw Error('첫 행에는 중복되지 않는 열 이름을 넣어 주세요.');
 if(upload.rows.some(r=>!Array.isArray(r)||r.length!==upload.headers.length||r.some(v=>v!==null&&!(typeof v==='string'&&v.length<=1000)&&!(typeof v==='number'&&Number.isFinite(v))&&typeof v!=='boolean')))throw Error('표의 열 수 또는 셀 값을 확인해 주세요.');
 const m=upload.mapping||{};for(const key of ['key','measure'])if(!Number.isInteger(m[key])||m[key]<0||m[key]>=upload.headers.length)throw Error('연결 열과 분석할 열을 선택해 주세요.');
 if(m.key===m.measure)throw Error('연결 열과 분석 열은 서로 달라야 합니다.');
 if(m.year!=null&&(!Number.isInteger(m.year)||m.year<0||m.year>=upload.headers.length))throw Error('연도 열을 확인해 주세요.');
 if(!['school_id','school_name','district'].includes(m.type))throw Error('학교 ID·학교명·군구 중 연결 기준을 골라 주세요.');
 return m;
}
function ranks(v){const a=v.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),r=[];for(let i=0;i<a.length;){let j=i+1;while(j<a.length&&a[j].v===a[i].v)j++;for(let k=i;k<j;k++)r[a[k].i]=(i+j-1)/2+1;i=j;}return r;}
function pearson(x,y){if(x.every(v=>v===x[0])||y.every(v=>v===y[0]))return null;const sx=Math.max(...x.map(Math.abs))||1,sy=Math.max(...y.map(Math.abs))||1;x=x.map(v=>v/sx);y=y.map(v=>v/sy);const a=mean(x),b=mean(y),xx=x.map(v=>v-a),yy=y.map(v=>v-b),den=Math.sqrt(xx.reduce((s,v)=>s+v*v,0)*yy.reduce((s,v)=>s+v*v,0));return den?Math.max(-1,Math.min(1,xx.reduce((s,v,i)=>s+v*yy[i],0)/den)):null;}
function run(q,p){
 const u=p.upload,m=validate(u),opt=options().find(o=>o.id===m.existing);if(!opt)throw Error('연결할 기존 지표를 선택해 주세요.');
 const registry=model.registry(),byId=new Map(registry.map(s=>[s.id,s])),districts=new Set(registry.map(s=>s.gu));
 const named=new Map();for(const s of registry)for(const name of new Set([s.name,s.name.replace(/^인천/,'' )])){if(name===s.level)continue;const key=normalize(name);named.set(key,[...(named.get(key)||[]),s]);}
 const level=['유치원','초등학교','중학교','고등학교'].find(l=>q.includes(l))||p.level||'초등학교';
 if(m.type==='district'&&level==='전체')throw Error('군·구 단위로 연결할 때는 학교급을 하나 선택해 주세요.');
 const yearDefault=Number(m.defaultYear||2026);if(!Number.isInteger(yearDefault)||yearDefault<2000||yearDefault>2100)throw Error('기준연도를 확인해 주세요.');
 const b=opt.category?null:base(opt),sourceRows=b?.rows||[];
 const values=new Map();for(const r of sourceRows){if(!byId.has(r.id)||opt.group&&r.group!==opt.group)continue;const y=r.year??(opt.dataset==='books'&&opt.field==='students'?r.student_year:r.books?.year),key=r.id+'|'+(y??'snapshot');const v=numeric(data.get(r,opt.field));if(values.has(key))values.set(key,null);else values.set(key,v);}
 const audit=u.rows.map((r,i)=>{const key=m.type==='district'?normalize(r[m.key]).replace(/^인천광역시|^인천시|^인천/,''):normalize(r[m.key]),y=m.year==null?yearDefault:(/^\d{4}(?:년|[-/.]\d{1,2}[-/.]\d{1,2})$/.test(String(r[m.year]))?Number(String(r[m.year]).slice(0,4)):numeric(r[m.year])),schools=m.type==='school_id'?(byId.has(key)?[byId.get(key)]:[]):m.type==='school_name'?(named.get(key)||[]):[];let status='연결';let target;
  if(!Number.isInteger(y)||y<2000||y>2100)status='연도 오류';else if(m.type==='district'){if(!districts.has(key))status='군·구 미연결';else target=key;}else if(schools.length!==1)status=schools.length?'학교명 중복':'학교 미연결';else if(level!=='전체'&&schools[0].level!==level)status='학교급 범위 제외';else if(p.scope!=='all'&&p.school_id&&schools[0].id!==p.school_id)status='선택 학교 범위 제외';else target=schools[0].id;
  return {row:i+2,key,target,year:y,status,x:r[m.measure],school:schools[0]};});
 const counts=new Map();for(const r of audit.filter(r=>r.status==='연결')){const k=r.target+'|'+r.year;counts.set(k,(counts.get(k)||0)+1);}for(const r of audit)if(r.status==='연결'&&counts.get(r.target+'|'+r.year)>1)r.status='동일 대상·연도 중복';
 const getValue=(s,y)=>opt.category?s[opt.category]:values.get(s.id+'|'+y)??(values.has(s.id+'|'+y)?null:values.get(s.id+'|snapshot'));
 for(const r of audit.filter(r=>r.status==='연결')){if(m.type==='district'){if(opt.category)r.y=opt.category==='gu'?r.target:level;else{const a=registry.filter(s=>s.gu===r.target&&s.level===level).map(s=>getValue(s,r.year)).filter(v=>v!=null);r.y=mean(a);r.baseN=a.length;}r.level=level;}else{r.y=getValue(r.school,r.year);r.level=r.school.level;}if(r.y==null)r.status='기존 지표 결측';else if(r.x===null||typeof r.x==='string'&&!r.x.trim())r.status='업로드 값 결측';else if(m.valueType==='numeric'&&numeric(r.x)==null)r.status='업로드 숫자 형식 오류';}
 const valid=audit.filter(r=>r.status==='연결'),sections=[],statistics=[];
 const sourceTitle=String(u.name||'사용자 첨부').slice(0,150),hash=crypto.createHash('sha256').update(JSON.stringify({headers:u.headers,rows:u.rows})).digest('hex');
 const keys=[...new Set(valid.map(r=>r.level+'|'+r.year))];
 for(const key of keys){const rows=valid.filter(r=>r.level+'|'+r.year===key),xNumeric=m.valueType!=='category'&&rows.every(r=>numeric(r.x)!=null),yNumeric=!opt.category;
  if(xNumeric&&yNumeric){const x=rows.map(r=>numeric(r.x)),y=rows.map(r=>r.y),n=rows.length,r=n>=3?pearson(x,y):null,rho=n>=3?pearson(ranks(x),ranks(y)):null;statistics.push({group:key,n,pearson:round(r),spearman:round(rho)});sections.push({title:key.replace('|',' · ')+' 관계 분석',chart:{kind:'scatter',x:[u.headers[m.measure]],y:[opt.label],points:rows.map((r,i)=>({name:r.school?.name||r.target,x:x[i],y:y[i]}))},table:{headers:['유효 쌍','Pearson r','Spearman ρ'],rows:[[n,round(r)??'계산 보류',round(rho)??'계산 보류']]},notes:['최소 3쌍이 필요하며 한 변수의 값이 일정하면 상관계수를 계산하지 않습니다. 관측의 연관성으로 인과효과·지원 우선순위를 판단하지 않습니다.']});
  }else{const grouped=new Map();for(const r of rows){const category=String(xNumeric?r.y:r.x);const k=xNumeric||yNumeric?category:category+' · '+r.y;grouped.set(k,[...(grouped.get(k)||[]),xNumeric?numeric(r.x):yNumeric?r.y:1]);}const points=[...grouped].map(([name,v])=>({name,value:round(xNumeric||yNumeric?mean(v):v.length),n:v.length}));sections.push({title:key.replace('|',' · ')+' 그룹별 비교',chart:{kind:'bar',unit:xNumeric||yNumeric?'':'건',points:points.slice(0,40)},table:{headers:['그룹',xNumeric||yNumeric?'평균':'연결 건수','유효 건수'],rows:points.map(p=>[p.name,p.value,p.n])},notes:['범주형 열은 그룹별 평균 또는 교차 빈도로 비교합니다. 도표는 앞 40개 그룹, 표는 전체 그룹입니다.']});}
 }
 const table={headers:['원본 행','연결 값','연도','업로드 값','기존 값','연결 상태'],rows:audit.map(r=>[r.row,r.key,r.year??'미확인',r.x,r.y==null?'미확보':round(numeric(r.y))??r.y,r.status])};
 const notes=['학교명·군구는 현재 기준 원장으로 연결합니다. 과거 통폐합·행정경계 변경을 복원한 분석이 아닙니다.',...(opt.dataset==='forecast'?['기존 값은 모형 예측이며 실제 재학생 수나 확정 수요가 아닙니다.']:[]),`연결 기준: ${u.headers[m.key]} → ${m.type==='district'?'군·구':m.type==='school_id'?'학교 ID':'학교명'}, ${m.year==null?'지정 기준연도 '+yearDefault:u.headers[m.year]+' 연도 열'}. 학교급·연도별로 분리 계산합니다.`,`사용자 제공 수치는 공공기관이 확인한 자료가 아닙니다. 원본 공공데이터를 변경하지 않고 이번 요청에서만 계산합니다. 수식은 실행하지 않으며 저장된 값만 사용합니다.`,`원본 ${audit.length}행, 연결 가능 ${valid.length}행, 제외 ${audit.length-valid.length}행. 같은 대상·연도 중복은 모두 제외하며 임의 평균·중복 복제를 하지 않습니다.`,...(m.type==='district'?['군·구 연결의 기존 숫자는 선택 학교급의 해당 지표를 확보한 학교들의 평균입니다. 지역 총합이나 인구가 아닙니다.']:[]),...(sourceRows.some(r=>r.year==null&&r.books?.year==null)?['연도가 없는 기존 환경 지표는 현재 보유 스냅샷입니다. 업로드 연도와 같은 시점이라고 단정하지 않습니다.']:[])];
 return {answerable:true,mode:'upload_analysis',school_id:null,summary:`${sourceTitle} / ${u.headers[m.measure]} × ${opt.label}: ${audit.length}행 중 ${valid.length}행을 기존 자료와 연결했습니다. ${audit.length-valid.length}행은 연결 상태 표에서 제외 이유를 확인할 수 있습니다.\n${statistics.map(s=>`${s.group.replace('|',' · ')}: ${s.n}쌍, Pearson ${s.pearson??'보류'}, Spearman ${s.spearman??'보류'}.`).join('\n')}\n${valid.length?'관측의 관계를 탐색한 결과이며 인과관계나 지원 순위가 아닙니다.':'연결 열·학교급·연도와 중복 행을 확인해 주세요.'}`,statistics,join:{total:audit.length,matched:valid.length,excluded:audit.length-valid.length,mapping:m},sources:[{id:'user-upload',title:sourceTitle,source:'사용자 제공 첨부 표',body:'공식 검증 자료와 구분. 정규화 표 SHA-256 '+hash},...(b?[b.source]:[{id:'registry',title:'학교 기준 원장',source:'data_processed/education/analysis_dataset.json'}])],visual:{title:'업로드 자료 × 기존 자료',sections,table:{...table,rows:table.rows.slice(0,300)},notes:[...notes,...(table.rows.length>300?['화면 표는 앞 300행이며 전체 연결 상태는 CSV로 저장할 수 있습니다.']:[])]},export_table:table};
}
module.exports={run,options,validate,numeric,pearson,ranks};
