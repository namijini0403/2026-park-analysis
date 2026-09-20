'use strict';
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.QA_BASE||'http://127.0.0.1:8893',live=process.env.QA_LIVE==='1';
const question='도서지역을 제외한 초등학교 중 공공도서관이 멀고 학교도서관 지원을 함께 검토할 5곳을 학교명을 명시해서 찾아줘.';
const columns=['students','forecast_2029','forecast_2031','nearest_public_library_m','libraries_walk','books_per_student'];
const dir='outputs/answer-candidates-20260919';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let response;
  if(process.env.QA_REPLAY)response=JSON.parse(fs.readFileSync(process.env.QA_REPLAY,'utf8'));
  else if(live){const r=await context.request.post(base+'/api/chat',{data:{question,scope:'all',level:'초등학교',selected_variables:columns,variables_confirmed:true},timeout:180000});assert(r.ok());response=await r.json();}
  else{
   const tool=require('../api/_agent_tools'),helper=require('../api/_answer_overview');
   const result=tool.run('query_schools',{level:'초등학교'},{sort_by:'nearest_public_library_m',order:'desc',limit:5,columns,island:'exclude'});
   const selected=result.llm.rows,final={summary:selected.map(r=>r.name).join(', ')+'를 학교도서관 지원 검토 대상으로 함께 살펴봅니다.',focus_school_ids:selected.map(r=>r.id)};
   response={observation_version:1,answerable:true,mode:'agent',...final,visual:helper.buildVisual(final,[result.visual],{selected_variables:columns}),sources:result.sources};
  }
  fs.writeFileSync(`${dir}/${live?'live':'local'}-response.json`,JSON.stringify(response,null,2));
  const o=response.visual.overview;assert.equal(o.schools.length,5);assert(o.additional_candidates.schools.length>=5);assert(o.additional_candidates.schools.length<=10);
  assert(!o.additional_candidates.schools.some(s=>s.island||o.school_ids.includes(s.id)));assert.deepEqual(response.visual.map.map(s=>s.id),o.school_ids);
  await page.route('**/api/chat',route=>route.fulfill({json:response}));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.workspace-nav [data-workspace="ask"]').click();
  await page.evaluate(async({question,columns})=>{document.getElementById('chat-scope').value='all';document.getElementById('question').value=question;await window.ChatAgent.submit(null,{selected_variables:columns,variable_plan:{mode:'variable_plan',variables:[]}});},{question,columns});
  const links=page.locator('.agent-summary a');assert.equal(new Set(await links.evaluateAll(items=>items.map(a=>a.href))).size,5);for(const school of o.schools)assert((await links.locator(`xpath=self::a[contains(@href, '${school.id}')]`).count())>0,school.name);
  const extra=page.locator('#evidence-overview details').filter({has:page.locator('summary').filter({hasText:'추가 비교 후보'})});
  assert.equal(await extra.count(),1);assert.equal(await extra.getAttribute('open'),null);
  assert.equal(await page.locator('#evidence-overview .evidence-matrix').first().locator('thead th').count(),6);
  await extra.locator(':scope > summary').click();assert.equal(await extra.getAttribute('open'),'');
  assert.equal(await extra.locator('.evidence-matrix thead th').count(),o.additional_candidates.schools.length+1);
  await extra.screenshot({path:dir+'/expanded.png'});
  const popupPromise=context.waitForEvent('page');await links.first().click();const popup=await popupPromise;
  await popup.waitForLoadState('domcontentloaded');await popup.waitForFunction(id=>document.querySelector('#school')?.value===id&&document.querySelector('#summary .school-heading'),o.schools[0].id,{timeout:45000});
  assert.equal(new URL(popup.url()).searchParams.get('school'),o.schools[0].id);assert(await popup.locator('#summary').isVisible());assert(await popup.locator('#summary .school-heading').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}),'report heading is in viewport immediately');
  await popup.locator('#summary').screenshot({path:dir+'/school-report.png'});await popup.close();
  await page.setViewportSize({width:390,height:844});await extra.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.screenshot({path:dir+'/mobile.png'});assert.deepEqual(errors,[]);
  console.log('PASS answer links open correct school report; primary five stay fixed; 5–10 filtered extras toggle; mobile');
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});

