'use strict';
(function(global){
 let sdkPromise;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const position=s=>Number.isFinite(s?.lat)&&Number.isFinite(s?.lng)&&Math.abs(s.lat)<=90&&Math.abs(s.lng)<=180;
 function distance(a,b){const rad=Math.PI/180;return 6371000*Math.hypot((a.lng-b.lng)*rad*Math.cos((a.lat+b.lat)*rad/2),(a.lat-b.lat)*rad);}
 function nearby(s,rows){return position(s)?rows.filter(position).map(r=>({...r,distance:distance(s,r)})).filter(r=>r.distance<=500).sort((a,b)=>a.name.localeCompare(b.name,'ko')):[];}
 async function ready(){
  if(sdkPromise)return sdkPromise;
  sdkPromise=(async()=>{
   const response=await fetch('/api/google-places-config',{cache:'no-store'});
   if(!response.ok)throw Error('사진 서비스 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
   const config=await response.json();
   if(!config.enabled)throw Error('사진 서비스가 아직 연결되지 않았습니다. 학교 분석은 계속 사용할 수 있습니다.');
   if(!global.google?.maps?.importLibrary)await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();reject(Error('사진 연결이 지연되고 있습니다. 다시 시도해 주세요.'));},20000);
    global.__schoolPhotosReady=()=>{clearTimeout(timer);resolve();};
    script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key:config.key,loading:'async',libraries:'places',v:'weekly',language:'ko',region:'KR',callback:'__schoolPhotosReady'});
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Google 사진 서비스에 연결하지 못했습니다.'));};
    document.head.append(script);
   });
   await global.google.maps.importLibrary('places');
  })().catch(e=>{sdkPromise=null;throw e;});
  return sdkPromise;
 }
 function mount(host,school){
  if(!host||!school?.name)return;
  host.className='school-photos';
  host.innerHTML='<h3>학교·주변 시설 사진</h3><p>공간의 모습을 참고해 보세요. 사진이 현재 상태·안전·출입 가능 여부를 확인해 주지는 않습니다.</p>'
   +'<div class="photo-controls"><label>사진을 볼 장소<select aria-label="사진을 볼 장소"></select></label><button type="button">사진 찾아보기</button></div>'
   +'<p class="photo-coverage">주변 시설 목록을 확인하고 있습니다.</p><p class="photo-status" role="status" aria-live="polite">장소를 선택하고 사진 찾아보기를 눌러 주세요.</p><div class="photo-results"></div>';
  const select=host.querySelector('select'),button=host.querySelector('button'),status=host.querySelector('.photo-status'),results=host.querySelector('.photo-results');
  let choices=[{...school,kind:'학교'}],revision=0;
  const options=()=>{select.innerHTML=choices.map((p,i)=>`<option value="${i}">${esc(p.kind)} · ${esc(p.name)}${p.distance!=null?' (직선 '+Math.round(p.distance)+'m)':''}</option>`).join('');};options();
  if(position(school))Promise.allSettled(['parks','libraries'].map(async id=>{
   const r=await fetch('/data_processed/map_layers/'+id+'.json');if(!r.ok)throw Error('coverage');return nearby(school,await r.json()).map(p=>({...p,kind:id==='parks'?'공원':'도서관'}));
  })).then(rows=>{
   if(!host.isConnected)return;
   choices.push(...rows.flatMap(r=>r.status==='fulfilled'?r.value:[]));options();
   host.querySelector('.photo-coverage').textContent='공공데이터의 학교 중심 직선 500m 내 시설 · 가나다순. 도보 접근을 확인한 목록은 아닙니다.'+(rows.some(r=>r.status==='rejected')?' 일부 시설 자료를 불러오지 못했습니다.':choices.length===1?' 이 범위에서 연결된 시설이 없습니다.':'');
  });else host.querySelector('.photo-coverage').textContent='학교 좌표가 없어 주변 시설 목록은 확인을 보류합니다.';
  select.onchange=()=>{revision++;results.replaceChildren();button.disabled=false;status.textContent='선택한 장소의 사진을 찾아보세요.';};
  button.onclick=async()=>{
   const ticket=++revision,p=choices[Number(select.value)];button.disabled=true;results.replaceChildren();status.textContent='Google Maps에서 사진 후보를 찾고 있습니다…';
   try{
    await ready();if(ticket!==revision||!host.isConnected)return;
    const widget=document.createElement('gmp-place-search');
    widget.setAttribute('selectable','');
    widget.innerHTML='<gmp-place-content-config><gmp-place-address></gmp-place-address><gmp-place-media lightbox-preferred></gmp-place-media><gmp-place-attribution></gmp-place-attribution></gmp-place-content-config>';
    const query=document.createElement('gmp-place-text-search-request');query.setAttribute('max-result-count','3');
    query.textQuery=['인천광역시',school.gu||'',p.name].join(' ');
    if(position(p))query.locationBias={lat:p.lat,lng:p.lng};
    const timer=setTimeout(()=>{if(ticket===revision&&host.isConnected){status.textContent='사진 응답이 지연되고 있습니다. 다시 시도해 주세요.';button.disabled=false;}},25000);
    const finish=message=>{clearTimeout(timer);if(ticket===revision&&host.isConnected){status.textContent=message;button.disabled=false;}};
    widget.addEventListener('gmp-load',()=>finish(widget.places?.length===0?'일치하는 장소를 찾지 못했습니다. 사진 미확보는 시설 부족을 뜻하지 않습니다.':'Google 장소 검색 후보입니다. 이름과 주소가 선택한 시설과 같은지 확인해 주세요. 사진이 표시되지 않는 후보는 등록 사진을 확인할 수 없습니다.'));
    widget.addEventListener('gmp-error',()=>finish('사진을 불러오지 못했습니다. 서비스 연결 또는 API 사용 설정을 확인해야 합니다. 학교 분석은 계속 사용할 수 있습니다.'));
    widget.addEventListener('gmp-select',event=>{
     if(ticket!==revision||!host.isConnected||!event.place)return;
     results.querySelector('.photo-detail')?.remove();
     const detail=document.createElement('section');detail.className='photo-detail';
     const heading=document.createElement('h4');heading.textContent='선택한 장소의 사진';detail.append(heading);
     const note=document.createElement('p');note.textContent='Google 등록 사진에는 해당 시설과 무관하거나 오래된 사진이 포함될 수 있습니다. 사진이 없으면 등록 사진 미확보이며, 시설이 없다는 뜻은 아닙니다.';detail.append(note);
     const card=document.createElement('gmp-place-details');
     card.innerHTML='<gmp-place-content-config><gmp-place-address></gmp-place-address><gmp-place-media lightbox-preferred></gmp-place-media><gmp-place-attribution></gmp-place-attribution></gmp-place-content-config>';
     const request=document.createElement('gmp-place-details-place-request');request.place=event.place;
     card.addEventListener('gmp-error',()=>{heading.textContent='사진 상세 정보를 불러오지 못했습니다. 다른 후보를 선택하거나 다시 시도해 주세요.';});
     card.append(request);detail.append(card);results.append(detail);
    });
    widget.append(query);results.append(widget);
   }catch(e){if(ticket===revision&&host.isConnected){status.textContent=e.message;button.disabled=false;}}
  };
 }
 global.SchoolPhotos={mount,nearby,distance};
})(typeof window!=='undefined'?window:globalThis);
