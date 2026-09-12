'use strict';
window.MapLayers=(()=>{
 const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const groups=[['nature','자연과 놀이','공원 · 놀이터 · 야외체육'],['learning','배움과 돌봄','도서관 · 청소년 · 학원가'],['housing','주거와 개발','대단지 · 정비사업 · 공사'],['safety','안전','사고다발구역']];
 const chosen=new Set(),cache=new Map(),errors=new Map();let map,manifest=[],visible=[],pageSize=50,initialized=false;
 function load(id){
  if(!cache.has(id))cache.set(id,fetch('/data_processed/map_layers/'+id+'.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('자료 연결 실패');return r.json();}).then(rows=>{cache.set(id,rows);errors.delete(id);return rows;}).catch(e=>{cache.delete(id);errors.set(id,e.message);throw e;}));
  return Promise.resolve(cache.get(id));
 }
 function save(){try{localStorage.setItem('education-map-layers-v1',JSON.stringify([...chosen]));}catch{}}
 async function toggle(id,on){if(on)chosen.add(id);else chosen.delete(id);map.close();save();draw();if(id==='parks')window.SchoolMap?.refreshWalking?.();if(on){await Promise.allSettled([load(id)]);draw();}}
 function controls(){
  const host=el('map-layer-groups');host.replaceChildren();
  for(const [group,title,hint] of groups){
   const section=document.createElement('details');section.className='map-layer-group';section.dataset.layerGroup=group;
   section.innerHTML=`<summary><span><strong>${title}</strong><small>${hint}</small></span><b class="layer-group-count">0</b></summary><div class="layer-group-options"></div>`;
   const options=section.querySelector('.layer-group-options');
   for(const layer of manifest.filter(l=>l.group===group)){
    const label=document.createElement('label');label.className='map-layer-option';
    label.innerHTML=`<input type="checkbox" data-context-layer="${layer.id}"><i style="background:${layer.color}"></i><span>${esc(layer.label)}<small>보유 ${layer.count.toLocaleString('ko-KR')}곳${layer.missing_coordinates?' · 좌표 미확보 '+layer.missing_coordinates+'곳':''}${layer.id==='parks'?' · 선택 학교의 가장 가까운 공원 보행 경로·거리 함께 표시':''}</small></span>`;
    const input=label.querySelector('input');input.checked=chosen.has(layer.id);input.onchange=()=>toggle(layer.id,input.checked);options.append(label);
   }
   host.append(section);
  }
 }
 function card(row,layer){
  const box=document.createElement('div');box.innerHTML=`<b>${esc(row.name)}</b><p>${esc(layer.label)}</p>${row.facts.map(f=>'<p>'+esc(f)+'</p>').join('')}<small>${esc(layer.note)}</small>`;
  for(const [url,text] of [[/^https:\/\//.test(row.source_url||'')?row.source_url:null,'공식 원자료 ↗'],[layer.source_url&&layer.source_url!==row.source_url?layer.source_url:null,(layer.source_title||'공개 자료 페이지')+' ↗'],[layer.source_url_extra||null,'추가 원자료 ↗']]){if(!url)continue;const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent=text;box.append(document.createElement('br'),link);}
  if(row.members){
   const button=document.createElement('button');button.className='text-button';button.textContent='이 구역의 학원 '+row.members.length+'곳 보기';
   button.onclick=async()=>{button.disabled=true;button.textContent='학원 목록 불러오는 중…';try{const rows=await load('academies'),ids=new Set(row.members),members=rows.filter(r=>ids.has(r.id));const list=document.createElement('div');list.className='map-member-list';const heading=document.createElement('p');heading.textContent='소속 학원 '+members.length+'곳';list.append(heading);for(const r of members){const b=document.createElement('button');b.className='text-button';b.textContent=r.name;b.onclick=()=>{map.select(r.lat,r.lng);map.open(map.point(r.lat,r.lng),card(r,manifest.find(l=>l.id==='academies')));};list.append(b);}button.replaceWith(list);}catch{button.disabled=false;button.textContent='목록 연결 실패 · 다시 보기';}};box.append(button);
  }
  return box;
 }
 function show(row,layer){map.select(row.lat,row.lng);map.open(map.point(row.lat,row.lng),card(row,layer));}
 function groupedPopup(rows,layer){const box=document.createElement('div');box.innerHTML=`<b>${esc(layer.label)} · ${rows.length}곳</b><p>지도가 축소되어 가까운 위치를 묶어 표시했습니다.</p>`;const zoom=document.createElement('button');zoom.className='text-button';zoom.textContent='이 위치들 확대하기';zoom.onclick=()=>map.fit(rows.map(r=>map.point(r.lat,r.lng)),2);box.append(zoom);for(const r of rows){const b=document.createElement('button');b.className='text-button';b.textContent=r.name;b.onclick=()=>show(r,layer);box.append(b);}return box;}
 function inView(r,bounds){
  if(r.geometry){const flat=r.geometry.coordinates.flat(r.geometry.type==='MultiPolygon'?2:1);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y] of flat){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}const sw=bounds.getSouthWest(),ne=bounds.getNorthEast();return minX<=ne.getLng()&&maxX>=sw.getLng()&&minY<=ne.getLat()&&maxY>=sw.getLat();}
  return bounds.contain(map.point(r.lat,r.lng));
 }
 function draw(){
  if(!map)return;const bounds=map.map.getBounds(),projection=map.map.getProjection();visible=[];const status=[];
  for(const layer of manifest){
   map.clear('context-'+layer.id,true);
   if(!chosen.has(layer.id))continue;
   const rows=cache.get(layer.id);
   if(!Array.isArray(rows)){status.push(layer.label+(errors.has(layer.id)?' 연결 실패 · 껐다 켜서 재시도':' 불러오는 중'));continue;}
   const matches=rows.filter(r=>inView(r,bounds));visible.push(...matches.map(row=>({row,layer})));status.push(layer.label+' '+matches.length+'곳');
   const cells=new Map();
   for(const r of matches){
    if(r.geometry)map.polygons('context-'+layer.id,{geometry:r.geometry},{color:layer.color,opacity:.12,content:()=>card(r,layer)});
    const p=projection.containerPointFromCoords(map.point(r.lat,r.lng)),cellSize=map.map.getLevel()<=3?12:48,key=Math.floor(p.x/cellSize)+'/'+Math.floor(p.y/cellSize);
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(r);
   }
   for(const rows of cells.values()){
    const lat=rows.reduce((n,r)=>n+r.lat,0)/rows.length,lng=rows.reduce((n,r)=>n+r.lng,0)/rows.length;
    const overlay=map.dot('context-'+layer.id,map.point(lat,lng),{color:layer.color,label:rows.length===1?rows[0].name:layer.label+' '+rows.length+'곳 · 목록 보기',onClick:()=>map.open(map.point(lat,lng),rows.length===1?card(rows[0],layer):groupedPopup(rows,layer))});
    const node=overlay.getContent();node.classList.add('map-facility-dot');node.dataset.facilityLayer=layer.id;if(rows.length>1){node.classList.add('map-facility-cluster');node.textContent=rows.length;}
   }
  }
  el('school-map').dataset.contextCount=String(visible.length);
  el('map-layer-status').textContent=chosen.size?'현재 지도 화면 · '+status.join(' / ')+' · 표시가 없어도 시설 부재나 안전을 뜻하지 않습니다.':'원하는 영역을 펼쳐 시설과 주변 환경을 지도에 겹쳐 보세요.';
  const chips=el('map-layer-selected');chips.replaceChildren();
  for(const layer of manifest.filter(l=>chosen.has(l.id))){const b=document.createElement('button');b.className='map-layer-chip';b.style.setProperty('--layer-color',layer.color);b.textContent=layer.label+' ×';b.setAttribute('aria-label',layer.label+' 표시 해제');b.onclick=()=>{document.querySelector('[data-context-layer="'+layer.id+'"]').checked=false;toggle(layer.id,false);};chips.append(b);}
  for(const section of document.querySelectorAll('[data-layer-group]'))section.querySelector('.layer-group-count').textContent=String(manifest.filter(l=>l.group===section.dataset.layerGroup&&chosen.has(l.id)).length);
  el('map-layers-clear').disabled=!chosen.size;el('map-layer-list').hidden=!chosen.size;el('map-layer-list-count').textContent=visible.length+'곳';renderList();
 }
 function renderList(){
  const body=el('map-layer-table');body.replaceChildren();
  for(const {row,layer} of visible.slice(0,pageSize)){const tr=document.createElement('tr');tr.innerHTML=`<td><button class="text-button">${esc(row.name)}</button></td><td>${esc(layer.label)}</td><td>${esc(row.facts.slice(0,2).join(' · '))}</td>`;tr.querySelector('button').onclick=()=>{show(row,layer);el('school-map').scrollIntoView({block:'center',behavior:'smooth'});};body.append(tr);}
  el('map-layer-more').hidden=visible.length<=pageSize;
 }
 async function init(adapter){
  if(initialized)return;initialized=true;map=adapter;
  try{const r=await fetch('/data_processed/map_layers/manifest.json',{cache:'no-cache'});if(!r.ok)throw Error();manifest=(await r.json()).layers;
   try{const stored=JSON.parse(localStorage.getItem('education-map-layers-v1')||'[]');if(Array.isArray(stored))for(const id of stored)if(manifest.some(l=>l.id===id))chosen.add(id);}catch{}
   controls();el('map-layers-clear').onclick=()=>{chosen.clear();map.close();document.querySelectorAll('[data-context-layer]').forEach(i=>i.checked=false);save();draw();};
   el('map-layer-more').onclick=()=>{pageSize+=50;renderList();};
   kakao.maps.event.addListener(map.map,'idle',draw);draw();window.SchoolMap?.refreshWalking?.();await Promise.allSettled([...chosen].map(load));draw();
  }catch{el('map-layer-status').textContent='시설 선택 목록을 불러오지 못했습니다. 새로고침으로 다시 연결해 주세요.';}
 }
 return {init,isChosen:id=>chosen.has(id),rows:load};
})();
