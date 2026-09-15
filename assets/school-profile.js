'use strict';
// 지도 하단 지표 프로필 패널. /api/school-profile 응답을 영역 카드와 레이더로 그린다.
// 영역 점수·종합점수를 만들지 않는다. 미확보는 0이 아니라 '미확보 · 사유'로 쓴다.
(function(global){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=Number.isFinite;
const MIN_GU_N=10;
const DIRECTION_TEXT={up:'많을수록 유리 ↑',down:'많을수록 불리 ↓',neutral:'해석에 정책 판단 필요 ·'};
const RADAR_NOTE='모양 비교용이며 순위·종합점수가 아닙니다. 축마다 단위와 성격이 다릅니다. 미확보 축은 값이 없어 끊어진 축으로 그립니다.';
const EMPTY='<div class="empty"><span class="empty-symbol">⌂</span><h2>학교를 선택하면 지표 프로필이 표시됩니다.</h2><p>영역별로 이 학교의 값과 같은 학교급 안에서의 상대 위치를 보여줍니다. 자료가 없는 항목은 미확보로 표시하며 0으로 보지 않습니다.</p></div>';
const fmt=v=>finite(v)?(Math.round(v*100)/100).toLocaleString('ko-KR'):'';

function indicatorRow(ind){
 const dir=`<span class="indicator-dir">${esc(DIRECTION_TEXT[ind.direction]||'')}</span>`;
 const label=`<span class="indicator-label">${esc(ind.label)}${ind.note?`<small>${esc(ind.note)}</small>`:''}</span>`;
 if(ind.missing)
  return `<div class="indicator missing"><span class="indicator-value">미확보</span>${label}<p class="indicator-why">${esc(ind.missing.detail)}</p></div>`;
 if(ind.text!=null)
  return `<div class="indicator text"><span class="indicator-value">${esc(ind.text)}</span>${label}</div>`;
 const o=ind.overall,g=ind.gu;
 const smallGu=g&&g.n<MIN_GU_N?`<p class="indicator-gu">${esc(g.name)} ${g.n}개교 중 ${g.rank}위 · 표본이 작아 백분위는 쓰지 않습니다.</p>`
  :g&&finite(g.percentile)?`<p class="indicator-gu">${esc(g.name)} 백분위 ${fmt(g.percentile)}% · ${g.n}개교 중 ${g.rank}위 · 구 평균 ${fmt(g.mean)}${esc(ind.unit)}</p>`:'';
 const chart=global.IndicatorCharts?global.IndicatorCharts.percentileBar({percentile:o.percentile,guPercentile:g&&g.n>=MIN_GU_N?g.percentile:null,guName:g&&g.name,value:ind.value,unit:ind.unit,rank:o.rank,n:o.n}):'';
 return `<div class="indicator">${label}${dir}${chart}`
  +`<p class="indicator-spread">전체 중앙값 ${fmt(o.median)}${esc(ind.unit)} · 범위 ${fmt(o.min)}~${fmt(o.max)}${esc(ind.unit)}</p>`
  +smallGu+`</div>`;
}

function domainTab(domain,active){
 const avail=domain.indicators.filter(i=>!i.missing).length,miss=domain.indicators.length-avail,id=esc(domain.id);
 return `<button type="button" role="tab" data-domain-tab="${id}" id="domain-tab-${id}" aria-controls="domain-panel-${id}"`
  +` aria-selected="${active?'true':'false'}" tabindex="${active?'0':'-1'}">`
  +`<span class="domain-name">${esc(domain.label)}</span>`
  +`<span class="domain-count">확보 ${avail} · 미확보 ${miss}</span></button>`;
}

function domainPanel(domain,active){
 const id=esc(domain.id);
 return `<section class="domain-card" role="tabpanel" id="domain-panel-${id}" aria-labelledby="domain-tab-${id}"${active?'':' hidden'}>`
  +`<button type="button" class="text-button" data-domain-stats="${id}">이 영역 전체 통계 →</button>`
  +domain.indicators.map(indicatorRow).join('')
  +`</section>`;
}

function radarBlock(data,basis){
 const gu=data.school&&data.school.gu;
 const buttons=`<button type="button" class="${basis==='overall'?'on':''}" data-basis="overall">인천 전체 기준</button>`
  +(gu?`<button type="button" class="${basis==='gu'?'on':''}" data-basis="gu">${esc(gu)} 기준</button>`:'');
 const svg=global.IndicatorCharts?global.IndicatorCharts.radar({axes:data.radar.axes,basis}):'';
 return `<div class="radar-basis" role="group" aria-label="비교 기준">${buttons}</div>`
  +`<div class="radar-holder">${svg}</div>`
  +`<p class="fine radar-note">${esc(RADAR_NOTE)}</p>`;
}

function render(el,data){
 if(!el)return;
 let basis='overall';
 const domainIds=(data.domains||[]).map(d=>d.id);
 // 학교를 바꿔도 보던 영역 탭을 유지한다.
 let active=domainIds.includes(el.__domainTab)?el.__domainTab:domainIds[0];
 const draw=()=>{
  const s=data.school||{};
  const badges=(data.track==='island'?'<span class="badge">도서지역 별도 검토</span>':'')
   +(finite(data.data_year)?`<span class="badge">기준 ${data.data_year}년</span>`:'');
  el.innerHTML=`<div class="school-heading"><h2>${esc(s.name)}</h2>`
   +`<span class="badge">${esc(s.level)}${s.gu?' · '+esc(s.gu):''}</span>${badges}</div>`
   +`<p class="muted profile-scope">같은 학교급 안에서 비교합니다${data.track==='island'?' (강화·옹진 도서지역끼리 비교)':''}. 확보 ${data.coverage.available} · 미확보 ${data.coverage.missing} 지표.</p>`
   +`<section data-school-photos aria-label="학교와 주변 시설 사진"></section>`
   +`<section class="radar-section" aria-label="영역 대표 지표 상대 위치">${radarBlock(data,basis)}</section>`
   +`<div class="domain-tablist" role="tablist" aria-label="영역 선택">${data.domains.map(d=>domainTab(d,d.id===active)).join('')}</div>`
   +`<div class="domain-cards">${data.domains.map(d=>domainPanel(d,d.id===active)).join('')}</div>`
   +((data.conditions||[]).length?`<section class="conditions-section"><h3>더 확인할 조건</h3>${data.conditions.map(c=>`<p class="condition">${esc(c)}</p>`).join('')}</section>`:'')
   +`<details class="profile-sources"><summary>출처 · 공개 원문</summary>`
   +((data.originals||[]).map(o=>`<p><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.title)} ↗</a>${o.provider?' · '+esc(o.provider):''}</p>`).join('')||'<p>공개 원문 미기록</p>')
   +`<p class="fine">분석 파일: ${(data.sources||[]).map(x=>`<code>${esc(x.path)}</code> (${esc(String(x.sha256||'').slice(0,12))})`).join(', ')}</p></details>`
   +((data.limits||[]).length?`<details class="profile-limits"><summary>분석의 한계</summary>${data.limits.map(c=>`<p class="condition">${esc(c)}</p>`).join('')}</details>`:'');
  global.SchoolPhotos?.mount(el.querySelector('[data-school-photos]'),data.photoSchool||s);
  const bindRadar=()=>el.querySelectorAll('.radar-basis button').forEach(b=>b.onclick=()=>{basis=b.dataset.basis;el.querySelector('.radar-section').innerHTML=radarBlock(data,basis);bindRadar();});bindRadar();
  const tabs=[...el.querySelectorAll('[data-domain-tab]')];
  const select=(id,focus)=>{
   active=id;el.__domainTab=id;
   tabs.forEach(t=>{const on=t.dataset.domainTab===id;t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;if(on&&focus)t.focus();});
   el.querySelectorAll('[role="tabpanel"]').forEach(p=>{p.hidden=p.id!=='domain-panel-'+id;});
  };
  tabs.forEach((t,i)=>{
   t.onclick=()=>select(t.dataset.domainTab,false);
   t.onkeydown=e=>{
    const n=tabs.length;let j=-1;
    if(e.key==='ArrowRight'||e.key==='ArrowDown')j=(i+1)%n;
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')j=(i-1+n)%n;
    else if(e.key==='Home')j=0;
    else if(e.key==='End')j=n-1;
    else return;
    e.preventDefault();select(tabs[j].dataset.domainTab,true);
   };
  });
  if(typeof el.__onDomainStats==='function')
   el.querySelectorAll('[data-domain-stats]').forEach(b=>b.onclick=()=>el.__onDomainStats(b.dataset.domainStats));
 };
 draw();
}
function clear(el){if(el)el.innerHTML=EMPTY;}
global.SchoolProfile={render,clear,EMPTY};
})(typeof window!=='undefined'?window:globalThis);
