import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import worker from '../education/python_worker.cjs';
import {applyRoot} from './paths.mjs';
import {buildStagedCandidate} from './candidate.mjs';

const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
export async function checkSchoolZones(entry,state,store,{actor='scheduler',collect=()=>worker('fetch_school_zones.py',null,{timeout:600000})}={},log=()=>{}){
  try{
    const data=await collect();
    if(data.type!=='FeatureCollection'||!data.features?.length)throw Error('학구도 경계 누락');
    const text=JSON.stringify(data),digest=hash(text);
    const current=path.join(applyRoot(),entry.local_file);
    const previous=fs.existsSync(current)?JSON.parse(fs.readFileSync(current,'utf8')):null;
    const currentHash=previous?hash(JSON.stringify(previous)):null;
    state[entry.dataset]={contentHash:digest,lastCheckedAt:new Date().toISOString(),lastStatus:'ok'};
    if(digest===currentHash)return {outcome:'unchanged'};
    // Do not duplicate a pending revision; retry a failed automatic application on next scan.
    const prior=await store.getMeta('school_zones_pending');
    if(prior?.hash===digest){const event=await store.getEvent(prior.event_id);if(event?.status==='pending')return {outcome:event.risk,event};}
    const stagingId='zones_'+Date.now();
    const candidate=await buildStagedCandidate({entry,rawText:text,stagingId,store,passthrough:true,fetchMeta:data.metadata,log});
    candidate.ok=true;
    const oldCount=previous?.features?.length||0;
    const changeRatio=oldCount?Math.abs(data.features.length-oldCount)/oldCount:1;
    const schema=doc=>[...new Set(doc.features.flatMap(f=>Object.keys(f.properties||{})))].sort().join('|');
    const schemaChanged=previous&&schema(previous)!==schema(data);
    const latest=doc=>doc.features.map(f=>f.properties.reference_date).sort().at(-1);
    const regressed=previous&&latest(data)<latest(previous);
    const risk=candidate.risk==='red'||regressed?'red':(changeRatio>.2||schemaChanged||candidate.risk!=='green')?'yellow':'green';
    const event=await store.recordEvent({dataset:entry.dataset,kind:'content',risk,status:'pending',summary:`공식 학구도 ${oldCount} → ${data.features.length}구역 · 정규화 결과 변경`,diff_json:{candidate,old_count:oldCount,new_count:data.features.length,change_ratio:changeRatio,schema_changed:Boolean(schemaChanged),content_hash:digest}});
    await store.setMeta('school_zones_pending',{hash:digest,event_id:event.id});
    await store.appendAudit({actor,action:'school_zones_collected',dataset:entry.dataset,event_id:event.id,detail:event.summary});
    return {outcome:risk,event};
  }catch(error){
    state[entry.dataset]={...state[entry.dataset],lastCheckedAt:new Date().toISOString(),lastStatus:'error',error:error.message};
    const event=await store.recordEvent({dataset:entry.dataset,kind:'error',risk:'red',status:'pending',summary:'학구도 수집 실패 · 기존 버전 유지',diff_json:{error:error.message}});
    return {outcome:'error',event};
  }
}
