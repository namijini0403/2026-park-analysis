'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),release=path.join(root,'outputs/ux-deploy-20260919');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert(fs.existsSync(path.join(release,'data-center-manifest.json')));
const entries=[];
function copy(file,dest=file){const output=path.join(release,dest);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(path.join(root,file),output);entries.push({file:dest,sha256:hash(output)});}
for(const file of ['api/_agent.js','api/_agent_tools.js','api/_school_table.js','scripts/education/merge_enrollment_release.cjs','scripts/education/enrollment_model_v2.py','scripts/education/build_analysis_dataset.py','scripts/education/refresh_support_enrollment.py'])copy(file);
for(const name of ['enrollment_forecasts.json','school_enrollment_forecast_v2.csv'])copy('vercel_public/data_processed/education/'+name);
// Preserve current published observations and environment while updating only enrollment projections.
require(path.join(release,'scripts/education/merge_enrollment_release.cjs')).applyEnrollmentRelease(path.join(release,'vercel_public'));
for(const name of ['analysis_dataset.json','school_analysis.json'])entries.push({file:'vercel_public/data_processed/education/'+name,sha256:hash(path.join(release,'vercel_public/data_processed/education',name))});
const report='reports/support-enrollment-20260919';
for(const name of ['index.html','analysis_report.md','analysis.json'])copy('outputs/support-enrollment-20260919/'+name,'vercel_public/'+report+'/'+name);
fs.writeFileSync(path.join(release,'support-enrollment-manifest.json'),JSON.stringify({created:new Date().toISOString(),baseDeployment:'848336e1-ff44-4c4a-a139-cc83b44396f9',files:entries},null,2));
console.log(JSON.stringify({release,files:entries.length,report}));
