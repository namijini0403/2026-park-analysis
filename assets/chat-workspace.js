/* Related evidence is rendered from server data; never execute model HTML. */
window.ChatWorkspace=(()=>{
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const href=v=>/^https?:\/\//.test(v||'')?v:/^(data_processed|rag)\/[\w./-]+$/.test(v||'')?'/'+v:null;
 const link=(url,label)=>href(url)?`<a href="${escape(href(url))}" target="_blank" rel="noopener">${escape(label||url)} ↗</a>`:escape(label||url||'출처 미확인');
 const number=v=>Number.isFinite(v)?Number(v.toFixed(3)).toLocaleString('ko-KR'):v;
 const table=t=>!t?'':`<div class="table-scroll"><table><thead><tr>${t.headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.map(v=>`<td>${v&&typeof v==='object'?link(v.url,v.label):escape(number(v))}</td>`).join('')}</tr>`).join('')}</tbody></table>${t.rows.length?'':'<p>이 조건으로 수집된 자료가 없습니다. 지정이 없다는 뜻은 아닙니다.</p>'}</div>`;
 let map=null,revision=0;
 function chart(c){
  if(!c||c.kind==='map')return '';
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
 function show(d,q){
  map?.destroy();map=null;const current=++revision;
  const panel=document.getElementById('evidence-panel'),raw=d.visual||{},v={...raw,map:[...(raw.map||[]),...(raw.sections||[]).flatMap(s=>s.map||[])],geometries:[...(raw.geometries||[]),...(raw.sections||[]).flatMap(s=>s.geometries||[])],routes:[...(raw.routes||[]),...(raw.sections||[]).flatMap(s=>s.routes||[])]},points=(v.map.length?v.map:(v.chart?.kind==='map'?v.chart.points:[])).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  panel.innerHTML=`<p class="eyebrow">이 답변의 근거</p><h3>${escape(v.title||'관련 자료')}</h3><p class="panel-question">${escape(q)}</p>${(points.length||v.geometries?.length||v.routes?.length)?'<div id="answer-map" aria-label="관련 학교 위치 지도"></div><p id="answer-map-status" class="fine">학교 위치 · 카카오맵을 불러오는 중입니다…</p>':''}${chart(v.chart)}${(v.sections||[]).map(s=>`<section class="comparison-section"><h4>${escape(s.title)}</h4>${chart(s.chart)}${(s.notes||[]).map(n=>`<p class="fine">${escape(n)}</p>`).join('')}${table(s.table)}</section>`).join('')}${(v.notes||[]).map(n=>`<p class="fine">${escape(n)}</p>`).join('')}${table(v.table)}${d.rows?.facilities?.length?'<h4>관련 시설</h4>'+table({headers:['시설','주소','이용조건','출처'],rows:d.rows.facilities.map(f=>[f.name,f.address,f.condition,{url:f.url,label:'원문'}])}):''}${window.SourceEvidence?window.SourceEvidence.render(d):'<p>출처 표시 모듈을 불러오지 못했습니다.</p>'}`;
  if(points.length||v.geometries?.length||v.routes?.length){
   const container=document.getElementById('answer-map'),status=document.getElementById('answer-map-status');
   window.EducationMaps.ready().then(()=>{
    if(current!==revision||!container.isConnected)return;
    map=window.EducationMaps.create(container);const bounds=[];
    const colors={'high-high':'#ac5835','low-low':'#426ca0','high-low':'#ad903d','low-high':'#775a9e',not_detected:'#7b877f'};
    points.forEach(p=>{const position=map.point(p.lat,p.lng);bounds.push(position);map.dot('points',position,{active:p.selected,color:p.selected?'#b56a30':colors[p.cluster]||'#33785d',label:p.name,content:`<b>${escape(p.name)}</b><br>${escape(p.detail||'')}${p.value!=null?'<br>관측값 '+escape(number(p.value))+' · '+escape(p.cluster):''}`});});
    for(const f of v.geometries||[])bounds.push(...map.polygons('geometries',f,{color:/^#[0-9a-f]{6}$/i.test(f.properties?.color)?f.properties.color:'#56836c',opacity:.12,content:escape(f.properties?.name||'구역')}));
    for(const r of v.routes||[])bounds.push(...map.route('routes',r.coordinates,escape(r.name)));
    map.fit(bounds);status.textContent='학교·시설 위치 · 지도 배경 © Kakao · 경로의 출처와 검증 상태는 아래 근거를 확인하세요.';
   }).catch(()=>{if(current===revision&&status.isConnected)status.textContent='카카오맵을 불러오지 못했습니다. 아래 표에서 자료를 확인해 주세요.';});
  }
  if(window.AnswerExport){const toolbar=document.createElement('div');toolbar.className='export-actions';for(const [format,label] of [['docx','Word 보고서 ↓'],['png','PNG 보고서 ↓'],['csv','전체 표 CSV ↓']]){if(format==='csv'&&!v.table)continue;const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;status.textContent='보고서를 만들고 있습니다…';try{await window.AnswerExport.save(format,d,q);status.textContent='저장 파일을 만들었습니다.';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};toolbar.append(b);}const status=document.createElement('p');status.className='fine';status.setAttribute('role','status');toolbar.append(status);panel.prepend(toolbar);}
  if(d.suggestions?.length){const list=document.createElement('div');list.className='prompts';for(const item of d.suggestions){const b=document.createElement('button');b.type='button';b.textContent=item.label;b.onclick=()=>{document.getElementById('question').value=item.question;document.getElementById('question').dataset.datasetId=item.dataset_id;document.getElementById('question').focus();};list.append(b);}panel.prepend(list);}

 }
 const originalShow=show;
 function enhancedShow(d,q){originalShow(d,q);window.CollectionAssistant?.mount(document.getElementById('evidence-panel'),q,d);window.VisualStudio?.enhance(document.getElementById('evidence-panel'),d);}
 return {show:enhancedShow,chart};
})();
