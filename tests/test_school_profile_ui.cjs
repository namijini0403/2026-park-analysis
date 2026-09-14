const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),profile=require('../api/_school_profile');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.eval(fs.readFileSync(path.join(root,'assets/indicator-charts.js'),'utf8'));
w.eval(fs.readFileSync(path.join(root,'assets/school-profile.js'),'utf8'));
const host=d.getElementById('summary');

w.SchoolProfile.render(host,{...profile.profile('B000002949'),conditions:['도서 아님 조건'],limits:['관측 0은 확정 부족이 아닙니다.']});
assert.equal(host.querySelectorAll('.domain-card').length,9,'영역 카드 9장');
assert(host.querySelector('svg.radar'),'레이더 1장');
assert.equal(host.querySelectorAll('.radar-basis button').length,2,'구 기준 / 인천 전체 기준 토글');
assert(host.textContent.includes('모양 비교용'),'레이더 고지 문구');
assert(host.textContent.includes('백분위 (값이 큰 쪽)'),'백분위 정의를 화면에 쓴다');
assert.equal(host.querySelectorAll('[data-domain-stats]').length,9,'영역마다 통계 링크');
// 영역은 탭으로 나뉘고 한 번에 하나만 보인다
const tabs=[...host.querySelectorAll('[role="tab"]')];
assert.equal(tabs.length,9,'영역 탭 9개');
const panels=()=>[...host.querySelectorAll('[role="tabpanel"]')];
assert.equal(panels().filter(p=>!p.hidden).length,1,'열린 영역은 하나');
assert.equal(tabs[0].getAttribute('aria-selected'),'true','첫 영역이 기본 선택');
assert.equal(panels()[0].hidden,false,'첫 영역 패널만 열림');
tabs[3].dispatchEvent(new w.Event('click',{bubbles:true}));
assert.equal(tabs[3].getAttribute('aria-selected'),'true','누른 탭이 선택된다');
assert.equal(tabs[0].getAttribute('aria-selected'),'false','이전 탭은 해제된다');
assert.equal(panels().filter(p=>!p.hidden).length,1,'전환 뒤에도 하나만 열림');
assert.equal(panels()[3].hidden,false,'누른 영역의 패널이 열린다');
assert.equal(tabs[3].tabIndex,0,'선택 탭만 탭 이동 대상');
assert.equal(tabs[0].tabIndex,-1,'비선택 탭은 화살표로 이동');
// 화살표 키로 옆 영역으로 이동한다
const key=(el,k)=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
key(tabs[3],'ArrowRight');
assert.equal(tabs[4].getAttribute('aria-selected'),'true','→ 키로 다음 영역');
key(tabs[4],'Home');
assert.equal(tabs[0].getAttribute('aria-selected'),'true','Home 키로 첫 영역');
// 기준 전환으로 다시 그려도 보던 영역을 유지한다
tabs[2].dispatchEvent(new w.Event('click',{bubbles:true}));
const keptId=host.querySelectorAll('[role="tab"]')[2].dataset.domainTab;
host.querySelectorAll('.radar-basis button')[1].dispatchEvent(new w.Event('click',{bubbles:true}));
const openPanel=[...host.querySelectorAll('[role="tabpanel"]')].find(p=>!p.hidden);
assert.equal(openPanel.id,'domain-panel-'+keptId,'기준을 바꿔도 보던 영역이 유지된다');
host.querySelectorAll('.radar-basis button')[0].dispatchEvent(new w.Event('click',{bubbles:true})); // 아래 기준 전환 검사를 위해 인천 전체로 되돌린다
// 제거된 것
for(const gone of ['확인된 사실','검토할 선택지','기존 공원과 연결 검토'])assert(!host.textContent.includes(gone),gone+' 제거');

// 토글이 실제로 다시 그린다
const before=host.querySelector('svg.radar').outerHTML;
host.querySelectorAll('.radar-basis button')[1].dispatchEvent(new w.Event('click',{bubbles:true}));
assert.notEqual(host.querySelector('svg.radar').outerHTML,before,'기준 전환이 반영된다');

// 미확보 표기
w.SchoolProfile.render(host,{...profile.profile('KLOCAL-000e957d3ab6431c'),conditions:[],limits:[]});
const missing=[...host.querySelectorAll('.indicator.missing')];
assert(missing.length>0,'유치원은 미확보 지표가 보인다');
assert(missing.every(el=>el.querySelector('.indicator-value').textContent.trim()==='미확보'),'미확보 칸에 0을 쓰지 않는다');
assert(missing.every(el=>!el.querySelector('svg')),'미확보에 막대를 그리지 않는다');

// 도서지역 배지
w.SchoolProfile.render(host,{...profile.profile('B000003173'),conditions:[],limits:[]});
assert(host.textContent.includes('도서지역'),'도서지역 표시');

// 소표본 군·구는 순위만
w.SchoolProfile.render(host,{...profile.profile('B000030928'),conditions:[],limits:[]});
const cls=[...host.querySelectorAll('.indicator')].find(el=>el.textContent.includes('학급당 학생 수'));
assert(cls.textContent.includes('1개교 중 1위'),'순위는 쓴다');
assert(!/검단구 백분위/.test(cls.textContent),'소표본 구 백분위는 쓰지 않는다');

// 빈 상태
w.SchoolProfile.clear(host);
assert(host.textContent.includes('학교를 선택하면'));
console.log('test_school_profile_ui: OK');
