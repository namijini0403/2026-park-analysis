// Optional browser smoke check. Set PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE when needed.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.QA_BASE||'http://localhost:3000')+'/?school=B000003025');
  await page.locator('.school-photos button').waitFor({timeout:30000});
  assert.equal(await page.locator('#managerCover').count(),1);
  assert.equal(await page.locator('#chat-form').count(),1);
  assert.equal(await page.locator('#question').count(),1);
  await page.locator('.workspace-nav [data-workspace=stats]').click();
  await page.locator('.ds-overview').waitFor();
  await page.locator('[data-view=relationship]').click();
  await page.locator('.ds-pair-metrics').waitFor();
  await page.locator('.workspace-nav [data-workspace=ask]').click();
  await page.locator('#question').fill('디자인 병합 입력 확인');
  assert.equal(await page.locator('#question').inputValue(),'디자인 병합 입력 확인');
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.locator('.workspace-nav [data-workspace=explore]').click();
  assert.equal(await page.locator('.school-photos select').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS merged design: cover, photo controls, stats views, unique chat form/input, mobile layout, no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
