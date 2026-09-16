/* Compare columns of the same entity table; never combine indicators into a score. */
window.TableComparison=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:3}):'자료 없음';
 const colors=['#087f8c','#8460a7','#bc7136','#397d61'];
 function columns(t){
  if(!t?.rows?.length||! /^(학교|학교명|군·구|군구|구분|지역)$/.test(t.headers?.[0]||''))return [];
  return t.headers.flatMap((h,i)=>i>0&&!/PAPS|등급|점수|순위|백분위|코드|ID|학년도|연도/i.test(h)&&t.rows.some(r=>Number.isFinite(r[i]))?[i]:[]);
 }
 function mount(host,t,renderTable){
  const available=columns(t);if(!available.length)return;
  const labels=t.headers.map((_,i)=>i).filter(i=>!available.includes(i)&&t.rows.some(r=>typeof r[i]==='string')&&!t.rows.some(r=>Number.isFinite(r[i])));
  if(!labels.includes(0))labels.unshift(0);
  const selected=new Set(available.slice(0,3));let page=0;const size=10,pages=Math.ceil(t.rows.length/size);
  const box=document.createElement('section');box.className='table-comparison';
  box.innerHTML=`<h4>선택 변수 한눈에 비교</h4><p class="fine">변수를 고르면 그래프와 표가 함께 바뀝니다. 최대 4개 · 각 열은 자체 눈금으로 표시하며, 열 사이 막대 길이는 비교하지 마세요.</p><fieldset><legend>비교할 변수</legend>${available.map(i=>`<label><input type="checkbox" value="${i}" ${selected.has(i)?'checked':''}>${esc(t.headers[i])}</label>`).join('')}</fieldset><p class="tc-status fine" role="status"></p><div class="tc-visual"></div><div class="tc-pager"><button type="button" data-step="-1">이전 10행</button><span></span><button type="button" data-step="1">다음 10행</button></div><h5>선택 변수 수치 표</h5><div class="tc-table"></div>`;
  const original=document.createElement('details');original.innerHTML=`<summary>원본 전체 표 · ${t.rows.length}행 · 모든 변수와 출처</summary>${renderTable(t)}`;box.append(original);
  host.replaceChildren(box);const details=host.closest('details');if(details)details.open=true;
  function draw(){
   const chosen=available.filter(i=>selected.has(i)),rows=t.rows.slice(page*size,(page+1)*size);
   box.querySelectorAll('input').forEach(input=>{input.disabled=!input.checked&&selected.size>=4;});
   box.querySelector('.tc-status').textContent=`표 전체 ${t.rows.length}행 중 ${page*size+1}–${page*size+rows.length}행 · 선택 변수 ${chosen.length}개 · 원래 표 순서 유지`;
   box.querySelector('.tc-pager span').textContent=`${page+1} / ${pages}`;
   box.querySelector('[data-step="-1"]').disabled=page===0;box.querySelector('[data-step="1"]').disabled=page===pages-1;
   box.querySelector('.tc-pager').hidden=pages===1;
   const domains=chosen.map(i=>{const values=t.rows.map(r=>r[i]).filter(Number.isFinite);return [Math.min(0,...values),Math.max(0,...values)];});
   box.querySelector('.tc-visual').innerHTML=chosen.length?`<div class="tc-scroll" tabindex="0" role="region" aria-label="선택 변수 비교 그래프"><div class="tc-grid" style="--tc-cols:${chosen.length}"><div class="tc-head">${esc(t.headers[0])}</div>${chosen.map((i,j)=>`<div class="tc-head" style="--tc-color:${colors[j]}"><strong>${esc(t.headers[i])}</strong><small>눈금 ${fmt(domains[j][0])} ~ ${fmt(domains[j][1])}</small></div>`).join('')}${rows.map(r=>`<div class="tc-name">${esc(r[0]?.label??r[0])}</div>${chosen.map((i,j)=>{const v=r[i],[lo,hi]=domains[j],range=hi-lo||1,left=(Math.min(0,v)-lo)/range*100,width=Math.abs(v)/range*100;return `<div class="tc-cell" style="--tc-color:${colors[j]}"><span>${fmt(v)}</span>${Number.isFinite(v)?`<div class="tc-track"><i class="tc-zero" style="left:${-lo/range*100}%"></i><b style="left:${left}%;width:${width}%"></b></div>`:'<div class="tc-missing">확인 필요</div>'}</div>`;}).join('')}`).join('')}</div></div><p class="fine">각 칸은 표의 실제 수치입니다. 자료 없음은 0이 아니며, 이 비교는 종합점수나 지원 순위가 아닙니다. 출처·확보 범위·접근 경로의 확인 조건을 함께 검토하세요.</p>`:'<p>위에서 비교할 변수를 선택하세요.</p>';
   const indices=[...labels,...chosen];box.querySelector('.tc-table').innerHTML=renderTable({headers:indices.map(i=>t.headers[i]),rows:rows.map(r=>indices.map(i=>r[i]))});
  }
  box.querySelectorAll('input').forEach(input=>input.onchange=()=>{const i=Number(input.value);if(input.checked)selected.add(i);else selected.delete(i);draw();});
  box.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>{page+=Number(button.dataset.step);draw();});draw();
 }
 return {columns,mount};
})();
