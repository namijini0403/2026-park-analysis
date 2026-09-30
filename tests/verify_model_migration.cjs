'use strict';
// Explicit live test (paid API calls). Local handlers by default; MODEL_TEST_BASE tests a deployment.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.MODEL_TEST_BASE;
const report={at:new Date().toISOString(),base:base||'local handlers',cases:[],calls:[]};
const nativeFetch=global.fetch;
if(!base){
 require('../api/_env');
 global.fetch=async(url,opts)=>{
  const response=await nativeFetch(url,opts);
  if(String(url)==='https://api.openai.com/v1/responses'){
   const body=JSON.parse(opts.body),result=await response.clone().json();
   report.calls.push({requested:body.model,actual:result.model,http:response.status,status:result.status,error:result.error?.code});
  }
  return response;
 };
}
async function run(name,endpoint,payload,check){
 const start=Date.now();let result;
 if(base){const response=await nativeFetch(new URL(endpoint,base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(70000)});assert.equal(response.status,200,name+' HTTP');result=await response.json();}
 else result=await require('..'+endpoint+'.js').run(payload);
 check(result);
 const record={name,ms:Date.now()-start,result};report.cases.push(record);
 console.log(JSON.stringify({name,ms:record.ms,model:result.agent?.model,router:result.agent?.router_model,summary:result.summary?.slice(0,220),passed:true}));
 return result;
}
function answer(result){
 assert.equal(result.answerable,true);assert.equal(result.agent.model,'gpt-5.6-sol');
 assert(result.summary.length>30);assert(result.agent.usage.output>0);
 assert(!/AI 설명 연결이 완료되지|조회 데이터로 직접 요약/.test(JSON.stringify(result.caveats)+result.summary),'must not silently pass fallback');
 assert(result.visual.sections.some(s=>s.table?.rows.length));
 assert(result.agent.calls.every(c=>c.ok),'tool calls succeed');
}
(async()=>{
 await run('variable plan','/api/chat',{action:'plan_variables',scope:'all',level:'초등학교',question:'초등학교 학생 수와 공원 접근 여건을 비교하고 싶어요.'},r=>{assert.equal(r.mode,'variable_plan');assert(r.variables.length);assert(!r.variables.some(v=>v.column==='paps'));});
 await run('tool query and synthesis','/api/chat',{scope:'all',level:'초등학교',question:'학생 수가 많은 초등학교 5곳의 학생 수와 공원 수 관측값을 보여줘. 투자 순위가 아니라 관측값만 비교해줘.',selected_variables:['students','parks_walk'],variables_confirmed:true},r=>{answer(r);assert.equal(r.agent.router_model,'gpt-5.6-luna');assert.equal(r.weights,null);});
 await run('preference recalculation','/api/chat',{action:'reweight',scope:'all',level:'초등학교',question:'공원 수와 학생 수 관측값을 관심 비중에 따라 살펴보고 싶어.',criteria:[{column:'parks_walk',weight:70,prefer:'low'},{column:'students',weight:30,prefer:'high'}],limit:5},r=>{answer(r);assert.equal(r.weights[0].share_pct,70);assert.equal(r.weights[1].share_pct,30);assert.equal(r.visual.sections.length,2);});
 await run('analysis planner','/api/analysis',{question:'초등학교 학생 수와 공원 수의 관계를 분석해줘.',options:{level:'초등학교'}},r=>{assert.equal(r.status,'ok');assert.equal(r.record.planner,'AI 질문 해석 · 서버 검증 계산');});
 if(!base){assert(report.calls.some(c=>c.actual==='gpt-5.6-luna'));assert(report.calls.some(c=>c.actual==='gpt-5.6-sol'));assert(report.calls.every(c=>c.http===200&&c.status==='completed'&&c.requested===c.actual));}
 report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.message;console.error(e.message);process.exitCode=1;}).finally(()=>{
 global.fetch=nativeFetch;const out=path.join(__dirname,'../outputs/model-migration-20260930');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,(base?new URL(base).hostname:'local')+'.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,calls:report.calls}));
});
