'use strict';
// 02 자료에 묻기 — agent chat: question → evidence (map/chart/table) → answer; weights sliders; clarifications; saved via AnalysisTopics.
window.ChatAgent=(()=>{
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const history=[];let busy=false;
 function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function post(payload){const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(65000)});const d=await r.json();if(!r.ok&&!d.summary)throw Error('요청 실패');return d;}
 function scope(){const s=(typeof schools!=='undefined'?schools:[]).find(s=>s.id===$('school').value),all=$('chat-scope').value==='all';return {scope:all?'all':'school',school_id:all?null:($('school').value||null),level:s&&!all?s.level:($('chat-level')?.value||$('level').value),kind:$('kind').value,school_name:all?null:s?.name};}
 function askText(q){$('question').value=q;submit();}
 function chips(items,onClick){if(!items?.length)return null;const box=document.createElement('div');box.className='prompts agent-followups';for(const t of items){const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=()=>onClick(t);box.append(b);}return box;}
 function weightPanel(article,d,question){
  const weights=d.weights||d.needs_input?.weights||[];if(!weights.length)return;
  const panel=document.createElement('section');panel.className='hitl-plan agent-weights';
  panel.innerHTML=`<h4>가중치 조정 <small>합계를 100%로 환산합니다 · 바꾼 뒤 “다시 계산”</small></h4><div class="hitl-selected"></div><div class="hitl-share-strip"></div><button type="button" class="hitl-run">이 가중치로 다시 계산</button><p class="hitl-status fine" role="status"></p>`;
  const list=panel.querySelector('.hitl-selected'),strip=panel.querySelector('.hitl-share-strip'),status=panel.querySelector('.hitl-status');
  const state=weights.map(w=>({column:w.column,label:w.label||w.column,prefer:w.prefer||'high',weight:Number.isFinite(w.share_pct)?w.share_pct:Math.round((w.weight||1)*100)}));
  function shares(){const total=state.reduce((n,w)=>n+w.weight,0)||1;panel.querySelectorAll('[data-share]').forEach(el=>{const w=state[Number(el.dataset.share)];el.textContent=Math.round(w.weight/total*100)+'%';});strip.innerHTML=state.map(w=>`<span style="flex:${Math.max(1,w.weight)}">${esc(w.label)} ${Math.round(w.weight/total*100)}%</span>`).join('');}
  state.forEach((w,i)=>{const f=document.createElement('fieldset');f.innerHTML=`<legend>${esc(w.label)}</legend><label>우선 방향 <select class="direction"><option value="high">값이 클수록 우선</option><option value="low">값이 작을수록 우선</option></select></label><label>가중치 <output data-share="${i}"></output><input class="weight" type="range" min="0" max="100" step="5" value="${w.weight}" aria-label="${esc(w.label)} 가중치"></label><div class="hitl-lever-labels"><span>비중 없음</span><span>보통</span><span>매우 중요</span></div>`;f.querySelector('.direction').value=w.prefer;f.querySelector('.direction').onchange=e=>{w.prefer=e.target.value;};f.querySelector('.weight').oninput=e=>{w.weight=Number(e.target.value);shares();};list.append(f);});
  shares();
  panel.querySelector('.hitl-run').onclick=async()=>{if(busy)return;busy=true;const b=panel.querySelector('.hitl-run');b.disabled=true;status.textContent='가중치를 반영해 다시 계산하고 있습니다…';
   const sc=d.weights_scope||{},payload={...scope(),question,action:'reweight',criteria:state.map(w=>({column:w.column,prefer:w.prefer,weight:w.weight})),rank_level:sc.level,rank_gu:sc.gu,rank_island:sc.island,limit:sc.limit};
   const ref=await window.AnalysisTopics?.start(question+' (가중치 조정)',payload);
   try{const r=await post(payload);await window.AnalysisTopics?.finish(ref,r);if(!r.answerable)throw Error(r.summary);status.textContent='반영했습니다.';render(article,r,question,{keepWeights:true});}
   catch(e){await window.AnalysisTopics?.finish(ref,null,e.message);status.textContent=e.message;}
   finally{busy=false;b.disabled=false;}};
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
  const head=article.querySelector('h3').outerHTML;
  article.innerHTML=head+`<p class="agent-summary">${esc(d.summary||d.blocked_reason||'답변에 필요한 근거가 없습니다.')}</p>`;
  if(d.highlights?.length)article.insertAdjacentHTML('beforeend',`<ul class="agent-highlights">${d.highlights.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`);
  if(d.caveats?.length)article.insertAdjacentHTML('beforeend',`<p class="fine agent-caveats">${d.caveats.map(esc).join(' · ')}</p>`);
  if(d.needs_input)inputPanel(article,d,question);else if(d.weights?.length)weightPanel(article,d,question);
  if(d.data_requests?.length){const box=document.createElement('details');box.className='collection-assistant agent-data';box.innerHTML=`<summary>더 정확한 답을 위해 첨부하면 좋은 내부 자료 <span>${d.data_requests.length}</span></summary>`;for(const r of d.data_requests){const item=document.createElement('div');item.className='collection-card';item.innerHTML=`<strong>${esc(r.title)}</strong><p>${esc(r.why)}</p><p class="fine">항목: ${esc((r.fields||[]).join(' · '))}</p><div class="collection-actions"><button type="button" class="tpl">조사표 CSV 내려받기</button><button type="button" class="attach">확보한 자료 첨부</button></div>`;item.querySelector('.tpl').onclick=()=>window.CollectionAssistant?.template({title:r.title,fields:['학교명','연도',...(r.fields||[]),'출처','기준일']});item.querySelector('.attach').onclick=()=>{const el=$('upload-details');el.open=true;el.scrollIntoView?.({block:'center',behavior:'smooth'});};box.append(item);}article.append(box);}
  const follow=chips(d.followups,t=>askText(t));if(follow){const p=document.createElement('p');p.className='fine';p.textContent='이어서 물어보기';article.append(p,follow);}
  window.SourceEvidence?.mount(article,d);
  const actions=document.createElement('div');actions.className='agent-actions';
  for(const [label,fn] of [['지도·자료 다시 보기 →',()=>window.ChatWorkspace?.show(d,question)],['답변·근거 JSON 저장 ↓',()=>download({question,...d},'반경너머-질문근거.json')]]){const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent=label;b.onclick=fn;actions.append(b);}
  if(d.agent?.usage)actions.insertAdjacentHTML('beforeend',`<small class="fine agent-meta">${esc(d.agent.model)} · 도구 ${d.agent.calls?.length||0}회 · 토큰 ${d.agent.usage.input+d.agent.usage.output}${d.agent.usage.cached?` (캐시 ${d.agent.usage.cached})`:''} · ${((d.agent.ms||0)/1000).toFixed(1)}s</small>`);
  article.append(actions);
  if(d.answerable!==false)window.ChatWorkspace?.show(d,question);
 }
 async function submit(event){
  event?.preventDefault();const q=$('question').value.trim();if(!q||busy)return;
  let attachment;try{attachment=window.ChatUpload?.payload();}catch(e){$('upload-status').textContent=e.message;return;}
  const sc=scope();if(sc.scope==='school'&&!sc.school_id){$('chat-context').textContent='학교를 선택하거나 질문 범위를 전체 통계로 바꾸세요.';return;}
  const article=document.createElement('article');article.className='message agent-message';article.innerHTML=`<h3>${esc(sc.school_name||sc.level+' 전체')} · ${esc(q)}</h3><p role="status">자료를 조회하고 있습니다… (보통 10~20초)</p>`;$('messages').append(article);article.scrollIntoView?.({block:'nearest'});
  busy=true;$('send').disabled=true;$('question').value='';
  const payload={question:q,scope:sc.scope,school_id:sc.school_id,level:sc.level,kind:sc.kind,upload:attachment,history:history.slice(-3)};
  const ref=await window.AnalysisTopics?.start(q,payload);
  try{const d=await post(payload);await window.AnalysisTopics?.finish(ref,d);render(article,d,q);if(d.answerable!==false&&d.mode!=='needs_input')history.push({q,a:(d.summary||'').slice(0,400)});}
  catch(e){await window.AnalysisTopics?.finish(ref,null,e.message);article.querySelector('[role=status]')?.remove();article.insertAdjacentHTML('beforeend',`<p class="error">${esc(e.name==='TimeoutError'?'답변이 지연되고 있습니다. 질문을 나누어 다시 시도해 주세요.':'답변 연결에 실패했습니다. 잠시 후 다시 질문해 주세요.')}</p>`);}
  finally{busy=false;$('send').disabled=false;}
 }
 $('chat-form').onsubmit=submit;
 document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{if(/전체|군.?구|상위|하위|비교/.test(b.dataset.question)&&!$('school').value)$('chat-scope').value='all';$('question').value=b.dataset.question;$('question').focus();});
 return {submit,ask:askText,history};
})();
