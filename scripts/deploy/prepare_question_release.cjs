'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.resolve(root,'../outputs/policy_studio_20260912/release'),audit=path.join(root,'outputs/hitl-relevance');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const files=['api/_question_intent.js','api/_boundary_comparison.js','api/_ordered_observations.js','scripts/education/compare_school_boundaries.py','api/_hitl_analysis.js','api/chat.js','api/_data_answers.js','assets/hitl-analysis.js','assets/hitl-analysis.css','assets/chat-workspace.js','index.html'];
// Verify the active release's reviewed manifest, including the other window's final policy fixes.
const previous=JSON.parse(fs.readFileSync(path.join(base,'policy-release-manifest.json')));
for(const f of previous.files)if(hash(path.join(base,f.file))!==f.sha256)throw Error('Base release changed: '+f.file);
for(const file of ['api/_hitl_analysis.js','api/chat.js','api/_data_answers.js','assets/hitl-analysis.js','assets/hitl-analysis.css','index.html']){
 if(hash(path.join(audit,'before',path.basename(file)))!==hash(path.join(base,file)))throw Error('Concurrent change needs merging: '+file);
}
const renderer=fs.readFileSync(path.join(root,'assets/chat-workspace.js'),'utf8').replace("color:/^#[0-9a-f]{6}$/i.test(f.properties?.color)?f.properties.color:'#56836c',opacity:.12","color:'#56836c',opacity:.12");
if(renderer.replace(/\r\n/g,'\n')!==fs.readFileSync(path.join(base,'assets/chat-workspace.js'),'utf8').replace(/\r\n/g,'\n'))throw Error('Renderer has an unreviewed concurrent change');
const out=path.join(root,'outputs/question-deploy-'+Date.now());
const r=cp.spawnSync('robocopy',[base,out,'/E','/MT:8','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP'],{windowsHide:true,encoding:'utf8'});if(r.status>7||r.error)throw Error(r.error||r.stdout);
const entries=[];
for(const file of files){const source=path.join(root,file);for(const target of file.startsWith('assets/')||file==='index.html'?[file,'vercel_public/'+file]:[file]){const dest=path.join(out,target);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);if(file==='index.html'){let html=fs.readFileSync(dest,'utf8');for(const asset of ['hitl-analysis.js','hitl-analysis.css','chat-workspace.js'])html=html.replace(new RegExp('(assets/'+asset.replace('.','\\.')+')\\?[^"\\s]+','g'),'$1?v=question20260912');fs.writeFileSync(dest,html);}entries.push({source:file,file:target,sha256:hash(dest),source_sha256:hash(source)});}}
const manifest={created_at:new Date().toISOString(),base_deployment:'ac2d447c-669c-4199-a7d1-23eaac2d23fc',base,out,files:entries};
fs.writeFileSync(path.join(audit,'release-manifest.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(out,'question-release-manifest.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(audit,'release-path.txt'),out);console.log(JSON.stringify({out,files:entries.length,preserved_base:manifest.base_deployment}));
