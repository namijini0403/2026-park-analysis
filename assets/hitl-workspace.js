'use strict';
(() => {
  const fields=['review-purpose','review-option','review-reason','review-followup'];
  let selectedContext='';
  function scopeLabel() {
    const s=schools.find(row=>row.id===$('school').value);
    $('chat-context').textContent=$('chat-scope').value==='all'
      ?`${$('chat-level')?.value||$('level').value} 전체 기준으로 답합니다. 답변마다 실제 범위와 자료 시점을 표시합니다.`
      :s?`${s.name} · ${$('kind').selectedOptions[0].textContent} 기준으로 답합니다. 답변마다 근거와 범위를 표시합니다.`:'학교를 선택하거나 질문 범위를 전체 통계로 바꾸세요.';
  }
  function show(page) {
    document.querySelectorAll('.workspace-page').forEach(el=>{el.hidden=el.id!==`workspace-${page}`;});
    document.querySelectorAll('.workspace-nav button').forEach(el=>{
      if(el.dataset.workspace===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
    });
    document.querySelector(`.workspace-nav [data-workspace="${page}"]`).focus();
    if(page==='ask')scopeLabel();window.dispatchEvent(new Event('resize'));
  }
  $('chat-scope').addEventListener('change',scopeLabel);$('chat-level')?.addEventListener('change',scopeLabel);
  document.querySelectorAll('[data-question]').forEach(el=>el.addEventListener('click',scopeLabel));
  document.querySelectorAll('[data-workspace]').forEach(el=>el.addEventListener('click',()=>show(el.dataset.workspace)));
  function sync() {
    const key=`${$('school').value}/${$('kind').value}`;
    if(key!==selectedContext){
      fields.forEach(id=>{$(id).value='';});$('review-outcome').value='deferred';$('review-status').textContent='';selectedContext=key;
    }
    const s=schools.find(row=>row.id===$('school').value);
    $('workspace-context').textContent=s?`선택 학교: ${s.name} · ${$('kind').selectedOptions[0].textContent} · 자료 확인 후 판단`:'학교를 선택하면 그 학교 기준으로, 선택하지 않으면 전체·군·구 기준으로 답합니다.';
    $('review-context').textContent=current?`${current.school.name} · ${current.label} — 화면의 관측 요약과 출처를 기록에 포함합니다.`:'01 학교 찾기에서 학교를 선택하면 관측 요약과 출처가 기록에 포함됩니다.';
    $('save-review').disabled=!current;
    [...fields,'review-outcome'].forEach(id=>{$(id).disabled=!current;});
    scopeLabel();
  }
  new MutationObserver(sync).observe($('summary'),{childList:true,subtree:true});
  $('save-review').onclick=()=>{
    if(!current)return;
    if(!$('review-purpose').value.trim()||!$('review-reason').value.trim()){
      $('review-status').textContent='검토 목적과 판단 이유를 입력해 주세요.';
      (!$('review-purpose').value.trim()?$('review-purpose'):$('review-reason')).focus();return;
    }
    const record={schema_version:1,record_type:'review_memo',created_at:new Date().toISOString(),
      purpose:$('review-purpose').value.trim(),outcome:$('review-outcome').value,
      options_note:$('review-option').value.trim(),reason:$('review-reason').value.trim(),followup:$('review-followup').value.trim(),
      observation:current,limits:['검토 메모이며 정책 확정·원자료 변경 아님','채팅·첨부 자료 미포함','원본 스냅샷 별도 보관 필요']};
    download(record,`반경너머-검토기록-${current.school.id}.json`);
    $('review-status').textContent='검토 기록 파일을 내려받았습니다. 파일을 보관하세요.';
  };
  sync();
})();
