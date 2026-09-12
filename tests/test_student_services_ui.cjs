const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const dom=new JSDOM(fs.readFileSync(path.join(root,'assets/student-services.html'),'utf8'),{url:'http://localhost/assets/student-services.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'data_processed/student_services/priorities.json'),'utf8'))});
function input(id,v){const e=d.getElementById(id);e.value=v;e.dispatchEvent(new w.Event(e.tagName==='SELECT'?'change':'input'));}
(async()=>{w.eval(fs.readFileSync(path.join(root,'assets/student-services.js'),'utf8')+'\nwindow.compareCandidates=compareCandidates;');for(let i=0;i<100&&!d.querySelector('#schools option');i++)await new Promise(r=>setTimeout(r,10));
assert.equal(d.querySelector('#error').textContent,'');assert.equal(d.querySelectorAll('#schools option').length,272);assert(!d.querySelector('[data-weight]'));assert.match(d.querySelector('#detail').textContent,/판단 보류/);assert.equal(d.querySelectorAll('.steps article').length,3);
for(const k of ['sports','welfare','books','library']){input('kind',k);assert.match(d.querySelector('#detail').textContent,/나열 순서는 우선순위가 아닙니다/);}
input('search','미송');assert.equal(d.querySelectorAll('#schools option').length,1);input('kind','sports');assert.match(d.querySelector('#detail').textContent,/시설이 없다는 뜻은 아닙니다/);
input('preference','route_m');assert.equal(d.querySelectorAll('#candidates tbody tr').length,0);assert.match(d.querySelector('#comparison-note').textContent,/조건부 비교/);
// Independent evidence fixture: unknown safety must never be compensated by distance.
const evidence=Object.fromEntries(['use','safety','execution','route'].map(k=>[k,{source_url:'https://example.org/verified'}]));
const option=(id,n)=>({id,layers:{sports:{verification:{use:'verified',safety:'verified',execution:'verified',route:'verified'},evidence,comparison_eligible:true,verified_metrics:{route_m:n}}}});
const a=option('A',400),b=option('B',200),bad=option('C',1);bad.layers.sports.verification.safety='unknown';
assert.deepEqual(Array.from(w.compareCandidates([a,b,bad],'sports','route_m'),c=>c.id),['B','A']);assert.deepEqual(Array.from(w.compareCandidates([b,a],'sports',''),c=>c.id),['A','B']);
input('facility-search','부이놀이');assert.equal(d.querySelectorAll('#facilities tbody tr').length,1);
const {normalize}=require('../scripts/policy_cards/observed_cards.cjs');const old=normalize({schools:{x:{primary_module:'park',base:{primary_action:'external_supply_new'},stability:1}}});assert.equal(old.schools.x.primary_module,null);assert.equal(old.schools.x.base.primary_action,null);
console.log('Observation UI and evidence-gated comparison passed');dom.window.close();})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()});
