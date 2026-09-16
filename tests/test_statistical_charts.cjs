const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['statistical-charts.js','chat-workspace.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',f),'utf8'),ctx);
const charts=ctx.window.StatisticalCharts;
let html=charts.dotPlot({title:'<script>alert(1)</script>',unit:'%',points:[{name:'음수',value:-2},{name:'영',value:0},{name:'없음',value:null},{name:'긴한국어학교이름입니다분교장이름입니다',value:4,selected:true}]});
assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('관측 3개 · 자료 없음 1개'));assert.equal((html.match(/<circle /g)||[]).length,3);assert(html.includes('-2%'));assert(html.includes('0%'));assert(html.includes('<tspan'));assert(!/NaN|Infinity/.test(html));
for(const value of [0,5,-5]){html=charts.dotPlot({points:[{name:'동일',value},{name:'동일2',value}]});assert(!/NaN|Infinity/.test(html));assert.equal((html.match(/<circle /g)||[]).length,2);}
html=charts.scatter({x:['학생 수'],y:['공원 수'],points:[{x:0,y:0},{x:null,y:5},{x:0,y:0,selected:true,name:'<img>'}]});assert.equal((html.match(/<circle /g)||[]).length,2);assert(html.includes('학생 수'));assert(html.includes('공원 수'));assert(html.includes('좌표 또는 값 없음 1개'));assert(html.includes('sc-selected'));assert(!html.includes('<img>'));assert(!/NaN|Infinity/.test(html));
html=charts.line({points:[{x:2020,y:3},{x:2021,y:null},{x:2022,y:5},{x:2023,y:6,name:'예측'}]});assert.equal((html.match(/class="sc-line/g)||[]).length,1);assert(html.includes('sc-forecast'));assert(html.includes('결측 구간은 연결하지 않습니다'));assert(!html.includes('NaN'));
assert(charts.dotPlot({points:[{value:null}]}).includes('자료 없음은 0이 아닙니다'));
assert(charts.dotPlot({points:[{name:'미소값',value:0.00001}]}).includes('0.00001'));
for(const c of [{title:'미래 수요 예측',points:[{value:2}]},{points:[{value:2,forecast:true}]},{points:[{value:2,name:'예측'}]}]){
 const forecastHtml=charts.dotPlot(c);assert(forecastHtml.includes('표시 1개'));assert(forecastHtml.includes('표시값'));assert(forecastHtml.includes('예측값이 포함'));assert(!forecastHtml.includes('관측 1개'));assert(!forecastHtml.includes('점의 위치는 관측값'));
}
assert(ctx.window.ChatWorkspace.chart({kind:'bar',points:[{name:'학교',value:1}]}).includes('statistical-chart-dot'));
assert(!ctx.window.ChatWorkspace.chart({kind:'bar',title:'값 구간 분포',points:[{name:'0~10',value:1}]}).includes('statistical-chart-dot'));
// Category appearance must not imply high/low risk, change with values, or invent missing bars.
const categoryHtml=value=>charts.dotPlot({points:[{name:'중구',value},{name:'미확보',value:null}]});
assert.equal(categoryHtml(1).match(/style="fill:(#[a-f0-9]+)"/)[1],categoryHtml(99).match(/style="fill:(#[a-f0-9]+)"/)[1]);
assert.equal((categoryHtml(1).match(/class="sc-stem"/g)||[]).length,1);
assert(categoryHtml(1).includes('색은 항목 구분 · 우열을 뜻하지 않음'));
assert(categoryHtml(1).includes('표시 1개 · 자료 없음 1개'));
html=charts.line({x:['연도','년'],y:['학생 수','명'],points:[{x:2020,y:10},{x:2021,y:12},{x:2022,y:null},{x:2023,y:15,name:'예측'}]});
assert(html.includes('>2020</text>'));assert(html.includes('>2021</text>'));assert(!html.includes('2,020'));assert(!html.includes('2020.75'));
assert.equal((html.match(/class="sc-point-label"/g)||[]).length,3);
assert(html.includes('예측 포함 · 확정값 아님'));assert.equal((html.match(/class="sc-line/g)||[]).length,1);
html=charts.scatter({points:[{x:1,y:2,forecast:true}]});assert(!html.includes('sc-key-observed'));assert(html.includes('sc-key-predicted'));
html=charts.dotPlot({points:[{value:2,forecast:true}]});assert(!html.includes('sc-key-forecast'));
console.log('Statistical chart regression checks passed');
