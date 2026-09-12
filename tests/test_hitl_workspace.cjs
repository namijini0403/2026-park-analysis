const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const model=require('../api/_school_summary');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,d=w.document;
let saved;
w.localStorage.setItem('review',JSON.stringify({score:99,primary_action:'external_supply_new',outcome:'approved'}));
w.fetch=async url=>({ok:true,json:async()=>{
  const u=new URL(url,'http://localhost');
  return u.searchParams.has('id')?model.summary(u.searchParams.get('id'),u.searchParams.get('kind')):{schools:model.list()};
}});
w.URL.createObjectURL=blob=>{saved=blob;return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
const tick=()=>new Promise(r=>setTimeout(r,25));
function change(id,value){d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));}
async function readBlob(blob){return new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(JSON.parse(reader.result));reader.readAsText(blob);});}
(async()=>{
  w.eval(['simple-app.js','hitl-workspace.js'].map(file=>fs.readFileSync(path.join(root,'assets',file),'utf8')).join('\n'));
  await tick();
  assert.equal(d.querySelectorAll('.workspace-page:not([hidden])').length,1);
  assert(d.getElementById('save-review').disabled);
  change('school','B000002949');await tick();
  d.querySelector('.workspace-nav [data-workspace="review"]').click();
  assert(!d.getElementById('workspace-review').hidden);assert(d.getElementById('workspace-explore').hidden);
  assert.equal(d.getElementById('review-outcome').value,'deferred');
  d.getElementById('save-review').click();assert(!saved);assert.match(d.getElementById('review-status').textContent,/목적과 판단 이유/);
  d.getElementById('review-purpose').value='이용 조건 확인';d.getElementById('review-reason').value='출입구 경로 미확인으로 보류';
  d.getElementById('save-review').click();const record=await readBlob(saved);
  assert.equal(record.outcome,'deferred');assert.equal(record.observation.school.id,'B000002949');
  assert(record.observation.sources.every(s=>s.sha256.length===64));assert.equal(record.observation.status,'pending');
  assert(!JSON.stringify(record).includes('external_supply_new'));assert(!Object.hasOwn(record,'score'));
  change('kind','sports');await tick();assert.equal(d.getElementById('review-reason').value,'');
  change('level','고등학교');await tick();assert(d.getElementById('save-review').disabled);
  assert.equal(d.getElementById('review-purpose').value,'');
  d.querySelector('.workspace-nav [data-workspace="ask"]').click();assert(!d.getElementById('workspace-ask').hidden);
  assert.equal(d.querySelectorAll('.workspace-page:not([hidden])').length,1);
  console.log('PASS HITL workspace: isolated screens, required reasons, source hashes, no policy approval or legacy restore, context reset');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
