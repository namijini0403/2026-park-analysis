const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=require('../api/_school_profile'),ds=require('../api/_domain_stats'),table=require('../api/_school_table');
// 1) 917교 전부 예외 없이 프로필이 생긴다
let ok=0;for(const r of table.build().rows){profile.profile(r.id);ok++;}
assert.equal(ok,917);
// 2) 어떤 응답에도 종합점수가 없다
const BAD=['"score"','"total_score"','"composite"','"weight"','"weighted"','종합점수','가중합'];
for(const id of ['B000002949','KLOCAL-000e957d3ab6431c','B000003173']){const b=JSON.stringify(profile.profile(id));for(const k of BAD)assert(!b.includes(k),id+' 금지 키: '+k);}
for(const d of table.DOMAINS){const b=JSON.stringify(ds.domainStats({domain:d.id,level:'초등학교'}));for(const k of BAD)assert(!b.includes(k),d.id+' 금지 키: '+k);}
// 3) 미확보가 평균에 섞이지 않는다 — 유효값 수 = 확보 개교 수
for(const d of table.DOMAINS)for(const i of ds.domainStats({domain:d.id,level:'유치원'}).indicators){
 assert.equal(i.overall.n+i.island.n,i.coverage.available,i.column+': 유효값 합 = 확보 개교 수');
 if(i.overall.n===0)assert.equal(i.overall.mean,null,i.column+': 유효값이 없으면 평균도 없다');
}
// 4) 레이더에 paps가 대표로 오지 않는다
for(const r of table.build().rows)assert(!profile.profile(r.id).radar.axes.some(a=>a.column==='paps'));
// 5) 레이더 규칙 예외가 저장소 안 문서에 기록되어 있다.
// AGENTS.md는 워크트리 상위(git 밖)에 있어 배포본에 없다. 저장소가 스스로 지킬 수 있는 파일을 기준으로 삼는다.
const spec=fs.readFileSync(path.join(root,'docs/superpowers/specs/2026-09-13-school-indicator-profile-design.md'),'utf8');
assert(/레이더/.test(spec),'설계 문서에 레이더 예외 기록 필요');
assert(/규칙 예외 기록/.test(spec),'예외임을 명시해야 한다');
assert(/끊어진 축/.test(spec),'완화 장치도 함께 기록');
// 작업 폴더에 AGENTS.md가 있으면 같은 내용이 반영돼 있는지도 확인한다 (배포본에는 없다).
const agentsPath=path.join(root,'..','AGENTS.md');
if(fs.existsSync(agentsPath)){
 const agents=fs.readFileSync(agentsPath,'utf8');
 assert(/radar|레이더/i.test(agents),'AGENTS.md에 예외 기록 필요');
 assert(/broken axes|끊어진 축/i.test(agents),'완화 장치도 함께 기록');
}
console.log('test_profile_guardrails: OK');
