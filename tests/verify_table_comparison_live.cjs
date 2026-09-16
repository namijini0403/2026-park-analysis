const {chromium}=require('C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Mijin/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});try{const page=await browser.newPage({viewport:{width:1600,height:1000}});const base='https://education-living-area-preview-production.up.railway.app';await page.goto(base);await page.locator('.workspace-nav [data-workspace=ask]').click();
if(process.env.QA_LOCAL){for(const f of ['table-comparison.js','chat-workspace.js'])await page.addScriptTag({path:path.resolve('assets',f)});await page.addStyleTag({path:path.resolve('assets/table-comparison.css')});}
const r=require('../api/_agent_tools').run('query_schools',{level:'초등학교'},{island:'exclude',sort_by:'books_per_student',order:'asc',limit:10,columns:['students','books_total','libraries_walk','nearest_public_library_m']});
await page.evaluate(r=>{window.ChatWorkspace.show({observation_version:1,visual:{sections:[r.visual]},sources:r.sources},'학생당 장서와 학생 수, 주변 도서관 접근성을 함께 비교해주세요')},r);
assert.equal(await page.locator('.table-comparison').count(),1);const inputs=page.locator('.table-comparison input');assert((await inputs.count())>=3);
await page.locator('.table-comparison h4').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/table-comparison-20260916/actual-data.png'});
assert.equal(await page.locator('.tc-table tbody tr').count(),10);await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('PASS real query_schools response through live app styles',r.visual.table.headers);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

