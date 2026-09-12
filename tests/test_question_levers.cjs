'use strict';
const assert=require('node:assert/strict'),h=require('../api/_hitl_analysis'),c=require('../assets/question-conclusion');
const base={version:1,weight_scale:100,scope:'all',question:'전체 초등학교 도서관 지원을 검토해줘',factors:[{id:'books:books.total',weight:80,direction:'lower'},{id:'library_access:nearest_m.public_children',weight:20,direction:'higher'}]};
(async()=>{
 const plan=h.plan(base);for(const id of ['books:books.total','library_access:nearest_m.public_children','schools:students'])assert(plan.candidates.some(f=>f.id===id),id);
 const a=await h.run(base);assert(a.conclusion.cards[0].label.includes('장서'));assert(a.summary.includes('도서 구입'));assert(a.conclusion.cards[0].groups.some(g=>g.members.length&&g.rows.length));
 const next=base.factors.map(f=>({...f,weight:100-f.weight})),b=c.reweight(a,next),server=await h.run({...base,factors:next});
 assert(b.conclusion.cards[0].id.startsWith('library_access'));assert(b.summary.includes('순회대출'));assert.notEqual(a.summary,b.summary);assert.deepEqual(b.conclusion,server.conclusion);assert.equal(b.review.gates.safety,'unverified');assert.equal(b.review.decision,'deferred');assert(!b.score&&!b.ranking);
 for(const x of a.conclusion.cards)for(const g of x.groups){assert(g.track);assert(g.members.every(m=>g.rows.some(r=>r.name===m.name&&r.value===m.value)));}
 const missing=await h.run({...base,year:2099});assert(missing.conclusion.cards.every(c=>!c.available));assert(missing.summary.includes('판단을 보류'));assert(!missing.summary.includes('가장 작은 관측'));
 await assert.rejects(()=>h.run({...base,factors:base.factors.map(f=>({...f,weight:0}))}));
 for(const value of [-1,101,NaN])await assert.rejects(()=>h.run({...base,factors:[{...base.factors[0],weight:value}]}));
 const zero=await h.run({...base,factors:[base.factors[0],{...base.factors[1],weight:0}]});assert.equal(zero.conclusion.cards[1].share,0);assert(!zero.conclusion.alternatives.some(a=>a.id===base.factors[1].id));
 const old=await h.run({...base,weight_scale:undefined,factors:[{...base.factors[0],weight:null}],gates:{safety:'verified'},recommendation:'approved'});assert.equal(old.review.gates.safety,'unverified');assert.equal(old.visual.chart,null);
 const synthetic=[{factor_id:'x',comparison_year:2025,comparison_track:'일반 검토',title:'2025 일반',statistics:{n:3,excluded:1,median:10,selected:null},table:{rows:[['A',10],['B',10],['C',20]]}}];
 const ties=c.build([{id:'x',label:'관측',field:'value',weight:50,direction:'lower'}],synthetic,{question:'지원'});assert.deepEqual(ties.cards[0].groups[0].members.map(m=>m.name),['A','B']);
 const unavailable=c.build([{id:'x',label:'관측',field:'value',weight:50,direction:'lower'}],synthetic,{question:'학교 지원',school_id:'missing'});assert(unavailable.conclusion.includes('선택 학교의 유효값이 없어'));
 console.log('PASS question levers: relevance, local/server parity, changed options, exact school evidence, ties, separate tracks, missing coverage, zero/invalid weights, safety, legacy');
})().catch(e=>{console.error(e);process.exitCode=1;});
