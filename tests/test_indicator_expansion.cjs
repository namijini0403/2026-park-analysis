'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const table=require('../api/_school_table'),extra=require('../api/_additional_indicators'),tools=require('../api/_agent_tools'),stats=require('../api/_domain_stats');
const t=table.build();assert.equal(t.rows.length,917);
for(const [id,c] of Object.entries(extra.COLUMNS)){
 assert(t.rows.some(r=>r[id]!=null),'No usable data: '+id);
 for(const r of t.rows)assert(r[id]==null||c.type==='text'||Number.isFinite(r[id]),id+' finite or explicit missing');
 const source=table.sourceFor(id);assert(source.path&&source.sha256&&source.title);assert(fs.existsSync(source.path));
 assert(c.note&&table.DOMAINS.some(d=>d.id===c.domain));
}
for(const [level,n] of [['초등학교',271],['중학교',147],['고등학교',129]])assert.equal(t.coverage.library_books_2026[level],n);
assert.equal(t.byId.get('B000003194').forecast_change_pct_2031,-100,'Forecast zero is a valid change');
for(const id of ['age_residents_straight_500m_2024','resident_age_0_500m_estimate','park_detour_ratio','libraries_public_children_500m']){
 assert.throws(()=>tools.run('query_schools',{level:'초등학교'},{aggregate:{by:'gu',column:id,stat:'sum'}}),/합계/);
 const r=tools.run('query_schools',{level:'초등학교'},{aggregate:{by:'gu',column:id,stat:'mean'}});
 assert(!r.visual.table.headers.includes('합계'));assert(r.llm.groups.every(g=>!Object.hasOwn(g,'sum')));
 assert(r.llm.indicator_definitions.some(d=>d.column===id&&d.non_additive));
}
const compact=table.dictionary({compact:true});assert(!compact.includes('paps='));
for(const id of Object.keys(extra.COLUMNS))assert(compact.includes(id+'='));
const asked=['library_books_2026','library_operating_budget_2026','cohort_scenario_2029'];
const result=tools.run('query_schools',{level:'초등학교'},{columns:asked,limit:5});
assert(asked.every(id=>result.llm.indicator_definitions.some(d=>d.column===id&&d.note)));
assert(result.visual.notes.some(n=>/시나리오|진급/.test(n)));
for(const domain of table.DOMAINS){const d=stats.domainStats({domain:domain.id,level:'초등학교'});for(const i of d.indicators){assert.equal(i.overall.n+i.island.n,i.coverage.available);assert(i.kind);assert(i.column!=='paps');}}
console.log('PASS expanded indicators: full source coverage, explicit kinds, zero forecast, overlapping sums blocked, compact complete dictionary and selected definitions');
