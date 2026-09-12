const assert=require('node:assert/strict');
process.env.AI_EXPLAINER_ENABLED='false';
const chat=require('../api/chat'),data=require('../api/_data_answers');
(async()=>{
 const r=await chat.run({question:'석암초등학교 도서관/장서 지원해야할 근거는?'});
 assert.equal(r.mode,'comparative');
 assert.equal(r.school_id,'B000002982');
 const books=r.comparison.metrics.find(m=>m.title.includes('학생당 장서'));
 assert.equal(books.own,23);assert.equal(books.groups[1].median,26.1);
 assert.equal(r.comparison.metrics[0].own,397);
 assert(r.visual.notes.some(n=>n.includes('도서관 0곳')));
 assert(r.visual.sections.some(s=>s.map?.length>1));assert(r.visual.sections.some(s=>s.chart?.kind==='scatter'));
 assert(r.visual.sections.find(s=>s.chart?.kind==='scatter').chart.points.some(p=>p.selected));
 assert(r.comparison.groups.every(g=>!g.ids.includes(r.school_id)));
 for(const topic of ['공원 지원 근거','학원 환경 비교','미래 학생 수 분석','돌봄 지원 근거','체력 수준 비교','방과후 지원 근거','보행 경로 비교','진학 수준 비교']){const a=await chat.run({question:'석암초등학교 '+topic});assert.equal(a.mode,'comparative',topic);assert(a.visual.sections.length,topic);assert(a.sources.length,topic);}
 const regional=await chat.run({question:'석암초등학교 지역 인구 전망 비교'});assert(regional.sources.some(s=>s.source.includes('regional_demography')));assert(regional.visual.sections.some(s=>s.title.includes('미추홀구')));
 const blocked=await chat.run({question:'석암초등학교 장서 지원 순위 추천'});assert.equal(blocked.mode,'evidence');
 console.log('PASS composite evidence: exact library/books metrics, excluded self, 8 other themes, maps/scatter, policy guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
