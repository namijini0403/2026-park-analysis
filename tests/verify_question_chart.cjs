const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Mijin/Desktop/SAbuffet/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.QA_BASE||'https://education-living-area-preview-production.up.railway.app';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Users/Mijin/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base);
const response=await page.request.post((process.env.CHAT_API_BASE||base)+'/api/chat',{timeout:120000,data:{scope:'all',level:'초등학교',question:'강화군 옹진군을 제외한 초등학교의 군구별 학급당 학생 수 평균을 비교하는 그래프를 보여줘. 학교 지원 순위를 만들지 말고 확보 학교 수와 단위를 포함해줘.',history:[]}});
assert(response.ok());const result=await response.json();assert(result.answerable,result.summary);const charts=[result.visual?.chart,...(result.visual?.sections||[]).map(s=>s.chart)].filter(Boolean);assert(charts.length,'actual answer contains chart specs');
await page.locator('.workspace-nav [data-workspace=ask]').click();
// Render actual server-returned chart specs through the same renderer used by chatbot messages.
await page.evaluate(r=>window.ChatWorkspace.show(r,'군·구별 학급당 학생 수 평균 비교'),result);
assert((await page.locator('#evidence-panel .statistical-chart-dot').count())>0);assert(await page.locator('#evidence-panel .statistical-chart-scroll').first().evaluate(e=>e.scrollWidth<=e.clientWidth+1),'desktop chart values visible');await page.locator('#evidence-panel').screenshot({path:'outputs/visualization-20260916/question-chart.png'});
fs.writeFileSync('outputs/visualization-20260916/question-chart-check.json',JSON.stringify({base,at:new Date(),passed:true,summary:result.summary,agent:result.agent,charts},null,2));console.log('PASS actual question -> server chart specification -> browser renderer',charts.length);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
