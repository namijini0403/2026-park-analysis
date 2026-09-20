/* Related evidence is rendered from server data; never execute model HTML. */
window.ChatWorkspace=(()=>{
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const href=v=>/^https?:\/\//.test(v||'')?v:/^(data_processed|rag)\/[\w./-]+$/.test(v||'')?'/'+v:null;
 const link=(url,label)=>href(url)?`<a href="${escape(href(url))}" target="_blank" rel="noopener">${escape(label||url)} ↗</a>`:escape(label||url||'출처 미확인');
 const number=v=>Number.isFinite(v)?Number(v.toFixed(3)).toLocaleString('ko-KR'):v;
 const schoolLink=(school,label=school.name)=>school.id&&/^[\w-]+$/.test(String(school.id))?`<a class="school-report-link" href="/index.html?school=${encodeURIComponent(school.id)}#summary" target="_blank" rel="noopener" title="${escape(school.name)} 상세 보고서 · 새 탭">${escape(label)}</a>`:escape(label);
 function schoolText(text,d){
  const o=d.visual?.overview,items=[...(o?.schools||[]),...(o?.additional_candidates?.schools||[])],aliases=new Map(),ambiguous=new Set();
  for(const school of items){if(!school.id||!school.name)continue;const short=school.name.replace(/초등학교$/,'초').replace(/중학교$/,'중').replace(/고등학교$/,'고');for(const name of new Set([school.name,short,school.name.replace(/^인천/,''),short.replace(/^인천/,''),...(school.aliases||[])])){if(name.length<2)continue;if(aliases.has(name)&&aliases.get(name).id!==school.id)ambiguous.add(name);else aliases.set(name,school);}}
  for(const name of ambiguous)aliases.delete(name);if(!aliases.size)return escape(text);
  const names=[...aliases.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const pattern=new RegExp(`(?<![\\p{L}\\p{N}])(${names.join('|')})(?=$|[^\\p{L}\\p{N}]|(?:입니다만|입니다|이며|이고|이므로|으로|에서는|에게는|은|는|이|가|을|를|과|와|의|에(?:서|게)?|로|도|만|부터|까지)(?=$|[^\\p{L}\\p{N}]))`,'gu');
  const source=String(text??'');let html='',last=0;for(const match of source.matchAll(pattern)){html+=escape(source.slice(last,match.index))+schoolLink(aliases.get(match[0]),match[0]);last=match.index+match[0].length;}return html+escape(source.slice(last));
 }
 function comparisonMatrix(schools,columns,caption){
  if(!schools.length||!columns.length)return '';
  const cell=(school,column,max)=>{const value=school.values?.[column.id],missing=value==null||value===''||(typeof value==='number'&&!Number.isFinite(value)),numeric=typeof value==='number'&&Number.isFinite(value);return `<td class="${missing?'evidence-missing':''}">${missing?'<span>자료 없음</span>':`<strong>${escape(number(value))}</strong>${numeric&&max>0?`<span class="evidence-value-track" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,Math.abs(value)/max*100))}%"></i></span>`:''}`}</td>`;};
  return `<div class="table-scroll evidence-matrix-scroll"><table class="evidence-matrix" style="min-width:${Math.max(580,155+schools.length*90)}px"><caption>${escape(caption)}</caption><thead><tr><th scope="col">확인한 변수</th>${schools.map(s=>`<th scope="col">${schoolLink(s)}${Number.isInteger(s.metric_position)&&s.metric_position>0?`<small class="evidence-metric-position">지표 기준 ${s.metric_position}번째</small>`:''}</th>`).join('')}</tr></thead><tbody>${columns.map(c=>{const max=Math.max(0,...schools.map(s=>typeof s.values?.[c.id]==='number'&&Number.isFinite(s.values[c.id])?Math.abs(s.values[c.id]):0));return `<tr><th scope="row"><span class="evidence-variable-group">${escape(c.group||'관측값')}</span>${escape(c.label||c.id)}${c.unit?` <small>(${escape(c.unit)})</small>`:''}${c.kind==='forecast'||/예측/.test(c.label||'')?'<small class="evidence-model-label">모형 추정</small>':''}</th>${schools.map(s=>cell(s,c,max)).join('')}</tr>`;}).join('')}</tbody></table></div><p class="fine">${schools.length>5?'표를 좌우로 밀어 나머지 학교를 확인하세요. ':''}막대는 같은 변수 안에서 이 표에 표시된 학교의 수치 크기를 비교합니다. 변수 사이의 단위는 다르며 합산 점수나 학교 순위가 아닙니다. 자료 없음은 0이 아닙니다.</p>`;
 }
 function additionalCandidates(o){
  const extra=o.additional_candidates;if(!extra)return '';
  const primaryIds=new Set((o.schools||[]).map(s=>s.id)),schools=(extra.schools||[]).filter(s=>!primaryIds.has(s.id)).slice(0,10);
  return `<details class="evidence-additional-candidates"><summary>${escape(extra.title||'추가 비교 후보')} · ${schools.length}곳</summary><p class="fine">답변에서 추린 학교 외에 같은 질문 조건으로 비교할 수 있는 학교입니다. 아래 순서는 지원 순위가 아니며 본문의 학교 수와 지도는 바뀌지 않습니다.</p>${(extra.criteria||[]).length?`<p class="fine">추가 비교 기준: ${extra.criteria.map(c=>escape(c.label||c.sort_by)).join(' · ')}</p>`:''}${schools.length?comparisonMatrix(schools,o.columns||[],'추가 후보 × 같은 선택 변수'):'<p class="evidence-empty">같은 조건에서 추가로 비교할 학교를 확인하지 못했습니다.</p>'}${(extra.notes||[]).length?`<ul class="evidence-notes">${extra.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul>`:''}</details>`;
 }
 const table=t=>!t?'':`<div class="table-scroll"><table><thead><tr>${t.headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.map(v=>`<td>${v&&typeof v==='object'?link(v.url,v.label):escape(number(v))}</td>`).join('')}</tr>`).join('')}</tbody></table>${t.rows.length?'':'<p>이 조건으로 수집된 자료가 없습니다. 지정이 없다는 뜻은 아닙니다.</p>'}</div>`;
 let map=null,revision=0;
 function overview(v){
  const o=v.overview;
  if(!o)return '<div class="evidence-empty"><strong>이전 답변의 종합 근거</strong><p>이 답변에는 결론과 학교를 연결한 자료가 없습니다. 변수별 자료에서 기존 근거를 확인하거나 질문을 다시 보내 주세요.</p></div>';
  const schools=o.schools||[],columns=o.columns||[];
  return `<div class="evidence-snapshot"><h4>${escape(o.title||'답변의 종합 근거')}</h4><div class="evidence-counts"><span><b>${schools.length}</b> 답변에 연결된 학교</span><span><b>${columns.length}</b> 함께 검토한 변수</span></div>${schools.length?`<p class="evidence-school-list">${schools.map(s=>`<span>${schoolLink(s)}</span>`).join('')}</p><p class="fine">학교명을 누르면 상세 보고서가 새 탭에서 열립니다.</p>`:'<p class="evidence-empty">결론과 연결된 개별 학교가 확인되지 않아 학교 지도와 비교표는 표시하지 않습니다. 변수별 자료에서 전체 집계와 원자료를 확인하세요.</p>'}${comparisonMatrix(schools,columns,'답변에 나온 학교 × 함께 검토한 변수')}${(o.notes||[]).length?`<ul class="evidence-notes">${o.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul>`:''}${(o.constraints||[]).length?`<div class="evidence-constraints"><strong>판단 전에 확인할 조건</strong><ul>${o.constraints.map(n=>`<li>${escape(n)}</li>`).join('')}</ul></div>`:''}${additionalCandidates(o)}</div>`;
 }
 function focusedVisual(v,omitMap){
  const o=v.overview;if(omitMap||!o||o.status!=='focused')return {...v,map:[],geometries:[],routes:[],sections:[]};
  const ids=new Set((o.schools||[]).map(s=>String(s.id))),names=new Set((o.schools||[]).map(s=>s.name));
  const points=(v.map||[]).filter(p=>(ids.has(String(p.id||p.school_id||''))||names.has(p.name))&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  return {...v,map:points,geometries:[],routes:[],sections:[]};
 }
 function chart(c){
  if(!c||c.kind==='map')return '';
  if(window.StatisticalCharts){
   if(c.kind==='scatter')return window.StatisticalCharts.scatter(c);
   if(c.kind==='line')return window.StatisticalCharts.line(c);
   const histogram=c.kind==='bar'&&(/구간|히스토그램/.test(c.title||'')||(/분포/.test(c.title||'')&&(c.points||[]).some(p=>/[-~–∼]|이상|미만|이하|초과/.test(p.name||''))));
   if(c.kind==='bar'&&!histogram)return window.StatisticalCharts.dotPlot(c);
  }
  if(c.points){c={...c,points:c.points.filter(p=>c.kind!=='bar'||Number.isFinite(p.value))};if(!c.points.length)return '<p class="fine">이 차트에 표시할 관측값이 없습니다. 값 없음은 0이 아닙니다.</p>';}
  if(c.kind==='bar'){const min=Math.min(0,...c.points.map(p=>p.value)),max=Math.max(0,...c.points.map(p=>p.value)),range=max-min||1,X=v=>160+(v-min)/range*305,height=50+c.points.length*32;return `<figure><svg viewBox="0 0 560 ${height}" role="img" aria-label="${escape(c.title||'항목별 관측 집계')}">${c.points.map((p,i)=>`<text x="8" y="${28+i*32}">${escape(p.name)}</text><rect x="${X(Math.min(0,p.value))}" y="${12+i*32}" width="${Math.abs(p.value)/range*305}" height="20" fill="${p.selected?'#b56a30':'#558c73'}"/><text x="${X(p.value)+10}" y="${28+i*32}">${escape(number(p.value))}${escape(c.unit||'개교')}</text>`).join('')}</svg><figcaption>표시된 자료의 집계이며 정책 우선순위가 아닙니다.</figcaption></figure>`;}

  const points=c.points||[],box=c.kind==='box',values=box?c.groups.flatMap(g=>[g.min,g.max]):points.map(p=>p.y),xs=box?[0,1]:points.map(p=>p.x);
  if(!values.length)return '';
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(0,...values),ymax=Math.max(...values),X=x=>60+(x-xmin)/(xmax-xmin||1)*440,Y=y=>235-(y-ymin)/(ymax-ymin||1)*190;
  let marks='';
  if(box)marks=c.groups.map((g,i)=>{const x=100+i*320/Math.max(1,c.groups.length-1);return `<path d="M${x} ${Y(g.min)}V${Y(g.max)}" stroke="#426c60"/><rect x="${x-25}" y="${Y(g.q3)}" width="50" height="${Math.max(1,Y(g.q1)-Y(g.q3))}" fill="#cee3d9" stroke="#426c60"/><path d="M${x-25} ${Y(g.median)}h50" stroke="#244f42"/><text x="${x}" y="256" text-anchor="middle">${escape(g.name)}</text>`;}).join('');
  else {if(c.kind!=='scatter')marks+=points.slice(1).map((p,i)=>`<path d="M${X(points[i].x)} ${Y(points[i].y)}L${X(p.x)} ${Y(p.y)}" fill="none" stroke="#36705b" stroke-width="2" ${p.name==='예측'?'stroke-dasharray="6 4"':''}/>`).join('');
   if(c.kind==='lorenz')marks+=`<path d="M60 235L500 45" stroke="#a3aaa6" stroke-dasharray="4"/>`;
   marks+=points.map(p=>`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.selected?7:c.kind==='scatter'?3:4}" fill="${p.selected||p.name==='예측'?'#b58732':'#36705b'}" opacity=".7"><title>${escape(p.name||'관측')}: ${escape(number(p.x))}, ${escape(number(p.y))}</title></circle>`).join('');}
  return `<figure><svg viewBox="0 0 560 300" role="img" aria-label="${escape(c.kind==='scatter'?'관측값 산점도':box?'분포 상자그림':'연속 관측 그래프')}"><path d="M60 35V235H510" fill="none" stroke="#a3b1a8"/>${[0,.5,1].map(t=>{const v=ymin+(ymax-ymin)*t;return `<text x="54" y="${Y(v)+4}" text-anchor="end">${escape(number(v))}</text>`;}).join('')}${marks}${box?'':`<text x="60" y="256">${escape(number(xmin))}</text><text x="500" y="256" text-anchor="end">${escape(number(xmax))}</text>`}<text x="60" y="20">${escape((c.y||['누적 관측값 비율']).join(' · '))}</text><text x="280" y="285" text-anchor="middle">${escape((c.x||[box?'지역':'누적 기관 비율']).join(' · '))}</text></svg><figcaption>정확한 수치는 아래 표에서 확인할 수 있습니다.</figcaption></figure>`;
 }
 function show(d,q,opt={}){
  map?.destroy();map=null;const current=++revision;
  const panel=document.getElementById('evidence-panel'),v={...(d.visual||{})},focus=focusedVisual(v,opt.omitMap),points=focus.map;
  window.ChatMap?.dispose(panel);
  const evidenceTables=[],seenTables=new Set(),seenSections=new Set();
  const tableKey=t=>JSON.stringify([t.headers,t.rows]);
  const evidenceTable=t=>{const key=tableKey(t);if(seenTables.has(key))return '';seenTables.add(key);const i=evidenceTables.push(t)-1;return `<div data-comparison-table="${i}">${table(t)}</div>`;};
  v.sections=(v.sections||[]).filter(s=>{const key=JSON.stringify([s.title,s.chart,s.table,s.notes]);if(seenSections.has(key))return false;seenSections.add(key);return true;});
  panel.innerHTML=`<p class="eyebrow">이 답변의 근거</p><h3>답변을 뒷받침하는 자료 한눈에 보기</h3><p class="panel-question">${escape(q)}</p><div class="evidence-tabs" role="tablist" aria-label="답변 근거 보기"><button type="button" role="tab" id="evidence-overview-tab" aria-controls="evidence-overview" aria-selected="true">종합 근거</button><button type="button" role="tab" id="evidence-details-tab" aria-controls="evidence-details" aria-selected="false" tabindex="-1">변수별 자료</button></div><section id="evidence-overview" role="tabpanel" aria-labelledby="evidence-overview-tab">${overview(v)}<div class="evidence-focused-map">${(!window.ChatMap&&points.length)?'<div id="answer-map" aria-label="답변에 나온 학교 위치 지도"></div><p id="answer-map-status" class="fine">학교 위치 · 카카오맵을 불러오는 중입니다…</p>':''}</div></section><section id="evidence-details" role="tabpanel" aria-labelledby="evidence-details-tab" hidden><p class="fine">변수별 차트는 해당 조회의 전체 비교 범위를 보여 줍니다. 종합 근거의 학교 목록과 범위가 다를 수 있습니다.</p>${!(v.sections||[]).some(s=>JSON.stringify(s.chart)===JSON.stringify(v.chart))?chart(v.chart):''}${(v.sections||[]).map(s=>`<details class="comparison-section"><summary>${escape(s.title)} · 세부 수치와 해석</summary>${chart(s.chart)}${(s.notes||[]).map(n=>`<p class="fine">${escape(n)}</p>`).join('')}${s.table&&!seenTables.has(tableKey(s.table))?`<details><summary>수치 표 보기 · ${s.table.rows.length}행</summary>${evidenceTable(s.table)}</details>`:''}</details>`).join('')}${(v.notes||[]).map(n=>`<p class="fine">${escape(n)}</p>`).join('')}${v.table&&!seenTables.has(tableKey(v.table))?`<details><summary>전체 수치 표 보기 · ${v.table.rows.length}행</summary>${evidenceTable(v.table)}</details>`:''}${d.rows?.facilities?.length?'<h4>관련 시설</h4>'+table({headers:['시설','주소','이용조건','출처'],rows:d.rows.facilities.map(f=>[f.name,f.address,f.condition,{url:f.url,label:'원문'}])}):''}</section>${window.SourceEvidence?'<details><summary>출처와 검증 상태</summary>'+window.SourceEvidence.render(d)+'</details>':'<p>출처 표시 모듈을 불러오지 못했습니다.</p>'}`;
  const tabs=[...panel.querySelectorAll('.evidence-tabs [role="tab"]')];
  const activate=tab=>{for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;}};
  tabs.forEach((tab,i)=>{tab.onclick=()=>activate(tab);tab.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];activate(next);next.focus();};});
  if(v.overview?.columns?.some(c=>c.note)){const definitions=document.createElement('details');definitions.className='evidence-variable-notes';definitions.innerHTML=`<summary>선택 변수의 정의와 예측 한계</summary><dl>${v.overview.columns.filter(c=>c.note).map(c=>`<dt>${escape(c.label||c.id)}</dt><dd>${escape(c.note)}</dd>`).join('')}</dl>`;panel.querySelector('#evidence-details').prepend(definitions);}
  panel.querySelectorAll('[data-comparison-table]').forEach(host=>window.TableComparison?.mount(host,evidenceTables[Number(host.dataset.comparisonTable)],table));
  if(window.ChatMap&&points.length)window.ChatMap.mount(panel.querySelector('.evidence-focused-map'),{...d,visual:focus});
  const spatial=[v,...v.sections].some(s=>s.geometries?.length||s.routes?.length||(!v.overview&&s.map?.length));
  if(window.ChatMap&&!opt.omitMap&&spatial){const details=document.createElement('details');details.className='evidence-spatial-details';details.innerHTML='<summary>변수별 공간 자료 보기 · 조회 범위 전체</summary><p class="fine">아래 지도는 해당 변수 조회의 전체 공간 자료입니다. 종합 근거의 학교 목록과 구분해 확인하세요.</p><div></div>';let mounted=false;details.ontoggle=()=>{if(details.open&&!mounted){mounted=true;window.ChatMap.mount(details.querySelector('div'),d);}};panel.querySelector('#evidence-details').prepend(details);}
  if(!window.ChatMap&&points.length){
   const container=document.getElementById('answer-map'),status=document.getElementById('answer-map-status');
   window.EducationMaps.ready().then(()=>{
    if(current!==revision||!container.isConnected)return;
    map=window.EducationMaps.create(container);const bounds=[];
    const colors={'high-high':'#ac5835','low-low':'#426ca0','high-low':'#ad903d','low-high':'#775a9e',not_detected:'#7b877f'};
    points.forEach(p=>{const position=map.point(p.lat,p.lng);bounds.push(position);map.dot('points',position,{active:p.selected,color:p.selected?'#b56a30':colors[p.cluster]||'#33785d',label:p.name,content:`<b>${escape(p.name)}</b><br>${escape(p.detail||'')}${p.value!=null?'<br>관측값 '+escape(number(p.value))+' · '+escape(p.cluster):''}`});});
    map.fit(bounds);status.textContent='학교·시설 위치 · 지도 배경 © Kakao · 경로의 출처와 검증 상태는 아래 근거를 확인하세요.';
   }).catch(()=>{if(current===revision&&status.isConnected)status.textContent='카카오맵을 불러오지 못했습니다. 아래 표에서 자료를 확인해 주세요.';});
  }
  if(window.AnswerExport){const toolbar=document.createElement('div');toolbar.className='export-actions';for(const [format,label] of [['docx','Word 보고서 ↓'],['png','PNG 보고서 ↓'],['csv','전체 표 CSV ↓']]){if(format==='csv'&&!v.table)continue;const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;status.textContent='보고서를 만들고 있습니다…';try{await window.AnswerExport.save(format,d,q);status.textContent='저장 파일을 만들었습니다.';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};toolbar.append(b);}const status=document.createElement('p');status.className='fine';status.setAttribute('role','status');toolbar.append(status);const exports=document.createElement('details');exports.innerHTML='<summary>분석 자료 내려받기</summary>';exports.append(toolbar);panel.append(exports);}
  if(d.suggestions?.length){const list=document.createElement('div');list.className='prompts';for(const item of d.suggestions){const b=document.createElement('button');b.type='button';b.textContent=item.label;b.onclick=()=>{document.getElementById('question').value=item.question;document.getElementById('question').dataset.datasetId=item.dataset_id;document.getElementById('question').focus();};list.append(b);}panel.prepend(list);}

 }
 const originalShow=show;
 function safeResult(d){const legacy=d&&!d.observation_version&&(d.weights?.length||d.lever_analysis||d.factor_analysis||(d.visual?.sections||[]).some(s=>s.chart?.unit==='점'||s.table?.headers?.includes('점수')));return legacy?{answerable:false,summary:'이전 방식으로 저장된 가중 점수·추천입니다. 현재 기준으로 질문을 다시 보내 관측값과 확인 조건을 검토해 주세요.',visual:{sections:[]},sources:[]}:d;}
 function enhancedShow(d,q,opt){d=safeResult(d);originalShow(d,q,opt);window.CollectionAssistant?.mount(document.getElementById('evidence-panel'),q,d);// The split pane already renders charts, tables and sources; legacy enhancement duplicates the answer.
}
 return {show:enhancedShow,chart,table,safeResult,focusedVisual,schoolText};
})();
