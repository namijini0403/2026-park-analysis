process.env.AI_EXPLAINER_ENABLED='false';process.env.AI_ANALYSIS_ENABLED='false';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),chat=require('../api/chat'),model=require('../api/_school_summary');
(async()=>{
 const roster=await chat.run({question:'2026 연구학교, 선도학교 목록 보여줘',level:'초등학교'});
 assert.equal(roster.mode,'roster');assert.equal(roster.visual.records.length,116);assert.equal(roster.visual.map.length,103);
 assert.equal(new Set(roster.visual.records.map(r=>r.name)).size,108);assert(roster.visual.records.every(r=>r.year===2026));assert(roster.sources.some(s=>s.url?.startsWith('https://www.ice.go.kr/')));
 const empty=await chat.run({question:'2035 연구학교 목록'});assert.equal(empty.visual.records.length,0);assert(empty.visual.notes.join(' ').includes('수집 원장'));
 const elementary=await chat.run({question:'2026 초등학교 연구학교 목록'});assert(elementary.visual.records.every(r=>r.level==='초등학교'&&r.type.includes('연구학교')));
 const results=[];for(const question of ['학생 수와 공원 수의 상관관계','학생 수 추세','학생 수 불평등','중구와 남동구 학생 수 차이','학생 수 공간 군집']){const a=await chat.run({question,level:'초등학교'});assert.equal(a.mode,'calculation');assert(a.visual.chart);assert(a.visual.table.rows.length);assert(a.visual.notes.length);results.push(a);}
 assert.deepEqual(results.map(d=>d.visual.chart.kind),['scatter','line','lorenz','box','map']);
 const spread=await chat.run({question:'학생 수 분포',level:'초등학교'});assert.equal(spread.mode,'relative');assert(spread.visual.sections.some(s=>/군·구별 평균/.test(s.title)));
 const forecast=await chat.run({question:'이 학교 미래 학생 수 전망',school_id:'B000002949'});assert(forecast.visual.chart.points.some(p=>p.name==='예측'));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 // jsdom has no SVG geometry API. Enable Leaflet's SVG renderer for DOM integration checks.
 w.SVGSVGElement.prototype.createSVGRect=()=>({});
 require('./map_test_double.cjs')(w);
 w.eval(fs.readFileSync(path.join(root,'assets/chat-workspace.js'),'utf8'));
 const exports=[];w.AnswerExport={save:async(...args)=>exports.push(args)};
 w.fetch=async(url,opts)=>({ok:true,json:async()=>url==='/api/chat'?chat.run(JSON.parse(opts.body)):{schools:model.list()}});
 w.eval(fs.readFileSync(path.join(root,'assets/simple-app.js'),'utf8'));
 const tick=()=>new Promise(r=>setTimeout(r,60));await tick();
 async function ask(q){d.getElementById('question').value=q;d.getElementById('chat-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();}
 await ask('2026 연구학교, 선도학교 목록 보여줘');
 assert.equal(d.querySelectorAll('#evidence-panel tbody tr').length,116);
 assert.equal(d.querySelectorAll('#answer-map [data-test-map-kind="dot"]').length,103);
 assert(d.querySelector('.panel-sources a[href^="https://www.ice.go.kr/"]'));
 assert.equal(d.querySelectorAll('#messages table').length,0);
 d.querySelector('.export-actions button').click();await tick();assert.equal(exports[0][0],'docx');assert.equal(exports[0][1].visual.records.length,116);assert.equal(d.querySelectorAll('.export-actions button').length,3);
 await ask('학생 수와 공원 수의 상관관계');assert(d.querySelector('#evidence-panel svg[aria-label="관측값 산점도"]'));assert.equal(d.querySelectorAll('#answer-map').length,0);
 assert.equal(d.querySelectorAll('#evidence-panel circle').length,results[0].calculation.metrics.n);
 d.querySelector('.message .text-button').click();await tick();assert.equal(d.querySelectorAll('#answer-map [data-test-map-kind="dot"]').length,103);
 for(const result of [...results,forecast]){w.ChatWorkspace.show(result,'검증 질문');await tick();assert(d.querySelector('#evidence-panel table'));assert(d.querySelector(result.visual.chart.kind==='map'?'#answer-map [data-test-map-kind="dot"]':'#evidence-panel svg'));}
 const composite=await chat.run({question:'석암초등학교 도서관 장서 지원 근거'});w.ChatWorkspace.show(composite,'석암초 비교');await tick();assert.equal(d.querySelectorAll('.comparison-section').length,composite.visual.sections.length);assert.equal(d.querySelectorAll('#answer-map [data-test-map-kind="dot"]').length,6);assert(d.querySelector('#evidence-panel svg[aria-label="관측값 산점도"] circle[fill="#b58732"]'));
 w.ChatWorkspace.show({summary:'없음',sources:[]},'근거 없는 질문');assert.equal(d.querySelectorAll('#answer-map, #evidence-panel table').length,0);
 w.ChatWorkspace.show({sources:[{title:'<img src=x onerror=alert(1)>',source:'javascript:alert(1)',body:'<script>alert(1)</script>'}]},'보안');assert(!d.querySelector('#evidence-panel img, #evidence-panel script, #evidence-panel a'));
 dom.window.close();console.log('PASS chat workspace: map point contract (real Kakao SDK covered separately), source links, roster scope/duplicates/missing locations, all 5 chart modes, forecast, history, stale-panel clearing, HTML escaping');
})().catch(e=>{console.error(e);process.exitCode=1;});
