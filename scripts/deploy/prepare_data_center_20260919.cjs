'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),release=path.join(root,'outputs/ux-deploy-20260919');
assert(fs.existsSync(path.join(release,'vercel_public/reports/walk-radius-area-20260919/index.html')));
assert(fs.existsSync(path.join(release,'vercel_public/data_processed/schools.csv')));
const files=['index.html','assets/hitl-workspace.js','assets/analysis-topics.js','assets/data-center-workspace.css','update-center.html'];
const entries=[];
for(const file of files){
 const input=fs.readFileSync(path.join(root,file));
 for(const relative of [file,'vercel_public/'+file]){
  const output=path.join(release,relative);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,input);
 }
 entries.push({file,sha256:crypto.createHash('sha256').update(input).digest('hex')});
}
const manifest={created:new Date().toISOString(),baseDeployment:'6ff1d782-65ed-4b33-9ddb-827310541497',files:entries};
fs.writeFileSync(path.join(release,'data-center-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
