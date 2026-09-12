const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'office-http-'));
const port=39871,url=`http://127.0.0.1:${port}`;
const token='local-integration-test';let child;
async function start(){
  child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),UPDATE_CENTER_TOKEN:token,UPDATE_CENTER_SCAN_INTERVAL_MIN:'0',UPDATE_CENTER_STORE_PATH:path.join(temp,'store.json'),UPDATE_CENTER_HOME:path.join(temp,'runtime'),UPDATE_CENTER_STATE_PATH:path.join(temp,'scan.json'),DATABASE_URL:'',OPENAI_API_KEY:''},stdio:['ignore','ignore','pipe']});
  const deadline=Date.now()+120000;while(Date.now()<deadline){try{const r=await fetch(url+'/office-documents.html');if(r.status===200)return;}catch{}await new Promise(r=>setTimeout(r,300));}throw Error('Local server startup timed out');
}
async function stop(){if(!child)return;const p=child;child=null;await new Promise(resolve=>{p.once('exit',resolve);p.kill();});}
async function post(action,body,auth=token){const r=await fetch(url+'/api/update-center/documents/'+action,{method:'POST',headers:{'Content-Type':'application/json','x-update-center-token':auth},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
(async()=>{try{
  await start();assert.equal((await post('import',{},'wrong')).status,401);
  const schools=require('../api/analysis.js').dataset().schools.filter(s=>s.level==='초등학교').slice(0,12);
  const csv='학교명,횟수\n'+schools.map((s,i)=>`${s.name},${i+1}`).join('\n');
  const imported=await post('import',{name:'검증_교육청.csv',base64:Buffer.from(csv).toString('base64')});assert.equal(imported.status,200);assert.equal(imported.data.tables.length,1);
  const docId=imported.data.id;
  await stop();await start();
  const result=await post('analyze',{document_id:docId,mode:'table',table_index:0,school_column:0,value_column:1,level:'초등학교',year:2026,compare_field:'students'});
  assert.equal(result.status,200);assert.equal(result.data.join.matched_numeric,12);assert.equal(result.data.source_hashes.office_document,docId);
  assert.equal((await fetch(url+'/data/update_center_store.json')).status,404);
  assert.equal((await post('delete',{document_id:docId})).data.deleted,true);
  assert.equal((await post('analyze',{document_id:docId})).status,400);
  const coverage=await fetch(url+'/api/update-center/coverage',{headers:{'x-update-center-token':token}});assert.equal(coverage.status,200);
  fs.writeFileSync(path.join(root,'contest_plan/data_integration_http_validation_20260911.json'),JSON.stringify({passed:true,checks:['authentication','CSV import','restart persistence','12-school join','provenance','private path 404','deletion','coverage endpoint'],generated_at:new Date().toISOString()},null,2));
  console.log('Office HTTP: auth, import, restart persistence, real-school join, private paths, delete, coverage PASS');
}finally{await stop();}})().catch(error=>{console.error(error);process.exitCode=1;});
