'use strict';
(() => {
  const dataFrame=$('data-center-frame');
  let frameObserver;
  function resizeDataCenter() {
    if($('workspace-data').hidden)return;
    const doc=dataFrame.contentDocument,content=doc?.querySelector('.wrap');
    if(content){
      const padding=parseFloat(dataFrame.contentWindow.getComputedStyle(doc.body).paddingBottom)||0;
      dataFrame.style.height=`${Math.ceil(content.offsetTop+content.getBoundingClientRect().height+padding)}px`;
    }
  }
  dataFrame.addEventListener('load',()=>{
    const body=dataFrame.contentDocument?.body;
    if(!body)return;
    frameObserver?.disconnect();
    frameObserver=new ResizeObserver(resizeDataCenter);
    frameObserver.observe(body.querySelector('.wrap')||body);
    resizeDataCenter();
  });
  function scopeLabel() {
    const s=schools.find(row=>row.id===$('school').value);
    $('chat-context').textContent=$('chat-scope').value==='all'
      ?`${$('chat-level')?.value||$('level').value} 전체 기준으로 답합니다. 답변마다 실제 범위와 자료 시점을 표시합니다.`
      :s?`${s.name} · ${$('kind').selectedOptions[0].textContent} 기준으로 답합니다. 답변마다 근거와 범위를 표시합니다.`:'학교를 선택하거나 질문 범위를 전체 통계로 바꾸세요.';
  }
  function show(page) {
    if(!document.getElementById(`workspace-${page}`))return;
    document.querySelectorAll('.workspace-page').forEach(el=>{el.hidden=el.id!==`workspace-${page}`;});
    document.querySelectorAll('.workspace-nav button').forEach(el=>{
      if(el.dataset.workspace===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
    });
    document.querySelector(`.workspace-nav [data-workspace="${page}"]`).focus();
    if(page==='data'){
      if(!dataFrame.hasAttribute('src'))dataFrame.src=dataFrame.dataset.src;
      else requestAnimationFrame(resizeDataCenter);
    }
    if(page==='ask')scopeLabel();window.dispatchEvent(new Event('resize'));
  }
  $('chat-scope').addEventListener('change',scopeLabel);$('chat-level')?.addEventListener('change',scopeLabel);
  document.querySelectorAll('[data-question]').forEach(el=>el.addEventListener('click',scopeLabel));
  document.querySelectorAll('[data-workspace]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();show(el.dataset.workspace);}));
  function sync() {
    const s=schools.find(row=>row.id===$('school').value);
    $('workspace-context').textContent=s?`선택 학교: ${s.name} · ${$('kind').selectedOptions[0].textContent} · 자료 확인 후 판단`:'학교를 선택하면 그 학교 기준으로, 선택하지 않으면 전체·군·구 기준으로 답합니다.';
    scopeLabel();
  }
  new MutationObserver(sync).observe($('summary'),{childList:true,subtree:true});
  sync();
  if(location.hash==='#workspace-data')show('data');
})();
