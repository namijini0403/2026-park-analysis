'use strict';
const {chromium}=require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.resolve('outputs/answer-display-20260919');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const table={headers:['학교','학생당 장서','공공도서관 거리'],rows:[['학교 A',8,1200],['학교 B',null,300]]};
  const section={title:'학교 도서관 관측',table};
  await page.route('http://answer.test/**',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/api/'))return route.fulfill({json:p==='/api/school-summary'?{schools:[]}:{}});const f=path.join(root,p==='/'?'index.html':p);if(!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({path:f,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p==='/'?'text/html':undefined});});
  await page.route('**/api/chat',route=>route.fulfill({json:route.request().postDataJSON().action==='plan_variables'?{mode:'variable_plan',summary:'교내 장서와 외부 도서관 접근성을 함께 살펴봅니다.',variables:[{column:'books_per_student',label:'학생당 장서',why:'교내 이용 여건'}]}:{observation_version:1,answerable:true,mode:'agent',summary:'학교 A는 교내 장서 보완과 외부 도서관 연계를 함께 검토할 수 있습니다. 학교 B는 장서 자료가 없어 판단을 보류합니다.',highlights:['학교 A: 학생당 장서 8권, 공공도서관 직선거리 1,200m'],caveats:['안전·이용대상·실행 여건·실제 출입구 경로 확인 전 지원을 확정하지 않습니다.'],visual:{sections:[section,section],table,map:[]},sources:[]}}));
  console.log('browser launched');
  await page.goto(process.env.QA_BASE||'http://answer.test/',{waitUntil:'domcontentloaded'});
  console.log('page loaded');
  await page.locator('.workspace-nav [data-workspace="ask"]').click();
  await page.evaluate(()=>{const e=document.querySelector('#chat-scope');e.value='all';e.dispatchEvent(new Event('change'));});await page.fill('#question','학교 도서관 지원 검토 초등학교 5개 찾아줘');await page.click('#send');
  await page.locator('.chat-run-analysis').click();await page.locator('.agent-summary').waitFor();
  assert.match(await page.locator('.agent-summary').innerText(),/함께 검토/);
  assert.equal(await page.locator('.table-comparison').count(),1);
  assert.equal(await page.locator('.agent-observations').evaluate(e=>e.open),false);
  assert.equal(await page.locator('.comparison-section').evaluate(e=>e.open),false);
  // Real browser CSS cascade: reading theme must not stretch map marks to 40px.
  await page.evaluate(()=>{const card=document.createElement('section');card.className='agent-inline-map';card.innerHTML='<div class="chat-map-canvas" style="position:relative"><button class="kakao-school-dot" aria-label="학교 A" style="--dot-color:#33785d;position:absolute;left:40%;top:40%"></button><button class="kakao-school-dot is-selected" aria-label="학교 B" style="--dot-color:#33785d;position:absolute;left:60%;top:60%"></button></div>';document.querySelector('#evidence-panel .panel-question').after(card);});
  const sizes=await page.locator('.chat-map-canvas .kakao-school-dot').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  assert.deepEqual(sizes,[{w:9,h:9},{w:13,h:13}]);
  assert((await page.locator('.chat-map-canvas').boundingBox()).height>=340);
  await page.locator('.agent-summary').scrollIntoViewIfNeeded();await page.locator('#workspace-ask').screenshot({path:path.join(out,'desktop.png')});
  await page.locator('.comparison-section>summary').click();await page.locator('[data-comparison-table]').evaluate(e=>e.closest('details').open=true);await page.locator('.tc-values>summary').click();assert.match(await page.locator('.tc-table').innerText(),/자료 없음/);
  await page.setViewportSize({width:390,height:844});await page.locator('.agent-summary').scrollIntoViewIfNeeded();await page.locator('#workspace-ask').screenshot({path:path.join(out,'mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'no mobile page overflow');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed:true,markerSizes:sizes,checks:['synthesis first','collapsed variable observations','deduplicated table','missing values','theme-resistant small circular markers','map height','mobile width'],note:'Map CSS tested with fixture markers; provider rendering separately covered by native map tests.'},null,2));
  console.log('PASS browser synthesis, evidence dedupe, expandable details, map marker CSS, desktop/mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
