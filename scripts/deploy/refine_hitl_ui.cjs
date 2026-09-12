const fs=require('node:fs');
const file='assets/hitl-analysis.js';let s=fs.readFileSync(file,'utf8');
s=s.replace('질문 후 고려 요소를 직접 선택하기','질문에 맞춰 분석하고, 필요할 때 요소 선택하기');
s=s.replace('function display(d){return d;}',`function display(d){return d;}
 async function straightforward(article,plan,payload){
  const overlap=plan.workflow==='overlap';
  article.innerHTML='<h3>'+escape(payload.question)+'</h3><p>'+escape(plan.summary)+'</p>'+(overlap?'<fieldset class="overlap-criteria"><legend>무엇을 비교할까요? 한 가지 선택</legend>'+Object.entries(plan.criteria).map(([id,v],i)=>'<label><input type="radio" name="criterion-'+ticket+'" value="'+id+'" '+(!i?'checked':'')+'> <span>'+escape(v[0])+'<small>'+escape(v[1])+'</small></span></label>').join('')+'</fieldset><p>학구도 + 보행 500m 도달권을 함께 사용합니다. 초록색은 보행권, 보라색은 학구도입니다.</p>':'')+'<button type="button" class="direct-run">'+(overlap?'이 기준으로 비교':'다시 확인')+'</button><p role="status" class="hitl-status"></p>';
  let busy=false,revision=0;
  const button=article.querySelector('.direct-run'),status=article.querySelector('.hitl-status');
  article.querySelectorAll('input').forEach(input=>input.onchange=()=>{revision++;status.textContent='비교 기준을 바꿨습니다. 이 기준으로 비교를 눌러 주세요.';});
  const run=async()=>{if(busy)return;busy=true;button.disabled=true;const rev=revision;status.textContent='요청한 범위와 근거를 계산하고 있습니다…';
   try{const request={...payload,scope:plan.context.school_id?'school':'all',school_id:plan.context.school_id,level:plan.context.level,...(overlap?{action:'hitl_overlap',criterion:article.querySelector('input:checked').value}:{upload:window.ChatUpload?.payload()})};
    const ref=await window.AnalysisTopics?.start(payload.question,request);let d;try{d=await post(request);await window.AnalysisTopics?.finish(ref,d);}catch(e){await window.AnalysisTopics?.finish(ref,null,e.message);throw e;}
    if(rev!==revision){status.textContent='계산 중 기준이 변경되었습니다. 다시 비교해 주세요.';return;}status.textContent=d.summary;window.ChatWorkspace?.show(d,payload.question);
   }catch(e){status.textContent=e.message;}finally{busy=false;button.disabled=false;}
  };button.onclick=run;await run();
 }
`);
s=s.replace('render(article,plan,payload);',"if(plan.workflow==='direct'||plan.workflow==='overlap')await straightforward(article,plan,payload);else render(article,plan,payload);");
s=s.replace('const selections=new Map(),uploads=[];','const selections=new Map(),uploads=[];const available=new Map();');
s=s.replace('<div class="hitl-related"></div><label>자료 영역 추가', '<p class="hitl-count" aria-live="polite">선택한 요소 0개 · 여러 개 선택 가능</p><div class="hitl-related"></div><div class="hitl-suggested"></div><details class="hitl-more"><summary>다른 자료에서 요소 더 찾기</summary><label>자료 영역 추가');
s=s.replace('<div class="hitl-candidates"></div><div class="hitl-selected"></div>', '<div class="hitl-candidates"></div></details><details class="hitl-priority"><summary>중요도와 살펴볼 방향 조정 (선택 사항)</summary><label class="hitl-weight-switch"><input type="checkbox" class="hitl-weighted"> 요소마다 중요도를 다르게 설정</label><p>기본은 모든 요소를 나란히 봅니다. 중요도를 켜면 모두 ‘보통’에서 시작합니다. 중요도는 결과를 검토할 순서와 비중에만 반영됩니다.</p><div class="hitl-selected"></div></details>');
s=s.replace("checks.innerHTML='<h4>함께 확인할 조건과 추가 자료</h4>'", "checks.innerHTML='<details><summary>더 확인할 조건과 추가 자료</summary>'");
s=s.replace(".map(s=>\x60<p>\x24{escape(s)}</p>\x60).join('');find('.hitl-related').before(checks);", ".map(s=>\x60<p>\x24{escape(s)}</p>\x60).join('')+'</details>';find('.hitl-related').before(checks);");
const start=s.indexOf('  function selected()'),end=s.indexOf('  function drawUploads()',start);
if(start<0||end<0)throw Error('UI anchors missing');
s=s.slice(0,start)+`  function syncChecks(){
   article.querySelectorAll('[data-factor]').forEach(input=>{input.checked=selections.has(input.dataset.factor);input.closest('label').classList.toggle('is-selected',input.checked);});
   find('.hitl-count').textContent='선택한 요소 '+selections.size+'개 · 여러 개 선택 가능';
   find('.hitl-run').textContent=selections.size?'선택한 '+selections.size+'개 요소로 분석':'요소를 체크해 주세요';
   find('.hitl-run').disabled=!selections.size;
  }
  function selected(){find('.hitl-selected').replaceChildren();for(const f of selections.values()){
   const row=document.createElement('fieldset');row.innerHTML='<legend>'+escape(f.title+' · '+f.label)+'</legend>'+(f.directions.length>1?'<label>어떤 값을 먼저 살펴볼까요?<select class="direction"><option value="observe">양쪽 모두 보기</option><option value="lower">작은 값 먼저 보기</option><option value="higher">큰 값 먼저 보기</option></select></label>':'<p>지도·기록은 원문 그대로 확인합니다.</p>')+'<label>중요도<select class="weight"><option value="">동일하게 보기</option><option value="1">낮음</option><option value="2">보통</option><option value="3">높음</option></select></label><button type="button">이 요소 제외</button><details><summary>계산 방법과 누락 처리</summary><p>'+escape(f.method)+'</p><p>'+escape(f.missing)+'</p></details>';
   const direction=row.querySelector('.direction');if(direction){direction.value=f.direction;direction.onchange=e=>{f.direction=e.target.value;changed();};}
   const weight=row.querySelector('.weight');weight.value=f.weight??'';weight.disabled=!find('.hitl-weighted').checked;weight.onchange=e=>{f.weight=e.target.value===''?2:Number(e.target.value);e.target.value=f.weight;changed();};
   row.querySelector('button').onclick=()=>{selections.delete(f.id);changed();selected();};find('.hitl-selected').append(row);
  }syncChecks();}
  function candidate(f,area){
   available.set(f.id,f);const row=document.createElement('label');row.className='hitl-choice';
   row.innerHTML='<input type="checkbox" data-factor="'+escape(f.id)+'"><span><strong>'+escape(f.field||f.query?f.label:area.title+' · 지도·기록')+'</strong><small>'+escape(f.reason||area.reason||'직접 추가한 자료')+'</small></span>';
   row.querySelector('input').onchange=e=>{if(e.target.checked){if(selections.size>=16){e.target.checked=false;status.textContent='한 번에 최대 16개 요소를 비교할 수 있습니다.';return;}selections.set(f.id,{...f,title:area.title,direction:'observe',weight:find('.hitl-weighted').checked?2:null});}else selections.delete(f.id);changed();selected();};return row;
  }
  for(const f of plan.candidates||[])find('.hitl-suggested').append(candidate(f,plan.catalog.find(e=>e.id===f.dataset)));
  find('.hitl-weighted').onchange=()=>{const weight=find('.hitl-weighted').checked?2:null;for(const f of selections.values())f.weight=weight;for(const u of uploads){u.hitl||={direction:'observe'};u.hitl.weight=weight;}changed();selected();drawUploads();};
  let optionTicket=0;
  async function options(id){const current=++optionTicket;find('.hitl-candidates').textContent='요소 목록을 읽고 있습니다…';try{const d=await post({action:'hitl_options',dataset_id:id});if(current!==optionTicket)return;const area=plan.catalog.find(e=>e.id===id);find('.hitl-candidates').innerHTML='<h4>'+escape(area.title)+'의 요소 · 여러 개 선택 가능</h4>';for(const f of d.factors)find('.hitl-candidates').append(candidate(f,area));syncChecks();}catch(e){find('.hitl-candidates').textContent=e.message;}}
  if(!plan.suggested.length)find('.hitl-related').textContent='질문에 해당하는 자료를 특정하지 못했습니다. 다른 자료에서 요소 더 찾기를 열어 주세요.';
  find('.hitl-dataset').onchange=e=>e.target.value&&options(e.target.value);
  selected();
`+s.slice(end);
// New uploads inherit the explicit global mode; partial weights never reach the server.
s=s.replace("uploads.push(JSON.parse(JSON.stringify(u)));", "const copy=JSON.parse(JSON.stringify(u));copy.hitl={direction:copy.hitl?.direction||'observe',weight:find('.hitl-weighted').checked?2:null};uploads.push(copy);");
s=s.replace("control.value=u.hitl[key]??'';control.onchange", "control.value=u.hitl[key]??'';if(key==='weight')control.disabled=!find('.hitl-weighted').checked;control.onchange");
s=s.replace("control.value===''?null:Number(control.value)","control.value===''?2:Number(control.value)");
fs.writeFileSync(file,s);
