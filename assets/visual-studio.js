'use strict';
window.VisualStudio=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=v=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:2}):v??'미확보';
 const labels={name:'학교·대상명',school_name:'학교명',school_level:'학교급',level:'학교급',gu:'군·구',year:'기준연도',school_year:'학년도',value:'관측값',unit:'단위',status:'확인 상태',group:'비교 집단',label:'항목',kind:'유형',address:'주소',source_url:'출처 URL',reference_date:'자료 기준일',coordinate_status:'좌표 확인 상태',verification_status:'검증 상태',students:'학생 수 · 명',classes:'학급 수 · 개',teachers:'교원 수 · 명',parks:'분석권 공원 수 · 곳',green:'추정 녹지비율 · %',capacity:'정원·수용량',opening_hours:'운영시간',eligibility_note:'이용 자격·조건',program_name:'사업명',designation_type:'지정 유형',period_status:'기간 확인',count_500m:'500m 범위 관측 수',area_m2:'면적 · ㎡',park_count:'공원 수 · 곳',sharing_school_count:'공동 이용 학교 수 · 개교',shared_area_per_student:'학생당 공동 이용 공원면적 · ㎡/명',same_level_shared_area_per_student:'같은 학교급 학생당 공원면적 · ㎡/명',largest_park_loss_share:'가장 큰 공원 제외 시 면적 감소 비율',park_name:'공원명',linked_schools:'연결 학교',analyzed_schools:'분석 학교',route_distance_m:'보행망 경로 길이 · m',straight_distance_m:'직선거리 · m',detour_ratio:'보행망 경로/직선거리 · 배',route_length_m:'연결 경로 길이 · m',method:'분석 방법',reviewed_distance_m:'재검토 거리 · m',reviewed_source:'재검토 출처',reviewed_date:'재검토일',review_status:'재검토 상태',adopted_basis:'채택 근거',entrances_verified:'출입구 확인 여부',legacy_distance_m:'기존 경로 거리 · m',radius_m:'분석 반경 · m',target_grade:'대상 학년',advertised_seats:'공고 정원 · 명',subject:'과목',source_school_name:'개설 학교',source_gu:'개설 지역',credits:'학점',provider_id:'제공 학교 ID',eligible_school_id:'대상 학교 ID',sport:'종목',athletes:'선수 수 · 명',budget_raw:'원문 예산',posted_date:'게시일',event:'대회',category:'부문',discipline:'세부 종목',result:'공개 결과',result_basis:'결과 기준',work_title:'작품명',facility_type:'시설 유형',target_category:'대상 구분',horizon:'예측 선행기간',mae:'평균 절대오차',baseline_mae:'기준모형 평균 절대오차',selected_mae:'선택모형 평균 절대오차',persistence_mae:'직전값 유지모형 절대오차',n:'유효 관측 수',missing_cells:'미확보 격자 수',grid_id:'격자 ID',note:'확인 내용'};
 const label=v=>labels[v]||v;
 let rosterPromise;
 const roster=()=>rosterPromise||=fetch('/api/school-summary').then(r=>{if(!r.ok)throw Error('학교 위치 연결 실패');return r.json();}).then(d=>d.schools).catch(()=>{rosterPromise=null;return [];});
 function grid(t,rows=t.rows){return `<div class="table-scroll"><table><thead><tr>${t.headers.map(h=>`<th scope="col">${esc(label(h))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(typeof v==='object'?v?.label??JSON.stringify(v):num(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
 async function drill(host,members,label){
  host.innerHTML=`<h5>${esc(label)} · ${members.length.toLocaleString('ko')}개 관측</h5><p>학교명을 누르면 새 창에서 해당 학교를 볼 수 있습니다. 위치는 학교 대표점입니다.</p><div class="vs-drill-table"></div><div class="vs-drill-map" aria-label="선택 구간 학교 위치"></div><p class="vs-map-status" role="status">위치 확인 중…</p>`;
  const rows=await roster();if(!host.isConnected)return;const target=host.querySelector('.vs-drill-table');
  target.innerHTML=`<div class="table-scroll"><table><thead><tr><th>학교·대상</th><th>지역</th><th>원래 관측값</th><th>위치 확인</th></tr></thead><tbody>${members.map(m=>{const found=rows.filter(s=>s.id===m.id||s.name===m.name),s=found.length===1?found[0]:null;return `<tr><td>${s?`<a href="/?school=${encodeURIComponent(s.id)}" target="_blank" rel="noopener">${esc(m.name)} ↗</a>`:esc(m.name)}</td><td>${esc(s?.gu||m.gu||'미확인')}</td><td>${esc(num(m.value))}</td><td>${s&&Number.isFinite(s.lat)?`${num(s.lat)}, ${num(s.lng)}`:'연결 미확인'}</td></tr>`;}).join('')}</tbody></table></div>`;
  const points=members.map(m=>rows.find(s=>s.id===m.id||s.name===m.name)).filter(s=>s&&Number.isFinite(s.lat)&&Number.isFinite(s.lng));
  const status=host.querySelector('.vs-map-status');if(!points.length){status.textContent='좌표를 확보하지 못했습니다. 대상과 원값은 표에 모두 남겨 두었습니다.';return;}
  try{await window.EducationMaps.ready();if(!host.isConnected)return;const map=window.EducationMaps.create(host.querySelector('.vs-drill-map'));const bounds=[];for(const s of points){const p=map.point(s.lat,s.lng);bounds.push(p);map.dot('selected',p,{label:s.name,content:esc(s.name)});}map.fit(bounds);host._map?.destroy();host._map=map;status.textContent=`${members.length}개 관측 중 ${points.length}개 위치 표시 · 실제 출입구 보행 경로는 별도 확인`;}catch{status.textContent='지도 배경을 불러오지 못했습니다. 학교명과 지역·좌표를 표에서 확인하세요.';}
 }
 function explorer(container,section){
  const c=section.chart,t=section.table;if(!c&&!t)return;
  if(t&&!t.rows?.length){const empty=[...container.children].find(el=>el.classList.contains('table-scroll'));if(empty)empty.innerHTML=`<p>${section.title==='가중치를 바꾸면 달라지는 배분'?'필수 조건을 통과한 학교가 없어 배분 비교를 보류합니다. 근거를 확인한 뒤 다시 계산하면 가중치별 학교 순서와 지원량이 표시됩니다.':'이 범위의 유효 관측을 확보하지 못했습니다. 실제 부재나 부족으로 판단하지 않습니다.'}</p>`;}
  // For categorical aggregates, membership is joined only when the exact category
  // and an identified school occur together in the underlying table.
  if(c?.kind==='bar'&&!c.members?.length&&t?.headers&&t?.rows){const ni=t.headers.findIndex(h=>/^(학교|학교명|school_name|name)$/.test(h));if(ni>=0)for(const p of c.points||[]){if(p.members)continue;const rows=t.rows.filter(r=>r.some((v,i)=>i!==ni&&String(v)===String(p.name)));const matched=[...new Map(rows.map(r=>[r[ni],{name:r[ni],value:p.name}])).values()];if(matched.length===p.value)p.members=matched;}}
  const figure=container.querySelector('figure'),members=c?.members||[];
  if(c?.kind==='bar'&&c.points?.length){
   const box=document.createElement('div');box.className='vs-chart';
   const max=Math.max(1,...c.points.map(p=>p.value));
   box.innerHTML=`<p class="vs-axis"><strong>${esc(c.measure||section.title||c.title||'항목별 관측')}</strong></p><p class="fine">${esc(c.axis_label||`가로 길이 = ${c.unit||'개 관측'} 수치 · 세로 각 행 = 표시된 항목`)}${c.points.some(p=>p.members?.length)?' · 구간을 눌러 해당 학교 확인':''}</p><div class="vs-bars">${c.points.map((p,i)=>`<button type="button" class="vs-bar" data-bin="${i}" ${p.members?.length?'':'disabled'}><span>${esc(p.name)}</span><span class="vs-bar-track"><i style="width:${Math.max(0,p.value)/max*100}%"></i></span><strong>${esc(num(p.value))} ${esc(c.unit||'건')}</strong></button>`).join('')}</div><div class="vs-drill" aria-live="polite"></div>`;
   if(members.length){
    const lo=Math.min(...members.map(m=>m.value)),hi=Math.max(...members.map(m=>m.value)),x=v=>35+(v-lo)/(hi-lo||1)*490;
    const buckets=new Map();for(const m of members){const k=Math.floor((m.value-lo)/(hi-lo||1)*48);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(m);}const clusters=[...buckets].sort((a,b)=>a[0]-b[0]).map(([k,rows])=>({k,rows,value:rows.reduce((n,m)=>n+m.value,0)/rows.length}));
    const strip=document.createElement('div');strip.className='vs-distribution';strip.innerHTML=`<p><strong>점 = 가까운 관측값의 학교 묶음 · 크기 = 관측 수</strong> · 가로축은 ${esc(c.measure||'원래 관측값')}입니다. 세로 위치는 겹침 방지용이며 별도 지표가 아닙니다. 점을 눌러 학교별 정확한 값을 보세요.</p><svg class="vs-strip" viewBox="0 0 560 150" role="group" aria-label="${esc(c.measure||'관측값')} 분포 · 점을 눌러 학교 확인"><path d="M35 112H525" stroke="#9db3a7"/>${clusters.map((g,i)=>`<circle data-member="${i}" tabindex="0" role="button" aria-label="${esc(g.rows[0].name)} 등 ${g.rows.length}개 관측" cx="${x(g.value)}" cy="${30+(g.k%3)*28}" r="${Math.min(11,4+Math.sqrt(g.rows.length))}" fill="#397c5d" opacity=".75"><title>${esc(num(g.value))} 부근 · ${g.rows.length}개 관측</title></circle>`).join('')}<text x="35" y="135">${esc(num(lo))}</text><text x="525" y="135" text-anchor="end">${esc(num(hi))}</text></svg>`;
    const bars=box.querySelector('.vs-bars'),detail=document.createElement('details');detail.innerHTML='<summary>값 구간별 관측 수 · 구간 선택</summary>';bars.before(strip);bars.before(detail);detail.append(bars);
    strip.querySelectorAll('[data-member]').forEach(dot=>{const select=()=>{const g=clusters[Number(dot.dataset.member)];drill(box.querySelector('.vs-drill'),g.rows,`${num(g.value)} 부근`);};dot.onclick=select;dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
   }
   if(figure)figure.replaceWith(box);else container.prepend(box);
   box.querySelectorAll('[data-bin]').forEach(b=>b.onclick=()=>{box.querySelectorAll('[data-bin]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const p=c.points[Number(b.dataset.bin)];drill(box.querySelector('.vs-drill'),p.members||[],p.name);});
  }
  if(members.length){
   const stats=section.statistics||{},card=document.createElement('div');card.className='vs-facts';card.innerHTML=`<div><small>유효 관측</small><strong>${num(members.length)}건</strong></div><div><small>가운데 값 · 중앙값</small><strong>${esc(num(stats.median))}</strong></div><div><small>자료 제외</small><strong>${num(stats.excluded||0)}건</strong></div>${stats.selected?`<div><small>${esc(stats.selected.name)}</small><strong>${esc(num(stats.selected.value))}</strong></div>`:''}`;container.prepend(card);
  }
  if(t?.rows?.length){
   const old=[...container.children].find(el=>el.classList.contains('table-scroll')),box=document.createElement('div');box.className='vs-table';let page=0,query='';
   box.innerHTML='<label>학교·항목 찾기 <input type="search" placeholder="학교명 또는 지역"></label><p class="vs-page-status"></p><div class="vs-table-body"></div><button type="button" class="vs-prev">이전 20개</button> <button type="button" class="vs-next">다음 20개</button>';
   const draw=()=>{const rows=t.rows.filter(r=>r.some(v=>String(v??'').includes(query))),pages=Math.max(1,Math.ceil(rows.length/20));page=Math.min(page,pages-1);box.querySelector('.vs-table-body').innerHTML=grid(t,rows.slice(page*20,(page+1)*20));box.querySelector('.vs-page-status').textContent=`전체 ${t.rows.length.toLocaleString('ko')}행 중 검색 ${rows.length.toLocaleString('ko')}행 · ${page+1}/${pages}쪽`;box.querySelector('.vs-prev').disabled=page===0;box.querySelector('.vs-next').disabled=page>=pages-1;};
   box.querySelector('input').oninput=e=>{query=e.target.value.trim();page=0;draw();};box.querySelector('.vs-prev').onclick=()=>{page--;draw();};box.querySelector('.vs-next').onclick=()=>{page++;draw();};draw();if(old)old.replaceWith(box);else container.append(box);
  }
 }
 function enhance(panel,d){
  const v=d.visual;if(!v)return;const sections=[...panel.querySelectorAll('.comparison-section')];(v.sections||[]).forEach((s,i)=>sections[i]&&explorer(sections[i],s));
  // Root table/figure only; nested sections keep their own units and comparison groups.
  const root=document.createElement('section');root.className='vs-root';const nodes=[...panel.children].filter(el=>el.tagName==='FIGURE'||el.classList.contains('table-scroll'));if(nodes.length){nodes[0].before(root);nodes.forEach(el=>root.append(el));explorer(root,v);if(d.mode==='policy_scenario')panel.querySelector('.panel-question')?.after(root);}
  if(d.mode==='policy_scenario'){const m=panel.querySelector('#answer-map'),status=panel.querySelector('#answer-map-status');if(m){const detail=document.createElement('details');detail.innerHTML='<summary>학교 위치 지도 · 대표점</summary>';m.before(detail);detail.append(m);if(status)detail.append(status);}}
  if(d.summary){const summary=document.createElement('p');summary.className='vs-outcome';summary.textContent=d.summary;panel.querySelector('h3')?.after(summary);}
 }
 return {enhance,grid,drill,esc,num};
})();
