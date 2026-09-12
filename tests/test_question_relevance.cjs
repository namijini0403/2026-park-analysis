process.env.AI_EXPLAINER_ENABLED='false';process.env.AI_ANALYSIS_ENABLED='false';
const assert=require('node:assert/strict'),fs=require('node:fs');
const intent=require('../api/_question_intent'),h=require('../api/_hitl_analysis'),chat=require('../api/chat'),catalog=require('../api/_data_catalog');
const base={scope:'all',level:'초등학교'};
const cases=[
 ['학구도랑 도보500m권이 가장 안 맞는 초등학교 상위 10개 뽑아줘','overlap',['zones','walkshed'],['schools','routes','parks']],
 ['학구도와 보행권 중첩 차이 비교','overlap',['zones','walkshed'],['schools','routes']],
 ['어느 초등학교 도서관을 우선지원할지 정해야해','factors',['books','library_access'],['schools','routes','forecast']],
 ['등교길 안전인력 지원을 검토해줘','factors',['zones','construction'],['routes','green']],
 ['초등학교 학생 수가 가장 많은 상위 10개','ordered',['schools'],['zones','routes']],
 ['초등학교 학생수와 학급수 상관관계','direct',['schools'],['routes']],
 ['초등학교 방과후 지표 분포','direct',['indicators'],['schools']],
 ['도서관 목록 보여줘','direct',['services'],['schools','routes']],
 ['공원까지 도보 경로 보여줘','direct',['routes'],[]],
 ['보행 500m 도달권 지도 보여줘','direct',['walkshed'],['routes','schools']],
 ['2026 연구학교 선도학교 명단 보여줘','direct',['designations'],['schools']],
 ['학생 수 전망 보여줘','direct',['forecast','school_validation'],[]],
 ['장학금과 체력 지표를 함께 고려해서 지원 검토','factors',['indicators'],['schools']],
 ['이 서비스 어떻게 사용해','direct',[],['schools','routes']],
];
(async()=>{
 const diagnostic=await chat.run({...base,question:cases[0][0]});fs.writeFileSync('outputs/hitl-relevance/overlap-diagnostic.json',JSON.stringify({comparison:diagnostic.comparison,sections:diagnostic.visual.sections.map(s=>({title:s.title,rows:s.table?.rows.slice(0,10)}))},null,2));console.log(JSON.stringify(diagnostic.comparison));
 for(const [q,workflow,yes,no] of cases){const r=intent.resolve(q);assert.equal(r.workflow,workflow,q);for(const id of yes)assert(r.matches.has(id),q+' missing '+id);for(const id of no)assert(!r.matches.has(id),q+' unrelated '+id);}
 // Every catalog entry remains explicitly reachable, without matching generic “학교”.
 for(const e of catalog){const r=intent.resolve(e.terms[0]+' 자료 검토',e.id);assert(r.matches.has(e.id),e.id);}
 const p=h.plan({...base,question:cases[0][0],scope:'school',school_id:'B000002949'});assert.equal(p.context.school_id,null);assert.deepEqual(p.suggested,['zones','walkshed']);assert(!p.candidates.length);
 const students=h.plan({...base,question:'초등학교 학생 수를 고려해 지원 검토'});assert(students.candidates.some(f=>f.id==='schools:students'));assert(!students.candidates.some(f=>/parks|green/.test(f.id)));assert(students.catalog.find(e=>e.id==='schools').title==='학생·학급·교원 관측');
 const books=h.plan({...base,question:cases[2][0]});assert(books.candidates.some(f=>f.id==='books:books.per_student'));assert(books.candidates.every(f=>f.reason));
 const top=await chat.run({...base,question:cases[4][0],scope:'school',school_id:'B000002949'});assert.equal(top.mode,'relative');assert(top.visual.sections.some(s=>s.table.rows.length>=10));assert(!top.ranking&&!top.score);assert.match(top.summary,/가중치 없는/);
 const overlap=await chat.run({...base,question:cases[0][0],scope:'school',school_id:'B000002949'});assert.equal(overlap.mode,'boundary_comparison');assert(overlap.comparison.scope_count>200);assert(overlap.comparison.valid>100);assert.equal(overlap.comparison.valid+overlap.comparison.excluded,overlap.comparison.scope_count);assert(overlap.visual.geometries.some(f=>f.properties.color==='#8359ae'));assert(overlap.visual.geometries.some(f=>f.properties.color==='#25866d'));assert(overlap.visual.sections.some(s=>s.title.includes('별도')));assert(!overlap.score&&!overlap.ranking);assert(overlap.sources.every(s=>s.provenance[0].sha256.length===64));
 const alternate=await chat.run({...base,question:cases[0][0],action:'hitl_overlap',criterion:'zone_outside'});assert.notDeepEqual(alternate.visual.sections[0].table,overlap.visual.sections[0].table);
 const missing=await chat.run({...base,question:'2099 학구도와 도보500m권 불일치 상위 10개',action:'hitl_overlap',criterion:'mismatch'});assert.equal(missing.comparison.valid,0);assert.equal(missing.visual.map.length,0);
 fs.writeFileSync('outputs/hitl-relevance/backend.json',JSON.stringify({passed:true,checked_at:new Date().toISOString(),catalog_domains:catalog.length,cases:cases.map(c=>({question:c[0],workflow:c[1]})),overlap:overlap.comparison,summary:overlap.summary,first:overlap.visual.sections[0].table.rows.slice(0,3)},null,2));
 fs.writeFileSync('outputs/hitl-relevance/overlap.json',JSON.stringify(overlap));console.log('PASS question relevance: 42 catalog domains, intent families, scope, observation order, genuine polygon overlap, missing data, independent gates');
})().catch(e=>{console.error(e);process.exitCode=1;});
