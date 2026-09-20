const {chromium}=require('C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Mijin/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  // Test-only observability for Google's closed shadow trees; production unchanged.
  await page.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'});};});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().replace(/AIza[\w-]+/g,'[REDACTED]'));});
  await page.goto((process.env.QA_BASE||'http://localhost:8893')+'/?school=B000003025');
  await page.locator('.school-photos button').waitFor({timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('.photo-coverage').textContent.includes('확인하고 있습니다'));
  console.log('OPTIONS',JSON.stringify(await page.locator('.school-photos option').allTextContents()));
  await page.locator('.school-photos button').click();
  await page.waitForFunction(()=>!document.querySelector('.school-photos button').disabled,{},{timeout:50000});
  fs.mkdirSync('outputs/school-photos-qa',{recursive:true});
  await page.locator('.school-photos').screenshot({path:'outputs/school-photos-qa/desktop.png'});
  console.log(JSON.stringify({status:await page.locator('.photo-status').innerText(),cards:await page.locator('gmp-place-search').count(),errors}));
  await page.setViewportSize({width:390,height:844});
  await page.locator('.school-photos').screenshot({path:'outputs/school-photos-qa/mobile.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  await page.setViewportSize({width:1440,height:1000});
  const options=await page.locator('.school-photos option').evaluateAll(items=>items.map(o=>({value:o.value,text:o.textContent})));
  for(const kind of (process.env.PHOTO_QA_KIND?[process.env.PHOTO_QA_KIND]:['학교','공원','도서관'])){
   const option=options.find(o=>o.text.startsWith(kind+' · ')&&(kind!=='공원'||o.text.includes('세모')));if(!option){console.log(kind,'no local candidate');continue;}
   await page.locator('.school-photos select').selectOption(option.value);
   await page.locator('.school-photos button').click();
   await page.waitForFunction(()=>!document.querySelector('.school-photos button').disabled,{},{timeout:40000});
   const search=page.locator('gmp-place-search');
   await search.screenshot({path:`outputs/school-photos-qa/${kind}-search.png`});
   console.log(kind,'SEARCH', (await search.innerText()).slice(0,1200));
   const name=option.text.split(' · ')[1].replace(/ \(직선.*$/,'');
   const target=search.getByText(kind==='공원'?'세모공원(세모 어린이공원)':name,{exact:true}).first();
   if(await target.count()){
    await target.click();
    await page.locator('gmp-place-details').waitFor({timeout:10000});
    let hasPhotos=true;try{await page.locator('gmp-place-details').getByRole('button',{name:'1번째 사진을 엽니다.',exact:true}).waitFor({timeout:10000});}catch{hasPhotos=false;}
    const photos=await page.locator('gmp-place-details img').evaluateAll(imgs=>imgs.filter(i=>i.complete&&i.naturalWidth>100).map(i=>({width:i.naturalWidth,height:i.naturalHeight,alt:i.alt})));
    console.log(kind,'PHOTOS',JSON.stringify(photos));
    await page.locator('.photo-detail').screenshot({path:`outputs/school-photos-qa/${kind}-detail.png`});
    if(hasPhotos){const big=page.locator('gmp-place-details').getByRole('button',{name:'1번째 사진을 엽니다.',exact:true});
    await big.click();await page.getByRole('dialog').first().waitFor({timeout:10000});console.log(kind,'DIALOGS',await page.getByRole('dialog').count());await page.screenshot({path:`outputs/school-photos-qa/${kind}-expanded.png`});await page.keyboard.press('Escape');}else console.log(kind,'NO_PHOTO');
    await page.setViewportSize({width:390,height:844});await page.locator('.photo-detail').screenshot({path:`outputs/school-photos-qa/${kind}-mobile-detail.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'detail mobile overflow');await page.setViewportSize({width:1440,height:1000});
   }else console.log(kind,'exact name not found; no automatic selection');
  }
  console.log('FINAL_ERRORS',JSON.stringify(errors));
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e).replace(/AIza[\w-]+/g,'[REDACTED]'));process.exitCode=1;});
