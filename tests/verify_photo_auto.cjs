const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.QA_BASE||'https://education-living-area-preview-production.up.railway.app',out=process.env.PHOTO_QA_OUT||'outputs/photo-auto-20260919';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Users/Mijin/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message.replace(/AIza[\w-]+/g,'[REDACTED]')));
// Inspect provider-owned photo pixels without changing the production widget.
await page.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'});};});
if(process.env.QA_LOCAL_PHOTOS==='1')await page.route('**/assets/school-photos.js*',route=>route.fulfill({path:'assets/school-photos.js',contentType:'text/javascript'}));
await page.goto(base+'/?school=B000003025');
await page.locator('gmp-place-search').waitFor({timeout:45000}); // no photo button click
await page.waitForFunction(()=>!document.querySelector('.school-photos button')?.disabled,null,{timeout:45000});
assert((await page.locator('.photo-auto-note').innerText()).includes('자동'));
assert((await page.locator('.photo-status').innerText()).includes('후보'));
assert.equal(await page.locator('.photo-detail').count(),0,'no implicit place confirmation');
await page.locator('.school-photos').screenshot({path:out+'/before-photo.png'});

await page.locator('.photo-preview').first().scrollIntoViewIfNeeded();
await page.locator('.photo-preview').getByRole('button',{name:'1번째 사진을 엽니다.',exact:true}).first().waitFor({timeout:25000});
await page.locator('.photo-preview').first().screenshot({path:out+'/desktop.png'});
await page.locator('.radar-section').screenshot({path:out+'/radar.png'});
await page.waitForFunction(()=>document.querySelector('.school-photos select').options.length>1);
const option=await page.locator('.school-photos option').evaluateAll(items=>items.find(o=>o.textContent.includes('세모'))?.value||items[1].value);await page.locator('.school-photos select').selectOption(option);
assert.equal(await page.locator('gmp-place-search').count(),0,'nearby facility remains manual');
await page.locator('.school-photos button').click();await page.locator('gmp-place-search').waitFor();
await page.locator('.photo-preview').getByRole('button',{name:'1번째 사진을 엽니다.',exact:true}).first().waitFor({timeout:30000});
await page.locator('.photo-preview').first().screenshot({path:out+'/facility.png'});
await page.locator('.school-photos select').selectOption('0');await page.locator('gmp-place-search').waitFor();
await page.locator('.photo-preview').getByRole('button',{name:'1번째 사진을 엽니다.',exact:true}).first().waitFor({timeout:30000});
await page.setViewportSize({width:390,height:844});await page.locator('.school-photos').screenshot({path:out+'/mobile.png'});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
fs.writeFileSync(out+'/browser-check.json',JSON.stringify({base,localAsset:process.env.QA_LOCAL_PHOTOS==='1',at:new Date(),passed:true,checks:['school automatic search and loaded photo','no implicit selection','manual facility and loaded photo','school reselect and loaded photo','mobile width'],errors},null,2));console.log('PASS automatic school photo browser, facility photo, school reselect, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(String(e).replace(/AIza[\w-]+/g,'[REDACTED]'));process.exitCode=1});
