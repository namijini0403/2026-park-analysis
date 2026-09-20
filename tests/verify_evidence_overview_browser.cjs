'use strict';
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.QA_BASE||'http://127.0.0.1:8893',live=process.env.QA_LIVE==='1';
const question='초등학교 도서관 지원을 검토하려고 해. 도서지역은 빼고 함께 살펴볼 학교 5곳을 추려서 학교명을 명시해줘.';
const columns=['students','forecast_2029','forecast_2031','nearest_public_library_m','libraries_walk','books_per_student'];
const dir='outputs/evidence-overview-20260919';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.workspace-nav [data-workspace="ask"]').click();
  let response;
  if(process.env.QA_REPLAY){
   response=JSON.parse(fs.readFileSync(process.env.QA_REPLAY,'utf8'));
  }else if(live){
   const result=await page.request.post(base+'/api/chat',{data:{question,scope:'all',level:'초등학교',selected_variables:columns,variables_confirmed:true},timeout:180000});
   assert(result.ok());response=await result.json();
  }else{
   const tools=require('../api/_agent_tools'),helper=require('../api/_answer_overview');
   const result=tools.run('query_schools',{level:'초등학교'},{sort_by:'nearest_public_library_m',order:'desc',limit:50,columns,island:'exclude'});
   const chosen=result.llm.rows.slice(1,6),final={summary:chosen.map(r=>r.name).join(', ')+'를 함께 검토합니다.',focus_school_ids:chosen.map(r=>r.id)};
   response={observation_version:1,answerable:true,...final,visual:helper.buildVisual(final,[result.visual],{selected_variables:columns}),sources:result.sources};
  }
  fs.writeFileSync(`${dir}/${live?'live':'local'}-response.json`,JSON.stringify(response,null,2));
  const overview=response.visual?.overview;assert(overview,'overview attached');assert.equal(overview.status,'focused');assert.equal(overview.schools.length,5);
  for(const column of columns)assert(overview.columns.some(c=>c.id===column),column);
  assert.deepEqual(response.visual.map.map(p=>p.id),overview.school_ids);assert(!overview.schools.some(s=>s.island));
  await page.evaluate(({response,question})=>window.ChatWorkspace.show(response,question),{response,question});
  assert.equal(await page.locator('#evidence-overview-tab').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('.evidence-school-list span').count(),5);assert((await page.locator('.evidence-matrix tbody tr').count())>=columns.length);
  assert(await page.locator('#evidence-details').isHidden());
  assert(await page.locator('.evidence-matrix-scroll').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'all metric rows visible without a nested vertical scroll');
  await page.locator('#evidence-panel').scrollIntoViewIfNeeded();
  await page.locator('#evidence-panel').screenshot({path:`${dir}/${live?'live':'local'}-overview.png`});
  await page.locator('#evidence-details-tab').click();assert(await page.locator('#evidence-details').isVisible());assert(await page.locator('#evidence-overview').isHidden());
  const detail=page.locator('.comparison-section').first();await detail.locator(':scope>summary').click();assert(await detail.isVisible());
  assert((await detail.locator('svg').count())>0,'detail chart preserved');
  await page.locator('#evidence-overview-tab').click();await page.setViewportSize({width:390,height:844});
  await page.locator('#evidence-panel').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page overflow');
  await page.screenshot({path:`${dir}/${live?'live':'local'}-mobile.png`});
  assert.deepEqual(errors,[]);console.log('PASS focused five-school map, all-variable overview, detail tabs, mobile and browser errors');
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
