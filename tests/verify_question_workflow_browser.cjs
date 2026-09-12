'use strict';
process.env.AI_EXPLAINER_ENABLED='false';process.env.AI_ANALYSIS_ENABLED='false';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),live=process.argv.includes('--live'),out=path.join(root,'outputs/hitl-relevance',live?'live':'preview');fs.mkdirSync(out,{recursive:true});
const url='https://education-living-area-preview-production.up.railway.app';
const files=['index.html','assets/hitl-analysis.js','assets/hitl-analysis.css','assets/chat-workspace.js'];
const chat=live?null:require('../api/chat');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();page.setDefaultTimeout(90000);
 const errors=[],responses=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(new URL(r.url()).pathname==='/api/chat'){try{responses.push({request:r.request().postDataJSON(),result:await r.json()});}catch{}}});
 if(!live)await page.route(url+'/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname;if(p==='/api/chat'&&req.method()==='POST'){try{return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await chat.run(req.postDataJSON()))});}catch(e){return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({summary:e.message})});}}const f=p==='/'?'index.html':p.slice(1);if(files.includes(f))return route.fulfill({path:path.join(root,f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});return route.continue();});
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.HitlAnalysis&&window.ChatWorkspace&&document.querySelector('#school option[value="B000002949"]'));
  await page.selectOption('#school','B000002949');await page.locator('.workspace-nav [data-workspace="ask"]').click();
  async function ask(question,action){console.log('ASK '+question);const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat'&&r.request().postDataJSON()?.action===action,{timeout:180000});await page.fill('#question',question);await page.locator('#send').click();const r=await response,d=await r.json();assert(r.ok(),d.summary);console.log('RESULT '+(d.mode||d.workflow));return d;}
  const exact='학구도랑 도보500m권이 가장 안 맞는 초등학교 상위 10개 뽑아줘';
  const overlap=await ask(exact,'hitl_overlap');assert.equal(overlap.mode,'boundary_comparison');assert.equal(overlap.comparison.scope_count,272);assert(overlap.comparison.valid>200);assert.equal(overlap.school_id,null);
  const first=page.locator('.hitl-plan').last();assert.equal(await first.locator('input[type=radio]').count(),3);assert.equal(await first.locator('input[type=checkbox]').count(),0);assert.equal(await first.locator('.weight').count(),0);assert(!(await first.innerText()).includes('녹지'));
  await page.waitForFunction(()=>document.getElementById('answer-map')?.dataset.mapProvider==='kakao');await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,'overlap-desktop.png'),fullPage:true});
  const alternateResponse=page.waitForResponse(r=>r.request().postDataJSON()?.action==='hitl_overlap'&&r.request().postDataJSON()?.criterion==='zone_outside');await first.locator('input[value="zone_outside"]').check();await first.locator('.direct-run').click();const alternate=await(await alternateResponse).json();assert.equal(alternate.comparison.criterion,'zone_outside');
  const question='인천석암초등학교 도서관 지원을 검토해줘. 학생당 장서, 외부 도서관 거리, 공식 통학구역을 함께 보고 싶어.';
  const plan=await ask(question,'hitl_plan');assert.equal(plan.workflow,'factors');await page.locator('.hitl-plan').last().locator('.hitl-run').waitFor();const panel=page.locator('.hitl-plan').last();
  assert.equal(await panel.locator('.hitl-priority').getAttribute('open'),null);assert.equal(await panel.locator('.hitl-count').innerText(),'선택한 요소 0개 · 여러 개 선택 가능');
  for(const id of ['books:books.per_student','library_access:nearest_m.public_children','zones:evidence'])await panel.locator('input[data-factor="'+id+'"]').check();
  assert.equal(await panel.locator('.hitl-count').innerText(),'선택한 요소 3개 · 여러 개 선택 가능');
  await panel.locator('input[data-factor="zones:evidence"]').uncheck();assert((await panel.locator('.hitl-count').innerText()).includes('2개'));await panel.locator('input[data-factor="zones:evidence"]').check();
  async function calculate(){const response=page.waitForResponse(r=>r.request().postDataJSON()?.action==='hitl_run');await panel.locator('.hitl-run').click();return (await response).json();}
  const basic=await calculate();assert.equal(basic.review.factors.length,3);assert(basic.review.factors.every(f=>f.weight===null));assert.equal(basic.review.gates.safety,'unverified');
  await panel.locator('.hitl-priority>summary').click();await panel.locator('.hitl-weighted').check();assert.deepEqual(await panel.locator('.hitl-selected .weight').evaluateAll(els=>els.map(e=>e.value)),['2','2','2']);
  await panel.locator('.hitl-selected .weight').first().selectOption('3');const weighted=await calculate();assert.equal(weighted.review.factors.find(f=>f.id==='books:books.per_student').share_percent,42.857);assert.equal(weighted.review.decision,'deferred');
  await panel.locator('.hitl-priority>summary').click();await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'factors-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'factors-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.setViewportSize({width:1440,height:1050});
  const ordered=await ask('초등학교 학생 수가 가장 많은 상위 10개','hitl_ordered');assert.equal(ordered.mode,'ordered_observations');assert.equal(ordered.review.context.school_id,null);assert(!ordered.score&&!ordered.ranking);
  const roster=await ask('2026 연구학교 선도학교 명단 보여줘',undefined);assert.equal(roster.mode,'roster');assert(roster.visual.map.length);assert.equal(await page.locator('.hitl-plan').last().locator('.weight').count(),0);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed:true,live,checked_at:new Date().toISOString(),checks:['exact question routes to polygon comparison','all school scope overrides map selection','three transparent spatial criteria','native Kakao map','no unrelated green or park-route candidates','checkbox multi-select/removal/count','optional weights default all normal','weight change and rerun','safety remains independent','mobile width','observational top ten','direct roster bypasses weights'],overlap:overlap.comparison,errors},null,2));fs.writeFileSync(path.join(out,'responses.json'),JSON.stringify(responses));console.log('PASS real browser question workflow '+(live?'LIVE':'PREVIEW'));
 }catch(e){console.error('BROWSER FAILURE '+e.message);fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.message,responses:responses.map(r=>({request:r.request,result:{mode:r.result.mode,workflow:r.result.workflow,summary:r.result.summary}}))},null,2));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
