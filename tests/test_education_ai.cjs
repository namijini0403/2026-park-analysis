const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
process.env.OPENAI_API_KEY='test-do-not-load-local-credentials';
const handler=require('../api/ai-explainer-v2.js');
const evidence=require('../api/_education_evidence.js');
delete process.env.OPENAI_API_KEY;
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_processed/context/education_school_evidence.json'),'utf8'));
global.fetch=async()=>{throw new Error('Unexpected network call');};
async function ask(payload){
  let answer;
  const res={setHeader(){},end(body){answer=JSON.parse(body);}};
  await handler({method:'POST',headers:{},body:payload},res);
  return answer;
}
(async()=>{
  for(const level of ['유치원','중학교','고등학교']){
    const school=Object.values(data).find(r=>r.extended&&r.school_level===level);
    const payload={mode:'identified_school_explainer',question:'이 학교 공원 환경 격차와 한계를 설명해줘',question_type:'school_explanation',school_context:{school_id:school.school_id,case_type:'case4',iso_park_count:99999}};
    const answer=await ask(payload);
    assert.equal(answer.answerable,true);
    assert(answer.evidence.every(r=>r.source_chunk_id.startsWith(`education#${school.school_id}-`)));
    assert(!JSON.stringify(answer).includes('99999'));
    assert(JSON.stringify(answer).includes(level));
    const performance=await ask({...payload,question:'수능 성적과 학업성취도를 알려줘'});
    assert.match(JSON.stringify(performance),/미확보|미수집/);
  }
  const elementary=Object.values(data).find(r=>r.school_level==='초등학교'&&r.academy.straight_500m_count>0);
  const academy=await ask({mode:'identified_school_explainer',question:'주변 학원은 몇 개야?',school_context:{school_id:elementary.school_id,academy_count:99999}});
  assert.equal(academy.answerable,true);
  assert.match(JSON.stringify(academy),new RegExp(`500m ${elementary.academy.straight_500m_count}개`));
  const unknown=await ask({mode:'identified_school_explainer',question:'공원 환경 분석',school_context:{school_id:'../unknown',school_level:'중학교'}});
  assert.equal(unknown.answerable,false);
  const middle=Object.values(data).find(r=>r.school_level==='중학교');
  for(const question of ['PAPS 체력 비율을 알려줘','방과후 프로그램 수를 알려줘']) {
    const answer=await ask({mode:'identified_school_explainer',question,school_context:{school_id:middle.school_id}});
    assert.equal(answer.answerable,true);
    assert.match(JSON.stringify(answer),/2026년 공시/);
    assert.match(JSON.stringify(answer),/전교생 비율이 아니다/);
  }
  let captured;
  process.env.OPENAI_API_KEY='test-key';
  global.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');captured=JSON.parse(options.body);return {ok:false};};
  await ask({mode:'identified_school_explainer',question:'현재 공원 분류를 설명해줘',school_context:{school_id:middle.school_id,school_name:'forged-school',case_type:'case4',iso_green_ratio:99999},candidate_context:{grid_id:'forged-candidate'}});
  const sent=JSON.parse(captured.input.find(r=>r.role==='user').content);
  assert.equal(sent.selected_context.school_context.school_name,middle.school_name);
  assert.equal(sent.selected_context.candidate_context,null);
  assert.equal(sent.selected_context.resolved_school_case,null);
  assert(!JSON.stringify(sent).includes('forged'));
  assert(sent.retrieved_chunks.every(r=>JSON.stringify(r).includes(`education#${middle.school_id}-`)));
  assert.equal(evidence.resolve({school_id:'missing',school_name:middle.school_name}),null);
  console.log('Education AI passed: three levels, academy grounding, missing performance, unknown IDs, forged client facts, exclusive server evidence.');
})().catch(error=>{console.error(error);process.exitCode=1;});
