'use strict';
// 02 자료에 묻기 — agent chat: question → evidence (map/chart/table) → answer; weights sliders; clarifications; saved via AnalysisTopics.
window.ChatAgent=(()=>{
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const history=[];let busy=false;
 const schoolIds=d=>[...new Set((d.visual?.map||[]).map(p=>p.id).filter(Boolean))].slice(0,50);
 async function record(method,...args){try{return await window.AnalysisTopics?.[method](...args);}catch{return null;}}
 function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function post(payload){const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(65000)});const d=await r.json();if(!r.ok&&!d.summary)throw Error('요청 실패');return d;}
 function scope(){const s=(typeof schools!=='undefined'?schools:[]).find(s=>s.id===$('school').value),all=$('chat-scope').value==='all';return {scope:all?'all':'school',school_id:all?null:($('school').value||null),level:s&&!all?s.level:($('chat-level')?.value||$('level').value),kind:$('kind').value,school_name:all?null:s?.name};}
 function askText(q){$('question').value=q;submit();}
 function chips(items,onClick){if(!items?.length)return null;const box=document.createElement('div');box.className='prompts agent-followups';for(const t of items){const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=()=>onClick(t);box.append(b);}return box;}
 function weightPanel(article,d,question){
  const weights=d.weights||d.needs_input?.weights||[];if(!weights.length)return;
  const panel=document.createElement('details');panel.className='hitl-plan agent-weights';
  panel.innerHTML=`<summary>관심 비중 바꾸기</summary><p class="fine">비중을 바꾸면 기준별 자료와 해석을 다시 보여드립니다. 학교 점수로 합산하지 않습니다.</p><div class="hitl-selected"></div><div class="hitl-share-strip"></div><button type="button" class="hitl-run">이 비중으로 다시 답변</button><p class="hitl-status fine" role="status"></p>`;
  const list=panel.querySelector('.hitl-selected'),strip=panel.querySelector('.hitl-share-strip'),status=panel.querySelector('.hitl-status');
  const state=weights.map(w=>({column:w.column,label:w.label||w.column,prefer:w.prefer||'high',weight:Number.isFinite(w.share_pct)?w.share_pct:Math.round((w.weight||1)*100)}));
  function shares(){const total=state.reduce((n,w)=>n+w.weight,0)||1;panel.querySelectorAll('[data-share]').forEach(el=>{const w=state[Number(el.dataset.share)];el.textContent=Number((w.weight/total*100).toFixed(1))+'%';});strip.innerHTML=state.map(w=>`<span style="flex:${Math.max(1,w.weight)}">${esc(w.label)} ${Number((w.weight/total*100).toFixed(1))}%</span>`).join('');}
  state.forEach((w,i)=>{const f=document.createElement('fieldset');f.innerHTML=`<legend>${esc(w.label)}</legend><label>우선 방향 <select class="direction"><option value="high">큰 값부터 살펴보기</option><option value="low">작은 값부터 살펴보기</option></select></label><label>가중치 <output data-share="${i}"></output><input class="weight" type="range" min="0" max="100" step="5" value="${w.weight}" aria-label="${esc(w.label)} 가중치"></label><div class="hitl-lever-labels"><span>비중 없음</span><span>보통</span><span>매우 중요</span></div>`;f.querySelector('.direction').value=w.prefer;f.querySelector('.direction').onchange=e=>{w.prefer=e.target.value;};f.querySelector('.weight').oninput=e=>{w.weight=Number(e.target.value);shares();};list.append(f);});
  shares();
  panel.querySelector('.hitl-run').onclick=async()=>{if(busy)return;busy=true;$('send').disabled=true;$('send').textContent='답변 갱신 중…';const b=panel.querySelector('.hitl-run');b.disabled=true;status.textContent='가중치를 반영해 다시 계산하고 있습니다…';
   const sc=d.weights_scope||{},payload={...(article.requestContext||scope()),question,action:'reweight',criteria:state.map(w=>({column:w.column,prefer:w.prefer,weight:w.weight})),rank_level:sc.level,rank_gu:sc.gu,rank_island:sc.island,limit:sc.limit};
   const ref=await record('start',question+' (관심 비중 조정)',payload);
   try{const r=await post(payload);await record('finish',ref,r);if(!r.answerable)throw Error(r.summary);status.textContent='반영했습니다.';render(article,r,question);history.push({q:question+' (관심 비중 조정)',a:r.summary.slice(0,600),school_ids:schoolIds(r)});article.querySelector('.agent-summary')?.scrollIntoView?.({block:'center',behavior:'smooth'});}
   catch(e){await record('finish',ref,null,e.message);status.textContent=e.message;}
   finally{busy=false;b.disabled=false;$('send').disabled=false;$('send').textContent='보내기 ↑';}};
  article.append(panel);
 }
 function inputPanel(article,d,question){
  const n=d.needs_input;if(!n)return;const box=document.createElement('section');box.className='hitl-plan agent-input';
  const opts=n.options||[];box.innerHTML=`<h4>선택해 주세요</h4>${opts.length?`<div class="hitl-related">${opts.map((o,i)=>`<label class="hitl-choice"><input type="${n.multi?'checkbox':'radio'}" name="agent-opt" value="${esc(o.id)}" ${!n.multi&&!i?'checked':''}><span><strong>${esc(o.label)}</strong>${o.description?`<small>${esc(o.description)}</small>`:''}</span></label>`).join('')}</div>`:''}<label>직접 입력 (선택)<input class="agent-free" maxlength="200" placeholder="예: 학생 수를 더 중요하게"></label><button type="button" class="hitl-run">이 조건으로 답변</button>`;
  box.querySelector('.hitl-run').onclick=()=>{const chosen=[...box.querySelectorAll('input[name=agent-opt]:checked')].map(i=>opts.find(o=>o.id===i.value)?.label).filter(Boolean),free=box.querySelector('.agent-free').value.trim();const parts=[...chosen,free].filter(Boolean);if(!parts.length){box.querySelector('.hitl-run').textContent='선택하거나 입력해 주세요';return;}history.push({q:question,a:d.summary});askText(`${question} — 선택: ${parts.join(', ')}`);};
  article.append(box);
  if(n.weights?.length)weightPanel(article,{weights:n.weights,weights_scope:null},question);
 }
 function render(article,d,question,opt={}){
  d=window.ChatWorkspace?.safeResult?.(d)||d;
  const existingPanel=$('evidence-panel');if(existingPanel&&article.contains(existingPanel))document.querySelector('.chat-workspace').append(existingPanel);
  window.ChatMap?.dispose(article);
  const head=article.querySelector('h3').outerHTML;
  article.innerHTML=head+`<p class="agent-summary">${esc(d.summary||d.blocked_reason||'답변에 필요한 근거가 없습니다.')}</p>`;
  article.querySelector('.agent-summary').insertAdjacentHTML('beforebegin','<p class="chat-result-label">04 결과 · 확인된 내용</p>');
  if(d.highlights?.length)article.insertAdjacentHTML('beforeend',`<ul class="agent-highlights">${d.highlights.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`);
  if(d.caveats?.length)article.insertAdjacentHTML('beforeend',`<p class="fine agent-caveats">${d.caveats.map(esc).join(' · ')}</p>`);

  if(d.needs_input)inputPanel(article,d,question);else if(d.weights?.length)weightPanel(article,d,question);
  if(d.data_requests?.length){const box=document.createElement('details');box.className='collection-assistant agent-data';box.innerHTML=`<summary>더 정확한 답을 위해 첨부하면 좋은 내부 자료 <span>${d.data_requests.length}</span></summary>`;for(const r of d.data_requests){const item=document.createElement('div');item.className='collection-card';item.innerHTML=`<strong>${esc(r.title)}</strong><p>${esc(r.why)}</p><p class="fine">항목: ${esc((r.fields||[]).join(' · '))}</p><div class="collection-actions"><button type="button" class="tpl">조사표 CSV 내려받기</button><button type="button" class="attach">확보한 자료 첨부</button></div>`;item.querySelector('.tpl').onclick=()=>window.CollectionAssistant?.template({title:r.title,fields:['학교명','연도',...(r.fields||[]),'출처','기준일']});item.querySelector('.attach').onclick=()=>{const el=$('upload-details');el.open=true;el.scrollIntoView?.({block:'center',behavior:'smooth'});};box.append(item);}article.append(box);}
  const follow=chips(d.followups,t=>askText(t));if(follow){const p=document.createElement('p');p.className='fine';p.textContent='이어서 물어보기';article.append(p,follow);}
  const sources=document.createElement('details');sources.className='agent-sources';sources.innerHTML='<summary>출처와 확인 사항</summary>';window.SourceEvidence?.mount(sources,d);article.append(sources);
  const actions=document.createElement('div');actions.className='agent-actions';
  for(const [label,fn] of [['지도·통계 보기 →',()=>window.ChatWorkspace?.show(d,question)],['답변·근거 JSON 저장 ↓',()=>download({question,...d},'반경너머-질문근거.json')]]){const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent=label;b.onclick=fn;actions.append(b);}

  if(d.agent?.usage)actions.insertAdjacentHTML('beforeend',`<details><summary>응답 정보</summary><small class="fine agent-meta">${esc(d.agent.model)} · 도구 ${d.agent.calls?.length||0}회 · 토큰 ${d.agent.usage.input+d.agent.usage.output}${d.agent.usage.cached?` (캐시 ${d.agent.usage.cached})`:''} · ${((d.agent.ms||0)/1000).toFixed(1)}s</small></details>`);
  if(d.answerable===false){const retry=document.createElement('button');retry.type='button';retry.textContent='다시 답변 받기';retry.onclick=()=>askText(question);actions.append(retry);}
  article.append(actions);
  if(article.selectedVariables?.length){const context=document.createElement('details');context.className='chat-analysis-context';const summary=document.createElement('summary');summary.textContent='분석에 사용한 질문 조건';const text=document.createElement('p');text.textContent=article.selectedVariables.join(' · ');context.append(summary,text);article.querySelector('.agent-summary').before(context);}
  window.ChatWorkspace?.show(d,question);
 }
 function chooseVariables(article,q,plan){
  return new Promise(resolve=>{
   article.querySelector('[role=status]')?.remove();
   const box=document.createElement('section');box.className='chat-variable-step';
   const variables=plan.variables||[];
   box.innerHTML='<p class="chat-result-label">02 변수 선택</p><h4>질문에 맞는 변수를 제안했어요</h4><p class="fine">추천 이유를 확인하고 함께 볼 변수를 선택하세요. 실제 자료 누락 여부는 분석에서 확인합니다.</p><div class="chat-variable-options"></div><details><summary>추가 데이터 제안 · 직접 지정</summary><div class="chat-plan-data"></div><label>함께 볼 변수나 확인할 조건<input class="chat-extra-variable" maxlength="200" placeholder="예: 공원 개방시간, 횡단보도 유무"></label><button type="button" class="chat-step-attach text-button">자료 첨부하기</button></details><div class="chat-step-actions"><button type="button" class="chat-run-analysis">이 조건으로 분석</button><button type="button" class="chat-cancel-analysis text-button">취소</button></div>';
   const intro=document.createElement('p');intro.className='chat-plan-summary';intro.textContent=plan.summary;box.querySelector('h4').after(intro);
   for(const v of variables){const label=document.createElement('label'),input=document.createElement('input'),body=document.createElement('span'),title=document.createElement('strong'),why=document.createElement('small');input.type='checkbox';input.value=v.label;title.textContent=v.label;why.textContent=v.why;body.append(title,why);label.append(input,body);box.querySelector('.chat-variable-options').append(label);}
   const data=box.querySelector('.chat-plan-data');for(const r of plan.data_requests||[]){const item=document.createElement('p');item.textContent=r.title+' — '+r.why+' (항목: '+(r.fields||[]).join(' · ')+')';data.append(item);}if(!data.childElementCount)data.textContent='현재 질문에 추가로 제안할 수집 자료가 없습니다. 필요한 조건은 아래에 직접 지정할 수 있습니다.';
   box.querySelector('.chat-step-attach').onclick=()=>{$('upload-details').open=true;$('upload-details').scrollIntoView?.({block:'nearest'});};
   box.querySelector('.chat-cancel-analysis').onclick=()=>{article.remove();$('question').value=q;resolve(null);};
   box.querySelector('.chat-run-analysis').onclick=()=>{const selected=[...box.querySelectorAll('input:checked')].map(i=>i.value),extra=box.querySelector('.chat-extra-variable').value.trim();if(extra)selected.push(extra);box.replaceChildren();box.innerHTML='<p class="chat-result-label">03 분석</p><ol class="chat-analysis-steps"><li>선택 범위와 변수 확인</li><li>보유 자료 조회·관측값 비교</li><li>자료 누락과 해석 조건 확인</li></ol><p role="status">자료를 조회하고 결과를 정리하고 있습니다…</p>';const note=document.createElement('p');note.className='fine';note.textContent=selected.length?'선택 변수: '+selected.join(' · '):'질문에 필요한 변수로 분석합니다.';box.prepend(note);resolve(selected);};
   article.append(box);
  });
 }
 async function submit(event){
  event?.preventDefault();const q=$('question').value.trim();if(!q||busy)return;
  let attachment;try{attachment=window.ChatUpload?.payload();}catch(e){$('upload-status').textContent=e.message;return;}
  const sc=scope();if(sc.scope==='school'&&!sc.school_id){$('chat-context').textContent='학교를 선택하거나 질문 범위를 전체 통계로 바꾸세요.';return;}
  const article=document.createElement('article');article.className='message agent-message';article.innerHTML=`<h3>${esc(sc.school_name||sc.level+' 전체')} · ${esc(q)}</h3><p role="status">질문에 맞는 자료를 찾고 답변을 작성하고 있습니다…</p>`;$('messages').append(article);article.scrollIntoView?.({block:'nearest'});
  busy=true;$('send').disabled=true;$('send').textContent='변수 선택 중…';$('question').value='';
  $('send').textContent='변수 제안 중…';article.querySelector('[role=status]').textContent='AI가 질문을 해석하고 변수 후보와 추천 이유를 정리하고 있습니다…';
  let plan;try{plan=await post({action:'plan_variables',question:q,...sc,upload:attachment,history:history.slice(-2)});if(plan.mode!=='variable_plan')throw Error(plan.summary||'변수 제안을 받지 못했습니다.');}
  catch(e){article.querySelector('[role=status]').textContent='변수 제안을 받지 못했습니다. 다시 시도해 주세요.';const retry=document.createElement('button');retry.type='button';retry.textContent='변수 제안 다시 받기';retry.onclick=()=>askText(q);article.append(retry);busy=false;$('send').disabled=false;$('send').textContent='보내기 ↑';return;}
  $('send').textContent='변수 선택 중…';
  const selected=await chooseVariables(article,q,plan);
  if(selected===null){busy=false;$('send').disabled=false;$('send').textContent='보내기 ↑';return;}
  try{attachment=window.ChatUpload?.payload();}catch(e){article.querySelector('[role=status]').textContent=e.message;busy=false;$('send').disabled=false;$('send').textContent='보내기 ↑';return;}
  article.selectedVariables=selected;
  const payload={question:q,selected_variables:selected,variable_plan:plan,scope:sc.scope,school_id:sc.school_id,level:sc.level,kind:sc.kind,upload:attachment,history:history.slice(-3)};
  article.requestContext={...payload,history:undefined};
  $('send').textContent='분석 중…';
  const ref=await record('start',q,payload);
  try{const d=await post(payload);await record('finish',ref,d);render(article,d,q);if(d.answerable!==false&&d.mode!=='needs_input')history.push({q,a:(d.summary||'').slice(0,400),school_ids:schoolIds(d)});}
  catch(e){await record('finish',ref,null,e.message);article.querySelector('[role=status]')?.remove();article.insertAdjacentHTML('beforeend',`<p class="error">${esc(e.name==='TimeoutError'?'답변이 지연되고 있습니다. 질문을 나누어 다시 시도해 주세요.':'답변 연결에 실패했습니다. 잠시 후 다시 질문해 주세요.')}</p>`);const retry=document.createElement('button');retry.type='button';retry.textContent='이 질문 다시 보내기';retry.onclick=()=>askText(q);article.append(retry);}
  finally{busy=false;$('send').disabled=false;$('send').textContent='보내기 ↑';}
 }
 $('chat-form').onsubmit=submit;
 document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{if(/전체|군.?구|상위|하위|비교/.test(b.dataset.question)&&!$('school').value)$('chat-scope').value='all';$('question').value=b.dataset.question;$('question').focus();});
 $('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}});
 return {submit,ask:askText,history};
})();
