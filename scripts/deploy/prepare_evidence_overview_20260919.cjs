'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),release=path.join(root,'outputs/ux-deploy-20260919');
assert(fs.existsSync(path.join(release,'support-enrollment-manifest.json')));
const files=['api/chat.js','api/_agent.js','api/_agent_tools.js','api/_answer_overview.js','index.html','assets/chat-workspace.js','assets/evidence-summary.css'];
const entries=[];
for(const file of files){
 const bytes=fs.readFileSync(path.join(root,file));
 for(const dest of file==='index.html'||file.startsWith('assets/')?[file,'vercel_public/'+file]:[file]){
  fs.writeFileSync(path.join(release,dest),bytes);
  entries.push({file:dest,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
}
fs.writeFileSync(path.join(release,'evidence-overview-manifest.json'),JSON.stringify({created:new Date().toISOString(),baseDeployment:'d56ba615-df1d-40ba-a569-c70b0e224c0c',files:entries},null,2));
console.log(JSON.stringify({release,files:entries.length}));
