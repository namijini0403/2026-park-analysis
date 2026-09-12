'use strict';
// Conversation recorder: questions and results of the current visit are kept in memory and saved as one conversation
// when the user presses 저장하기. Saved conversations are listed in the 저장된 대화 tab. Nothing is auto-saved.
window.AnalysisTopics=(()=>{
 const VERSION=2;let dbPromise;
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const open=()=>dbPromise||=new Promise((resolve,reject)=>{const r=indexedDB.open('beyond-radius-analysis-topics',1);r.onupgradeneeded=()=>r.result.createObjectStore('topics',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const op=async(mode,fn)=>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('topics',mode),request=fn(tx.objectStore('topics'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('저장 중단'));});};
 const session={entries:[],savedId:null,dirty:false};
 const bar=document.createElement('div');bar.className='chat-save-bar';bar.innerHTML='<p class="chat-save-status" role="status">이번 대화 0건 · 질문한 뒤 저장할 수 있습니다.</p><input class="chat-save-name" aria-label="대화 이름" maxlength="100" placeholder="대화 이름 (비우면 첫 질문으로 저장)"><button type="button" class="chat-save" disabled>대화 저장하기 ↓</button><button type="button" class="chat-new text-button">새 대화 시작</button>';
 $('messages').after(bar);const status=bar.querySelector('.chat-save-status'),saveButton=bar.querySelector('.chat-save');
 function refreshBar(){const n=session.entries.length;saveButton.disabled=!n;saveButton.textContent=session.savedId?'다시 저장하기 ↓':'대화 저장하기 ↓';status.textContent=n?`이번 대화 ${n}건 · ${session.savedId?(session.dirty?'저장 후 새 질문이 있습니다.':'저장됨 · ‘04 저장된 대화’ 탭에서 다시 볼 수 있습니다.'):'아직 저장하지 않았습니다. 대화가 끝나면 저장하세요.'}`:'이번 대화 0건 · 질문한 뒤 저장할 수 있습니다.';}
 const strip=r=>{const c=JSON.parse(JSON.stringify(r||{}));delete c.token;delete c.admin_token;if(c.upload?.rows)c.upload={name:c.upload.name,headers:c.upload.headers,rows:c.upload.rows.slice(0,200),truncated:c.upload.rows.length>200};return c;};
 async function start(question,request={}){const entry={id:crypto.randomUUID(),question,request:strip(request),created:new Date().toISOString(),status:'진행 중',result:null,error:null};session.entries.push(entry);session.dirty=true;refreshBar();return {id:entry.id};}
 async function finish(ref,result,error){if(!ref)return;const e=session.entries.find(e=>e.id===ref.id);if(!e)return;e.status=error?'실패':'완료';e.error=error||null;e.result=result?JSON.parse(JSON.stringify(result)):null;session.dirty=true;refreshBar();}
 function context(){const school=$('school')?.selectedOptions?.[0];return {school_id:$('school')?.value||null,school_name:$('school')?.value?school?.textContent:null,level:$('chat-level')?.value||null,scope:$('chat-scope')?.value||null};}
 async function save(){
  if(!session.entries.length)return;saveButton.disabled=true;
  try{const name=(bar.querySelector('.chat-save-name').value.trim()||session.entries[0].question).slice(0,100),now=new Date().toISOString();
   const existing=session.savedId&&await op('readonly',s=>s.get(session.savedId));
   const record={id:existing?.id||crypto.randomUUID(),schema:VERSION,name,created:existing?.created||now,updated:now,context:context(),entries:session.entries.map(e=>JSON.parse(JSON.stringify(e)))};
   await op('readwrite',s=>s.put(record));session.savedId=record.id;session.dirty=false;refreshBar();status.textContent=`‘${name}’ 저장 완료 · ${record.entries.length}건 · ‘04 저장된 대화’ 탭에서 확인하세요.`;await list();}
  catch(e){status.textContent='저장 실패: '+e.message+' · 답변의 JSON 저장 버튼으로 파일에 보관해 주세요.';}
  finally{saveButton.disabled=!session.entries.length;}
 }
 function reset(){session.entries=[];session.savedId=null;session.dirty=false;bar.querySelector('.chat-save-name').value='';$('messages').replaceChildren();const panel=$('evidence-panel');if(panel)panel.innerHTML='<p class="eyebrow">지도 · 자료 · 출처</p><h3>질문하면 근거가 여기에 나타나요.</h3><p class="muted">목록은 지도와 표로, 분석은 차트와 해석으로 확인하세요.</p>';refreshBar();}
 saveButton.onclick=save;bar.querySelector('.chat-new').onclick=()=>{if(session.entries.length&&session.dirty&&!confirm('저장하지 않은 대화가 있습니다. 새 대화를 시작할까요?'))return;reset();};
 // Saved conversations tab
 const listHost=$('saved-list'),savedStatus=$('saved-status');
 function restore(entry){document.querySelector('.workspace-nav [data-workspace="ask"]')?.click();const old=JSON.parse(JSON.stringify(entry.result));old.summary='저장 당시 기록입니다. 현재 지원안은 다시 계산해야 합니다. '+(old.summary||'');window.ChatWorkspace?.show(old,entry.question);const warning=document.createElement('p');warning.className='vs-history-warning';warning.textContent='저장 당시 관측·가정입니다. 현재 지원 판단으로 자동 복원하지 않습니다.';$('evidence-panel')?.prepend(warning);}
 function download(record){const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='반경너머-분석대화-'+record.name.replace(/[\\/:*?"<>|]+/g,'_').slice(0,40)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function article(t){
  const legacy=t.schema!==VERSION,item=document.createElement('article');
  item.innerHTML=`<h3>${esc(t.name)}</h3><p class="saved-meta">${esc(new Date(t.updated||t.created).toLocaleString('ko'))} · 질문 ${t.entries.length}건${t.context?.school_name?' · '+esc(t.context.school_name):''}${t.context?.level?' · '+esc(t.context.level):''}${legacy?' · 이전 자동 저장 기록':''}</p><div class="saved-actions"></div><details><summary>대화 내용 보기</summary><div class="saved-entries"></div></details>`;
  const actions=item.querySelector('.saved-actions');
  for(const [label,fn,cls] of [['이어서 질문하기',()=>{session.entries=t.entries.map(e=>JSON.parse(JSON.stringify(e)));session.savedId=legacy?null:t.id;session.dirty=false;$('messages').replaceChildren();for(const e of t.entries){const m=document.createElement('article');m.className='message';m.innerHTML=`<h3>${esc(e.question)}</h3><p>${esc(e.result?.summary||e.error||'결과 없음')}</p><p class="fine">저장된 대화에서 불러온 기록입니다.</p>`;if(e.result){const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent='당시 근거 다시 보기 →';b.onclick=()=>restore(e);m.append(b);}$('messages').append(m);}refreshBar();document.querySelector('.workspace-nav [data-workspace="ask"]')?.click();},''],['JSON 저장 ↓',()=>download(t),''],['삭제',async()=>{if(!confirm(`‘${t.name}’ 대화를 삭제할까요?`))return;await op('readwrite',s=>s.delete(t.id));if(session.savedId===t.id)session.savedId=null;await list();},'danger']]){const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;b.onclick=fn;actions.append(b);}
  const entries=item.querySelector('.saved-entries');
  for(const e of t.entries){const row=document.createElement('div');row.className='saved-entry';row.innerHTML=`<h4>${esc(e.question)}</h4><small>${esc(new Date(e.created).toLocaleString('ko'))} · ${esc(e.status)}</small><p>${esc((e.result?.summary||e.error||'결과 없음').slice(0,600))}</p>`;if(e.result){const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent='당시 근거 다시 보기 →';b.onclick=()=>restore(e);row.append(b);}const again=document.createElement('button');again.type='button';again.className='text-button';again.textContent='이 질문으로 새 분석 →';again.onclick=()=>{document.querySelector('.workspace-nav [data-workspace="ask"]')?.click();$('question').value=e.question;$('question').focus();};row.append(again);entries.append(row);}
  return item;
 }
 async function list(){
  if(!listHost)return;
  try{const rows=(await op('readonly',s=>s.getAll())).filter(t=>Array.isArray(t.entries)).sort((a,b)=>String(b.updated||b.created).localeCompare(String(a.updated||a.created)));listHost.replaceChildren();if(!rows.length){listHost.innerHTML='<div class="saved-empty">저장된 대화가 없습니다. ‘02 정책 길잡이’에서 질문한 뒤 ‘대화 저장하기’를 누르세요.</div>';return;}for(const t of rows)listHost.append(article(t));if(savedStatus)savedStatus.textContent=`저장된 대화 ${rows.length}건 · 이 브라우저에만 보관됩니다.`;}
  catch(e){if(savedStatus)savedStatus.textContent='이 브라우저에서 저장 기능을 사용할 수 없습니다: '+e.message;}
 }
 $('saved-import')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const t=JSON.parse(await file.text());if(!t||!Array.isArray(t.entries)||!t.name)throw Error('대화 JSON 형식이 아닙니다.');t.id=t.id||crypto.randomUUID();t.schema=VERSION;t.updated=new Date().toISOString();await op('readwrite',s=>s.put(t));savedStatus.textContent=`‘${t.name}’을(를) 불러왔습니다.`;await list();}catch(err){savedStatus.textContent='불러오기 실패: '+err.message;}finally{e.target.value='';}});
 document.querySelector('.workspace-nav [data-workspace="saved"]')?.addEventListener('click',list);
 refreshBar();list().catch(()=>{});
 return {start,finish,save,reset,list};
})();
