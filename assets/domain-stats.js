'use strict';
// 05 영역별 통계 탭. 영역·학교급을 고르면 지표마다 분포·군구 비교·커버리지를 그린다.
// 미확보는 분포·평균에서 빠지며 사유별 개교 수로만 표시한다 (0으로 요약하지 않는다).
(function(global){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=Number.isFinite;
const $=id=>global.document.getElementById(id);
const DOMAIN_OPTIONS=[['designation','지정·지원사업'],['park','공원·야외'],['reading','도서·독서'],['academy','학원'],['safety','안전 환경'],['boundary','도보권·학구도'],['trend','학생 추세'],['school','학생·교원'],['development','주변 개발']];
const DIRECTION_TEXT={up:'많을수록 유리 ↑',down:'많을수록 불리 ↓',neutral:'해석에 정책 판단 필요 ·'};
const fmt=v=>finite(v)?(Math.round(v*100)/100).toLocaleString('ko-KR'):'미확보';
let ticket=0;

function indicatorBlock(i,level){
 const u=esc(i.unit||'');
 const head=`<h3>${esc(i.label)}${i.unit?` <small>(${u})</small>`:''} <span class="stat-dir">${esc(DIRECTION_TEXT[i.direction]||'')}</span></h3>`
  +(i.note?`<p class="fine">${esc(i.note)}</p>`:'');
 const missTotal=i.coverage.missing.reduce((a,b)=>a+b.n,0);
 const coverage=`<p class="stat-coverage">확보 ${i.coverage.available} · 미확보 ${missTotal}</p>`
  +(i.coverage.missing.length?`<ul class="stat-missing">${i.coverage.missing.map(m=>`<li>${esc(m.detail)} ${m.n}곳</li>`).join('')}</ul>`:'');
 if(!i.overall.n)
  return `<article class="stat-indicator">${head}<p class="stat-empty">관측된 값이 없습니다. 아래 미확보 사유를 확인하세요.</p>${coverage}</article>`;
 const chart=global.IndicatorCharts?global.IndicatorCharts.histogram({bins:i.histogram,selectedValue:i.selected&&i.selected.value,unit:i.unit}):'';
 const summary=`<p class="stat-summary">유효 ${i.overall.n}개교 · 평균 ${fmt(i.overall.mean)}${u} · 중앙값 ${fmt(i.overall.median)}${u} · 범위 ${fmt(i.overall.min)}~${fmt(i.overall.max)}${u}</p>`;
 const picked=i.selected?`<p class="stat-selected">선택 학교 ${fmt(i.selected.value)}${u} · 백분위 (값이 큰 쪽) ${fmt(i.selected.percentile)}% · ${i.selected.track==='island'?'도서지역 ':''}${i.overall.n}개교 중 ${i.selected.rank}위</p>`:'';
 const island=i.island.n?`<p class="stat-island">강화·옹진 도서지역 ${i.island.n}개교 · 평균 ${fmt(i.island.mean)}${u} · 중앙값 ${fmt(i.island.median)}${u} (별도 집계)</p>`:'';
 const gu=i.gu.length?`<details class="stat-gu"><summary>군·구별 비교</summary><div class="table-scroll"><table><thead><tr><th>군·구</th><th>개교</th><th>평균</th><th>중앙값</th></tr></thead><tbody>`
  +i.gu.map(g=>`<tr><td>${esc(g.name)}</td><td>${g.n}</td><td>${fmt(g.mean)}${u}</td><td>${fmt(g.median)}${u}</td></tr>`).join('')
  +`</tbody></table></div><p class="fine">개교 수가 적은 군·구는 평균이 흔들립니다. 순위 근거로 쓰지 마세요.</p></details>`:'';
 return `<article class="stat-indicator">${head}${chart}${summary}${picked}${island}${gu}${coverage}</article>`;
}

async function load(){
 const mine=++ticket,domain=$('stats-domain').value,level=$('stats-level').value;
 const school=$('school')&&$('school').value?$('school').value:'';
 $('stats-status').textContent='통계를 계산하고 있습니다…';
 try{
  const r=await fetch(`/api/domain-stats?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}${school?'&school='+encodeURIComponent(school):''}`,{cache:'no-store'});
  const data=await r.json();
  if(mine!==ticket)return;
  if(!r.ok)throw Error(data.error||'통계를 불러오지 못했습니다.');
  $('stats-status').textContent=`${data.label} · ${data.level} 기준 · 지표 ${data.indicators.length}개`;
  $('stats-body').innerHTML=data.indicators.map(i=>indicatorBlock(i,data.level)).join('')
   ||'<p class="muted">이 영역에는 수치 지표가 없습니다.</p>';
 }catch(e){
  if(mine!==ticket)return;
  $('stats-status').textContent=e.message;
  $('stats-body').innerHTML='';
 }
}

function init(){
 const sel=$('stats-domain');if(!sel)return;
 if(!sel.options.length)sel.innerHTML=DOMAIN_OPTIONS.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
 if(!sel.dataset.bound){sel.dataset.bound='1';sel.addEventListener('change',load);$('stats-level').addEventListener('change',load);}
}
function open(domain){
 init();
 if(domain)$('stats-domain').value=domain;
 const button=global.document.querySelector('.workspace-nav [data-workspace="stats"]');
 if(button)button.click();
 load();
}
global.DomainStats={init,open,load};
if(global.document)global.document.addEventListener('DOMContentLoaded',init);
})(typeof window!=='undefined'?window:globalThis);
