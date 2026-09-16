// Offline checks for the agent's deterministic layer: unified school table, tools, chat routing without an API key.
const assert=require('node:assert/strict');
process.env.AI_EXPLAINER_ENABLED='false';
const table=require('../api/_school_table'),tools=require('../api/_agent_tools'),chat=require('../api/chat');
(async()=>{
 const T=table.build();assert.equal(T.rows.length,917);
 const g=T.byId.get('B000003024');assert.equal(g.name,'인천갈월초등학교');assert(g.students>0&&g.books_per_student>0&&g.zone_walk_mismatch_pct>0&&g.walk_area_m2>0);
 assert(table.dictionary().length<4000,'dictionary must stay small for the prompt');
 for(const c of Object.keys(table.COLUMNS))assert(T.rows.some(r=>r[c]!=null),'empty column '+c);
 const ctx={level:'초등학교',school_id:'B000003024'};
 // ranking + boundaries on the map
 let r=tools.run('query_schools',ctx,{sort_by:'zone_walk_mismatch_pct',order:'desc',limit:10,columns:['zone_outside_walk_pct']});
 assert.equal(r.llm.rows.length,10);assert(r.llm.rows[0].zone_walk_mismatch_pct>=r.llm.rows[9].zone_walk_mismatch_pct);assert(r.visual.geometries.length>=10);assert.equal(r.visual.map.length,10);assert(r.sources.some(s=>/학구도/.test(s.title)));
 // filter + level override + island exclude
 r=tools.run('query_schools',ctx,{level:'중학교',island:'exclude',where:[{column:'class_size',op:'>',value:25}],sort_by:'class_size',order:'desc',limit:5});
 assert(r.llm.rows.every(x=>x.class_size>25));assert(!r.llm.rows.some(x=>/강화|옹진/.test(x.gu)));
 // Every requested variable reaches the visual table (no silent 9-column truncation).
 const many=['students','classes','teachers','class_size','books_total','books_per_student','library_seats','librarians','libraries_walk','nearest_public_library_m'];
 const multi=tools.run('query_schools',ctx,{columns:many,limit:3,island:'exclude'});
 assert.equal(multi.visual.table.headers.length,many.length+2);
 assert(multi.visual.table.rows.every(row=>row.length===many.length+2));
 assert(many.every(c=>Object.hasOwn(multi.llm.rows[0],c)));
 assert.throws(()=>tools.run('query_schools',ctx,{columns:[...many,'nonexistent']}),/알 수 없는 열/);
 // aggregate
 r=tools.run('query_schools',ctx,{aggregate:{by:'gu',column:'students',stat:'sum'}});assert(r.llm.groups.length>=10);assert.equal(r.visual.chart.kind,'bar');
 // profile by id, by ambiguous name resolved with level
 r=tools.run('school_profile',ctx,{school_id:'B000003024'});assert(r.llm.indicators.length>10);assert(r.llm.similar_schools.length);
 r=tools.run('school_profile',ctx,{name:'갈월초'});assert.equal(r.llm.id,'B000003024');
 // correlate / distribution / weighted rank
 r=tools.run('correlate',ctx,{x:'academies_500m',y:'class_size'});assert(r.llm.n>200&&Math.abs(r.llm.spearman_rho)<=1);
 r=tools.run('distribution',ctx,{column:'books_per_student'});assert(r.llm.selected_school.name==='인천갈월초등학교');
 r=tools.run('weighted_rank',ctx,{criteria:[{column:'parks_walk',prefer:'low',weight:2},{column:'students',prefer:'high',weight:1}],limit:5,island:'exclude'});
 assert.equal(r.llm.observations[0].rows.length,5);assert.equal(r.llm.weights[0].share_pct,66.7);assert.equal(r.sections.length,2);assert(!JSON.stringify(r).includes('\"score\"'));assert(!r.visual.table.headers.includes('점수'));
 assert.throws(()=>tools.run('query_schools',ctx,{sort_by:'nonexistent'}),/알 수 없는 열/);
 // upload column joins into the table
 const extra=chat.context({question:'x',level:'초등학교',upload:{name:'t.csv',headers:['학교명','값'],rows:[['인천갈월초등학교',10],['인천신흥초등학교',20],['없는학교',5]],mapping:{type:'school_name',key:0,measure:1,year:null,defaultYear:2026,existing:'schools:students',valueType:'numeric'}}}).extra;
 assert.equal(extra.values.size,2);r=tools.run('query_schools',{level:'초등학교',extra},{sort_by:'upload_value',order:'desc',limit:5});assert.equal(r.llm.rows.length,2);assert(r.sources.some(s=>s.id==='user-upload'));
 // chat routing without a key
 const blocked=await chat.run({question:'학구도랑 도보권이 가장 다른 학교 10개'});assert.equal(blocked.answerable,false);assert.match(blocked.summary,/OPENAI_API_KEY/);
 await assert.rejects(()=>chat.run({question:'공원',school_id:'unknown'}));
 assert(chat.retrieve('도보 출입구 검증').length);
 const opts=await chat.run({action:'upload_options'});assert(opts.upload_options.length>5);
 console.log('PASS agent tools: 917-row table, ranking with boundaries, filters, aggregates, profile, correlation, distribution, weighted rank, upload join, key-less routing');
})().catch(e=>{console.error(e);process.exitCode=1;});
