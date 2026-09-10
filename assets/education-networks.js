/* Observed designations and explicitly hypothetical diffusion/resource scenarios. */
(function(global){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,d=2)=>v==null?'미산출':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:d});
  const option=(v,label=v)=>`<option value="${esc(v)}">${esc(label)}</option>`;
  const table=(headers,rows)=>`<div class="edu-table"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  async function mount(container,initialLevel,initialGu){
    container.innerHTML='<h2>공유 자원과 학교 네트워크</h2><p>실행 결과를 불러오고 있습니다.</p>';
    try{
      const [parks,diffusion]=await Promise.all(['shared_parks','designation_diffusion'].map(async name=>{
        const r=await fetch(`./data_processed/education/${name}.json`);if(!r.ok)throw Error(`${name}: ${r.status}`);return r.json();
      }));
      if(!container.isConnected)return;
      const levels=['유치원','초등학교','중학교','고등학교'];
      const districts=[...new Set(parks.schools.map(s=>s.gu).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
      container.innerHTML=`<h2>공유 공원 · 한 곳을 이용하지 못하면?</h2>
        <p>같은 공원에 접근 가능한 학교들의 2026년 학생·원아 수로 공원 면적을 나눕니다. 실제 혼잡도나 이용자 수가 아닌 공급 배분 시나리오입니다.</p>
        <div class="edu-stat-controls"><label>학교급<select data-network="level">${levels.map(l=>option(l)).join('')}</select></label><label>지역<select data-network="gu">${['전체',...districts].map(g=>option(g)).join('')}</select></label><label>정렬<select data-network="sort">${option('loss','가장 큰 공원 중단 시 손실률')}${option('supply','공유 반영 면적이 적은 순')}${option('sharing','공원을 함께 접근하는 기관 수')}</select></label></div>
        <p class="edu-note">필터는 표시할 학교를 선택합니다. 자원 배분의 분모는 전체 917개 기관을 유지합니다. 공원 대표점이 v3 도보 500m 도달권 안에 있을 때 연결하며 검증된 출입구 기준은 아닙니다. 기존 면적비율과 산출 기준이 다릅니다.</p>
        <div data-network="parks-result" aria-live="polite"></div>
        <p class="edu-note">단위는 ㎡/학생·원아입니다. 공원 전체 공시면적을 공급 대리값으로 사용하며 다른 주민 수요·시간대 차이는 미반영입니다. 한 곳 중단은 나머지 배분을 고정한 시나리오입니다. 연결 학교의 공시 결측 또는 공원 면적 충돌은 미산출로 남깁니다.</p>
        <details><summary>공원 원자료 중복·확인 필요 항목</summary><p>원본 ${parks.raw_park_rows}행 → 이름·좌표 기준 ${parks.parks.length}개. 중복 ${parks.collapsed_duplicate_rows}행을 묶었습니다. 아래 항목의 면적은 임의 선택하지 않았습니다.</p>${table(['공원','확인할 내용'],parks.identity_issues.map(p=>[p.name,p.reason==='conflicting_area_same_name_coordinate'?'동일 이름·좌표의 공시면적 충돌':'서로 다른 시설명이 같은 좌표 사용']))}</details>
        <h2>선도·연구학교 지정 변화와 확산 시나리오</h2>
        <p>이 영역은 위 학교급·지역 필터와 별개로 일반학교 ${diffusion.registry_n}곳 전체를 분석합니다. 지정 명단은 관측 자료이고 학교 간 연결·전파 확률은 가정입니다.</p>
        <div class="edu-metrics"><div>2025년 지정<strong>${diffusion.matched_2025}곳</strong></div><div>2026년 지정<strong>${diffusion.matched_2026}곳</strong></div><div>두 해 모두 등재<strong>${diffusion.retained}곳</strong></div><div>2026년 신규 등재<strong>${diffusion.new_in_2026}곳</strong></div></div>
        ${table(['같은 학교급 연결 반경','신규군의 전년도 지정 이웃 비율','나머지군','층화 순열 p'],diffusion.scenarios.filter(s=>s.probability_per_edge===.15).map(s=>[`${s.radius_m/1000}km`,`${num(s.empirical_transition.mean_seed_neighbor_share_new*100)}%`,`${num(s.empirical_transition.mean_seed_neighbor_share_other*100)}%`,num(s.empirical_transition.permutation_upper_tail_p,4)]))}
        <p class="edu-note">학교급×군구별 신규 지정 수를 유지한 1,999회 순열 비교입니다. 단측 탐색 결과이며 거리 기준 3개에 대한 다중검정 보정은 하지 않았습니다. 사업 선정 기준 변화·현재 원장 사용의 영향을 받으며, 실제 교육 확산의 인과효과가 아닙니다.</p>
        <div class="edu-stat-controls"><label>가정한 연결 반경<select data-network="radius">${[1000,3000,5000].map(r=>option(r,`${r/1000}km`)).join('')}</select></label><label>연결당 전파 확률<select data-network="probability">${[.05,.15,.30].map(p=>option(p,`${p*100}% · 가정값`)).join('')}</select></label></div>
        <div data-network="diffusion-result" aria-live="polite"></div>
        <p class="edu-note">독립 전파 모형: 새로 도달한 학교가 연결마다 한 번 시도합니다. ${diffusion.trials}회·${diffusion.rounds}단계이며 단계는 월·연도가 아닙니다. 누적 도달 수는 최초 지정학교를 포함합니다. 전파 확률은 추정치가 아니며 결과는 실제 전망이 아닙니다.</p>
        <p><a href="./data_processed/education/shared_parks.json" download>공유 공원 결과·근거 JSON</a> · <a href="./data_processed/education/designation_diffusion.json" download>지정·확산 결과·근거 JSON</a></p>`;
      const select=k=>container.querySelector(`[data-network="${k}"]`);
      select('level').value=levels.includes(initialLevel)?initialLevel:'초등학교';
      select('gu').value=districts.includes(initialGu)?initialGu:'전체';
      select('radius').value='3000';select('probability').value='0.15';
      const parkNames=new Map(parks.parks.map(p=>[p.id,p.name]));
      function drawParks(){
        const rows=parks.schools.filter(s=>s.level===select('level').value&&(select('gu').value==='전체'||s.gu===select('gu').value));
        const key={loss:'largest_park_loss_share',supply:'shared_area_per_student',sharing:'sharing_school_count'}[select('sort').value];
        rows.sort((a,b)=>a[key]==null?b[key]==null?0:1:b[key]==null?-1:(select('sort').value==='supply'?1:-1)*(a[key]-b[key]));
        const valid=rows.filter(s=>s.park_count>0&&s.shared_area_per_student!=null);
        select('parks-result').innerHTML=`<div class="edu-metrics"><div>표시 대상<strong>${rows.length}곳</strong></div><div>공원 연결 없음<strong>${rows.filter(s=>s.park_count===0).length}곳</strong></div><div>공원 배분값 확보<strong>${valid.length}곳</strong></div><div>공원 2개 이상·중단 손실 50% 초과<strong>${valid.filter(s=>s.park_count>=2&&s.largest_park_loss_share>.5).length}곳</strong></div></div><details><summary>학교별 공유 자원과 중단 민감도 (${rows.length}곳 펼치기)</summary>${table(['학교·유치원','공원 수','공유 기관 수','전 학교급 공유 반영','같은 학교급만 반영','최대 손실률','영향이 가장 큰 공원'],rows.map(s=>[s.name,s.park_count,s.sharing_school_count,num(s.shared_area_per_student),num(s.same_level_shared_area_per_student),s.largest_park_loss_share==null?'미산출':`${num(s.largest_park_loss_share*100)}%`,parkNames.get(s.largest_contribution_park)||'—']))}</details>`;
      }
      function drawDiffusion(){
        const s=diffusion.scenarios.find(s=>s.radius_m===Number(select('radius').value)&&s.probability_per_edge===Number(select('probability').value));
        const means=s.simulation.mean_by_round,max=diffusion.registry_n;
        select('diffusion-result').innerHTML=`<p>연결 ${num(s.undirected_edges,0)}쌍 · 이웃 없는 학교 ${s.isolates}곳 · 최종 누적 평균 <strong>${num(means.at(-1),1)}곳</strong> · 시뮬레이션 5~95백분위 ${s.simulation.final_simulation_interval.map(v=>num(v,1)).join('~')}곳</p><svg class="edu-stat-scatter" viewBox="0 0 760 240" role="img" aria-label="단계별 가상 누적 도달 학교 수"><path d="M60 20V200H720" stroke="#7a8da2" fill="none"/><polyline points="${means.map((v,i)=>`${60+i*105},${200-v/max*175}`).join(' ')}" fill="none" stroke="#187d9c" stroke-width="3"/>${means.map((v,i)=>`<text x="${60+i*105}" y="${190-v/max*175}" text-anchor="middle" font-size="12">${num(v,1)}</text><text x="${60+i*105}" y="225" text-anchor="middle" font-size="12">${i}단계</text>`).join('')}</svg>`;
      }
      ['level','gu','sort'].forEach(k=>select(k).onchange=drawParks);
      ['radius','probability'].forEach(k=>select(k).onchange=drawDiffusion);
      drawParks();drawDiffusion();
      const curriculum=document.createElement('section');curriculum.id='educationCurriculumNetwork';container.appendChild(curriculum);
      await mountCurriculum(curriculum);
      const field=document.createElement('section');field.id='educationFieldVerification';container.appendChild(field);
      await mountField(field);
      const road=document.createElement('section');road.id='educationRoadResilience';container.appendChild(road);
      await mountRoad(road);
    }catch(e){if(container.isConnected)container.innerHTML=`<h2>네트워크 분석 자료 로딩 실패</h2><p>${esc(e.message)} · 통계창을 다시 열어 주세요.</p>`;}
  }
  async function mountCurriculum(container){
    container.innerHTML='<h2>공식 공동교육과정 기회망</h2><p>공식 강좌 목록을 불러오고 있습니다.</p>';
    try{
      const response=await fetch('./data_processed/education/curriculum_network.json');
      if(!response.ok)throw Error(response.status);
      const data=await response.json();if(!container.isConnected)return;
      const labels={official_band_opportunity:'공식 밴드형 수강 기회',same_level_3km:'같은 학교급 직선 3km',combined:'두 연결망 합집합'};
      const schools=data.schools.slice().sort((a,b)=>a.name.localeCompare(b.name,'ko'));
      const names=new Map(schools.map(s=>[s.id,s.name]));
      container.innerHTML=`<h2>공식 공동교육과정 기회망 · 2026년 2학기</h2>
        <p>공식 모집 목록 ${data.summary.courses}강좌 중 일반 고등학교 ${data.summary.matched_providers}곳에 ${data.summary.matched_courses}강좌를 연결했습니다. 밴드형 중심학교→신청가능학교 ${data.summary.band_directed_edges}개 연결 중 ${data.summary.band_edges_over_3km}개는 직선거리 3km를 넘습니다.</p>
        <p class="edu-note">이 영역은 고등학교 129곳 전체를 비교하며 위 학교급·지역 필터와 별개입니다. 공개된 신청 가능 관계이지 실제 수강·교사 교류·혁신 전파 실적이 아닙니다. 거점형·온라인형은 수강생 소속교가 없어 학교 쌍 연결을 만들지 않았습니다.</p>
        <label>세 연결망에 공통 적용할 전파 확률<select data-curriculum="probability">${[.05,.15,.3].map(p=>option(p,`${p*100}% · 가정값`)).join('')}</select></label>
        <div data-curriculum="comparison" aria-live="polite"></div>
        <p class="edu-note">디지털 선도·연구 고등학교 ${data.summary.high_school_seeds}곳을 시작점으로 같은 독립 전파 모형을 적용합니다. 300회·6단계이며 누적 도달 수에 시작점이 포함됩니다. 공식 밴드형은 전체 교류의 일부이므로 이 결과를 실제 확산량이나 어느 연결망의 정확도로 해석하지 않습니다.</p>
        <label>학교별 제공 강좌·신청 기회<select data-curriculum="school">${schools.map(s=>option(s.id,s.name)).join('')}</select></label>
        <div data-curriculum="school-result" aria-live="polite"></div>
        <p class="edu-note">강좌별 모집 정원 합계는 고유 학생 수가 아닙니다. 미등재는 이 모집 목록에 없다는 뜻이며 전체 교육과정이나 교육 기회의 부재를 뜻하지 않습니다. 현재 원장 밖의 인천산업정보학교·인천온라인학교 강좌도 다운로드 원문 목록에 보존했습니다.</p>
        <p><a href="${esc(data.source_url)}" target="_blank" rel="noopener">공식 모집 리플릿 PDF</a> · <a href="./data_processed/education/curriculum_network.json" download>전체 강좌·연결·실행 결과 JSON</a></p>`;
      const el=k=>container.querySelector(`[data-curriculum="${k}"]`);
      el('probability').value='0.15';
      function compare(){
        const scenarios=data.simulations.filter(s=>s.probability_per_edge===Number(el('probability').value));
        el('comparison').innerHTML=table(['연결망','방향 연결 수','6단계 평균 누적 도달','시뮬레이션 5~95백분위'],scenarios.map(s=>[labels[s.network],s.edges,`${num(s.mean_by_round.at(-1))}곳`,s.final_simulation_interval.map(v=>num(v,1)).join('~')+'곳']));
      }
      function showSchool(){
        const school=schools.find(s=>s.id===el('school').value);
        const courses=data.courses.filter(c=>c.school_id===school.id);
        const edges=data.edges.filter(e=>e.provider_id===school.id||e.eligible_school_id===school.id);
        el('school-result').innerHTML=`<h3>${esc(school.name)}</h3><p>2026 디지털 지정 명단: ${school.designated_2026?'등재':'미등재'} · 공고 강좌 ${school.advertised_courses}개 · 교과군 ${school.subject_groups}개 · 강좌별 모집 정원 합 ${school.advertised_seats}석</p>
          ${table(['유형','과목','교과군','대상','모집 정원'],courses.map(c=>[c.kind,c.subject,c.subject_group,c.target_grade,`${c.advertised_seats}석`]))}
          <h4>공식 밴드형 신청 가능 관계 (${edges.length}개)</h4>${table(['중심학교','신청가능학교','해당 강좌 번호','직선거리'],edges.map(e=>[names.get(e.provider_id),names.get(e.eligible_school_id),e.course_numbers.join(', '),`${num(e.straight_distance_m/1000)}km`]))}`;
      }
      el('probability').onchange=compare;el('school').onchange=showSchool;compare();showSchool();
    }catch(error){if(container.isConnected)container.innerHTML=`<h2>공동교육과정 자료 로딩 실패</h2><p>${esc(error.message)}</p>`;}
  }
  async function mountField(container){
    container.innerHTML='<h2>현장 확인 우선순위</h2><p>확인 민감도를 불러오고 있습니다.</p>';
    try{
      const response=await fetch('./data_processed/education/field_verification.json');if(!response.ok)throw Error(response.status);
      const data=await response.json();if(!container.isConnected)return;
      const available=data.parks.filter(p=>p.status==='available'),unknown=data.parks.filter(p=>p.status!=='available');
      container.innerHTML=`<h2>어느 공원부터 현장 확인할까?</h2><p>공원 한 곳을 이용하지 못하는 경우를 가정해, 연결 학교들의 같은 학교급 내 자원 부족 우선순위가 얼마나 올라가는지 계산했습니다. 변화량 합계가 큰 순서이며 학교 품질 순위가 아닙니다.</p>
        <p class="edu-note">공원 출입구·이용 가능 여부를 확인할 때의 판단 민감도입니다. 폐쇄 확률이나 기대 편익을 추정한 값이 아닙니다. 단위는 학교급 내 백분위 순위 변화의 %p이며 동점은 평균 순위입니다. 여러 공원의 결과를 합산해 조사 예산의 효과로 해석하지 않습니다.</p>
        <label>확인 후보 공원<select data-field="park">${available.map(p=>option(p.park_id,`${p.park_name} · 변화량 합 ${num(p.priority_change_sum_pp)}%p`)).join('')}</select></label>
        <div data-field="result" aria-live="polite"></div>
        <details><summary>원자료 확인이 먼저 필요한 공원 (${unknown.length}개)</summary>${table(['공원','연결 기관'],unknown.map(p=>[p.park_name,p.linked_schools]))}</details>
        <p><a href="./data_processed/education/field_verification.json" download>전체 확인 민감도·가정 JSON</a></p>`;
      const select=container.querySelector('[data-field="park"]');
      function draw(){
        const p=available.find(p=>p.park_id===select.value);
        container.querySelector('[data-field="result"]').innerHTML=p?`<p>연결 ${p.linked_schools}곳 · 계산 ${p.analyzed_schools}곳 · 우선순위가 10%p 이상 올라가는 기관 ${p.schools_rising_10pp}곳</p>${table(['기관','학교급','현재 배분 면적','해당 공원 제외 후','부족 우선순위 상승'],p.schools.map(s=>[s.name,s.level,`${num(s.before_supply)}㎡/명`,`${num(s.after_supply)}㎡/명`,`${num(s.shortage_priority_rise_pp)}%p`]))}`:'계산 가능한 공원이 없습니다.';
      }
      select.onchange=draw;draw();
    }catch(error){if(container.isConnected)container.innerHTML=`<h2>현장 확인 자료 로딩 실패</h2><p>${esc(error.message)}</p>`;}
  }
  async function mountRoad(container){
    container.innerHTML='<h2>도로 구간 한 곳이 막히면?</h2><p>대체 경로 계산을 불러오고 있습니다.</p>';
    try{
      const response=await fetch('./data_processed/education/road_resilience.json');if(!response.ok)throw Error(response.status);
      const data=await response.json();if(!container.isConnected)return;
      container.innerHTML=`<h2>도로 구간 한 곳이 막히면?</h2><p>현재 가장 가까운 공원까지의 최단 경로에서 구간을 하나씩 제외한 뒤, 다른 공원을 포함해 500m 안의 대안을 다시 찾았습니다.</p>
        <label>학교급<select data-road="level">${['유치원','초등학교','중학교','고등학교'].map(s=>option(s)).join('')}</select></label><div data-road="result" aria-live="polite"></div>
        <p class="edu-note">학교·공원 대표점을 각각 150m 이내 도로 노드에 연결하는 가정입니다. 연결선의 실제 통행 가능 여부와 공원 출입구는 미확인입니다. OSM의 같은 양끝 노드를 잇는 평행 간선을 함께 제외합니다. 실제 도로 폐쇄 단위·사고 위험을 관측한 결과가 아닙니다. 기초 경로 미확보는 취약성 0이 아니며, 500m 내 대안 미확보는 전체 도로망 단절을 뜻하지 않습니다.</p>
        <p><a href="./data_processed/education/road_resilience.json" download>전체 구간별 중단 결과·근거 JSON</a></p>`;
      const select=container.querySelector('[data-road="level"]');
      function draw(){
        const rows=data.schools.filter(s=>s.level===select.value),valid=rows.filter(s=>s.status==='available');
        valid.sort((a,b)=>b.segments_losing_500m_access-a.segments_losing_500m_access);
        container.querySelector('[data-road="result"]').innerHTML=`<p>대상 ${rows.length}곳 · 기초 경로 500m 이내 ${valid.length}곳 · 특정 구간 중단 시 500m 대안 미확보 ${valid.filter(s=>s.segments_losing_500m_access>0).length}곳 · 기초 경로·연결 조건 미충족 ${rows.length-valid.length}곳</p>
          <details><summary>계산 대상 학교별 구간 결과 (${valid.length}곳)</summary>${table(['기관','기초 거리','검사 구간','500m 대안 미확보 구간','대안이 있는 경우 최대 추가 거리'],valid.map(s=>[s.name,`${num(s.baseline_distance_m)}m`,s.tested_segments,s.segments_losing_500m_access,s.max_extra_distance_m==null?'미산출':`${num(s.max_extra_distance_m)}m`]))}</details>`;
      }
      select.onchange=draw;draw();
    }catch(error){if(container.isConnected)container.innerHTML=`<h2>도로 중단 자료 로딩 실패</h2><p>${esc(error.message)}</p>`;}
  }
  global.EducationNetworks={mount};
})(window);
