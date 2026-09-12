const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const model=require('../api/_school_summary'),root=path.resolve(__dirname,'..');
const zoneData=JSON.parse(fs.readFileSync(path.join(root,'data_processed/education/school_zones.geojson')));
// Official IDs/metadata with small display fixtures for DOM interaction checks.
// Full geometries are verified in the browser, avoiding heavyweight SVG in jsdom.
zoneData.features=zoneData.features.map(f=>({...f,geometry:{type:'Polygon',coordinates:[[[126.6,37.4],[126.61,37.4],[126.61,37.41],[126.6,37.4]]]}}));
const allSchools=model.list();assert.equal(allSchools.length,917);assert.equal(allSchools.filter(s=>['유치원','초등학교'].includes(s.level)).length,641);
const sampleSchools=['초등학교','유치원','중학교','고등학교'].map(level=>level==='초등학교'?allSchools.find(s=>s.id==='B000002949'):allSchools.find(s=>s.level===level));
const tick=()=>new Promise(r=>setTimeout(r,30));
async function run(failZones=false){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.SVGSVGElement.prototype.createSVGRect=()=>({});w.ResizeObserver=class{observe(){}};
 let release;const pending=new Promise(resolve=>{release=resolve;});let zoneRequests=0;
 w.fetch=async url=>{if(url.includes('school_zones')){zoneRequests++;await pending;return {ok:!failZones,json:async()=>zoneData};}const u=new URL(url,'http://localhost');return {ok:true,json:async()=>u.searchParams.get('id')?model.summary(u.searchParams.get('id'),u.searchParams.get('kind')):{schools:sampleSchools}};};
 require('./map_test_double.cjs')(w);
 for(const file of ['school-map.js'])w.eval(fs.readFileSync(path.join(root,'assets',file),'utf8'));
 w.eval(['simple-app.js','hitl-workspace.js'].map(file=>fs.readFileSync(path.join(root,'assets',file),'utf8')).join('\n'));await tick();
 const count=()=>[...d.querySelectorAll('[data-school-count]')].reduce((n,e)=>n+Number(e.dataset.schoolCount),0);
 function change(id,value){d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));}
 function toggle(selector,checked){const el=d.querySelector(selector);el.checked=checked;el.dispatchEvent(new w.Event('change'));}
 assert.equal(count(),1);toggle('[data-map-level="유치원"]',true);assert.equal(count(),2);
 assert.equal(d.querySelectorAll('#school option').length,3);
 const kindergarten=model.list().find(s=>s.level==='유치원');change('school',kindergarten.id);await tick();
 release();await tick();
 if(failZones){assert.match(d.getElementById('map-zone-status').textContent,/불러오지 못했습니다/);assert.equal(d.querySelectorAll('[data-test-map-group="zones"]').length,0);dom.window.close();return;}
 assert.match(d.getElementById('map-zone-status').textContent,/유치원 학구도는 원자료에서 제공하지 않습니다/);
 assert.equal(d.querySelectorAll('[data-test-map-group="zones"]').length,0);assert.equal(zoneRequests,1);
 change('school','B000002949');await tick();
 assert.match(d.getElementById('map-zone-status').textContent,/공식 연결된 학구 1개/);
 assert.equal(d.querySelectorAll('[data-test-map-group="radius"]').length,1);assert.equal(d.querySelectorAll('[data-test-map-group="zones"]').length,1);
 assert.equal(d.querySelectorAll('[data-map-level]:checked').length,2);
 toggle('#map-zones',false);assert.equal(d.querySelectorAll('[data-test-map-group="zones"]').length,0);
 toggle('#map-zones',true);assert.equal(d.querySelectorAll('[data-test-map-group="zones"]').length,1);
 toggle('#map-radius',false);assert.equal(d.querySelectorAll('[data-test-map-group="radius"]').length,0);
 d.getElementById('map-clear-school').click();assert.equal(d.getElementById('school').value,'');assert.equal(d.querySelectorAll('[data-test-map-group="radius"]').length,0);
 d.getElementById('map-all-levels').click();assert.equal(count(),4);assert.match(d.getElementById('map-zone-status').textContent,/311개/);
 for(const el of d.querySelectorAll('[data-map-level]'))toggle(`[data-map-level="${el.dataset.mapLevel}"]`,false);
 assert.equal(count(),0);assert.equal(d.querySelectorAll('[data-test-map-group="zones"]').length,0);assert.match(d.getElementById('map-status').textContent,/하나 이상/);
 await tick();assert.equal(d.getElementById('chat-level').value,'초등학교');assert.equal(d.getElementById('save-review').disabled,true);
 dom.window.close();
}
(async()=>{await run();await run(true);console.log('PASS school map: 917 coordinates, multi-level union, official ID-linked boundaries, kindergarten coverage, 500m toggle, stale fetch and failure, empty filters, independent chat scope');})().catch(e=>{console.error(e);process.exitCode=1;});
