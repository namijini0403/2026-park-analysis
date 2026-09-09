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
  const high=Object.values(data).find(r=>r.school_level==='고등학교'&&r.progression.observations.length===2);
  const progressionAnswer=await ask({mode:'identified_school_explainer',question:'2025년 졸업 후 진학률을 알려줘',school_context:{school_id:high.school_id}});
  assert.equal(progressionAnswer.answerable,true);
  assert(progressionAnswer.evidence.every(r=>r.source_chunk_id===`education#${high.school_id}-performance`));
  const progression2025=evidence.build(high,'2025년 졸업 후 진학률')[0].body;
  assert(progression2025.includes('"year":2025'));
  assert(!progression2025.includes('"year":2026'));
  const progression2026=evidence.build(high,'2026년 졸업 후 취업 현황')[0].body;
  assert(progression2026.includes('progression_pending_publication'));
  assert(progression2026.includes('"employed":null'));
  const before=JSON.stringify(middle);
  const apartment=evidence.build(middle,'주변 아파트는 몇 개야?')[0].body;
  assert(apartment.includes(JSON.stringify(middle.context.large_apartment)));
  assert(!apartment.includes('"construction"'));
  assert(!apartment.includes('"library"'));
  assert(!apartment.includes('지정사업:'));
  const combined=evidence.build(middle,'아파트와 도서관, 공사 상황을 알려줘')[0].body;
  for(const key of ['large_apartment','library','construction']) assert(combined.includes(`"${key}"`));
  assert(combined.includes('현재 공사 여부가 아니다'));
  assert(combined.includes('내부 도서관 미공시는 0권이 아니다'));
  const current=evidence.build(middle,'현재 학교 주변 연령 인구 알려줘')[0].body;
  assert(current.includes(JSON.stringify(middle.current_age_demand)));
  assert(!current.includes('학교 이력·지원 예측:'));
  assert(!current.includes('지역 연령 예측:'));
  const future=evidence.build(middle,'2028년 학생수 예측을 알려줘')[0].body;
  const forecast=middle.enrollment.forecast.find(r=>r.year===2028);
  assert(forecast);
  assert(future.includes(JSON.stringify(forecast)));
  assert(!future.includes('"year":2027'));
  assert(!future.includes('"year":2029'));
  const range=evidence.build(middle,'2027년부터 2029년 학생수 예측')[0].body;
  for(const year of [2027,2028,2029]) assert(range.includes(`"year":${year}`));
  const unavailable=evidence.build(middle,'2035년 학생수 예측')[0].body;
  assert(unavailable.includes('외삽하지 않는다'));
  assert(!unavailable.includes('"year":2035'));
  assert.equal(JSON.stringify(middle),before,'Question projection must not mutate authoritative evidence');
  const inventor=Object.values(data).find(r=>r.awards.some(a=>a.event.includes('발명품')));
  const inventionChunks=evidence.build(inventor,'발명대회 결과를 알려줘');
  assert(inventionChunks.some(c=>c.body.includes(inventor.awards.find(a=>a.event.includes('발명품')).work_title)));
  const multiYear=Object.values(data).find(r=>r.awards.some(a=>a.year===2026&&a.event.includes('발명'))&&r.awards.some(a=>a.year===2024&&a.event.includes('발명')));
  assert(multiYear);
  const historicAwards=evidence.build(multiYear,'2024년 발명대회 수상 결과')[0].body;
  assert(historicAwards.includes('"year":2024'));
  assert(!historicAwards.includes('"year":2026'));
  assert(!historicAwards.includes('"year":2025'));
  const missingAwards=evidence.build(multiYear,'2035년 발명대회 수상 결과')[0].body;
  assert(missingAwards.includes('확인 기록 0건'));
  assert(missingAwards.includes('수상 없음이라는 뜻이 아니다'));
  assert(!missingAwards.includes('"year":'));
  const combinedAwards=evidence.build({...multiYear,awards:[
    {event:'전국학생과학발명품경진대회',year:2024,work_title:'발명 예시'},
    {event:'전국과학전람회',year:2025,work_title:'전람회 예시'},
    {event:'전국과학전람회',year:2026,work_title:'범위 밖 예시'}
  ]},'2024~2025년 발명과 과학전람회 수상을 함께 알려줘')[0].body;
  assert(combinedAwards.includes('발명 예시'));
  assert(combinedAwards.includes('전람회 예시'));
  assert(!combinedAwards.includes('범위 밖 예시'));
  assert(combinedAwards.includes('학교단체상과 학생 작품 수상은 별도'));
  const inventionAnswer=await ask({mode:'identified_school_explainer',question:'발명대회 결과를 알려줘',school_context:{school_id:inventor.school_id}});
  assert.equal(inventionAnswer.answerable,true);
  assert(inventionAnswer.evidence.every(r=>r.source_chunk_id===`education#${inventor.school_id}-performance`));
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
