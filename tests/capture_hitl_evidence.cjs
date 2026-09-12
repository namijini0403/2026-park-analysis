'use strict';
// Capture a specific analytical chart from an actual saved live response.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const out=path.resolve(__dirname,'../outputs/hitl-release-validation/live');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('https://education-living-area-preview-production.up.railway.app',{waitUntil:'domcontentloaded'});await page.locator('.workspace-nav [data-workspace="ask"]').click();
 const item=JSON.parse(fs.readFileSync(path.join(out,'future.json'),'utf8')),result=item.result;
 const target=result.visual.sections.find(s=>s.statistics&&s.title.includes('2031')&&s.title.includes('예측'));assert(target,'2031 forecast distribution exists');
 await page.evaluate(({result,question})=>window.ChatWorkspace.show({...result,visual:{...result.visual,sections:result.visual.sections.map(s=>({...s,table:s.table?{...s.table,rows:s.table.rows.slice(0,12)}:undefined}))}},question),{result,question:item.question});
 const section=page.locator('.comparison-section').filter({has:page.getByRole('heading',{name:target.title,exact:true})});await section.locator('svg').screenshot({path:path.join(out,'future-chart.png')});fs.writeFileSync(path.join(out,'future-chart-scope.json'),JSON.stringify({title:target.title,statistics:target.statistics,source:'saved actual live HTTP response rendered by deployed ChatWorkspace'},null,2));console.log('PASS future chart: '+target.title);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
