'use strict';
// Tool-using chat agent (OpenAI Responses API). One system prompt (cached prefix), compact tool results, short final JSON.
const table=require('./_school_table'),tools=require('./_agent_tools');
require('./ai-explainer-v2');// loads OPENAI_API_KEY from local .env for development
const MODEL=process.env.AI_AGENT_MODEL||process.env.AI_EXPLAINER_MODEL||'gpt-5.4-mini';
const MAX_STEPS=Number(process.env.AI_AGENT_MAX_STEPS||6),TIMEOUT=Number(process.env.AI_AGENT_TIMEOUT_MS||55000);
const FINAL_SCHEMA={type:'object',additionalProperties:false,required:['summary','highlights','caveats','followups','data_requests'],properties:{
 summary:{type:'string',description:'핵심 답변. 숫자와 학교명을 구체적으로. 3~8문장, 마크다운 없이 줄바꿈만.'},
 highlights:{type:'array',maxItems:5,items:{type:'string'},description:'표·차트에서 읽어낸 핵심 관찰 (한 줄씩)'},
 caveats:{type:'array',maxItems:3,items:{type:'string'},description:'해석 시 주의점(자료 시점·범위·측정 방법). 결과에 실제로 영향 있는 것만.'},
 followups:{type:'array',maxItems:3,items:{type:'string'},description:'사용자가 이어서 물어볼 만한 질문 (그대로 입력 가능한 문장)'},
 data_requests:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['title','why','fields'],properties:{title:{type:'string'},why:{type:'string'},fields:{type:'array',items:{type:'string'}}}},description:'더 정확히 답하려면 사용자가 첨부하면 좋을 내부 자료. 정말 필요할 때만.'}}};
