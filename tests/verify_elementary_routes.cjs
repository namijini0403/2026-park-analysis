const {chromium}=require('C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.QA_BASE||'http://127.0.0.1:8877',out='outputs/elementary-routes-20260916';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Mijin/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/?school=B000002951');await page.locator('[data-workspace=stats]').click();await page.locator('.ds-chart-grid').waitFor();
const d=await (await page.request.get(base+'/api/domain-stats?domain=park&level='+encodeURIComponent('초등학교')+'&schoolId=B000002951')).json();
for(const column of ['park_route_m','park_detour_ratio']){
const i=d.indicators.find(i=>i.column===column);assert.equal(i.coverage.general.available,237);assert.equal(i.coverage.island.available,14);
await page.locator('[data-indicator='+column+']').click();await page.locator('.ds-main-histogram').waitFor();
assert.equal((await page.locator('.ds-hist-count').allTextContents()).reduce((n,s)=>n+Number(s),0),237);
await page.locator('.ds-view-tabs').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+column+'.png'});
}
const routes=await (await page.request.get(base+'/data_processed/education/school_routes.json')).json();assert(routes.B000002951.route_coordinates.length>2);
assert.deepEqual(errors,[]);fs.writeFileSync(out+'/browser-check.json',JSON.stringify({base,passed:true,general:237,island:14,selected:routes.B000002951,at:new Date()},null,2));console.log('PASS elementary route charts',base);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
