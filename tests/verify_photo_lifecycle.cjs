const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Users/Mijin/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 fs.mkdirSync('outputs/photo-lifecycle',{recursive:true});
 try{
  await page.goto((process.env.QA_BASE||'http://127.0.0.1:8879')+'/?school=B000003025');
  for(const [i,id] of ['B000003025','B000002956','B000003025'].entries()){
   if(i)await page.locator('#school').selectOption(id,{force:true});
   await page.locator('gmp-place-search').waitFor({timeout:30000});
   await page.locator('gmp-place-search').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>!document.querySelector('.school-photos button')?.disabled,null,{timeout:35000});
   const state=await page.locator('.school-photos').evaluate(el=>({status:el.querySelector('.photo-status').textContent,previews:el.querySelectorAll('.photo-preview').length,places:el.querySelector('gmp-place-search')?.places?.length,query:el.querySelector('gmp-place-text-search-request')?.textQuery}));
   assert(state.previews>0,'school switch must load candidate previews');
   assert(state.query.includes(i===1?'인천운남초등학교':'인천부개초등학교'),'query must follow current school');
   console.log('SCHOOL',id,state);
   await page.locator('.photo-preview').first().scrollIntoViewIfNeeded();
   await page.waitForTimeout(2000); // Allow provider-owned lazy media to paint for visual QA.
   await page.locator('.photo-preview').first().screenshot({path:'outputs/photo-lifecycle/'+i+'.png'});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e).replace(/AIza[\w-]+/g,'[REDACTED]'));process.exitCode=1;});
