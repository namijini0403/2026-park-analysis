'use strict';
const root='../data_processed/';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'미확보':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1});
const table=(heads,rows)=>`<div class="scroll"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const load=async name=>{const r=await fetch(root+name);if(!r.ok)throw Error(`자료를 읽을 수 없습니다: ${name} (${r.status})`);return r.json();};
const params=new URLSearchParams(location.search);let active=params.get('tab')||'demand';
const cache={};
async function data(key,path){return cache[key]||(cache[key]=await load(path));}
const content=document.getElementById('content');
let renderToken=0;
async function render(){
 const token=++renderToken;document.getElementById('error').textContent='';
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===active)));
 content.textContent='자료를 읽고 있습니다…';
 try{
 if(active==='demand'){
  const [d,grid]=await Promise.all([data('demand','education/candidate_demand_v2.json'),data('grid','candidate_grid_final.geojson')]);if(token!==renderToken)return;
  const ids=Object.keys(d.candidates);const selected=ids.includes(params.get('grid'))?params.get('grid'):ids[0];
  content.innerHTML=`<section><h2>후보지 안에 사는 인구와 주변 인구</h2><p>2024년 연령별 거주인구를 100m 총인구 비중과 실제 교차면적으로 배분했습니다. 후보를 추가·삭제해도 같은 권역의 추정값은 바뀌지 않습니다.</p><p class="warning">직선 500m 인구는 보행 접근 인구가 아닙니다. 두 권역의 인원을 더하거나 겹치는 후보의 인원을 합산하지 않습니다.</p><label>후보 격자 <input id="grid-search" list="grids" value="${esc(selected)}"><datalist id="grids">${ids.map(id=>`<option value="${esc(id)}">`).join('')}</datalist></label><label>대상 <select id="level">${['초등학교','유치원','중학교','고등학교'].map(s=>`<option>${s}</option>`).join('')}</select></label><div id="demand-detail"></div></section><section><h2>주변 인구 규모 비교</h2><p class="note">기존 초등학교 후보 중 2024년 직선 500m 인구가 확보된 곳을 비교합니다. 아래 순서는 인구 규모 순서이며 설치 우선순위·신규 수혜 순위가 아닙니다.</p><div id="demand-ranking"></div></section>`;
  function show(){const id=document.getElementById('grid-search').value,level=document.getElementById('level').value,c=d.candidates[id];
   document.getElementById('demand-detail').innerHTML=c?table(['범위','2024년 추정 거주인구','2029년 도시 성장 시나리오','2031년 도시 성장 시나리오'],[['footprint','격자 내부'],['straight_500m','주변 직선 500m']].map(([scope,label])=>{const v=c[scope].levels[level];return[label,num(v.estimated_residents),num(v.city_growth_scenario?.['2029']),num(v.city_growth_scenario?.['2031'])]}))+`<p class="note">미확보는 0명이 아닙니다. 미래 값은 인천 전체 해당 연령인구 성장률을 동일하게 적용한 가정입니다. 후보지별 개발·전입·출생 분포는 반영하지 않았으며 실제 이용자 수를 뜻하지 않습니다. 2029·2031 장기 성능 미검증.</p>`:'격자 ID를 확인해 주세요.';
   const ranked=grid.features.map(f=>({id:f.properties.grid_id,n:d.candidates[f.properties.grid_id]?.straight_500m.levels[level].estimated_residents})).filter(r=>r.n!=null).sort((a,b)=>b.n-a.n||a.id.localeCompare(b.id));
   document.getElementById('demand-ranking').innerHTML=table(['격자','2024년 직선 500m 추정 인구'],ranked.slice(0,20).map(r=>[r.id,num(r.n)]));
  }document.getElementById('grid-search').addEventListener('change',show);document.getElementById('level').addEventListener('change',show);show();
 }else if(active==='routes'){
  const d=await data('routes','education/route_review.json');if(token!==renderToken)return;
  const rows=Object.values(d.schools),available=rows.filter(r=>r.automatic.status==='available');
  content.innerHTML=`<section><h2>기존 검수값과 카카오 도보 경로 비교</h2><div class="metrics"><div><b>${rows.length}</b>기존 보정 학교</div><div><b>${available.length}</b>카카오 경로 확보</div><div><b>${available.filter(r=>r.flags.includes('500m_classification_disagreement')).length}</b>500m 판정 차이</div></div><p class="warning">학교 중심·공원 대표점 기준 비교입니다. 실제 출입구가 확인되지 않아 기존 검수값은 유지합니다. 경로가 일치해도 현장 검증 완료로 처리하지 않습니다.</p><label>학교 검색 <input id="route-filter" placeholder="학교 이름"></label><div id="route-table"></div><p class="note">거리 차이 검토 기준: 50m와 기존 거리의 20% 중 큰 값 초과. 450~550m는 경계 재검토. 기준은 초기 운영 가정입니다.</p><p><a href="https://developers.kakao.com/docs/ko/kakaomap/rest-api#도보-경로-조회" target="_blank" rel="noreferrer">카카오 공식 도보 API</a> · 최단거리 옵션 사용. 도달권 폴리곤과 점간 경로는 별도 산출물입니다.</p></section>`;
  function show(){const q=document.getElementById('route-filter').value;document.getElementById('route-table').innerHTML=table(['학교','검수 대상 공원','기존 검수(m)','카카오(m)','차이(m)','검토'],rows.filter(r=>r.school_name.includes(q)).map(r=>[r.school_name,r.park_name,num(r.reviewed_distance_m),num(r.automatic.distance_m),num(r.difference_m),r.automatic.status!=='available'?'공원 식별·경로 확인 필요':r.flags.includes('500m_classification_disagreement')?'500m 판정 차이':r.flags.includes('distance_disagreement')?'거리 차이·출입구 확인':'출입구 확인 필요']));}document.getElementById('route-filter').addEventListener('input',show);show();
 }else{
  const [d,v,c,schools]=await Promise.all([data('forecast','education/enrollment_forecasts.json'),data('validation','education/forecast_validation.json'),data('cohort','education/grade_cohort_scenarios.json'),data('schools','education/shared_parks.json')]);if(token!==renderToken)return;
  const names=Object.fromEntries((schools.schools||[]).map(s=>[s.id,s.name||s.school_name||s.id]));for(const [id,s] of Object.entries(c.schools))names[id]=s.school_name;
  const ids=Object.keys(d),sid=ids.includes(params.get('school'))?params.get('school'):ids.find(id=>c.schools[id])||ids[0];
  content.innerHTML=`<section><h2>학교별 학생수와 학년 진급 시나리오</h2><label>학교 <select id="school">${ids.map(id=>`<option value="${esc(id)}" ${id===sid?'selected':''}>${esc(names[id]||id)}</option>`).join('')}</select></label><div id="forecast-detail"></div></section><section><h2>미래 정보를 제외한 평가</h2><p>예측 원점까지만 학습·가중치 선택에 사용하고 마지막 관측연도를 평가했습니다. 5년 자료가 부족한 학교급은 평가값을 만들지 않습니다.</p>${table(['학교급','선행기간','평가 학교','선택모형 MAE(명)','추세 MAE(명)'],Object.entries(v).flatMap(([level,x])=>x.summary.map(s=>[level,s.horizon+'년',s.n,num(s.mae),num(s.baseline_mae)])))}</section>`;
  function show(){const id=document.getElementById('school').value,s=d[id],g=c.schools[id];const years=[...new Set([...s.history.map(r=>r.year),...s.forecast.map(r=>r.year)])];document.getElementById('forecast-detail').innerHTML=table(['연도','관측 학생수','추세·잔차 모델','학년 진급 시나리오'],years.map(y=>[y,num(s.history.find(r=>r.year===y)?.students),num(s.forecast.find(r=>r.year===y)?.students),num(g?.forecast.find(r=>r.year===y)?.students)]))+`<p class="note">모형: ${s.model_status==='weighted_trend_lightgbm'?'가중 추세 + LightGBM 잔차':'가중 추세/이력 부족'}. 원점 이전 검증에서 5% 이상 개선될 때 보정을 적용합니다. 미래 값은 확정 수요가 아닙니다.</p>`+(g?`<p class="warning">학년 진급은 별도 비교 시나리오입니다. 최신 1학년 인원을 유지하고 관측 가능한 진급 비율을 적용합니다. 학구별 취학예정 인구는 아직 결합하지 않았습니다. ${esc(g.limitations)}</p>`:'<p class="note">일관된 학년별 인원 자료 미확보: 학년 진급 시나리오 미산출.</p>');}document.getElementById('school').addEventListener('change',show);show();
 }
 }catch(error){if(token===renderToken){document.getElementById('error').textContent=error.message;content.textContent='미확보 자료를 이전 모델의 숫자로 대체하지 않습니다.';}}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.tab;render();}));render();
