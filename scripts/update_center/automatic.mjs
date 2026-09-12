import {applyStagedCandidate} from './apply.mjs';
// Explicit per-source opt-in. Derived/policy tables remain reviewable candidates.
export async function autoApplyEvents(events,sources,store,{apply=applyStagedCandidate,log=()=>{}}={}){
  const results=[];
  for(const event of events){
    const entry=sources.find(s=>s.dataset===event.dataset),candidate=event.diff_json?.candidate;
    if(!entry?.auto_apply||entry.never_auto_apply||entry.rebuild_command||event.risk!=='green'||event.kind!=='content'||event.status!=='pending'||!candidate?.ok||candidate.approval_blocked||candidate.quality_status!=='ok')continue;
    try{
      const result=await apply({entry,stagingId:candidate.staging_id,store,eventId:event.id,actor:'scheduler-auto',confirm:false,log});
      await store.updateEventStatus(event.id,'applied','scheduler-auto');
      await store.appendAudit({actor:'scheduler-auto',action:'auto_applied',dataset:event.dataset,event_id:event.id,detail:`품질 검사 통과 · ${result.version}`});
      results.push({dataset:event.dataset,ok:true,version:result.version});
    }catch(error){results.push({dataset:event.dataset,ok:false,error:error.message});await store.appendAudit({actor:'scheduler-auto',action:'auto_apply_failed',dataset:event.dataset,event_id:event.id,detail:error.message});}
  }
  return results;
}
