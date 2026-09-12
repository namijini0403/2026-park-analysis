'use strict';
// Shared native Kakao renderer for school exploration and answer evidence.
window.EducationMaps=(()=>{
 let loading;
 function ready(){
  if(window.kakao?.maps?.Map)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   const timer=setTimeout(()=>reject(Error('카카오맵 연결 시간이 초과되었습니다.')),20000);
   script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(window.KAKAO_MAP_KEY);
   script.onerror=()=>{clearTimeout(timer);reject(Error('카카오맵을 불러오지 못했습니다.'));};
   script.onload=()=>{if(!window.kakao?.maps){clearTimeout(timer);reject(Error('카카오맵 인증을 확인해 주세요.'));return;}kakao.maps.load(()=>{clearTimeout(timer);resolve();});};
   document.head.append(script);
  });
  return loading;
 }
 const point=(lat,lng)=>new kakao.maps.LatLng(lat,lng);
 function create(container,{center=[37.49,126.68],level=8}={}){
  const map=new kakao.maps.Map(container,{center:point(...center),level,scrollwheel:true});
  map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);
  map.addControl(new kakao.maps.MapTypeControl(),kakao.maps.ControlPosition.TOPRIGHT);
  const layers=new Map();let popup=null,pendingBounds=null,disposed=false;
  container.dataset.mapProvider='kakao';
  const track=(name,layer)=>{if(!layers.has(name))layers.set(name,[]);layers.get(name).push(layer);layer.setMap(map);return layer;};
  const close=()=>{popup?.setMap(null);popup=null;};
  function open(position,content){
   close();const box=document.createElement('div');box.className='kakao-evidence-popup';
   const button=document.createElement('button');button.type='button';button.className='kakao-popup-close';button.textContent='×';button.setAttribute('aria-label','지도 설명 닫기');button.onclick=close;
   const body=document.createElement('div');if(typeof content==='string')body.innerHTML=content;else body.append(content);
   box.append(button,body);popup=new kakao.maps.CustomOverlay({position,content:box,yAnchor:1.15,zIndex:1000,clickable:true,map});
  }
  function fit(points,minLevel=4){
   if(!points.length)return;
   const bounds=new kakao.maps.LatLngBounds();points.forEach(p=>bounds.extend(p));
   if(!container.clientWidth||!container.clientHeight){pendingBounds={points,minLevel};return;}
   map.relayout();map.setBounds(bounds,30,30,30,30);if(map.getLevel()<minLevel)map.setLevel(minLevel);
  }
  const observer=new ResizeObserver(()=>{if(disposed||!container.clientWidth||!container.clientHeight)return;const center=map.getCenter();map.relayout();map.setCenter(center);if(pendingBounds){const next=pendingBounds;pendingBounds=null;fit(next.points,next.minLevel);}});observer.observe(container);
  function dot(group,position,{color='#33785d',active=false,label='',onClick,content,count}={}){
   const node=document.createElement('button');node.type='button';node.className='kakao-school-dot'+(active?' is-selected':'');node.style.setProperty('--dot-color',color);node.title=label;node.setAttribute('aria-label',label);node.setAttribute('aria-pressed',String(active));
   if(count){node.dataset.schoolCount=count;if(count>1)node.classList.add('is-shared');}
   node.onclick=e=>{e.stopPropagation();if(onClick)onClick();else if(content)open(position,content);};
   return track(group,new kakao.maps.CustomOverlay({position,content:node,yAnchor:.5,xAnchor:.5,zIndex:active?600:500,clickable:true}));
  }
  function polygons(group,feature,{color='#8560ad',opacity=.09,content}={}){
   const geometry=feature.geometry||feature,polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[],points=[];
   for(const polygon of polys){const path=polygon.map(ring=>ring.map(([lng,lat])=>{const p=point(lat,lng);points.push(p);return p;}));
    const layer=track(group,new kakao.maps.Polygon({path,strokeWeight:1.5,strokeColor:color,fillColor:color,fillOpacity:opacity,zIndex:100}));
    if(content)kakao.maps.event.addListener(layer,'click',event=>open(event.latLng,typeof content==='function'?content():content));
   }return points;
  }
  function route(group,coordinates,content,{dashed=false}={}){const path=coordinates.map(([lng,lat])=>point(lat,lng));const layer=track(group,new kakao.maps.Polyline({path,strokeColor:'#aa7240',strokeWeight:3,strokeStyle:dashed?'shortdash':'solid',zIndex:300}));if(content)kakao.maps.event.addListener(layer,'click',event=>open(event.latLng,content));return path;}
  function circle(group,position){return track(group,new kakao.maps.Circle({center:position,radius:500,strokeColor:'#277f88',strokeWeight:2,strokeStyle:'dash',fillColor:'#277f88',fillOpacity:.06,zIndex:200}));}
  function clear(group,keepPopup=false){(layers.get(group)||[]).forEach(layer=>layer.setMap(null));layers.delete(group);if(!keepPopup)close();}
  function destroy(){disposed=true;observer.disconnect();for(const group of layers.keys())clear(group);close();container.replaceChildren();}
  return {map,point,dot,polygons,route,circle,open,close,clear,fit,destroy,select:(lat,lng)=>{map.setCenter(point(lat,lng));map.setLevel(4);}};
 }
 return {ready,create,point};
})();