function system(ctx){
 return `너는 인천 교육청 담당자를 돕는 학교 데이터 분석가다. 아래 학교 표(인천 917개 기관)를 도구로 조회해 근거 있는 답을 준다.
원칙:
- 반드시 도구로 실제 수치를 조회한 뒤 답한다. 수치를 지어내지 않는다. 도구 결과의 표·차트·지도는 자동으로 사용자에게 보이므로 답변에서 표를 반복하지 말고 핵심 수치·학교명·패턴을 해석한다.
- 질문이 단순하면 도구 1회로 끝낸다. 열 이름은 아래 사전의 id를 그대로 쓴다. "가장 다른/차이"는 불일치율(zone_walk_mismatch_pct), "가장 먼"은 거리, "부족"은 낮은 값 등 당연한 해석은 직접 정한다.
- 학교급을 명시하지 않으면 현재 범위(${ctx.level||'초등학교'})를 쓴다. 학교가 선택돼 있으면(${ctx.school_name||'없음'}) "이 학교" 질문은 그 학교다.
- 정책·우선순위·종합 판단 질문은 weighted_rank로 기본 가중치를 정해 먼저 계산하고, 가중치 조정 가능함을 알린다. 사용자가 이미 가중치·기준을 말했으면 그대로 쓴다.
- ask_user는 결과가 크게 갈릴 때만. 당연한 건 직접 판단.
- 값이 없는 학교(null)는 제외됐음을 짧게 언급. 도서·농어촌(강화·옹진)은 도시와 여건이 다르니 상위에 몰리면 언급.
- 판단 보류·거절보다 근거 있는 답을 준다. 한계는 caveats에 짧게(실제로 해석에 영향 있는 것만, 없으면 빈 배열).
- 사용자에게 보이는 문장에는 열 id 대신 한국어 이름을 쓴다(예: zone_walk_mismatch_pct → 학구도·도보권 불일치율).
- followups는 사용자가 다음에 입력할 문장 형태로("강화군 빼고 다시 보여줘"). "~할까요?"처럼 되묻지 않는다.
- data_requests는 이 표에 없는 자료(현장·내부 자료: 이용자 수, 대기자, 개방시간, 예산, 안전점검 등)만. 표에 있는 열은 절대 요청하지 않는다. 필요 없으면 빈 배열.
- 한국어, 담당자에게 보고하듯 간결하고 구체적으로.
학교 표 열 사전 (id=이름(단위) ※주의 [학교급별 값 있는 학교 수]):
${table.dictionary()}${ctx.extra?`\n[사용자 첨부] ${ctx.extra.column}=${ctx.extra.label}${ctx.extra.unit?'('+ctx.extra.unit+')':''} ※사용자 제공 값, 연결 ${ctx.extra.values.size}개교`:''}`;
}
async function call(body){
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});
 const text=await r.text();let json;try{json=JSON.parse(text);}catch{json={};}
 if(!r.ok){const msg=json.error?.message||text.slice(0,300);const e=Error('LLM 오류: '+msg);e.status=r.status;e.body=json;throw e;}
 return json;
}
function extractText(res){return (res.output||[]).filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');}
function toolCalls(res){return (res.output||[]).filter(o=>o.type==='function_call');}
function label(c){return table.COLUMNS[c]?.label||c;}
const strip=v=>typeof v==='string'?v.replace(/\*\*|__|^#+\s*/gm,''):v;
function plain(f){return {...f,summary:strip(f.summary),highlights:(f.highlights||[]).map(strip),caveats:(f.caveats||[]).map(strip),followups:(f.followups||[]).map(strip)};}
async function answer(ctx,question,history=[]){
 const started=Date.now(),calls=[],sections=[],sources=[],map=[],geometries=[];let needs_input=null;
 const input=[{role:'system',content:system(ctx)}];
 for(const h of history.slice(-3)){input.push({role:'user',content:String(h.q||'').slice(0,300)});input.push({role:'assistant',content:String(h.a||'').slice(0,400)});}
 const scopeLine=`[범위: ${ctx.level||'전체'}${ctx.school_name?` · 선택 학교: ${ctx.school_name} (id ${ctx.school_id})`:' · 학교 미선택'}]`;
 input.push({role:'user',content:scopeLine+'\n'+question});
 const base={model:MODEL,store:false,tools:tools.TOOLS.map(t=>({type:'function',...t})),tool_choice:'auto',parallel_tool_calls:true,max_output_tokens:1600,reasoning:{effort:process.env.AI_AGENT_REASONING||'low'},text:{format:{type:'json_schema',name:'answer',strict:true,schema:FINAL_SCHEMA}}};
 let final=null,usage={input:0,output:0,cached:0};
 for(let step=0;step<MAX_STEPS+1;step++){
  if(Date.now()-started>TIMEOUT)throw Error('분석 시간이 초과됐습니다. 질문을 나누어 주세요.');
  let res;try{res=await call({...base,input});}catch(e){if(e.status===400&&/reasoning/.test(String(e.message)))res=await call({...base,reasoning:{effort:'none'},input});else throw e;}
  usage.input+=res.usage?.input_tokens||0;usage.output+=res.usage?.output_tokens||0;usage.cached+=res.usage?.input_tokens_details?.cached_tokens||0;
  const fc=toolCalls(res);
  if(!fc.length||step===MAX_STEPS){const text=extractText(res);try{final=JSON.parse(text);}catch{final={summary:text||'답변을 생성하지 못했습니다.',highlights:[],caveats:[],followups:[],data_requests:[]};}final=plain(final);break;}
  for(const item of res.output)if(item.type==='function_call')input.push(item);
  for(const c of fc){let args={};try{args=JSON.parse(c.arguments||'{}');}catch{}let out;
   try{const r=tools.run(c.name,ctx,args);calls.push({name:c.name,args,ok:true});out=r.llm;
    if(r.visual){sections.push(r.visual);map.push(...(r.visual.map||[]));geometries.push(...(r.visual.geometries||[]));}
    for(const s of r.sources||[])if(!sources.some(x=>x.id===s.id))sources.push(s);
    if(r.needs_input)needs_input=r.needs_input;
   }catch(e){calls.push({name:c.name,args,ok:false,error:e.message});out={error:e.message};}
   input.push({type:'function_call_output',call_id:c.call_id,output:JSON.stringify(out).slice(0,6000)});
  }
  if(needs_input){final={summary:needs_input.prompt,highlights:[],caveats:[],followups:[],data_requests:[]};break;}
 }
 const seenGeom=new Set(),uniqGeom=geometries.filter(g=>{const k=g.properties.name;if(seenGeom.has(k))return false;seenGeom.add(k);return true;});
 const seenPt=new Set(),uniqPts=map.filter(p=>{const k=p.name+p.lat;if(seenPt.has(k))return false;seenPt.add(k);return true;});
 const weights=sections.map(s=>s.weights).filter(Boolean).at(-1),rankCall=calls.filter(c=>c.name==='weighted_rank'&&c.ok).at(-1);
 return {answerable:true,mode:needs_input?'needs_input':'agent',summary:final.summary,highlights:final.highlights||[],caveats:final.caveats||[],followups:final.followups||[],data_requests:(final.data_requests||[]).map(d=>({...d,fields:d.fields||[]})),
  needs_input:needs_input?{...needs_input,weights:(needs_input.weights||[]).map(w=>({...w,label:label(w.column)}))}:null,
  weights:weights?weights.map(w=>({...w,label:label(w.column)})):null,weights_scope:rankCall?{level:rankCall.args.level||ctx.level,gu:rankCall.args.gu||null,island:rankCall.args.island||null,limit:rankCall.args.limit||10}:null,
  visual:{title:sections[0]?.title||'답변 근거',map:uniqPts,geometries:uniqGeom,sections:sections.map(s=>({...s,map:undefined,geometries:undefined,weights:undefined})),notes:[]},
  sources,school_id:ctx.school_id||null,agent:{model:MODEL,calls,usage,ms:Date.now()-started}};
}
// Deterministic re-run when the user moves weight sliders: compute, then one short LLM interpretation.
async function reweight(ctx,question,criteria,scopeArgs={}){
 const r=tools.run('weighted_rank',ctx,{...scopeArgs,criteria,limit:scopeArgs.limit||10});
 let text={summary:'',highlights:[],caveats:[],followups:[],data_requests:[]};
 if(process.env.OPENAI_API_KEY&&process.env.AI_EXPLAINER_ENABLED!=='false'){
  try{const res=await call({model:MODEL,store:false,max_output_tokens:900,reasoning:{effort:'none'},input:[{role:'system',content:'담당자에게 보고하듯 한국어로 간결하게(summary 3~4문장, highlights 최대 3개, caveats 최대 1개, followups 최대 2개, data_requests 빈 배열). 가중치 결과를 해석한다: 상위 학교와 왜 상위인지(어느 기준 기여가 큰지), 가중치를 바꾸면 달라질 점. 열 id 대신 한국어 이름, 마크다운 금지. 표는 자동 표시되므로 반복하지 않는다.'},{role:'user',content:JSON.stringify({question,result:r.llm})}],text:{format:{type:'json_schema',name:'answer',strict:true,schema:FINAL_SCHEMA}}});text=plain(JSON.parse(extractText(res)));}catch(e){console.error('[agent] reweight summary failed:',e.message);}
 }
 if(!text.summary)text.summary=`가중치 ${r.llm.weights.map(w=>`${label(w.column)} ${w.share_pct}%`).join(', ')} 기준 상위: ${r.llm.top.slice(0,5).map(t=>`${t.name}(${t.score}점)`).join(', ')}.`;
 return {answerable:true,mode:'agent',...text,weights:r.llm.weights.map(w=>({...w,label:label(w.column)})),weights_scope:{level:scopeArgs.level||ctx.level,gu:scopeArgs.gu||null,island:scopeArgs.island||null,limit:scopeArgs.limit||10},visual:{title:r.visual.title,map:r.visual.map,geometries:[],sections:[{...r.visual,map:undefined,weights:undefined}],notes:[]},sources:r.sources,school_id:ctx.school_id||null,agent:{model:MODEL,calls:[{name:'weighted_rank',args:{criteria},ok:true}]}};
}
module.exports={answer,reweight,system,MODEL};
