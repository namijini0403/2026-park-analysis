'use strict';
// Real HTTP and browser checks. Optional HITL_BASE_URL verifies the deployed service.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/hitl-release-validation',process.env.HITL_BASE_URL?'live':'local');fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const cases=[
 {id:'safety',question:'지금 등교길 안전인력을 추가 지원한다면 어떤 학교를 검토해야 할까? 학생 수와 통학구역, 공사장, 기존 인력과 사고 기록을 함께 고려하고 이유를 보여줘.',year:2026,factors:['schools:students','zones:evidence','construction:evidence'],directions:['higher','observe','observe'],weights:[3,2,2]},
 {id:'library',question:'인천석암초등학교 도서관 지원을 검토하고 있어. 장서 총수와 학생당 장서, 외부 도서관 거리, 학생 수를 함께 보면 어떤 근거가 있나?',factors:['books:books.total','books:books.per_student','library_access:nearest_m.public_children','books:students'],directions:['lower','lower','higher','higher'],weights:[2,3,2,1]},
 {id:'park',question:'인천석암초등학교 야외활동 지원에 공원 수, 공동 이용 부담과 보행 우회율을 고려하면 무엇을 먼저 확인해야 할까?',factors:['schools:parks','shared_parks:sharing_school_count','routes:detour_ratio'],directions:['lower','higher','higher']},
 {id:'care',question:'남동구 초등학교 방과후 돌봄 확대를 검토해줘. 학생 수와 돌봄 시설, 생활권 연령 인구를 함께 보고 정원과 이용 자격도 확인하고 싶어.',year:2026,factors:['schools:students','services:service-2','school_demand:evidence'],directions:['higher','observe','observe']},
 {id:'future',question:'향후 학생이 늘어날 학교의 시설 지원을 검토하고 싶어. 학생 수 전망과 예측 오차, 재개발 계획을 함께 보고 불확실성도 설명해줘.',factors:['forecast:value','school_validation:mae','redevelopment:evidence'],directions:['higher','lower','observe']},
 {id:'curriculum',question:'가림고등학교 공동교육과정 참여를 늘리려면 개설 과목과 학교 간 거리, 학생 수를 어떻게 함께 검토할까?',factors:['curriculum:evidence','curriculum_links:evidence','schools:students'],directions:['observe','observe','higher']},
 {id:'island',question:'강화군 초등학교 독서 지원을 검토해줘. 학생당 장서와 도서관 거리를 보고 도서지역의 이동 조건을 따로 확인하고 싶어.',factors:['books:books.per_student','library_access:nearest_m.public_children'],directions:['lower','higher']},
 {id:'upload',question:'등교 안전인력 지원 검토에 학생 수와 내가 제공한 현장 통행량을 함께 보고 싶어. 첨부 수치는 시험 자료이므로 실제 조사로 확정하지 말아줘.',year:2026,factors:['schools:students'],directions:['higher'],upload:true}
];
async function main(){
 let server,browser,base=process.env.HITL_BASE_URL;
 if(!base){process.env.AI_EXPLAINER_ENABLED='false';const chat=require('../api/chat'),model=require('../api/_school_summary');server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/chat'){let raw='';for await(const c of req)raw+=c;req.body=JSON.parse(raw);return chat(req,res);}if(u.pathname==='/api/school-summary'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(u.searchParams.has('id')?model.summary(u.searchParams.get('id'),u.searchParams.get('kind')):{schools:model.list()}));}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.geojson':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch(e){res.statusCode=400;res.end(JSON.stringify({summary:e.message}));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 const report={base,started:new Date().toISOString(),cases:[],errors:[]};
 try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 for(const c of cases){
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.workspace-nav [data-workspace="ask"]').click();await page.locator('#chat-scope').selectOption('all');await page.locator('#question').fill(c.question);
  const planResponse=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().postDataJSON()?.action==='hitl_plan');await page.locator('#send').click();const plan=await (await planResponse).json();assert.equal(plan.catalog.length,42);assert(plan.checks.length);
  if(c.id==='safety')assert(plan.suggested.includes('construction')&&plan.checks.some(x=>x.includes('통학 경로가 아닙니다')));
  const selected=[];
  for(const [i,id] of c.factors.entries()){
   const dataset=id.split(':')[0];const r=await page.request.post(base+'/api/chat',{data:{action:'hitl_options',dataset_id:dataset}});assert.equal(r.status(),200);const options=(await r.json()).factors;const f=options.find(f=>f.id===id);assert(f,`Missing ${id}: ${options.map(f=>f.id).join(',')}`);
   await page.locator('.hitl-dataset').selectOption(dataset);await page.getByRole('button',{name:f.label+' +',exact:true}).click();await page.locator('.hitl-selected .direction').nth(i).selectOption(c.directions[i]);if(c.weights)await page.locator('.hitl-selected .weight').nth(i).selectOption(String(c.weights[i]));selected.push(f);
  }
  await page.locator('.hitl-year').fill(c.year?String(c.year):'');
  if(c.upload){await page.getByText('내 자료·현장 의견 추가',{exact:true}).click();await page.locator('.hitl-paste').fill('학교명,시험 통행량\n인천석암초등학교,120\n인천신흥초등학교,80\n인천송림초등학교,100');await page.locator('.hitl-add-paste').click();await page.locator('.hitl-notes').fill('브라우저 검증용 시험값. 실제 통학 조사 결과가 아님.');assert.equal(await page.locator('.hitl-uploads p').count(),1);}
  await page.locator('.hitl-selected').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,c.id+'-selection.png')});
  const start=Date.now(),response=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().postDataJSON()?.action==='hitl_run');await page.locator('.hitl-run').click();const raw=await response,result=await raw.json();assert.equal(raw.status(),200,JSON.stringify(result));assert.equal(result.review.decision,'deferred');assert(Object.values(result.review.gates).every(v=>v==='unverified'));assert.equal(result.review.factors.length,c.factors.length+(c.upload?1:0));
  if(c.id==='safety')assert.equal(new Set(result.visual.chart.points.map(p=>p.name)).size,3);
  if(c.upload){assert.equal(result.review.upload_count,1);const uploaded=result.visual.sections.filter(s=>s.title.includes('사용자 자료'));assert.equal(uploaded.reduce((n,s)=>n+s.table.rows.length,0),3);assert.match(result.review.notes,/시험값/);}
  await page.locator('.hitl-results button').first().waitFor();await page.locator('#evidence-panel').scrollIntoViewIfNeeded();assert(await page.locator('#evidence-panel').innerText());await page.screenshot({path:path.join(out,c.id+'-result.png')});
  let candidates=page.locator('.comparison-section').filter({has:page.locator('svg')});if(c.id==='future')candidates=candidates.filter({hasText:'2031'});if(c.upload)candidates=candidates.filter({hasText:'사용자 자료'});const detail=candidates.first();if(await detail.count()){await detail.locator('h4').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,c.id+'-distribution.png')});await detail.locator('svg').first().screenshot({path:path.join(out,c.id+'-chart.png')});}
  fs.writeFileSync(path.join(out,c.id+'.json'),JSON.stringify({question:c.question,plan,selected,result},null,2));report.cases.push({id:c.id,question:c.question,ms:Date.now()-start,factors:result.review.factors.map(f=>({id:f.id,label:f.label,weight:f.weight,share:f.share_percent})),sections:result.visual.sections.length,charts:await page.locator('#evidence-panel svg').count(),school_id:result.school_id,summary:result.summary});console.log('PASS '+c.id+' '+report.cases.at(-1).ms+'ms');
  if(c.id==='library'){await page.locator('.hitl-selected .weight').first().selectOption('1');assert(await page.locator('.hitl-results button').first().isDisabled());const changed=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().postDataJSON()?.action==='hitl_run');await page.locator('.hitl-run').click();const d=await(await changed).json();assert.notEqual(d.review.factors[0].share_percent,result.review.factors[0].share_percent);report.weight_revision=true;}
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.hitl-selected').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'mobile.png')});report.mobile=true;assert.deepEqual(report.errors,[]);report.finished=new Date().toISOString();report.passed=true;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
