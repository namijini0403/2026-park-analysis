'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'outputs/source-audit-deploy-20260918'),out=path.join(root,'outputs/ux-deploy-20260919');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
const overlays=[];
const lines=fs.readFileSync(path.join(root,'outputs/ux20260919-live-hashes.txt'),'utf8').split(/\r?\n/),checks=[];
for(const line of lines){const m=line.match(/^([a-f0-9]{64})  (.+)$/);if(!m||m[2].includes('/__pycache__/'))continue;const file=path.join(base,m[2]);
 if(!fs.existsSync(file)||hash(file)!==m[1]){
  assert(m[2].startsWith('vercel_public/data_processed/'),'Active source differs: '+m[2]);
  const response=await fetch('https://education-living-area-preview-production.up.railway.app/'+m[2].slice('vercel_public/'.length));assert(response.ok,m[2]);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),m[1],'Public data differs from active source: '+m[2]);overlays.push({file:m[2],bytes});
 }
 checks.push(m[2]);}
assert(checks.length>100,'Full active source hash inventory required');
assert(!fs.existsSync(out),'Release directory already exists');
fs.cpSync(base,out,{recursive:true});
// Deploy this isolated directory with --no-gitignore: parent repo ignores vercel_public.
const docker=path.join(out,'Dockerfile');fs.writeFileSync(docker,fs.readFileSync(docker,'utf8').replace('RUN ln -s vercel_public/data_processed data_processed','RUN test -f vercel_public/data_processed/schools.csv && test -f vercel_public/index.html && ln -s vercel_public/data_processed data_processed'));
for(const item of overlays){fs.mkdirSync(path.dirname(path.join(out,item.file)),{recursive:true});fs.writeFileSync(path.join(out,item.file),item.bytes);}
const files=['api/_agent.js','api/chat.js','assets/chat-agent.js','assets/chat-conversation.css','assets/chat-workspace.js','assets/indicator-charts.js','assets/kakao-maps.css','assets/school-profile.js','assets/table-comparison.js','index.html'];
const entries=[];
for(const file of files){for(const dest of file.startsWith('assets/')||file==='index.html'?[file,'vercel_public/'+file]:[file]){fs.copyFileSync(path.join(root,file),path.join(out,dest));entries.push({file:dest,sha256:hash(path.join(out,dest))});}}
const manifest={created:new Date().toISOString(),baseDeployment:'eb6c379c-72d5-4811-91c0-7840ce05bbd8',verifiedBaseFiles:checks.length,preservedLiveData:overlays.map(o=>o.file),files:entries};
fs.writeFileSync(path.join(out,'ux-release-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({out,verifiedBaseFiles:checks.length,changedFiles:entries.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
