const {chromium}=require('C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.QA_BASE||'http://127.0.0.1:8891';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#school option'));
  assert.deepEqual(await page.locator('.workspace-nav button').allTextContents(),['01 학교 찾기','02 AI 도우미','03 저장된 대화','04 전체 통계','05 데이터 관리센터']);
  assert.equal(await page.locator('#workspace-review,[data-workspace="review"]').count(),0);
  await page.locator('.workspace-nav [data-workspace="data"]').click();
  const frame=page.frameLocator('#data-center-frame');
  await frame.locator('#upload-file').waitFor();
  await frame.locator('#scan-now-btn').waitFor();
  await frame.locator('#upload-note').fill('탭 전환 유지 확인');
  await page.locator('.workspace-nav [data-workspace="saved"]').click();
  await page.locator('#saved-list').waitFor();
  await page.locator('.workspace-nav [data-workspace="stats"]').click();
  await page.locator('#stats-title').waitFor();
  await page.locator('.workspace-nav [data-workspace="data"]').click();
  assert.equal(await frame.locator('#upload-note').inputValue(),'탭 전환 유지 확인');
  await page.locator('#workspace-data').scrollIntoViewIfNeeded();
  fs.mkdirSync('outputs/data-center-workspace-20260919',{recursive:true});
  const tag=base.includes('127.0.0.1')?'local':'live';
  await page.screenshot({path:`outputs/data-center-workspace-20260919/${tag}-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#workspace-data').scrollIntoViewIfNeeded();
  await page.screenshot({path:`outputs/data-center-workspace-20260919/${tag}-mobile.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'outer page overflow');
  assert(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'data center overflow');
  assert.deepEqual(errors,[],'browser exceptions');
  console.log('PASS navigation, manager controls, persistent input, mobile layout, startup');
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
