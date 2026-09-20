'use strict';
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('outputs/question-ux-live-20260919'),response=JSON.parse(fs.readFileSync(path.join(out,'responses.json'),'utf8')).find(r=>r.phase==='answer').data;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',timeout:20000}),timer=setTimeout(()=>process.exit(1),90000);try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
 const navigation=await page.goto('https://education-living-area-preview-production.up.railway.app',{waitUntil:'domcontentloaded',timeout:35000});assert(navigation.ok());
 await page.locator('.workspace-nav [data-workspace="ask"]').click();await page.evaluate(d=>window.ChatWorkspace.show(d,'학교 도서관 지원을 검토할 초등학교 5개를 찾아줘'),response);
 const section=page.locator('.comparison-section').first();assert(await section.isVisible());
 const before=await page.locator('#evidence-panel').evaluate(e=>({clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,overflow:getComputedStyle(e).overflow,scrollTop:e.scrollTop}));
 await section.scrollIntoViewIfNeeded();await section.screenshot({path:path.join(out,'live-details-collapsed.png')});await section.locator(':scope>summary').click();
 const tableWrap=section.locator('details').filter({has:page.locator('[data-comparison-table]')}).first();await tableWrap.locator(':scope>summary').click();
 const values=section.locator('.tc-values');assert(await values.isVisible());await values.locator(':scope>summary').click();
 assert(await section.locator('.tc-table table').isVisible());assert((await section.locator('.tc-table tbody tr').count())>0);
 await values.scrollIntoViewIfNeeded();await page.locator('#evidence-panel').screenshot({path:path.join(out,'live-details-expanded.png')});
 const after=await page.locator('#evidence-panel').evaluate(e=>({scrollTop:e.scrollTop,scrollHeight:e.scrollHeight}));
 fs.writeFileSync(path.join(out,'drilldown-validation.json'),JSON.stringify({passed:true,source:'Saved real production API response rendered by actual production assets; no new LLM query.',before,after,rows:await section.locator('.tc-table tbody tr').count(),headers:await section.locator('.tc-table th').allTextContents()},null,2));console.log('PASS real production evidence details visible and clickable to numeric table');
}finally{await browser.close();clearTimeout(timer);}})().catch(e=>{console.error(e);process.exitCode=1;});
