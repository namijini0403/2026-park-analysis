'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'미확보':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1});
const $=id=>document.getElementById(id);
let dataset, shapes, selected;
const drafts={};
const table=(heads,rows)=>`<div class="scroll"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const status=r=>r.comparison==='500m_disagreement'?'500m 판정 차이':r.comparison==='500m_agreement'?'500m 판정 일치 (실측 아님)':r.status==='not_queried'?'카카오 미조회':'경로·연결 미확보';
function coordinateDiagram(row){
 const shape=shapes.features.find(f=>f.properties.school_id===row.school_id)?.geometry;
 const polygons=shape?(shape.type==='Polygon'?[shape.coordinates]:shape.coordinates):[];
 const segments=row.comparisons.flatMap(c=>dataset.route_cache[c.request_hash]?.segments||[]);
 const all=[row.origin,...row.comparisons.map(c=>c.coordinates),...polygons.flat(2),...segments.flat()];
 const lon=all.map(p=>p[0]),lat=all.map(p=>p[1]);
 const center=[(Math.min(...lon)+Math.max(...lon))/2,(Math.min(...lat)+Math.max(...lat))/2];
 const sx=Math.cos(center[1]*Math.PI/180),span=Math.max((Math.max(...lon)-Math.min(...lon))*sx,Math.max(...lat)-Math.min(...lat),.001);
 const xy=p=>[300+(p[0]-center[0])*sx/span*360,210-(p[1]-center[1])/span*360];
 const points=ps=>ps.map(p=>xy(p).map(v=>v.toFixed(2)).join(',')).join(' ');
 return `<svg viewBox="0 0 600 420" role="img" aria-label="OSM 도달권과 카카오 경로 및 조회 표본점 좌표 비교">${polygons.map(poly=>`<path fill="#9bc7ad" fill-opacity=".5" fill-rule="evenodd" stroke="#4a8061" stroke-width=".7" d="${poly.map(r=>'M'+r.map(p=>xy(p).join(',')).join('L')+'Z').join('')}"/>`).join('')}${segments.filter(s=>s.length>1).map(s=>`<polyline points="${points(s)}" fill="none" stroke="#345bcc" stroke-width="2"/>`).join('')}${row.comparisons.map(c=>{const [x,y]=xy(c.coordinates);return `<circle cx="${x}" cy="${y}" r="${c.kind==='park'?6:4}" fill="${c.comparison==='500m_disagreement'?'#bc3c31':c.status==='available'?'#345bcc':'#909b94'}"><title>${esc(c.kind)}: OSM ${num(c.osm_distance_m)}m / 카카오 ${num(c.kakao_distance_m)}m</title></circle>`}).join('')}<circle cx="${xy(row.origin)[0]}" cy="${xy(row.origin)[1]}" r="7" fill="#173c2a"><title>학교 출발점</title></circle></svg>`;
}
function renderSchool(){
 selected=$('school').value;const row=dataset.schools[selected];if(!row)return;
 $('save-status').textContent='';
 $('detail').innerHTML=`<h2>${esc(row.school_name)} → ${esc(row.park_name)}</h2><p>기존 검수 거리 <b>${num(row.legacy_distance_m)}m</b> · 출입구: ${Object.values(row.entrances_verified).every(Boolean)?'근거 확보, 경로 검수 필요':'근거 확인 필요'} · ${row.pilot?'우선 표본 대조 대상':'전체 OSM 산출 대상'}</p><p>학교→보행망 직선 연결 ${num(row.osm.offset_m)}m. ${row.osm.method==='origin_snap_exceeds_50m'?'50m 한도 초과로 도달권 미산출. 연결을 임의로 통행 가능 처리하지 않았습니다.':'도달 가능한 도로 부분만 500m에서 절단했습니다. 녹색 면은 10m 표시 버퍼이며 보행 가능 필지 면적이 아닙니다.'}</p>${coordinateDiagram(row)}<p class="note"><span style="color:#4a8061">녹색: OSM 500m 표시 영역</span> · <span style="color:#345bcc">파랑: 카카오 경로/조회점</span> · <span style="color:#bc3c31">빨강: 500m 판정 차이</span> · 회색: 미조회/미확보</p>${table(['대상','OSM 거리(m)','카카오 거리(m)','도착 연결(m)','결과'],row.comparisons.map(c=>[c.kind==='park'?'검수 대상 공원':c.kind,num(c.osm_distance_m),num(c.kakao_distance_m),num(c.destination_snap_m),status(c)]))}<p><a href="https://map.kakao.com/link/map/${encodeURIComponent(row.school_name)},${row.origin[1]},${row.origin[0]}" target="_blank" rel="noopener">학교 위치를 카카오지도에서 확인</a>${row.destination?` · <a href="https://map.kakao.com/link/map/${encodeURIComponent(row.park_name)},${row.destination[1]},${row.destination[0]}" target="_blank" rel="noopener">공원 대표점 확인</a>`:''}</p><p class="note">카카오 미조회 지점은 접근 불가를 뜻하지 않습니다. 조회점들을 연결해 카카오 500m 폴리곤을 만들지 않습니다.</p>`;
 const candidates=row.entrance_candidates;
 const candidateRows=candidates?['school','park'].flatMap(kind=>(candidates[kind]||[]).map(c=>[kind==='school'?'학교 주변':'공원 주변',String(c.osm_id),num(c.distance_from_representative_m),c.coordinates.join(', '),c.tags.entrance||c.tags.barrier||'태그 후보',c.tags.access||'통행 미확인'])):[];
 const candidateLinks=candidates?Object.values(candidates).flat().map(c=>`<a href="https://www.openstreetmap.org/node/${encodeURIComponent(c.osm_id)}" target="_blank" rel="noopener">OSM ${esc(c.osm_id)} 원자료</a>`).join(' · '):'';
 $('detail').insertAdjacentHTML('beforeend',`<h3>OSM 출입구 참고 후보</h3><p class="note">200m 이내 태그 후보이며 해당 시설 소속·개방을 확인한 출입구가 아닙니다. 확인 전에는 위 경로의 출발·도착점으로 사용하지 않습니다.</p>${candidateRows.length?table(['주변','OSM 노드 ID','대표점 거리(m)','경도, 위도','태그','통행 태그'],candidateRows)+`<p>${candidateLinks}</p>`:'<p>후보 미확보 또는 미조회. 출입구가 없다는 뜻이 아닙니다.</p>'}`);
 const record=drafts[selected]||row.endpoints;
 $('endpoints').innerHTML=['school','park'].map(kind=>{const r=record[kind]||{};return `<fieldset><legend>${kind==='school'?'학교':'공원'} 출입구</legend><label>경도 <input name="${kind}_lon" type="number" min="124" max="132" step="any" value="${esc(r.coordinates?.[0]??'')}" required></label><label>위도 <input name="${kind}_lat" type="number" min="33" max="39" step="any" value="${esc(r.coordinates?.[1]??'')}" required></label><label>근거 종류 <select name="${kind}_kind"><option value="official">공식 자료</option><option value="streetview">거리뷰</option><option value="field">현장 확인</option></select></label><label>근거 URL 또는 기록 식별번호 <input type="text" name="${kind}_evidence" value="${esc(r.evidence||'')}" required></label><label><input type="checkbox" name="${kind}_identity" ${r.entity_identity_confirmed?'checked':''}> 해당 시설의 출입구임을 확인</label><label><input type="checkbox" name="${kind}_open" ${r.pedestrian_access==='open'?'checked':''}> 도보 통행 가능·개방을 확인</label></fieldset>`}).join('');
 const form=$('review-form');for(const kind of ['school','park'])form.elements[kind+'_kind'].value=record[kind]?.evidence_kind||'official';
 form.elements.checked_on.value=record.school?.checked_on||new Date().toISOString().slice(0,10);
 form.elements.reviewer.value=record.school?.reviewer||'';
}
$('review-form').addEventListener('submit',event=>{
 event.preventDefault();const f=event.target.elements,checked=f.checked_on.value;
 if(!checked||checked>new Date().toISOString().slice(0,10)){ $('save-status').textContent='미래 날짜는 확인일로 기록할 수 없습니다.';return; }
 const record={};for(const kind of ['school','park']){
  const identity=f[kind+'_identity'].checked,open=f[kind+'_open'].checked;
  record[kind]={status:identity&&open?'verified':'pending',coordinates:[Number(f[kind+'_lon'].value),Number(f[kind+'_lat'].value)],evidence_kind:f[kind+'_kind'].value,evidence:f[kind+'_evidence'].value.trim(),checked_on:checked,reviewer:f.reviewer.value.trim(),entity_identity_confirmed:identity,pedestrian_access:open?'open':'unknown'};
 }drafts[selected]=record;$('save-status').textContent='임시 기록에 저장했습니다. JSON을 내려받아 재산출해야 검수 자료에 반영됩니다.';
});
$('download').addEventListener('click',()=>{
 const schools=Object.fromEntries(Object.values(dataset.schools).map(r=>[r.school_id,drafts[r.school_id]||r.endpoints]));
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,schools},null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='walk_entrance_reviews.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('beforeunload',event=>{if(Object.keys(drafts).length){event.preventDefault();event.returnValue='';}});
$('school').addEventListener('change',renderSchool);
$('search').addEventListener('input',()=>{const q=$('search').value;for(const option of $('school').options)option.hidden=!option.textContent.includes(q);const first=Array.from($('school').options).find(o=>!o.hidden);if(first){$('school').value=first.value;renderSchool();}});
(async()=>{
 const loaded=await Promise.all(['hybrid_walk_review.json','hybrid_walkshed_500m.geojson','hybrid_entrance_candidates.json'].map(async name=>{const r=await fetch('../data_processed/education/'+name);if(!r.ok)throw Error('검수 자료 미확보: '+name);return r.json();}));
 [dataset,shapes]=loaded;for(const [sid,candidates] of Object.entries(loaded[2].schools||{}))if(dataset.schools[sid])dataset.schools[sid].entrance_candidates=candidates;
 const s=dataset.summary;$('summary').textContent=`검토 ${s.schools}개교 · 우선 ${s.pilot_schools}개교 · OSM 도달권 ${s.walkshed_features}개 · 카카오 표본점 ${s.sample_queries_available}개 · 출입구 쌍 확인 ${s.verified_endpoint_pairs}개`;
 $('school').innerHTML=Object.values(dataset.schools).map(r=>`<option value="${esc(r.school_id)}">${esc(r.school_name)} · ${r.priority===0?'500m 판정 차이':r.priority===1?'경계 부근':r.priority===2?'거리 차이':'식별·출입구 검토'}</option>`).join('');renderSchool();
})().catch(error=>{$('error').textContent=error.message;});
