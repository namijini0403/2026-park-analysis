const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),ds=require('../api/_domain_stats'),model=require('../api/_school_summary');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.fetch=async url=>{const u=new URL(url,'http://localhost');
 if(u.pathname==='/api/domain-stats')return {ok:true,json:async()=>ds.domainStats({domain:u.searchParams.get('domain'),level:u.searchParams.get('level'),schoolId:u.searchParams.get('school')||null})};
 if(u.pathname==='/api/school-profile')return {ok:true,json:async()=>require('../api/_school_profile').profile(u.searchParams.get('id'))};
 return {ok:true,json:async()=>u.searchParams.get('id')?model.summary(u.searchParams.get('id'),u.searchParams.get('kind')):{schools:model.list()}};};
// 탭 전환은 hitl-workspace.js가 담당한다. 통계 탭이 그 규칙을 그대로 타는지 보려면 실제 스택을 같은 스코프에 올려야 한다.
const stack=['indicator-charts.js','school-profile.js','domain-stats.js','simple-app.js','hitl-workspace.js'];
w.eval(stack.map(f=>fs.readFileSync(path.join(root,'assets',f),'utf8')).join('\n'));
const tick=()=>new Promise(r=>setTimeout(r,30));
(async()=>{
 const host=d.getElementById('workspace-stats');
 assert(host,'05 탭 섹션이 있다');
 assert(d.querySelector('.workspace-nav [data-workspace="stats"]'),'탭 버튼이 있다');
 assert(host.classList.contains('workspace-page'),'탭 전환 규칙을 따른다');
 w.DomainStats.init();
 assert.equal(d.querySelectorAll('#stats-domain option').length,9,'영역 9개');
 w.DomainStats.open('reading');await tick();
 assert.equal(d.getElementById('stats-domain').value,'reading');
 assert.equal(host.hidden,false,'탭이 열린다');
 const body=d.getElementById('stats-body');
 assert(body.querySelectorAll('svg').length>0,'분포 차트');
 assert(body.textContent.includes('군·구별'),'군구 비교');
 assert(body.textContent.includes('확보')&&body.textContent.includes('미확보'),'커버리지');
 // 학교급을 유치원으로 바꾸면 장서가 전부 미확보로 표시된다
 const sel=d.getElementById('stats-level');sel.value='유치원';sel.dispatchEvent(new w.Event('change'));await tick();
 assert(body.textContent.includes('미확보 369'),'유치원 장서 369곳 미확보');
 assert(body.textContent.includes('관측된 값이 없습니다'),'유효값 0이면 차트 대신 안내');
 assert(!/평균 0권/.test(body.textContent),'미확보를 0으로 요약하지 않는다');
 console.log('test_domain_stats_ui: OK');
})();
