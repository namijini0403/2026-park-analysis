const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'refresh-cache-'));
  fs.writeFileSync(path.join(dir,'context_layers_manifest.json'),'{}');
  const file=path.join(dir,'school_context_summary.json');
  const put=name=>fs.writeFileSync(file,JSON.stringify({schools:{s:{school_name:name}}}));
  put('before');const context=require('../api/_context_evidence.js');assert.equal(context.loadContextData(dir).summary.schools.s.school_name,'before');
  put('after');fs.utimesSync(file,new Date(),new Date(Date.now()+10000));
  assert.equal(context.loadContextData(dir).summary.schools.s.school_name,'after');
  let stamp=1,name='before';const sandbox={module:{exports:{}},require:n=>n==='node:fs'?{statSync:()=>({mtimeMs:stamp}),readFileSync:()=>JSON.stringify({s:{school_name:name}})}:require(n)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/_education_evidence.js'),'utf8'),{...sandbox,__dirname});
  assert.equal(sandbox.module.exports.resolve({school_id:'s'}).school_name,'before');
  name='after';stamp++;assert.equal(sandbox.module.exports.resolve({school_id:'s'}).school_name,'after');
  let revision='a',poll,reloads=0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/data-refresh.js'),'utf8'),{fetch:async()=>({ok:true,json:async()=>({revision})}),setInterval:fn=>{poll=fn;},window:{location:{reload:()=>reloads++}}});
  await new Promise(setImmediate);await poll();assert.equal(reloads,0);
  revision='b';await poll();assert.equal(reloads,1);
  console.log('Context/education caches follow file changes; open map follows published revision PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
