process.env.AI_EXPLAINER_ENABLED='false';process.env.AI_ANALYSIS_ENABLED='false';
const assert=require('node:assert/strict');
const relative=require('../api/_relative_position'),chat=require('../api/chat'),h=require('../api/_hitl_analysis'),model=require('../api/_school_summary');
(async()=>{
 // Detection: metric + relative trigger; relationships, lists and recommendations are left to other paths.
 const cases=[['어떤 학교에 책이 부족하니?',['books_per_student']],['초등학교 학생 수가 가장 많은 상위 10개',['students']],['부평구 초등학교 공원까지 거리가 먼 학교',['route_distance_m']],['중학교 학급당 학생 수 통계',['class_size']],['도서관 목록 보여줘',[]],['초등학교 학생 수와 공원 수의 상관관계',[]],['안전 미확인이지만 거리가 짧은 후보지를 추천해줘',[]],['유치원 원아 수 분포',['students']],['이 학교 학생당 장서는 전체에서 어느 위치인가요?',['books_per_student']]];
 for(const [q,ids] of cases)assert.deepEqual(relative.detect(q).map(m=>m.id),ids,q);
 // Shortage question: lowest books per student first, with book totals and student counts, island schools separate.
 const books=relative.run('어떤 학교에 책이 부족하니?',{level:'초등학교'});
 assert.equal(books.mode,'relative');assert.equal(books.relative.direction,'lower');
 const [summary,gu,rank,island]=books.visual.sections;
 assert.match(summary.title,/학생당 장서/);assert(summary.table.rows.some(r=>r[0]==='전체 평균'));assert(summary.table.rows.some(r=>r[0]==='중앙값'));
 assert.equal(gu.table.headers[0],'군·구');assert(gu.table.rows.length>=8);assert(gu.table.headers.includes('전체 평균 대비'));
 assert.deepEqual(rank.table.headers.slice(0,7),['순위','학교','군·구','학생당 장서 (권/명)','장서 수','학생 수(장서 기준)','사서']);
 const values=rank.table.rows.map(r=>r[3]);assert.deepEqual(values,[...values].sort((a,b)=>a-b));assert(rank.table.rows.length>=20);
 assert(rank.table.rows.every(r=>!/옹진|강화/.test(r[2])),'island schools never rank against mainland schools');
 assert.match(island.title,/도서지역/);assert(island.table.rows.length>0);
 assert(rank.map.length>=20&&rank.map.every(p=>Number.isFinite(p.lat)));
 assert(books.export_table.rows.length>200);assert(books.sources.every(s=>s.provenance[0].sha256));
 assert(!JSON.stringify(books).includes('score'),'no composite score');
 // Selected school: rank, percentile, overall and district deltas.
 const own=relative.run('이 학교 학생당 장서는 전체에서 어느 위치인가요?',{school_id:'B000002949',scope:'school'});
 assert.equal(own.school_id,'B000002949');assert.match(own.summary,/개교 중 .*위\(백분위/);assert.match(own.summary,/중구 평균보다/);
 assert(own.visual.sections[0].table.rows.some(r=>/전체 순위/.test(r[0])));assert(own.visual.sections[2].table.rows.some(r=>r[1].includes('★')));
 // Named school in the question wins over the selected one; island school is compared within the island track.
 const named=relative.run('덕적초등학교 장서 순위',{school_id:'B000002949'});assert.match(named.summary,/도서지역/);assert.match(named.summary,/덕적초등학교/);
 // Missing coverage is reported, never estimated.
 const middle=relative.run('중학교 장서 순위',{});assert.equal(middle.answerable,false);assert.match(middle.summary,/중학교 자료를 보유하지 않습니다/);
 // District filter and explicit limit.
 const district=relative.run('부평구 초등학교 공원까지 거리가 먼 학교 5개',{});assert(district.visual.sections[2].table.rows.every(r=>r[2].startsWith('부평구')));assert.equal(district.relative.direction,'higher');
 const top=relative.run('초등학교 학생 수가 가장 많은 상위 10개',{});assert(top.visual.sections[2].table.rows.length>=10&&top.visual.sections[2].table.rows.length<=12);
 // Whole-level scope answers per level; 전체 splits by school level.
 const all=relative.run('전체 학생 수 군구별 통계',{level:'전체'});assert(all.visual.sections.length>=12);
 // Chat routing: the shortage question, ranked questions and the HITL plan all reach the relative engine directly.
 const viaChat=await chat.run({question:'어떤 학교에 책이 부족하니?',scope:'all',level:'초등학교'});assert.equal(viaChat.mode,'relative');
 assert(viaChat.sources[0].source_chain.originals.some(o=>o.url.includes('kess.kedi.re.kr')),'public source attached');
 const ordered=await chat.run({question:'초등학교 학생 수가 가장 많은 상위 10개',scope:'all',level:'초등학교'});assert.equal(ordered.mode,'relative');
 const guard=await chat.run({question:'종합 점수로 최우선 지원 학교를 추천해줘',scope:'all',level:'초등학교'});assert.equal(guard.mode,'evidence');assert.match(guard.summary,/정할 수 없습니다/);
 const plan=h.plan({question:'어떤 학교에 책이 부족하니?',scope:'all',level:'초등학교'});assert.equal(plan.workflow,'direct');
 const factors=h.plan({question:'장학금과 체력 지표를 함께 고려해서 지원 검토',scope:'all',level:'초등학교'});assert.equal(factors.workflow,'factors');
 // School summary and map manifest link to public pages, not local files.
 const summaryApi=model.summary('B000002949','books');assert(summaryApi.originals.some(o=>o.url.startsWith('https://')));
 const manifest=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','data_processed/map_layers/manifest.json'),'utf8'));assert(manifest.layers.every(l=>/^https:\/\//.test(l.source_url)));
 console.log('PASS relative position: detection, shortage ranking with totals, island track, school rank/percentile, district filter, chat routing, public sources');
})().catch(e=>{console.error(e);process.exitCode=1;});
