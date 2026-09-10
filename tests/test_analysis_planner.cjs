const assert=require('node:assert/strict');
const api=require('../api/analysis.js');
const originalFetch=global.fetch,originalKey=process.env.OPENAI_API_KEY,originalEnabled=process.env.AI_ANALYSIS_ENABLED;
process.env.OPENAI_API_KEY='test-placeholder-not-a-key';process.env.AI_ANALYSIS_ENABLED='true';
let requested;
global.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');requested=JSON.parse(options.body);return {ok:true,json:async()=>({output_text:JSON.stringify({method:'relationship',x:'parks',y:'students',controls:[],adjust_gu:false,reason:'관측 관계'})})};};
(async()=>{
 const result=await api.run({question:'공원 수와 학생 수는 함께 움직이나요?',options:{level:'중학교',gu:'전체',year:2026},schools:[{students:999999999}]});
 assert.equal(result.record.planner,'AI 질문 해석 · 서버 검증 계산');assert(result.metrics.n>100);
 assert(!result.chart.points.some(p=>p.y===999999999));
 assert.equal(requested.store,false);assert.equal(requested.text.format.strict,true);
 assert(!JSON.stringify(requested).includes('999999999'),'Client rows never go to the planner');
 global.fetch=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({method:'relationship',x:'invented',y:'students',controls:[],adjust_gu:false,reason:'wrong'})})});
 await assert.rejects(()=>api.run({question:'공원과 학생 관계',options:{level:'중학교',year:2026}}));
 global.fetch=async()=>{throw Error('offline');};
 const fallback=await api.run({question:'학원 수와 학생 수 관계',options:{level:'중학교',year:2026}});
 assert(fallback.record.planner.includes('AI 응답 미확보'));
 console.log('AI planner: strict schema, server-only facts, unsupported generated fields and network fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;if(originalEnabled===undefined)delete process.env.AI_ANALYSIS_ENABLED;else process.env.AI_ANALYSIS_ENABLED=originalEnabled;});
