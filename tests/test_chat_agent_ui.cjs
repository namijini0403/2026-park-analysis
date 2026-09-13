// jsdom smoke test for assets/chat-agent.js: submit → render answer, highlights, followups, weight sliders → reweight request.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),model=require('../api/_school_summary');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;const calls=[];
w.EducationMaps={ready:async()=>{throw Error('no map in test');}};
const answer={answerable:true,mode:'agent',summary:'부평구 초등학교 42곳 중 1위는 인천부개서초등학교입니다.',highlights:['인천부개서초 87점'],caveats:['공원 수는 대표점 기준'],followups:['학생 수 가중치를 50%로 올려줘'],data_requests:[{title:'공원 개방시간',why:'실제 이용 가능 여부',fields:['개방시간']}],weights:[{column:'parks_walk',prefer:'low',weight:0.7,share_pct:70,label:'도보 500m 공원 수'},{column:'students',prefer:'high',weight:0.3,share_pct:30,label:'재학생 수'}],weights_scope:{level:'초등학교',gu:'부평구',island:null,limit:10},visual:{title:'가중 우선순위',map:[],geometries:[],sections:[{title:'가중 우선순위 · 초등학교 · 부평구',chart:{kind:'bar',unit:'점',points:[{name:'A',value:87},{name:'B',value:80}]},table:{headers:['순위','학교'],rows:[[1,'A'],[2,'B']]},notes:['n']}],notes:[]},sources:[{id:'table#dataset',title:'학교알리미',source:'data_processed/education/analysis_dataset.json',body:'재학생 수'}],agent:{model:'test',calls:[{name:'weighted_rank'}],usage:{input:100,output:50,cached:0},ms:1200}};
w.fetch=async(url,opts)=>{calls.push({url,body:opts?.body?JSON.parse(opts.body):null});if(url==='/api/chat')return {ok:true,json:async()=>answer};const u=new URL(url,'http://localhost');return {ok:true,json:async()=>u.searchParams.get('id')?model.summary(u.searchParams.get('id')):{schools:model.list()}};};
const tick=(ms=30)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(const f of ['assets/chat-workspace.js','assets/source-evidence.js','assets/collection-assistant.js','assets/simple-app.js','assets/chat-agent.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
 await tick();assert(w.ChatAgent,'ChatAgent loaded');
 d.getElementById('chat-scope').value='all';d.getElementById('question').value='공원이 부족하고 학생이 많은 학교 우선순위';d.getElementById('chat-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick(60);
 const chat=calls.filter(c=>c.url==='/api/chat');assert.equal(chat.length,1);assert.equal(chat[0].body.scope,'all');assert.deepEqual(chat[0].body.history,[]);
 const msg=d.querySelector('.agent-message');assert(msg);assert.match(msg.querySelector('.agent-summary').textContent,/인천부개서초등학교/);assert.equal(msg.querySelectorAll('.agent-highlights li').length,1);
 assert.equal(msg.querySelectorAll('.agent-followups button').length,1);assert.equal(msg.querySelectorAll('.agent-weights input[type=range]').length,2);assert.match(msg.querySelector('.hitl-share-strip').textContent,/70%/);assert(msg.querySelector('.agent-data'));assert(msg.querySelector('.source-evidence'));
 assert.match(d.getElementById('evidence-panel').textContent,/가중 우선순위 · 초등학교 · 부평구/);
 const slider=msg.querySelector('.agent-weights input[type=range]');slider.value='30';slider.dispatchEvent(new w.Event('input'));assert.match(msg.querySelector('.hitl-share-strip').textContent,/50%/);
 msg.querySelector('.agent-weights .hitl-run').click();await tick(60);
 const re=calls.filter(c=>c.url==='/api/chat').at(-1).body;assert.equal(re.action,'reweight');assert.equal(re.criteria[0].weight,30);assert.equal(re.rank_gu,'부평구');
 assert.equal(w.ChatAgent.history.length,1);
 msg.querySelector('.agent-followups button').click();await tick(60);assert.equal(calls.filter(c=>c.url==='/api/chat').length,3);assert.equal(calls.at(-1).body.history.length,1);
 console.log('PASS chat agent UI: submit payload, answer/highlights/followups/data requests render, weight sliders → reweight request, history carried');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
