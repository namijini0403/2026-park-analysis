'use strict';
// Each answer owns its map. Coordinates stay in the browser, not in the model context.
window.ChatMap=(()=>{
 const mounted=new Map();
 function collect(d){
  const v=d.visual||{},sections=v.sections||[],unique=(items,key)=>[...new Map(items.map(x=>[key(x),x])).values()];
  return {
   points:unique([...(v.map||[]),...sections.flatMap(s=>s.map||[])].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)),p=>p.id||`${p.name}:${p.lat}:${p.lng}`),
   geometries:unique([...(v.geometries||[]),...sections.flatMap(s=>s.geometries||[])],g=>JSON.stringify([g.properties?.name,g.geometry])),
   routes:unique([...(v.routes||[]),...sections.flatMap(s=>s.routes||[])],r=>JSON.stringify([r.name,r.coordinates]))
  };
 }
 function mount(host,d){
  const v=collect(d);if(d.answerable===false||(!v.points.length&&!v.geometries.length&&!v.routes.length))return null;
  const card=document.createElement('section');card.className='agent-inline-map';
  card.innerHTML='<div class="chat-map-toolbar"><strong>이 답변의 지도</strong><button type="button" class="chat-map-fit">전체 보기</button></div><div class="chat-map-canvas" aria-label="답변에 나온 학교와 경계 지도"></div><div class="chat-map-layers"></div><p class="fine chat-map-status" role="status">지도를 불러오는 중입니다…</p><button type="button" class="chat-map-retry" hidden>지도 다시 불러오기</button>';
  const canvas=card.querySelector('.chat-map-canvas'),status=card.querySelector('.chat-map-status'),retry=card.querySelector('.chat-map-retry'),controls=card.querySelector('.chat-map-layers');
  const state={map:null,observer:null,disposed:false,busy:false};mounted.set(card,state);host.append(card);
  const groups=[{id:'zone',label:'학구도',color:'#8359ae',features:[]},{id:'walk',label:'보행 500m 분석 범위',color:'#25866d',features:[]},{id:'other',label:'기타 경계',color:'#56836c',features:[]}];
  for(const f of v.geometries){const name=f.properties?.name||'';groups[/학구도/.test(name)?0:/보행|도보/.test(name)?1:2].features.push(f);}
  const content=text=>{const node=document.createElement('span');node.textContent=text;return node;};
  let bounds=[];
  function drawGroup(group){return group.features.flatMap(f=>state.map.polygons(group.id,f,{color:group.color,opacity:.12,content:content(f.properties?.name||group.label)}));}
  for(const group of groups.filter(g=>g.features.length)){
   const label=document.createElement('label'),input=document.createElement('input'),dot=document.createElement('i');input.type='checkbox';input.checked=true;input.setAttribute('aria-label',group.label+' 표시');dot.style.background=group.color;label.append(input,dot,document.createTextNode(group.label));controls.append(label);group.input=input;
   input.onchange=()=>{if(!state.map)return;state.map.clear(group.id);if(input.checked)drawGroup(group);};
  }
  if(v.points.length){const select=document.createElement('select');select.setAttribute('aria-label','지도의 학교로 이동');select.add(new Option('학교로 이동', ''));v.points.forEach((p,i)=>select.add(new Option(p.name,String(i))));select.onchange=()=>{if(select.value!==''&&state.map){const p=v.points[Number(select.value)];state.map.select(p.lat,p.lng);}};card.querySelector('.chat-map-toolbar').append(select);}
  card.querySelector('.chat-map-fit').onclick=()=>state.map?.fit(bounds);
  async function start(){
   if(state.busy||state.map||state.disposed||!card.isConnected)return;state.busy=true;retry.hidden=true;status.textContent='지도를 불러오는 중입니다…';
   try{
    await window.EducationMaps.ready();if(state.disposed||!card.isConnected)return;
    state.map=window.EducationMaps.create(canvas);bounds=[];
    for(const p of v.points){const position=state.map.point(p.lat,p.lng);bounds.push(position);state.map.dot('schools',position,{label:p.name,active:p.selected,content:content([p.name,p.detail].filter(Boolean).join(' · '))});}
    for(const group of groups)if(group.features.length&&group.input.checked)bounds.push(...drawGroup(group));
    for(const r of v.routes)bounds.push(...state.map.route('routes',r.coordinates,content(r.name||'경로')));
    state.map.fit(bounds);status.textContent=`학교·시설 ${v.points.length}곳 · 지도에서 드래그·확대하거나 학교를 선택해 보세요. 지도 © Kakao${v.geometries.length?' · 면의 겹침은 출입구·통학로 검증을 뜻하지 않습니다.':''}`;
   }catch{state.map?.destroy();state.map=null;if(!state.disposed){status.textContent='지도 연결을 완료하지 못했습니다. 다시 불러오거나 아래 학교별 표를 확인해 주세요.';retry.hidden=false;}}
   finally{state.busy=false;}
  }
  retry.onclick=start;
  if(window.IntersectionObserver){state.observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){state.observer.disconnect();start();}},{rootMargin:'300px'});state.observer.observe(card);}else start();
  return card;
 }
 function dispose(host){for(const [card,state] of mounted)if(host===card||host.contains(card)){state.disposed=true;state.observer?.disconnect();state.map?.destroy();mounted.delete(card);}}
 return {mount,dispose,collect};
})();
