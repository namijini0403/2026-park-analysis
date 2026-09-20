'use strict';
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.QA_BASE||'https://education-living-area-preview-production.up.railway.app';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.workspace-nav [data-workspace="ask"]').click();
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().postDataJSON()?.action==='plan_variables',{timeout:90000});
  await page.locator('#question').fill('학교 도서관 지원을 검토할 초등학교 5곳을 찾아줘');
  await page.locator('#send').click();
  const response=await pending,plan=await response.json();
  assert(response.ok());assert.equal(plan.mode,'variable_plan');
  for(const id of ['students','forecast_2029','forecast_2031'])assert(plan.variables.some(v=>v.column===id),id);
  const step=page.locator('.chat-variable-step');await step.waitFor();
  assert.match(await step.innerText(),/3년 뒤.*2029/);assert.match(await step.innerText(),/5년 뒤.*2031/);
  fs.mkdirSync('outputs/support-enrollment-20260919',{recursive:true});
  await step.screenshot({path:'outputs/support-enrollment-20260919/live-variable-proposal.png'});
  fs.writeFileSync('outputs/support-enrollment-20260919/live-variable-proposal.json',JSON.stringify(plan,null,2));
  await page.goto(base+'/reports/support-enrollment-20260919/',{waitUntil:'domcontentloaded'});
  assert.match(await page.locator('main').innerText(),/검증값/);
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'report mobile overflow');
  await page.screenshot({path:'outputs/support-enrollment-20260919/live-report-mobile.png'});
  console.log('PASS live school-support proposal includes current, +3 and +5 enrollment');
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
