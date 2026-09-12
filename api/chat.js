const fs=require('node:fs'),path=require('node:path');
const schoolModel=require('./_school_summary.js');
const explainer=require('./ai-explainer-v2.js');
const analysis=require('./analysis.js');
const education=require('./_education_evidence.js');
const context=require('./_context_evidence.js');
const visuals=require('./_chat_visuals');
const dataAnswers=require('./_data_answers');
const comparative=require('./_comparative_evidence');
const joined=require('./_joined_analysis'),population=require('./_population_answers');
const questionIntent=require('./_question_intent');
const relative=require('./_relative_position');
const GUIDE='rag/policy-guide.md';
function chunks(){return [GUIDE,'rag/analysis-guide.md'].flatMap(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8').split(/^### /m).slice(1).map(part=>{const lines=part.trim().split('\n'),m=lines.shift().match(/^\[chunk: ([^\]]+)\]\s*(.*)/);return {id:m[1],title:m[2],source:file,tags:lines.shift().replace(/^tags: /,'').split(', '),body:lines.join('\n').trim()};}));}
function retrieve(q){const query=q+(/서비스|사용법|뭐 하는|어떻게 쓰|어떻게 사용/.test(q)?' 목적 사용법':'');return chunks().map(c=>({...c,score:c.tags.reduce((n,t)=>n+(query.toLowerCase().includes(t.toLowerCase())?2:0),0)})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,3);}
const block=message=>({answerable:false,summary:message,evidence:[],sources:[],mode:'blocked'});
function scope(payload,q){
 if(questionIntent.allScope(q)||/학교급별/.test(q))return null;
 const named=schoolModel.registry().filter(s=>q.includes(s.name)||s.name.replace(/^인천/,'').length>4&&s.name.replace(/^인천/,'')!==s.level&&q.includes(s.name.replace(/^인천/,'')));
 if(named.length>1)throw Error('학교별 질문은 한 학교씩 확인해 주세요.');
 if(!named.length&&payload.scope==='all')return null;
 const id=named[0]?.id||payload.school_id||payload.school_context?.school_id;
 if(id&&!schoolModel.registry().some(s=>s.id===id))throw Error('선택 학교를 확인할 수 없습니다. 학교를 다시 골라 주세요.');
 return id;
}
async function answer(payload){
 if(payload.upload?.kind==='document'){const q=String(payload.question||'').trim();if(!q||q.length>500)throw Error('질문은 1~500자로 입력해 주세요.');if(payload.action==='hitl_plan')return {workflow:'direct',summary:'첨부 문서의 질문 관련 근거를 확인합니다.',context:{school_id:payload.school_id||null,level:payload.level||'초등학교'}};return require('./_document_evidence').run(q,payload.upload);}
 if(String(payload.action||'').startsWith('studio_'))return require('./_policy_studio').handle(payload);
 if(payload.action==='hitl_plan')return require('./_hitl_analysis').plan(payload);
 if(payload.action==='hitl_options')return require('./_hitl_analysis').factorOptions(payload);
 if(payload.action==='hitl_run')return require('./_hitl_analysis').run(payload);
 if(payload.action==='hitl_overlap')return require('./_boundary_comparison').run(require('./_hitl_analysis').context(payload),payload.criterion);
 if(payload.action==='hitl_ordered')return require('./_ordered_observations').run(payload);
 if(payload.action==='upload_options')return {upload_options:joined.options()};
 const q=String(payload.question||'').trim();if(!q||q.length>500)throw Error('질문은 1~500자로 입력해 주세요.');
 // Single-indicator ranks (no weights) are answered directly; only composite scores and recommendations stay guarded below.
 // A school-scoped question also gets the peer comparison below; the position sections are merged into it.
 const position=payload.upload?null:relative.run(q,{...payload,school_id:payload.scope==='all'?null:(payload.school_id||payload.school_context?.school_id||null)});
 const workflow=questionIntent.resolve(q,payload.dataset_id).workflow;
 if(position&&(!position.school_id||workflow==='ordered'))return position;
 if(questionIntent.spatial(q))return require('./_boundary_comparison').run(require('./_hitl_analysis').context(payload),payload.criterion);
 if(workflow==='ordered')return require('./_ordered_observations').run(payload);
 const roster=!payload.upload&&!/확산|시뮬레이션|근거|지원|비교|분석|대비/.test(q)&&visuals.designation(q);if(roster)return roster;
 const id=scope(payload,q),kind=Object.hasOwn(schoolModel.labels,payload.kind)?payload.kind:'park';
 const sourceChunks=retrieve(q);let rows=null,calculation=null;
 if(!payload.upload&&/수능|의대|학업성취|학력\s*수준/.test(q))return block('그 성과를 설명할 학교별 공개 수치를 확보하지 못했습니다. 다른 지표로 대신 판단하지 않습니다.');
 if(/최우선|종합\s*점수|추천|가중치/.test(q)||(/순위|랭킹|1등|일등/.test(q)&&!relative.detect(q).length)){
  const guard=chunks().find(c=>c.id==='policy#verification');
  return {answerable:true,mode:'evidence',summary:'현재 검증 근거로는 종합 지원 순위나 하나의 우선안을 정할 수 없습니다. 단일 지표의 학교별 위치는 지표 이름을 넣어 질문하면(예: 학생당 장서가 적은 학교) 확인할 수 있습니다. 이용·안전·실행·출입구 경로는 별도로 확인해야 합니다.',evidence:[{claim:guard.body,source_chunk_id:guard.id}],sources:[guard],school_id:id||null};
 }
 if(payload.upload)return joined.run(q,{...payload,school_id:id,scope:id?'school':'all'});
 const totals=population.run(q,{...payload,school_id:id});if(totals)return totals;
 const comparison=comparative.run(q,{...payload,school_id:id});
 if(comparison&&position){comparison.visual.sections.unshift(...position.visual.sections);comparison.summary=position.summary+'\n\n'+comparison.summary;for(const s of position.sources)if(!comparison.sources.some(x=>x.source===s.source))comparison.sources.push(s);comparison.relative=position.relative;return comparison;}
 if(comparison)return comparison;if(position)return position;
 const datasetRequest=payload.dataset_id||(!/확인 조건|판단|왜|검증 방법/.test(q)&&/분석|해석|시사점|비교|그래프|차트|상관|관계|평균|중앙값|몇 개|얼마|자료|목록|보여|시각|통계|현황|분포|지도|예측|전망|시나리오|인구|장학금|발명|수상|운동부|진학|공동교육/.test(q));
 const candidateData=datasetRequest&&!/학원.*밀집|학원가|확산|중단|폐쇄/.test(q)?dataAnswers.run(q,{...payload,school_id:id}):null;
 if(candidateData&&(!/상관|보정|지니|불평등|분포|차이|공간|추세|증감/.test(q)||!['schools','academies'].includes(candidateData.query?.dataset_id)))return candidateData;
 const variableCount=[/학생|원아/,/학급/,/교사|교원/,/공원|녹지/,/학원/,/도서관|장서/,/체력|PAPS/i,/방과후/,/동아리/].filter(re=>re.test(q)).length;
 if((/상관|보정|지니|불평등|추세|증감|분포|차이|공간|집중/.test(q)||(/관계|관련|연관/.test(q)&&variableCount>=2&&!/관련\s*(자료|시설)/.test(q)))&&variableCount>0){
  const s=id?schoolModel.registry().find(s=>s.id===id):null;
  const d=analysis.dataset();const plan=analysis.localPlan(q,{level:s?.level||payload.level||'초등학교',school_id:id},d);
  if(plan.method!=='trend')plan.school_id=null;
  if(!['relationship','difference','inequality','trend','spatial'].includes(plan.method))throw Error('계산할 변수 두 개와 범위를 적어 주세요. 예: 초등학교 학생 수와 공원 수의 상관관계');
  calculation=await analysis.run({question:q,plan});
  const c={id:'calculation#'+calculation.analysis_id,title:'질문 조건으로 계산한 결과',source:'api/_analysis_engine.js',tags:[],body:JSON.stringify({summary:calculation.summary,metrics:calculation.metrics,limitations:calculation.limitations,plan:calculation.plan})};
  return {answerable:true,mode:'calculation',summary:calculation.summary,evidence:[{claim:calculation.summary,source_chunk_id:c.id}],sources:[c,...sourceChunks],calculation,school_id:id||null};
 }
 const resourceMethod=/학원.*밀집|학원가/.test(q)?'academy_clusters':/확산/.test(q)?'network':/중단|폐쇄|도로.*대체/.test(q)?'resilience':null;
 if(resourceMethod){const plan={method:resourceMethod,level:payload.level||'초등학교',gu:'전체',year:2026};const calculation=await analysis.run({question:q,plan});if(calculation.chart?.kind==='bars')calculation.chart={kind:'bar',unit:'곳',points:calculation.chart.groups};return {answerable:true,mode:'calculation',summary:calculation.summary,calculation,sources:[{id:'analysis#'+resourceMethod,title:'사전 계산 분석',source:calculation.download?.replace('./',''),body:JSON.stringify({metrics:calculation.metrics,limitations:calculation.limitations,source_hashes:calculation.source_hashes})}]};}
 const schoolQuestion=/이 학교|선택|사실|조건|방법|시설|정리|자료|학생|원아|공원|녹지|도서관|장서|사서|운동|체육|돌봄|미래|예측|전망|학원|공사|유흥|지정|유사|KNN|knn|도보|보행|출입|경로|재개발|아파트/.test(q);
 if(id&&schoolQuestion){
  const chosen=/장서|사서/.test(q)?'books':/도서관|독서/.test(q)?'library':/돌봄/.test(q)?'welfare':/운동|체육/.test(q)?'sports':/공원|녹지/.test(q)?'park':kind;
  rows=schoolModel.summary(id,chosen);
  sourceChunks.unshift({id:'school#'+id,title:rows.school.name+' · '+rows.label,source:rows.sources[0].path,tags:[],body:rows.facts.map(f=>`${f.label}: ${f.value} (${f.note})`).join('\n')+'\n확인 조건: '+rows.conditions.join(' ')+'\n검토 방법(우선순위 아님): '+rows.options.map(o=>o.name+' — '+o.condition).join('; '),provenance:rows.sources});
  if(/미래|예측|전망|학원|체력|방과후|동아리|PAPS|연도|20\d{2}|지정|공사|유흥|유사|knn|도보|보행|출입|경로|재개발|아파트/i.test(q)){
   const resolved=education.resolve({school_id:id});
   if(resolved)sourceChunks.unshift(...education.build(resolved,q).filter(c=>!/-candidate$|-current$/.test(c.id)).slice(0,2).map(c=>({...c,provenance:[{path:'data_processed/context/education_school_evidence.json',row:id,sha256:schoolModel.read('data_processed/context/education_school_evidence.json').hash}]})));
   if(context.isContextTopicQuestion(q)){const c=context.buildSchoolContextChunk({school_id:id},q);if(c)sourceChunks.unshift(c);}
  }
 }else if(!id&&/이 학교|선택 학교/.test(q))return block('먼저 학교를 선택해 주세요. 선택하지 않은 학교의 수치는 추정하지 않습니다.');
 if(!sourceChunks.length)return block('이 질문에 답할 근거를 찾지 못했습니다. 학교·자원 이름이나 확인하려는 항목을 구체적으로 적어 주세요.');
 const pack=sourceChunks.slice(0,5);
 const answer=await explainer.answerEvidence(q,pack);
 return {...answer,sources:pack,rows,school_id:id||null};
}
async function run(payload){const answerResult=await answer(payload);if(answerResult.mode==='dataset'&&/해석|분석|정책|의미|시사점/.test(payload.question||'')){const source={id:'dataset#interpretation',title:answerResult.visual.title,source:answerResult.sources[0].source,body:JSON.stringify({observations:answerResult.summary,scope:answerResult.query,chart:answerResult.visual.chart,notes:answerResult.visual.notes}).slice(0,6500)};const interpreted=await explainer.answerEvidence(payload.question,[source]);if(interpreted.mode==='generated'){answerResult.summary+='\n\n'+interpreted.summary;answerResult.evidence=interpreted.evidence;answerResult.sources.push(source);}}return require('./_source_provenance').enrich(require('./_collection_plan').enrich(visuals.enrich(answerResult,answerResult.school_id,String(payload.question||'')),payload));}
module.exports=async(req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify(block('POST 요청만 지원합니다.')));return;}try{res.end(JSON.stringify(req.body?.action==='studio_review'?await require('./_policy_studio').handle(req.body,req.headers?.['x-update-center-token']):await run(req.body||{})));}catch(e){res.statusCode=400;res.end(JSON.stringify(block(e.message)));}};
module.exports.run=run;module.exports.retrieve=retrieve;
