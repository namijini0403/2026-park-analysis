'use strict';
// Reconcile a completed snapshot if source edits were detected during copying.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||'');
if(path.dirname(out)!==path.join(root,'outputs')||!path.basename(out).startsWith('hitl-deploy-')||!fs.existsSync(path.join(out,'Dockerfile')))throw Error('Expected completed isolated release');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),files=[],changed=[];
function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const dest=path.join(dir,item.name);if(item.isDirectory()){visit(dest);continue;}const rel=path.relative(out,dest);if(['Dockerfile','.dockerignore','railway.json','release-manifest.json'].includes(rel))continue;let source=rel;if(rel.startsWith('vercel_public'+path.sep)){const original=rel.slice('vercel_public'.length+1);if(fs.existsSync(path.join(root,original)))source=original;}
 const src=path.join(root,source);if(!fs.existsSync(src))throw Error('Unmapped file '+rel);const before=hash(src);if(hash(dest)!==before){fs.copyFileSync(src,dest);changed.push(rel);}if(hash(dest)!==before||hash(src)!==before)throw Error('Source changed while reconciling '+source);files.push({source,target:rel,sha256:before});}}
visit(out);fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify({created:new Date().toISOString(),files,changed},null,2));fs.writeFileSync(path.join(root,'outputs/hitl-release-path.txt'),out);console.log(JSON.stringify({out,files:files.length,changed}));
