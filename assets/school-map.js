'use strict';
window.SchoolMap=(() => {
  const colors={'유치원':'#b47724','초등학교':'#267a59','중학교':'#426cbd','고등학교':'#8960a9'};
  const el=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inputs=()=>[...document.querySelectorAll('[data-map-level]')];
  const levels=()=>inputs().filter(input=>input.checked).map(input=>input.dataset.mapLevel);
  const position=s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&Math.abs(s.lat)<=90&&Math.abs(s.lng)<=180;
  let walkingRevision=0,walkingPoints=[];const walkingCache=new Map();
  let map,rows=[],selected='',zoneData,zonePromise,callbacks,initialized=false,zonePoints=[];
  function setLevels(values){inputs().forEach(input=>{input.checked=values.includes(input.dataset.mapLevel);});}
  async function init(options) {
    if(initialized)return;initialized=true;callbacks=options;
    if(window.matchMedia){const mobile=window.matchMedia('(max-width:850px)');const adjust=()=>{el('map-options').open=!mobile.matches;};mobile.addEventListener('change',adjust);adjust();}
    inputs().forEach(input=>input.addEventListener('change',()=>callbacks.onFilter()));
    el('map-all-levels').onclick=()=>{setLevels(Object.keys(colors));callbacks.onFilter();};
    el('map-clear-school').onclick=()=>callbacks.onSelect('');
    el('map-radius').onchange=drawRadius;
    el('map-zones').onchange=drawZones;
    el('map-walkshed').onchange=drawWalking;el('map-walking-fit').onclick=()=>map?.fit(walkingPoints,3);
    el('map-status').textContent='카카오맵을 불러오는 중입니다…';
    try{await window.EducationMaps.ready();map=window.EducationMaps.create(el('school-map'));}
    catch(error){el('map-status').textContent='카카오맵을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요. 학교 검색과 목록은 계속 사용할 수 있습니다.';return;}
    window.MapLayers?.init(map);
    el('map-fit').onclick=()=>map.fit(rows.filter(position).map(s=>map.point(s.lat,s.lng)));
    el('map-zone-fit').onclick=()=>map.fit(zonePoints,3);
    render(rows,selected);if(selected)select(selected);
  }
  function zonePopup(feature) {
    const p=feature.properties;
    const box=document.createElement('div');
    box.innerHTML=`<b>${escape(p.name)}</b><p>${escape(p.level)} · 자료 기준 ${escape(p.reference_date||'미확보')}</p><p>${escape(p.office||'')}</p><p>연결 학교: ${escape((p.schools||[]).map(s=>s.name).join(', ')||'연계정보 미확보')}</p><small>공식 연결정보입니다. 실제 배정은 교육청 고시를 확인하세요.</small>`;
    const linked=(p.schools||[]).filter(s=>rows.some(row=>row.id===s.id));
    linked.forEach(s=>{const button=document.createElement('button');button.className='text-button';button.textContent=`${s.name} 살펴보기 →`;button.onclick=()=>callbacks.onSelect(s.id);box.append(button);});
    const source=document.createElement('a');source.href='https://schoolzone.emac.kr/publicData/publicDataList.do';source.target='_blank';source.rel='noopener';source.textContent='공식 공개자료 ↗';box.append(document.createElement('br'),source);
    return box;
  }
  function drawPoints() {
    if(!map)return;map.clear('schools');
    const groups=new Map();
    rows.filter(position).forEach(s=>{const key=`${s.lat.toFixed(6)}/${s.lng.toFixed(6)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);});
    groups.forEach(group=>{
      const s=group.find(s=>s.id===selected)||group[0],active=group.some(s=>s.id===selected);
      const choose=()=>{if(group.length>1){
        const box=document.createElement('div');const title=document.createElement('b');title.textContent=`같은 위치에 등록된 학교 ${group.length}곳`;box.append(title);
        group.forEach(s=>{const button=document.createElement('button');button.className='text-button';button.textContent=`${s.name} · ${s.level} 선택`;button.onclick=()=>callbacks.onSelect(s.id);box.append(button);});map.open(map.point(s.lat,s.lng),box);
      }else callbacks.onSelect(s.id);};
      map.dot('schools',map.point(s.lat,s.lng),{color:colors[s.level],active,count:group.length,onClick:choose,label:group.length>1?`${group.map(s=>s.name).join(', ')} · 같은 위치 ${group.length}곳 선택`:`${s.name} · ${s.level} 선택`});
    });
  }
  function render(filtered,id) {
    rows=filtered;selected=id||'';
    const n=rows.filter(position).length;
    el('map-count').textContent=`${levels().join(' · ')||'학교급 미선택'} · 지도 ${n}곳${n<rows.length?` / 좌표 미확보 ${rows.length-n}곳`:''}`;
    el('map-clear-school').disabled=!selected;el('map-fit').disabled=!n;
    if(!levels().length)el('map-status').textContent='보고 싶은 학교급을 하나 이상 선택해 주세요.';
    else if(!rows.length)el('map-status').textContent='검색 조건에 맞는 학교가 없습니다. 이름이나 학교급을 바꿔 보세요.';
    else if(map)el('map-status').textContent='학교를 누르면 요약과 선택 학교의 경계를 확인할 수 있습니다.';
    drawPoints();drawRadius();drawZones();drawWalking();
  }
  function select(id) {
    selected=id||'';el('map-clear-school').disabled=!selected;
    drawPoints();drawRadius();drawZones();drawWalking();
    const school=rows.find(s=>s.id===selected);if(map&&school&&position(school))map.select(school.lat,school.lng);
  }
  function drawRadius() {
    if(!map)return;map.clear('radius');
    const s=rows.find(s=>s.id===selected);
    if(el('map-radius').checked&&s&&position(s))map.circle('radius',map.point(s.lat,s.lng));
  }
  function walkingData(file){
    if(!walkingCache.has(file)){const request=fetch('/data_processed/'+file,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('자료 연결 실패');return r.json();}).catch(e=>{walkingCache.delete(file);throw e;});walkingCache.set(file,request);}return walkingCache.get(file);
  }
  const nearestCache=new Map();
  function nearestParks(){
    if(!nearestCache.has('csv'))nearestCache.set('csv',fetch('/data_processed/school_nearest_park.csv',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('자료 연결 실패');return r.text();}).then(text=>{const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean),head=lines.shift().split(','),map=new Map();for(const line of lines){const cells=line.split(','),row=Object.fromEntries(head.map((k,i)=>[k,cells[i]]));map.set(row.학교ID,{park:row.nearest_park_name,distance:Number(row.nearest_park_dist_m)});}return map;}).catch(e=>{nearestCache.delete('csv');throw e;}));
    return nearestCache.get('csv');
  }
  const straight=(a,b)=>{const rad=Math.PI/180,x=(a.lng-b.lng)*rad*Math.cos((a.lat+b.lat)*rad/2),y=(a.lat-b.lat)*rad;return 6371000*Math.hypot(x,y);};
  // Park routes belong to the 공원 layer: when it is on, the selected school's nearest-park walk is drawn with it.
  async function elementaryRoute(school){
    const nearest=(await nearestParks()).get(school.id);if(!nearest||!Number.isFinite(nearest.distance))return null;
    const parks=await window.MapLayers.rows('parks'),same=parks.filter(p=>p.name===nearest.park&&position(p));
    const park=same.sort((a,b)=>straight(a,school)-straight(b,school))[0];
    return {park_name:nearest.park,route_distance_m:nearest.distance,straight_distance_m:park?Math.round(straight(park,school)):null,coordinates:park?[[school.lng,school.lat],[park.lng,park.lat]]:null,method:'공공 공원 대상 보행망 최근접 거리 원장 · 경로선은 대표점 직선 표시'};
  }
  async function drawWalking(){
    const revision=++walkingRevision;if(!map)return;map.clear('walkshed');map.clear('walking-route');walkingPoints=[];el('map-walking-fit').hidden=true;
    const status=el('map-walking-status'),school=rows.find(s=>s.id===selected),showArea=el('map-walkshed').checked,showRoute=!!window.MapLayers?.isChosen?.('parks');
    el('school-map').dataset.walkingSchool='';el('school-map').dataset.walkingAreas='0';el('school-map').dataset.walkingRoutes='0';
    if(!showArea&&!showRoute){status.textContent='도보권 표시 꺼짐 · 공원 경로는 ‘자연과 놀이 › 공원’을 켜면 표시됩니다.';return;}
    if(!school){status.textContent=showRoute?'학교를 선택하면 도보 500m 도달권과 가장 가까운 공원까지의 보행 경로·거리를 확인할 수 있습니다.':'학교를 선택하면 도보 500m 도달권을 확인할 수 있습니다. 공원 경로는 ‘자연과 놀이 › 공원’을 켜면 함께 표시됩니다.';return;}
    status.textContent=school.name+'의 보행 자료를 불러오는 중입니다…';
    const tasks=[];
    if(showArea)tasks.push(walkingData(school.level==='초등학교'?'school_walkshed_500m_v3.geojson':'education/walkshed_500m.geojson').then(d=>({kind:'area',data:d})));
    if(showRoute)tasks.push((school.level==='초등학교'?elementaryRoute(school):walkingData('education/school_routes.json').then(d=>{const r=d[school.id];return r?.status==='available'&&Number.isFinite(r.route_distance_m)&&Array.isArray(r.route_coordinates)&&r.route_coordinates.length>=2?{park_name:r.park_name,route_distance_m:r.route_distance_m,straight_distance_m:r.straight_distance_m,coordinates:r.route_coordinates,method:r.method||'보행망 분석'}:null;})).then(d=>({kind:'route',data:d})));
    const results=await Promise.allSettled(tasks);if(revision!==walkingRevision)return;
    const messages=[];el('school-map').dataset.walkingSchool=school.id;
    for(const [i,result] of results.entries()){
      const kind=result.status==='fulfilled'?result.value.kind:(i===0&&showArea?'area':'route');
      if(result.status==='rejected'){messages.push((kind==='area'?'도보권':'공원 보행 경로')+' 자료를 불러오지 못했습니다. 옵션을 껐다 켜면 재시도합니다.');continue;}
      if(kind==='area'){
        const features=result.value.data.features?.filter(f=>f.properties?.학교ID===school.id)||[];
        for(const feature of features)walkingPoints.push(...map.polygons('walkshed',feature,{color:'#21875a',opacity:.2,content:()=>{const box=document.createElement('div');box.innerHTML='<b>'+escape(school.name)+' · 도보 500m 도달권</b><p>보행망을 따라 500m까지 도달하는 범위입니다. 출입구·통행허용·안전은 별도 확인이 필요합니다.</p><small>분석 방법: '+escape(feature.properties.method||'원자료 확인')+'</small>';return box;}}));
        el('school-map').dataset.walkingAreas=String(features.length);messages.push(features.length?'도보 500m 도달권 표시 중':'이 학교의 도보권 자료 미확보 · 도달 가능 범위가 없다는 뜻은 아닙니다.');
      }else{
        const route=result.value.data;
        if(route){
          const text=school.name+' → '+route.park_name+' · 보행망 거리 '+Math.round(route.route_distance_m).toLocaleString('ko-KR')+'m'+(Number.isFinite(route.straight_distance_m)?' · 직선 '+Math.round(route.straight_distance_m).toLocaleString('ko-KR')+'m':'');
          if(route.coordinates){walkingPoints.push(...map.route('walking-route',route.coordinates,escape(text)+'<br>'+escape(route.method)+'<br>대표점 경로 · 실제 출입구와 통행 조건 별도 확인',{dashed:route.coordinates.length<=2}));el('school-map').dataset.walkingRoutes='1';messages.push(text);}
          else messages.push(text+' · 공원 좌표 미확보로 선은 표시하지 않습니다.');
        }else messages.push('이 학교의 공원 보행 경로·거리 자료 미확보 · 경로가 없다는 뜻은 아닙니다.');
      }
    }
    status.textContent=school.name+' · '+messages.join(' / ');el('map-walking-fit').hidden=!walkingPoints.length;
  }
  async function drawZones() {
    if(!map)return;map.clear('zones');zonePoints=[];el('map-zone-fit').hidden=true;
    if(!el('map-zones').checked){el('map-zone-status').textContent='학구도 표시 꺼짐';return;}
    if(!levels().length){el('map-zone-status').textContent='학구도를 보려면 학교급을 선택해 주세요.';return;}
    if(!zoneData){
      el('map-zone-status').textContent='공식 학구도를 불러오는 중입니다…';
      try{
        if(!zonePromise)zonePromise=fetch('/data_processed/education/school_zones.geojson',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('학구도 연결 실패');return r.json();}).then(data=>{if(!Array.isArray(data.features))throw Error('학구도 형식 오류');zoneData=data;});
        await zonePromise;
      }catch(error){zonePromise=null;el('map-zone-status').textContent='학구도를 불러오지 못했습니다. 표시를 껐다 켜면 다시 시도합니다. 경계가 없다는 뜻은 아닙니다.';return;}
      // Always use the latest filters after a slow request; never restore stale boundaries.
      return drawZones();
    }
    const features=zoneData.features.filter(f=>levels().includes(f.properties.level)&&(!selected||(f.properties.schools||[]).some(s=>s.id===selected)));
    zonePoints=features.flatMap(f=>map.polygons('zones',f,{content:()=>zonePopup(f)}));el('map-zone-fit').hidden=!(selected&&features.length);
    const school=rows.find(s=>s.id===selected),dates=[...new Set(features.map(f=>f.properties.reference_date).filter(Boolean))].sort();
    let message=selected?`${school?.name||'선택 학교'}와 공식 연결된 학구 ${features.length}개`:`선택 학교급의 공식 학구 ${features.length}개`;
    if(dates.length)message+=` · 자료 기준 ${dates.length===1?dates[0]:`${dates[0]} ~ ${dates.at(-1)}`}`;
    if(school?.level==='유치원'||(!selected&&levels().includes('유치원')))message+=' · 유치원 학구도는 원자료에서 제공하지 않습니다.';
    else if(selected&&!features.length)message+=' · 연결 자료 미확보이며 학구가 없다는 뜻은 아닙니다.';
    el('map-zone-status').textContent=message;
  }
  return {init,levels,setLevels,render,select,refreshWalking:drawWalking};
})();
