const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
// Expose the pure renderer in the test harness only.
w.eval(fs.readFileSync(path.join(root,'assets/education-layers.js'),'utf8').replace('return {clearRoute,','return {schoolProfile,clearRoute,'));
const render=(level,rows)=>{
  const element=w.document.createElement('div');
  element.innerHTML=w.EducationLayers.schoolProfile({학교급구분:level},rows);
  return element;
};
const record=(item,year,values,depth='0')=>({item,year,values,depth,title:item,source_url:'https://www.schoolinfo.go.kr'});
let el=render('중학교',[
  record('09',2025,{COL_S_SUM:999,TEACH_CNT:100,PBAN_EXCP_YN:'N'}),
  record('09',2026,{COL_S_SUM:0,TEACH_CNT:'',COL_C_SUM:0,PBAN_EXCP_YN:'N'}),
  record('22',2026,{COL_S:33,COL_R_SUM:2,PBAN_EXCP_YN:'N'}),
  record('0',2026,{SCHUL_NM:'<img src=x onerror=alert(1)>'})
]);
assert.equal(el.querySelectorAll('img').length,0);
assert(!el.textContent.includes('999'));
assert(el.textContent.includes('0명'));
assert(el.textContent.includes('교사 수(수업교원 공시 기준)미확보'));
assert(el.textContent.includes('교원 전체(직위별 공시 총계)33명'));
el=render('고등학교',[record('09',2026,{COL_S_SUM:999,TEACH_CNT:888,PBAN_EXCP_YN:'Y'})]);
assert(el.querySelector('table').textContent.includes('학생 수(학년별·학급별 공시)미확보'));
const kg=JSON.parse(fs.readFileSync(path.join(root,'data_processed/education/disclosures/KLOCAL-000e957d3ab6431c.json'),'utf8'));
el=render('유치원',kg);
assert(el.textContent.includes('원아 수(공개 연령별 5항목 합계)91명'));
assert(el.textContent.includes('일반 교사수7명'));
assert(el.textContent.includes('원장수1명'));
assert(el.textContent.includes('2026년 1차'));
el=render('유치원',[record('KG05',2026,{'만3세원아수':10},'1')]);
assert(el.querySelector('table').textContent.includes('합계)미확보'));
el=render('초등학교',[]);
assert(el.textContent.includes('확보된 공시자료가 없습니다.'));
w.close();
console.log('School profile: source scopes, latest periods, missing/exempt values, kindergarten counts and escaping passed.');
