'use strict';
// /api/chat — LLM tool-using agent over the unified school table (see _agent.js, _agent_tools.js, _school_table.js).
const schoolModel=require('./_school_summary'),agent=require('./_agent'),joined=require('./_joined_analysis'),guide=require('./_guide_chunks');
const block=message=>({answerable:false,summary:message,evidence:[],sources:[],mode:'blocked'});
const normalize=v=>String(v??'').trim().replace(/\s+/g,'');
// Attach an uploaded table column to the school table for this request (join by school id / name).
function extra(upload){
 if(!upload||upload.kind==='document'||!Array.isArray(upload.headers))return null;
 const m=joined.validate(upload);if(m.type==='district')return null;
 const registry=schoolModel.registry(),byId=new Map(registry.map(s=>[s.id,s])),byName=new Map();
 for(const s of registry)for(const n of new Set([s.name,s.name.replace(/^인천/,'')])){const k=normalize(n);if(k===s.level)continue;byName.set(k,[...(byName.get(k)||[]),s]);}
 const values=new Map(),dup=new Set();
 for(const r of upload.rows){const key=normalize(r[m.key]);const hits=m.type==='school_id'?(byId.has(key)?[byId.get(key)]:[]):(byName.get(key)||[]);if(hits.length!==1)continue;const v=joined.numeric(r[m.measure]);if(v==null)continue;if(values.has(hits[0].id))dup.add(hits[0].id);values.set(hits[0].id,v);}
 for(const id of dup)values.delete(id);
 if(!values.size)throw Error('첨부 표의 학교를 원장과 연결하지 못했습니다. 학교명·학교 ID 열을 확인해 주세요.');
 return {column:'upload_value',label:String(upload.headers[m.measure]).slice(0,60),unit:'',name:upload.name,values};
}
function context(p){
 const q=String(p.question||'').trim();
 const school=p.scope==='all'?null:schoolModel.registry().find(s=>s.id===(p.school_id||p.school_context?.school_id));
 if(p.school_id&&p.scope!=='all'&&!school)throw Error('선택 학교를 확인할 수 없습니다. 학교를 다시 골라 주세요.');
 const level=school?.level||(['초등학교','중학교','고등학교','유치원','전체'].includes(p.level)?p.level:'초등학교');
 return {question:q,level,school_id:school?.id||null,school_name:school?.name||null,extra:extra(p.upload)};
}
async function run(p){
 if(p.action==='upload_options')return {upload_options:joined.options()};
 if(String(p.action||'').startsWith('studio_'))return require('./_policy_studio').handle(p);
 const q=String(p.question||'').trim();if(!q||q.length>500)throw Error('질문은 1~500자로 입력해 주세요.');
 const selected=Array.isArray(p.selected_variables)?p.selected_variables.slice(0,8).map(v=>String(v).slice(0,200)):[];
 const analysisQuestion=selected.length?q+' — 함께 분석할 변수·확인 조건: '+selected.join(', '):q;
 if(p.action!=='plan_variables'&&p.upload?.kind==='document')return require('./_document_evidence').run(analysisQuestion,p.upload);
 const ctx=context(p);
 if(!process.env.OPENAI_API_KEY||process.env.AI_EXPLAINER_ENABLED==='false')return block('AI 분석 키가 설정되지 않아 질문에 답할 수 없습니다. 관리자에게 OPENAI_API_KEY 설정을 요청해 주세요.');
 if(p.action==='plan_variables'){if(p.upload?.kind==='document')ctx.document=require('./_document_evidence').select(q,p.upload).map(s=>({title:s.title,text:s.body.slice(0,800)}));return agent.plan(ctx,q,Array.isArray(p.history)?p.history:[]);}
 const result=p.action==='reweight'?await agent.reweight(ctx,q,p.criteria||[],{level:p.rank_level||ctx.level,gu:p.rank_gu||null,island:p.rank_island||null,limit:p.limit}):await agent.answer(ctx,analysisQuestion,Array.isArray(p.history)?p.history:[]);
 return require('./_source_provenance').enrich(require('./_collection_plan').enrich(result,{...p,action:undefined}));
}
module.exports=async(req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify(block('POST 요청만 지원합니다.')));return;}try{res.end(JSON.stringify(req.body?.action==='studio_review'?await require('./_policy_studio').handle(req.body,req.headers?.['x-update-center-token']):await run(req.body||{})));}catch(e){res.statusCode=400;res.end(JSON.stringify(block(e.message)));}};
module.exports.run=run;module.exports.retrieve=guide.retrieve;module.exports.context=context;
