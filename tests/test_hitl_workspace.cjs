const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const model=require('../api/_school_summary');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.localStorage.setItem('review',JSON.stringify({score:99,primary_action:'external_supply_new',outcome:'approved'}));
w.fetch=async url=>({ok:true,json:async()=>{
  const u=new URL(url,'http://localhost');
  if(u.pathname==='/api/school-profile')return require('../api/_school_profile').profile(u.searchParams.get('id'));
  return u.searchParams.has('id')?model.summary(u.searchParams.get('id'),u.searchParams.get('kind')):{schools:model.list()};
}});
const tick=()=>new Promise(r=>setTimeout(r,25));
function change(id,value){d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));}
(async()=>{
  w.eval(['indicator-charts.js','school-profile.js','simple-app.js','hitl-workspace.js'].map(file=>fs.readFileSync(path.join(root,'assets',file),'utf8')).join('\n'));
  await tick();
  assert.equal(d.querySelectorAll('.workspace-page:not([hidden])').length,1);
  assert.equal(d.getElementById('workspace-review'),null);
  assert.deepEqual([...d.querySelectorAll('.workspace-nav button')].map(el=>el.textContent),['01 학교 찾기','02 AI 도우미','03 저장된 대화','04 전체 통계','05 데이터 관리센터']);
  assert.equal(d.getElementById('data-center-frame').getAttribute('src'),null,'Data management must load only when opened');
  change('school','B000002949');await tick();
  const observation=model.summary('B000002949','books');
  assert(observation.sources.every(s=>s.sha256.length===64));assert.equal(observation.status,'pending');
  assert(!Object.hasOwn(observation,'score'));assert(!d.getElementById('summary').textContent.includes('external_supply_new'),'Legacy review storage cannot restore unsupported recommendations');
  for(const page of ['saved','stats','data']){
    d.querySelector(`.workspace-nav [data-workspace="${page}"]`).click();
    assert(!d.getElementById(`workspace-${page}`).hidden);assert(d.getElementById('workspace-explore').hidden);
    assert.equal(d.querySelectorAll('.workspace-page:not([hidden])').length,1);
  }
  assert.match(d.getElementById('data-center-frame').getAttribute('src'),/^\/update-center\.html/);
  change('kind','sports');await tick();
  change('level','고등학교');await tick();
  d.querySelector('.workspace-nav [data-workspace="ask"]').click();assert(!d.getElementById('workspace-ask').hidden);
  assert.equal(d.querySelectorAll('.workspace-page:not([hidden])').length,1);
  console.log('PASS workspace: five isolated screens, lazy data center, source hashes, no default score or legacy recommendation restore');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
