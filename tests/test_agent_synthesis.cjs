const assert=require('node:assert/strict');
const agent=require('../api/_agent'),tools=require('../api/_agent_tools');
const fetchBefore=global.fetch,runBefore=tools.run;
const section=(title,rows)=>({title,table:{headers:['학교','관측값'],rows}});
(async()=>{
 let request,sections;
 tools.run=()=>({llm:{},sections,sources:[]});
 global.fetch=async(_,opts)=>{
  request=JSON.parse(opts.body);
  if(request.input.some(i=>i.type==='function_call_output'))throw Error('summary connection failed');
  return {ok:true,text:async()=>JSON.stringify({output:[{type:'function_call',call_id:'q',name:'query_schools',arguments:'{}'}]})};
 };
 sections=[section('장서',[['가초',12],['나초',null]]),section('주변 접근',[['가초',900],['다초',1200]])];
 let r=await agent.answer({level:'초등학교',variables_confirmed:true},'도서관 지원 대상 검토');
 assert.match(r.summary,/함께 나타난 학교는 가초/);assert(!r.summary.includes('나초'),'does not claim two independent lists intersect');
 assert(!r.summary.includes('900'),'raw variable values stay in details');assert(r.highlights.some(s=>s.includes('900')));
 assert(r.highlights.some(s=>s.includes('미확인')));assert.match(r.summary,/미확인 값은 부족으로 판단하지/);
 assert.match(r.summary,/이용대상·안전·실행·출입구 경로를 별도로 확인/);
 assert(!JSON.stringify(r).includes('"score"'));assert.equal(r.weights,null);assert.equal(r.needs_input,null);
 const contract=request.text.format.schema.properties.summary.description;
 assert.match(contract,/여러 관측을 함께 해석/);assert.match(contract,/복수 검토안이나 판단 보류/);
 sections=[section('장서',[['가초',12]]),section('주변 접근',[['나초',900]])];
 r=await agent.answer({level:'초등학교',variables_confirmed:true},'도서관 지원 대상 검토');
 assert.match(r.summary,/모두 공통으로 나타난 학교는 없습니다/);assert.match(r.summary,/기준별 검토안을 함께/);
 console.log('PASS synthesis: evidence-based overlap, distinct options, missing observations and non-compensatory safety');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{global.fetch=fetchBefore;tools.run=runBefore;});
