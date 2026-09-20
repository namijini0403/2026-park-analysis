const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id=x></div>',{runScripts:'outside-only'}),w=dom.window;
w.eval(fs.readFileSync(path.join(__dirname,'..','assets/indicator-charts.js'),'utf8'));
const C=w.IndicatorCharts;

// 백분위 막대
const bar=C.percentileBar({percentile:72.5,guPercentile:40,guName:'중구',value:6.2,unit:'%',rank:41,n:262});
assert(bar.startsWith('<svg'),'SVG 문자열');
assert(bar.includes('72.5'),'백분위 표시');
assert(bar.includes('262개교 중 41위'),'순위 표시');
assert(bar.includes('class="gu-mark"'),'구 눈금');
const noGu=C.percentileBar({percentile:50,guPercentile:null,guName:'중구',value:1,unit:'',rank:2,n:5});
assert(!noGu.includes('class="gu-mark"'),'구 백분위가 없으면 눈금을 그리지 않는다');
assert(!/NaN/.test(noGu),'NaN 없음');
// 이스케이프
assert(C.percentileBar({percentile:1,guPercentile:null,guName:'<b>',value:1,unit:'<i>',rank:1,n:1}).includes('&lt;'),'HTML 이스케이프');

// 히스토그램
const h=C.histogram({bins:[{from:0,to:5,count:3},{from:5,to:10,count:7}],selectedValue:6,unit:'%'});
assert(h.startsWith('<svg'));
assert(h.includes('selected'),'선택 학교 구간 표시');
assert(!C.histogram({bins:[{from:0,to:5,count:3}],selectedValue:null,unit:''}).includes('selected'));
assert.equal(C.histogram({bins:[],selectedValue:null,unit:''}),'','빈 분포는 빈 문자열');

// 레이더: 미확보 축은 0이 아니라 끊어진 축
const axes=[{domain_label:'공원·야외',label:'녹지비율',direction:'up',percentile_overall:80,percentile_gu:60,missing:null},
            {domain_label:'도서·독서',label:'학생당 장서',direction:'up',percentile_overall:null,percentile_gu:null,missing:{reason:'level_not_covered',detail:'초등만'}},
            {domain_label:'안전 환경',label:'사고 거리',direction:'up',percentile_overall:30,percentile_gu:null,missing:null}];
const rad=C.radar({axes,basis:'overall'});
assert(rad.startsWith('<svg')&&rad.includes('class="radar"'));
assert(rad.includes('stroke-dasharray'),'미확보 축은 점선');
assert(!/NaN/.test(rad),'NaN 좌표 없음');
assert(rad.includes('공원·야외')&&rad.includes('도서·독서'));
assert(rad.includes('↑'),'방향 표시');
assert.notEqual(C.radar({axes,basis:'gu'}),rad,'기준을 바꾸면 그림이 달라진다');
// 구 기준인데 구 백분위가 없는 축도 끊어진 축이 된다
assert(C.radar({axes,basis:'gu'}).includes('stroke-dasharray'));
// 값이 하나도 없으면 안내 문구
const empty=C.radar({axes:axes.map(a=>({...a,percentile_overall:null,percentile_gu:null,missing:{reason:'x',detail:'y'}})),basis:'overall'});
assert(empty.includes('표시할 값이 없습니다'));
console.log('test_indicator_charts: OK');

// 레이더 방향 통일: 같은 긍정 상태는 같은 반지름. 원자료 막대에는 영향을 주지 않는다.
const aligned=[{domain_label:'긍정',label:'많을수록 유리',direction:'up',percentile_overall:80,percentile_gu:60},
 {domain_label:'부정',label:'적을수록 유리',direction:'down',percentile_overall:20,percentile_gu:40},
 {domain_label:'중립',label:'정책 판단',direction:'neutral',percentile_overall:95,percentile_gu:90},
 {domain_label:'누락',label:'미수집',direction:'down',percentile_overall:null,percentile_gu:null}];
const host=w.document.getElementById('x');
for(const basis of ['overall','gu']){
 host.innerHTML=C.radar({axes:aligned,basis});
 const dots=[...host.querySelectorAll('.dot')];
 assert.equal(dots.length,2,'중립과 결측값에 점을 찍지 않는다');
 const radius=el=>Math.hypot(Number(el.getAttribute('cx'))-150,Number(el.getAttribute('cy'))-150);
 assert(Math.abs(radius(dots[0])-radius(dots[1]))<0.1,'긍정 방향을 일치시킨다');
 assert.equal(host.querySelectorAll('.broken').length,1,'부정 지표의 결측도 0으로 뒤집지 않는다');
 assert(!host.textContent.includes('정책 판단'),'중립 지표를 긍정 수치로 표시하지 않는다');
 assert(host.textContent.includes('100 − 원자료 백분위'),'변환을 설명한다');
}
assert(C.percentileBar({percentile:20,value:20}).includes('값이 큰 쪽) 20%'),'상세 막대는 원자료 백분위 유지');
