'use strict';
// Fresh allowlisted snapshot; never rebuilds or alters the shared source/build tree.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs','hitl-deploy-'+Date.now()),manifest=[];
fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function copy(from,to=from){const source=path.join(root,from),dest=path.join(out,to),stat=fs.statSync(source);if(stat.isDirectory()){fs.mkdirSync(dest,{recursive:true});for(const name of fs.readdirSync(source)){if(name==='__pycache__'||name==='node_modules'||name.startsWith('.env'))continue;copy(path.join(from,name),path.join(to,name));}}else{const before=hash(source);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);if(hash(dest)!==before||hash(source)!==before)throw Error('Concurrent file change: '+from);manifest.push({source:from,target:to,sha256:before});}}
for(const dir of ['api','assets','modules','rag','refresh_seed'])copy(dir);
for(const name of ['update_center','education','reading_module','policy_cards','context'])copy('scripts/'+name);
copy('scripts/validate_module_contract.mjs');
for(const name of ['server.js','package.json','package-lock.json','data_sources.yaml','index.html','logo.png','update-center.html','office-documents.html','requirements.txt'])copy(name);
copy('vercel_public');
for(const name of ['index.html','logo.png','update-center.html','office-documents.html'])copy(name,'vercel_public/'+name);
for(const name of ['assets','rag'])copy(name,'vercel_public/'+name);
for(const e of require('../../api/_data_catalog'))copy(e.file,'vercel_public/'+e.file);
for(const name of ['education','context','student_services'])copy('data_processed/'+name,'vercel_public/data_processed/'+name);
for(const name of ['school_library_access.csv','policy_action_cards.json','school_nearest_park.csv'])copy('data_processed/'+name,'vercel_public/data_processed/'+name);
copy('outputs/robust_xai');
fs.writeFileSync(path.join(out,'Dockerfile'),'FROM node:22-bookworm-slim\nWORKDIR /app\nRUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*\nCOPY requirements.txt ./\nRUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt\nENV PATH="/opt/venv/bin:$PATH"\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev\nCOPY . .\nRUN ln -s vercel_public/data_processed data_processed\nENV NODE_ENV=production\nCMD ["node", "server.js"]\n');
fs.writeFileSync(path.join(out,'.dockerignore'),'node_modules\n.env\n__pycache__\nrelease-manifest.json\n');
fs.writeFileSync(path.join(out,'railway.json'),JSON.stringify({build:{builder:'DOCKERFILE',dockerfilePath:'Dockerfile'},deploy:{startCommand:'node server.js',healthcheckPath:'/',healthcheckTimeout:120,restartPolicyType:'ON_FAILURE'}}));
const final=new Map(manifest.map(m=>[m.target,m]));for(const m of final.values())if(hash(path.join(root,m.source))!==m.sha256)throw Error('Source changed during snapshot: '+m.source);
fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify({created:new Date().toISOString(),files:[...final.values()]},null,2));
fs.writeFileSync(path.join(root,'outputs/hitl-release-path.txt'),out);console.log(JSON.stringify({out,files:final.size}));
