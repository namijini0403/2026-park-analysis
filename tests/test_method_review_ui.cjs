const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'assets/method-review.html'),'utf8'),{
 url:'http://localhost/assets/method-review.html',runScripts:'outside-only'});
dom.window.fetch=async url=>{
 const file=path.resolve(root,'assets',String(url));
 assert(file.startsWith(root+path.sep));
 return {ok:fs.existsSync(file),status:fs.existsSync(file)?200:404,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
};
async function wait(selector){
 for(let i=0;i<200;i++){
  if(dom.window.document.querySelector(selector))return;
  if(dom.window.document.querySelector('#error').textContent)throw Error(dom.window.document.querySelector('#error').textContent);
  await new Promise(resolve=>setTimeout(resolve,10));
 }throw Error('Timed out: '+selector);
}
(async()=>{
 dom.window.eval(fs.readFileSync(path.join(root,'assets/method-review-page.js'),'utf8'));
 await wait('#demand-detail table');
 assert.match(dom.window.document.body.textContent,/직선 500m/);
 dom.window.document.querySelector('[data-tab="routes"]').click();
 await wait('#route-table table');
 assert.equal(dom.window.document.querySelectorAll('#route-table tbody tr').length,53);
 dom.window.document.querySelector('[data-tab="forecast"]').click();
 await wait('#forecast-detail table');
 assert(dom.window.document.querySelectorAll('#school option').length>=900);
 const grid=JSON.parse(fs.readFileSync(path.join(root,'data_processed/candidate_grid_final.geojson'),'utf8'));
 assert(grid.features.every(f=>f.properties.demand_model_version==='source_allocation_v2_20260911'));
 assert(grid.features.every(f=>!('walkshed_beneficiary_2029' in f.properties)));
 const validation=JSON.parse(fs.readFileSync(path.join(root,'data_processed/education/forecast_validation.json'),'utf8'));
 for(const level of Object.values(validation))for(const row of level.rows){
  assert(row.training_max_year===null||row.training_max_year<=row.origin);
  assert(row.selection_max_year===null||row.selection_max_year<=row.origin);
  assert(row.origin<row.target);
 }
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.includes('./data_processed/education/school_enrollment_forecast_v2.csv'));
 assert(html.includes("candidate.demand_model_version === 'source_allocation_v2_20260911') return candidate"));
 console.log('Method UI: 3 tabs, current candidate data, missing values, forecast chronology and integration passed');
 dom.window.close();
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
