import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import worker from '../education/python_worker.cjs';
import {applyRoot, updateCenterHome} from './paths.mjs';
import {stageCandidate,persistStagedCandidate} from './candidate.mjs';
import {applyStagedCandidate} from './apply.mjs';
import {csvToRecords} from './quality.mjs';

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const allowed=new Set(['data_processed/libraries.csv','data_processed/school_library_access.csv','data_processed/policy_action_cards.json',
  ...['school_analysis','analysis_dataset','library_access_scenarios','library_access_preview','school_public_indicators','public_indicators_manifest','school_statistics','disclosure_coverage']
    .map(n=>`data_processed/education/${n}.json`),'data_processed/education/library_refresh_coverage.json','data_processed/context/education_school_evidence.json']);
export function validatePipelineFile(buffer,target,current){
  if(!allowed.has(target)&&!/^data_processed\/education\/disclosures\/[A-Za-z0-9_-]+\.json$/.test(target))throw Error('Unregistered pipeline output: '+target);
  if(target==='data_processed/education/library_refresh_coverage.json'){
    const next=JSON.parse(buffer);if(!Array.isArray(next.unresolved)||!Number.isInteger(next.mapped_records)||next.mapped_records<1)throw Error('Invalid library coverage');
    return {status:'ok',records:next.mapped_records,columns:[],issues:[],contract:'library_coverage'};
  }
  if(!fs.existsSync(current))throw Error('No established output contract: '+target);
  const parse=text=>target.endsWith('.csv')?csvToRecords(text):JSON.parse(text);
  const old=parse(fs.readFileSync(current,'utf8').replace(/^\uFEFF/,'')),next=parse(buffer.toString('utf8').replace(/^\uFEFF/,''));
  const shape=value=>Array.isArray(value)?'array':value===null?'null':typeof value;
  if(shape(old)!==shape(next))throw Error('Output schema changed: '+target);
  if(Array.isArray(old)){
    if(old.length&&next.length<old.length*.8)throw Error('Output record loss >20%: '+target);
    const objects=old.filter(r=>r&&typeof r==='object');
    const identity=r=>r?.학교ID||r?.id;
    const byId=new Map(objects.filter(identity).map(r=>[identity(r),r]));
    const common=objects.length?Object.keys(objects[0]).filter(k=>objects.every(r=>k in r)):[];
    if(next.some(r=>!r||typeof r!=='object'||(byId.has(identity(r))?Object.keys(byId.get(identity(r))):common).some(k=>!(k in r))))throw Error('Output columns missing: '+target);
  }else if(!next||Object.keys(old).some(k=>!(k in next)))throw Error('Output keys missing: '+target);
  if(target.endsWith('/analysis_dataset.json')){
    if(new Set(next.schools.map(s=>s.id)).size!==next.schools.length||next.schools.length!==old.schools.length)throw Error('Analysis school identity contract changed');
    if(next.schools.some(s=>!s.environment||!s.observations))throw Error('Missing analysis fields');
  }
  return {status:'ok',records:Array.isArray(next)?next.length:Object.keys(next).length,columns:[],issues:[],contract:'registered_pipeline'};
}

export async function checkPipeline(entry,state,store,{actor='scheduler',collect=worker}={},log=()=>{}){
  const id=`pipeline_${entry.check.pipeline}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const work=path.join(updateCenterHome(),'builds',id);
  try{
    // Run only one isolated source dependency group at a time. Its publication completes
    // before another group takes its input snapshot (shared analysis outputs).
    const result=await collect('refresh_public_data.py',{kind:entry.check.pipeline,root:applyRoot(),work},{timeout:1800000,maxBytes:1024*1024});
    state[entry.dataset]={lastCheckedAt:new Date().toISOString(),lastStatus:'ok',result:result.result};
    if(!result.files?.length)return {outcome:'unchanged'};
    const files=result.files.map((f,i)=>{
      const source=path.resolve(work,f.target);
      if(!source.startsWith(path.resolve(work)+path.sep))throw Error('Invalid pipeline output path');
      const content=fs.readFileSync(source);
      if(sha(content)!==f.sha256)throw Error('Pipeline output checksum mismatch');
      validatePipelineFile(content,f.target,path.join(applyRoot(),f.target));
      return {name:`${i}_${path.basename(f.target)}`,target:f.target,content};
    });
    const inputs=result.input_hashes;
    if(!inputs||!Object.keys(inputs).length)throw Error('Pipeline input snapshot hashes missing');
    stageCandidate(id,files,{dataset:entry.dataset,pipeline:entry.check.pipeline,input_hashes:inputs});
    const persisted=await persistStagedCandidate(store,id,log);
    if(!persisted.ok)throw Error('Candidate persistence failed: '+persisted.error);
    const candidate={ok:true,staging_id:id,quality_status:'ok',risk:'green',approval_blocked:false,files:files.map(({name,target})=>({name,target}))};
    const event=await store.recordEvent({dataset:entry.dataset,kind:'content',risk:'green',status:'pending',summary:`공개자료 변경 · 관련 산출물 ${files.length}개 재계산·검증`,diff_json:{candidate,result:result.result}});
    if(entry.auto_apply){
      const applied=await applyStagedCandidate({entry,stagingId:id,store,eventId:event.id,actor,log});
      if(applied.persist_error)throw Error(applied.persist_error);
      await store.updateEventStatus(event.id,'applied',actor);
      await store.appendAudit({actor,action:'auto_applied',dataset:entry.dataset,event_id:event.id,detail:`${applied.version}: 원자료+파생 분석 ${files.length}개 반영`});
      event.status='applied';state[entry.dataset].version=applied.version;
    }
    return {outcome:'green',event};
  }catch(error){
    state[entry.dataset]={lastCheckedAt:new Date().toISOString(),lastStatus:'error',error:error.message};
    const event=await store.recordEvent({dataset:entry.dataset,kind:'error',risk:'red',status:'pending',summary:'자동 수집·재분석 실패 · 기존 정상 버전 유지',diff_json:{error:error.message}});
    return {outcome:'error',event};
  }finally{
    // The worker directory is generated under a fixed workspace; never remove user paths.
    const builds=path.resolve(updateCenterHome(),'builds');
    if(path.dirname(path.resolve(work))===builds)fs.rmSync(work,{recursive:true,force:true});
  }
}
