'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),base='https://education-living-area-preview-production.up.railway.app',live=process.argv.includes('--live'),out=path.join(root,'outputs/kakao-migration',live?'live':'preview');fs.mkdirSync(out,{recursive:true});
const files=['index.html','assets/kakao-config.js','assets/kakao-maps.js','assets/kakao-maps.css','assets/school-map.js','assets/chat-workspace.js'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],tiles=[];page.setDefaultTimeout(45000);
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/daumcdn.net/.test(r.url())&&r.request().resourceType()==='image')tiles.push({status:r.status(),host:new URL(r.url()).hostname});});
 await context.addInitScript(()=>{let api;window.qaMaps=[];Object.defineProperty(window,'EducationMaps',{configurable:true,get:()=>api,set(value){api=value;const create=api.create;api.create=function(...args){const m=create(...args),entry={id:args[0].id,map:m,groups:{}};qaMaps.push(entry);for(const name of ['dot','polygons','circle','route']){const fn=m[name];m[name]=function(group,...rest){const result=fn.call(m,group,...rest);(entry.groups[group]??=[]).push(result);return result;};}const clear=m.clear;m.clear=function(group){entry.groups[group]=[];return clear(group);};return m;};}});});
 if(!live)await context.route(base+'/**',route=>{const url=new URL(route.request().url()),file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(files.includes(file))return route.fulfill({path:path.join(root,file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});return route.continue();});
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#school-map')?.dataset.mapProvider==='kakao');
  await page.locator('#map-zone-status').filter({hasText:'279개'}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('#school-map img')].some(i=>/daumcdn.net/.test(i.src)&&i.complete&&i.naturalWidth>100));
  assert.equal(await page.evaluate(()=>typeof window.L),'undefined');
  const represented=()=>page.evaluate(()=>qaMaps[0].groups.schools.reduce((n,m)=>n+Number(m.getContent().dataset.schoolCount),0));
  await page.locator('[data-map-level="유치원"]').check({force:true});assert.equal(await represented(),641);
  await page.waitForTimeout(500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-provider=\"kakao\"] img')].filter(i=>/daumcdn.net/.test(i.src)).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'desktop-start.png')});
  await page.locator('#search').fill('신흥');
  // Center the filtered group, then exercise the visible marker including co-located schools.
  await page.locator('#map-fit').click();const marker=page.locator('#school-map .kakao-school-dot[aria-label*="인천신흥초등학교"]');await marker.click();
  const choice=page.getByRole('button',{name:'인천신흥초등학교 · 초등학교 선택',exact:true});if(await choice.count())await choice.click();
  await page.locator('#summary h2').filter({hasText:'인천신흥초등학교'}).waitFor();await page.locator('#map-zone-status').filter({hasText:'공식 연결된 학구 1개'}).waitFor();
  assert.equal(await page.evaluate(()=>qaMaps[0].groups.radius[0].getRadius()),500);
  await page.locator('#map-radius').uncheck();assert.equal(await page.evaluate(()=>qaMaps[0].groups.radius.length),0);await page.locator('#map-radius').check();
  await page.locator('#map-zones').uncheck();assert.equal(await page.evaluate(()=>qaMaps[0].groups.zones.length),0);await page.locator('#map-zones').check();
  await page.locator('#map-zone-fit').click();await page.waitForTimeout(500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-provider=\"kakao\"] img')].filter(i=>/daumcdn.net/.test(i.src)).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'desktop-school.png')});
  await page.locator('#search').fill('');await page.locator('#map-clear-school').click();await page.locator('#map-all-levels').click();assert.equal(await represented(),917);await page.locator('#map-fit').click();
  await page.waitForTimeout(500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-provider=\"kakao\"] img')].filter(i=>/daumcdn.net/.test(i.src)).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'desktop-islands.png')});
  await page.locator('.workspace-nav [data-workspace="ask"]').click();
  const result=await page.request.post(base+'/api/chat',{data:{question:'2026 연구학교, 선도학교 목록 보여줘',level:'초등학교'}});assert.equal(result.status(),200);const data=await result.json();
  await page.evaluate(data=>ChatWorkspace.show(data,'2026 연구학교, 선도학교 목록 보여줘'),data);
  await page.locator('#answer-map-status').filter({hasText:'© Kakao'}).waitFor();assert.equal(await page.locator('#answer-map .kakao-school-dot').count(),103);
  await page.locator('#answer-map').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-provider=\"kakao\"] img')].filter(i=>/daumcdn.net/.test(i.src)).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'answer-locations.png')});
  const question='인천석암초등학교 도서관 지원을 검토하고 있어. 학생당 장서와 외부 도서관 거리, 공식 통학구역을 함께 고려해줘.';
  await page.locator('#question').fill(question);await page.locator('#send').click();await page.locator('.hitl-dataset').waitFor();
  for(const [dataset,id,direction,weight] of [['books','books:books.per_student','lower','3'],['library_access','library_access:nearest_m.public_children','higher','2'],['zones','zones:evidence','observe','1']]){
   const options=await (await page.request.post(base+'/api/chat',{data:{action:'hitl_options',dataset_id:dataset}})).json();
   const factor=options.factors.find(f=>f.id===id);
   assert(factor);await page.locator('.hitl-dataset').selectOption(dataset);await page.getByRole('button',{name:factor.label+' +',exact:true}).click();await page.locator('.hitl-selected .direction').last().selectOption(direction);await page.locator('.hitl-selected .weight').last().selectOption(weight);
  }
  const answer=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().postDataJSON()?.action==='hitl_run');await page.locator('.hitl-run').click();const hitl=await (await answer).json();assert.equal(hitl.review.decision,'deferred');assert.equal(hitl.review.factors.length,3);
  await page.locator('#answer-map-status').filter({hasText:'© Kakao'}).waitFor();await page.locator('#answer-map').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'hitl-library.png')});
  fs.writeFileSync(path.join(out,'hitl-library.json'),JSON.stringify({question,result:hitl},null,2));
  // Same GeoJSON/route contract as actual answers; includes a polygon hole and two islands.
  await page.evaluate(()=>ChatWorkspace.show({visual:{map:[{lat:37.45,lng:126.7,name:'시험 위치'}],geometries:[{type:'Feature',properties:{name:'도형 변환 시험'},geometry:{type:'MultiPolygon',coordinates:[[[[126.69,37.44],[126.71,37.44],[126.71,37.46],[126.69,37.44]],[[126.698,37.447],[126.70,37.447],[126.70,37.45],[126.698,37.447]]],[[[126.72,37.45],[126.73,37.45],[126.73,37.46],[126.72,37.45]]]]}}],routes:[{name:'기존 근거 경로 · 시험',coordinates:[[126.69,37.44],[126.7,37.45]]}]},sources:[]},'지도 도형 계약 시험'));
  await page.locator('#answer-map-status').filter({hasText:'© Kakao'}).waitFor();assert.equal(await page.evaluate(()=>qaMaps.at(-1).groups.geometries[0].length),12);assert.equal(await page.evaluate(()=>qaMaps.at(-1).groups.routes[0].length),2);
  await page.waitForTimeout(500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-provider=\"kakao\"] img')].filter(i=>/daumcdn.net/.test(i.src)).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'answer-geometries.png')});
  await page.evaluate(()=>{ChatWorkspace.show({visual:{map:[{lat:37.45,lng:126.7,name:'과거'}]}},'과거');ChatWorkspace.show({summary:'새 답변',sources:[]},'새 답변');});await page.waitForTimeout(100);assert.equal(await page.locator('#answer-map').count(),0);
  await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#map-zone-status').filter({hasText:'279개'}).waitFor();await page.locator('#school-map').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-provider=\"kakao\"] img')].filter(i=>/daumcdn.net/.test(i.src)).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const failed=await context.newPage();await failed.route('**/v2/maps/sdk.js**',route=>route.abort());await failed.goto(base,{waitUntil:'domcontentloaded'});
  await failed.locator('#map-status').filter({hasText:'카카오맵을 불러오지 못했습니다'}).waitFor();assert(await failed.locator('#search').isEnabled());
  await failed.locator('.workspace-nav [data-workspace="ask"]').click();await failed.evaluate(data=>ChatWorkspace.show(data,'지도 연결 실패 때도 근거 유지'),data);
  await failed.locator('#answer-map-status').filter({hasText:'아래 표에서 자료를 확인'}).waitFor();assert(await failed.locator('#evidence-panel tbody tr').count()>0);await failed.close();
  assert.equal(errors.length,0,errors.join('\n'));assert(tiles.some(t=>t.status===200),'Kakao tiles did not load');
  const report={passed:true,mode:live?'live':'preview-on-production-origin',checked_at:new Date().toISOString(),school_union:641,all_schools:917,radius_m:500,answer_markers:103,kakao_tile_responses:tiles.length,page_errors:errors,checks:['native Kakao SDK and tiles','no Leaflet runtime','multi-level selection','co-located marker selection','500m and zones toggles','islands fit','answer locations / polygon holes / multipolygon / route','stale answer clearing','mobile no overflow']};fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
