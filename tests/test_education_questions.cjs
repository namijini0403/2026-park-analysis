const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
process.env.AI_ANALYSIS_ENABLED='false';
const api=require('../api/analysis.js');
const dom=new JSDOM('<section id="questions"></section>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
let calls=[];
w.fetch=async(url,options)=>{assert.equal(url,'./api/analysis');const body=JSON.parse(options.body);calls.push(body);try{const result=await api.run(body);return {ok:true,json:async()=>result};}catch(error){return {ok:false,json:async()=>({status:'error',summary:error.message})};}};
w.eval(fs.readFileSync('assets/education-questions.js','utf8'));
const root=w.document.querySelector('#questions');w.EducationQuestions.mount(root,'중학교','전체');
const el=k=>root.querySelector(`[data-question="${k}"]`);
async function submit(question){el('input').value=question;el('form').dispatchEvent(new w.Event('submit',{cancelable:true}));for(let i=0;i<100&&el('submit').disabled;i++)await new Promise(r=>setTimeout(r,10));assert.equal(el('submit').disabled,false);}
(async()=>{
 await submit('학원 수와 학생 수는 관련 있어?');
 assert(root.querySelector('svg'));assert(el('result').textContent.includes('순위상관'));
 assert(root.querySelector('[data-plan="y"]'));
 root.querySelector('[data-plan="x"]').value='parks';el('rerun').click();
 for(let i=0;i<100&&el('submit').disabled;i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(calls.at(-1).plan.x,'parks');assert(w.localStorage.getItem('education-analysis-history'));
 await submit('유치원 학생수와 교사수 관련 있어?');assert(el('result').textContent.includes('일반 교사'));
 await submit('도서관 추천 후보를 보여줘');assert(root.querySelector('svg'));assert(el('result').textContent.includes('7304'));
 assert.equal(root.querySelector('[data-plan="radius_m"]').value,'1000');
 await submit('학원가 밀집 구역을 보여줘');assert(root.querySelector('svg path[fill-rule="evenodd"]'));
 await submit('수능과 학생수 관계');assert(el('result').textContent.includes('확보하지 못했습니다'));
 assert(!/NaN|undefined/.test(root.textContent));
 console.log('Question UI: real API data, charts, editable plan, scope sync, history, library, academy polygons and unsupported data passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());
