'use strict';
const assert=require('node:assert/strict'),agent=require('../api/_agent'),table=require('../api/_school_table');
const original=global.fetch;
// The model omits demand entirely and fills its candidate budget: deterministic additions must survive.
const modelColumns=['books_total','books_per_student','library_seats','librarians','libraries_walk','nearest_public_library_m','classes','teachers'];
global.fetch=async()=>({ok:true,text:async()=>JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'지원 여건을 확인합니다.',variables:modelColumns.map(column=>({column,why:'여건 확인'})),data_requests:[]})}]}]})});
(async()=>{
 try{
  for(const level of ['유치원','초등학교','중학교','고등학교','전체']){
   for(const question of ['학교 도서관 지원 대상 찾아줘','교육 예산을 배분할 학교를 검토해줘','돌봄 시설 확충이 필요한 곳을 찾아줘']){
    const result=await agent.plan({level},question),ids=result.variables.map(v=>v.column);
    assert.deepEqual(ids.slice(0,3),['students','forecast_2029','forecast_2031']);
    assert.equal(new Set(ids).size,ids.length);assert(ids.length<=8);
    assert(result.variables.every(v=>!Object.hasOwn(v,'selected')&&!Object.hasOwn(v,'required')),'candidate is not forced selection');
    assert.match(result.variables[1].why,/미확인.*보류/);
   }
  }
  const simple=await agent.plan({level:'초등학교'},'학교도서관 장서 수를 알려줘');
  assert(!simple.variables.some(v=>v.column==='forecast_2029'),'plain lookup does not require forecasts');
  const followup=await agent.plan({level:'초등학교'},'그럼 5곳만',[{q:'학교 도서관 지원 대상 찾아줘',a:'지원 여건 확인'}]);
  assert.deepEqual(followup.variables.slice(0,3).map(v=>v.column),['students','forecast_2029','forecast_2031']);
  assert.match(table.COLUMNS.forecast_2029.label,/3년 뒤.*2029/);
  assert.match(table.COLUMNS.forecast_2031.label,/5년 뒤.*2031/);
  assert.equal(table.COLUMNS.forecast_2029.kind,'forecast');
  assert.equal(table.COLUMNS.forecast_2031.kind,'forecast');
  const tools=require('../api/_agent_tools'),row=table.build().rows[0],saved={...row};
  try{
   Object.assign(row,{forecast_status:'limited_history_constant_scenario',forecast_origin_year:2025,forecast_model_version:'test-scenario',forecast_limitations:'최근 학생 수 유지 참고 시나리오. 검증 완료 모형이 아님.',forecast_2029:123,forecast_2031:null});
   const evidence=tools.run('query_schools',{level:row.level},{school_ids:[row.id],columns:['forecast_2029','forecast_2031']});
   assert.equal(evidence.llm.rows[0].forecast_2031,null,'unavailable forecast stays unknown');
   assert.equal(evidence.llm.rows[0].forecast_evidence.origin_year,2025);
   assert.equal(evidence.llm.rows[0].forecast_evidence.status,'limited_history_constant_scenario');
   assert(evidence.visual.notes.some(n=>n.includes(row.name)&&n.includes('2025년 관측 기준')&&n.includes('시나리오')));
   const weighted=tools.run('weighted_rank',{level:row.level},{school_ids:[row.id],criteria:[{column:'forecast_2029',prefer:'high',weight:1}],limit:1});
   assert.equal(weighted.llm.observations[0].rows[0].forecast_evidence.status,'limited_history_constant_scenario');
   assert(weighted.sections[0].notes.some(n=>n.includes(row.name)&&n.includes('시나리오')));
  }finally{Object.assign(row,saved);}
  console.log('PASS support demand candidates: all levels, 8-item cap, optional choice, missing caveat, simple lookup');
 }finally{global.fetch=original;}
})().catch(e=>{console.error(e);process.exitCode=1;});
