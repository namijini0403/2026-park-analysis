'use strict';
// Explicit live integration check. No request/asset mocks and no credential logging.
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE||'https://education-living-area-preview-production.up.railway.app';
const out=path.resolve('outputs/question-ux-live-20260919'),question='학교 도서관 지원을 검토할 초등학교 5개를 찾아줘';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 let browser,page;const requests=[],responses=[],errors=[];
 const deadline=setTimeout(()=>{console.error('FAIL live verification exceeded 210 seconds');browser?.close();process.exit(1);},210000);
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',timeout:20000});
  page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message.replace(/https?:\/\/\S+/g,'[URL omitted]')));
  page.on('request',r=>{if(new URL(r.url()).pathname==='/api/chat'){const d=r.postDataJSON();requests.push({action:d.action||'answer',question:d.question,selected_variables:d.selected_variables,variables_confirmed:d.variables_confirmed});}});
  const navigation=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});assert(navigation.ok(),'production navigation HTTP '+navigation.status());
  assert(await page.locator('script[src*="chat-agent.js?v=ux20260919"]').count(),'deployed UX asset version');
  await page.locator('.workspace-nav [data-workspace="ask"]').click();
  await page.evaluate(()=>{const e=document.querySelector('#chat-scope');e.value='all';e.dispatchEvent(new Event('change'));});
  const planned=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat'&&r.request().postDataJSON()?.action==='plan_variables',{timeout:45000});
  await page.fill('#question',question);await page.click('#send');
  const pr=await planned,plan=await pr.json();responses.push({phase:'plan',status:pr.status(),data:plan});fs.writeFileSync(path.join(out,'responses.json'),JSON.stringify(responses,null,2));
  assert(pr.ok(),plan.summary);assert.equal(plan.mode,'variable_plan');
  assert(plan.variables.some(v=>v.column==='nearest_public_library_m'),'public library distance included');
  assert(!plan.variables.some(v=>['name','level'].includes(v.column)),'identity/school level excluded');
  const priority=['nearest_public_library_m','books_per_student','students','librarians','libraries_walk','library_seats','books_total'];
  const chosen=priority.map(id=>plan.variables.find(v=>v.column===id)).filter(Boolean).slice(0,4);
  assert(chosen.length>=3,'at least three meaningful variables');
  for(const v of chosen)await page.locator('.chat-variable-options input').evaluateAll((els,label)=>{const input=els.find(e=>e.value===label);if(!input)throw Error('candidate input missing');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));},v.label);
  await page.locator('.chat-variable-step').screenshot({path:path.join(out,'variable-plan.png')});
  const answered=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat'&&r.request().postDataJSON()?.action!=='plan_variables',{timeout:75000});
  await page.locator('.chat-run-analysis').click();
  const ar=await answered,answer=await ar.json();responses.push({phase:'answer',status:ar.status(),data:answer});fs.writeFileSync(path.join(out,'responses.json'),JSON.stringify(responses,null,2));
  assert(ar.ok(),answer.summary);assert.equal(answer.answerable,true);assert.notEqual(answer.mode,'needs_input');assert(!answer.needs_input);
  assert(!(answer.agent?.calls||[]).some(c=>c.name==='ask_user'),'no repeated selection request');
  await page.locator('.agent-summary').waitFor();assert.match(await page.locator('.chat-result-label').last().innerText(),/종합 결론/);
  assert.equal(await page.locator('.chat-run-analysis').count(),0);
  assert.equal(requests.filter(r=>r.action==='plan_variables').length,1);assert.equal(requests.filter(r=>r.action==='answer').length,1);
  assert.deepEqual(requests.find(r=>r.action==='answer').selected_variables,chosen.map(v=>v.label).sort((a,b)=>plan.variables.findIndex(v=>v.label===a)-plan.variables.findIndex(v=>v.label===b)));
  assert((await page.locator('.comparison-section').count())>0);
  assert(await page.locator('.comparison-section').evaluateAll(es=>es.every(e=>!e.open)),'variable evidence initially collapsed');
  assert(await page.locator('.agent-observations').evaluateAll(es=>es.every(e=>!e.open)),'per-variable prose initially collapsed');
  assert(await page.locator('[data-comparison-table]').evaluateAll(es=>new Set(es.map(e=>e.querySelector('.table-comparison>details:last-of-type')?.textContent||e.textContent)).size===es.length),'no identical table copies');
  await page.locator('.chat-map-canvas').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.chat-map-canvas')?.dataset.mapProvider==='kakao'&&document.querySelectorAll('.chat-map-canvas .kakao-school-dot').length>0,{},{timeout:25000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.chat-map-canvas img')].some(img=>img.complete&&img.naturalWidth>0),{},{timeout:15000});
  const markers=await page.locator('.chat-map-canvas .kakao-school-dot').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  assert(markers.every(m=>m.width===m.height&&m.width<=13),'small circular live SDK markers');
  await page.locator('.agent-inline-map').screenshot({path:path.join(out,'live-map.png')});
  await page.locator('.agent-summary').scrollIntoViewIfNeeded();await page.locator('#workspace-ask').screenshot({path:path.join(out,'live-answer-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('.agent-summary').scrollIntoViewIfNeeded();await page.locator('#workspace-ask').screenshot({path:path.join(out,'live-answer-mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'mobile overflow');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed:true,at:new Date().toISOString(),base,question,chosen,requests,summary:answer.summary,markers,checks:['library distance candidate','no name/level candidate','one variable confirmation','no ask_user','synthesis first','details collapsed','no duplicate tables','actual Kakao SDK map and loaded images','small circular marks','desktop/mobile layout'],errors},null,2));
  console.log('PASS live question UX and native map');
 }catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed:false,error:e.message.replace(/https?:\/\/\S+/g,'[URL omitted]'),requests,errors},null,2));await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true,timeout:10000}).catch(()=>{});throw e;}
 finally{await browser?.close();clearTimeout(deadline);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
