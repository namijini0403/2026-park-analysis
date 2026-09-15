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
 w.DomainStats.init();d.querySelector('.workspace-nav [data-workspace="stats"]').click();await tick();assert(d.querySelector('.ds-overview'),'navigation loads statistics without profile shortcut');
 assert.equal(d.querySelectorAll('#stats-domain option').length,9,'영역 9개');
 w.DomainStats.open('reading');await tick();
 assert.equal(d.getElementById('stats-domain').value,'reading');
 assert.equal(host.hidden,false,'탭이 열린다');
 const body=d.getElementById('stats-body');
 assert(body.querySelectorAll('.ds-range').length>0,'분포 차트');
 assert(body.textContent.includes('군·구별'),'군구 비교');
 assert(body.textContent.includes('확보')&&body.textContent.includes('미확보'),'커버리지');
 // 학교급을 유치원으로 바꾸면 장서가 전부 미확보로 표시된다
 const sel=d.getElementById('stats-level');sel.value='유치원';sel.dispatchEvent(new w.Event('change'));await tick();
 assert(body.textContent.includes('미확보 369'),'유치원 장서 369곳 미확보');
 assert(body.textContent.includes('관측된 값이 없습니다'),'유효값 0이면 차트 대신 안내');
 assert(!/평균 0권/.test(body.textContent),'미확보를 0으로 요약하지 않는다');
 // 지표 전환은 해당 지표의 제목과 관측치에 연결된다.
 sel.value='초등학교';sel.dispatchEvent(new w.Event('change'));await tick();
 const indicators=[...body.querySelectorAll('[data-indicator]')];
 assert(indicators.length>1,'영역에 여러 지표 선택이 있다');
 const second=indicators[1],secondId=second.dataset.indicator,secondLabel=second.textContent;
 second.click();
 assert.equal(body.querySelector('[data-indicator][aria-pressed="true"]').dataset.indicator,secondId);
 assert(body.querySelector('.ds-kicker').textContent.includes(secondLabel),'제목도 선택 지표를 따른다');

 // 일반/도서는 각기 다른 대상·확보 분모를 사용하며 선택 학교 마커를 섞지 않는다.
 const table=require('../api/_school_table'),stats=require('../api/_indicator_stats');
 const islandSchool=table.build().rows.find(s=>s.level==='초등학교'&&stats.isIsland(s.gu)&&Number.isFinite(s.green_ratio));
 const school=d.getElementById('school');
 if(![...school.options].some(o=>o.value===islandSchool.id))school.add(new w.Option(islandSchool.name,islandSchool.id));
 school.value=islandSchool.id;
 w.DomainStats.open('park');await tick();
 body.querySelector('[data-indicator="green_ratio"]').click();
 const green=ds.domainStats({domain:'park',level:'초등학교',schoolId:islandSchool.id}).indicators.find(i=>i.column==='green_ratio');
 function checkTrack(track){
  body.querySelector(`[data-track="${track}"]`).click();
  assert.equal(body.querySelector('[data-track][aria-pressed="true"]').dataset.track,track);
  const cov=green.coverage[track];
  assert.equal(body.querySelector('.ds-coverage').getAttribute('aria-label'),`확보 ${cov.available}곳, 미확보 ${cov.missing_n}곳`);
  const metrics=body.querySelector('.ds-metrics').textContent;
  assert(metrics.includes(`${cov.available} / ${cov.total}곳`),'현재 범위의 확보/대상 분모');
  const names=[...body.querySelectorAll('.ds-district strong')].map(el=>el.textContent);
  assert.deepEqual(names,green.gu.filter(g=>g.track===track).map(g=>g.name).sort((a,b)=>a.localeCompare(b,'ko')),'해당 범위 군구만 이름순');
 }
 checkTrack('general');
 assert.equal(body.querySelectorAll('.ds-picked').length,0,'도서 선택 학교를 일반지역에 표시하지 않는다');
 assert(body.textContent.includes('선택 학교는 다른 비교 지역'),'선택 학교 미표시 이유');
 checkTrack('island');
 assert.equal(body.querySelectorAll('.ds-picked').length,1,'도서 범위에서는 선택 학교 마커 표시');
 assert(body.querySelector('.ds-school').textContent.includes(islandSchool.name));
 assert(body.querySelector('.ds-school').textContent.includes(`같은 범위 ${green.island.n}곳`),'백분위 분모는 도서 유효값');
 checkTrack('general');
 assert.equal(body.querySelectorAll('.ds-picked').length,0,'일반지역으로 복귀하면 도서 마커 제거');
 assert(!body.textContent.includes('종합점수'),'종합점수를 만들지 않는다');
 console.log('test_domain_stats_ui: OK');w.close();
})().catch(e=>{w.close();console.error(e);process.exitCode=1;});
