'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),release=process.env.UX_RELEASE||'outputs/ux-deploy-20260919';
const base='https://education-living-area-preview-production.up.railway.app';
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,release,'ux-release-manifest.json'),'utf8')),checked=[];
 for(const item of manifest.files){if(item.file.startsWith('api/')||item.file.startsWith('vercel_public/'))continue;
  const r=await fetch(base+'/'+(item.file==='index.html'?'':item.file),{signal:AbortSignal.timeout(30000)});assert(r.ok,item.file);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),item.sha256,item.file);checked.push(item.file);
 }
 const profile=await(await fetch(base+'/api/school-profile?id=B000002949')).json();assert(profile.radar.axes.length);assert(!profile.radar.axes.some(a=>a.column==='paps'));
 const result={checkedAt:new Date().toISOString(),base,checked,profile:'API valid; no PAPS radar axis'};
 fs.writeFileSync(path.join(root,'outputs/ux20260919-public-validation.json'),JSON.stringify(result,null,2));console.log('PASS public release hashes and profile API:',checked.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
