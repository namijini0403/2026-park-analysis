window.SchoolZones = (() => {
  let data = null, pending = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function ensure() {
    if (data) return data;
    if (!pending) pending = fetch('./data_processed/education/school_zones.geojson',{cache:'no-cache'})
      .then(r=>{if(!r.ok)throw Error(`학구도 ${r.status}`);return r.json();})
      .then(value=>{data=value;render();return value;})
      .catch(error=>{appendStatus(`학구도 로딩 실패: ${error.message}`);throw error;})
      .finally(()=>{pending=null;});
    return pending;
  }
  function render() {
    clearOverlayGroup('schoolZonePolygons');
    state.overlays.schoolZonePolygons=[];
    if (!data || !isLayerOnById('schoolZones')) return;
    const level=document.getElementById('schoolLevelFilter')?.value || '초등학교';
    if(level==='유치원'){appendStatus(data.metadata.kindergarten.note);return;}
    const colors={'초등학교':'#c2410c','중학교':'#7c3aed','고등학교':'#0369a1'};
    const features=data.features.filter(f=>level==='all'||f.properties.level===level);
    for(const feature of features){
      const p=feature.properties, polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
      for(const rings of polygons){
        const polygon=new kakao.maps.Polygon({map:state.map,path:rings.map(r=>r.map(([lng,lat])=>new kakao.maps.LatLng(lat,lng))),strokeWeight:2,strokeColor:colors[p.level],strokeOpacity:.9,fillColor:colors[p.level],fillOpacity:.09});
        kakao.maps.event.addListener(polygon,'click',event=>{
          state.infoWindow.setContent(`<div style="padding:12px;max-width:320px;color:#172033"><b>${escape(p.name)}</b><p>${escape(p.level)} · 기준 ${escape(p.reference_date)}</p><p>${escape(p.schools.map(s=>s.name).join(', ')||'학교 연계정보 미확보')}</p><small>학구 유형 코드 ${escape(p.zone_type)} · 500m 생활권과 별개입니다. 실제 배정은 교육청 고시를 확인하세요.</small><p><a href="https://schoolzone.emac.kr/publicData/publicDataList.do" target="_blank" rel="noopener">공식 공개자료</a></p></div>`);
          state.infoWindow.setPosition(event.latLng);state.infoWindow.open(state.map);
        });
        state.overlays.schoolZonePolygons.push(polygon);
      }
    }
    appendStatus(`공식 학구도 ${features.length}개 구역 · ${[...new Set(features.map(f=>f.properties.reference_date))].join(', ')} 기준`);
  }
  return {ensure,render,isLoaded:()=>!!data};
})();
