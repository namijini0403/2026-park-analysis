/* Multi-level analysis and public disclosures. All source text is escaped. */
window.EducationLayers = (() => {
  const root = './data_processed/education/';
  let allSchools = [], disclosures = {}, labels = {}, routes = null, regionalDemography = {}, regionalForecasts = {}, regionalForecastValidation = {}, scienceAwards = {}, candidateAgeDemand = {}, academies = [], reportRequest = 0;
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, suffix = '') => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '미확보' : Number(v).toLocaleString('ko-KR', {maximumFractionDigits:1}) + suffix;
  const categories = {elementary:'초등',middle:'중등',high:'고등',secondary:'중·고등',integrated:'통합(초등 포함)',kindergarten:'유아',mixed:'복합 대상',unknown:'대상 미확인'};
  async function json(name) { const r = await fetch(root + name); if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); }
  async function init() {
    const [schools, walks, academyData, academyContext] = await Promise.all([json('school_analysis.json'), json('walkshed_500m.geojson'), json('academies_map.json'),json('academy_school_context.json')]);
    academies = academyData;
    state.datasets.academies = academies;
    state.datasets.schools = state.datasets.schools.map(r => ({...r, 학교급구분:'초등학교',context:{academy:academyContext[getSchoolId(r)]}}));
    allSchools = [...state.datasets.schools, ...schools];
    state.datasets.educationAllSchools = allSchools;
    state.datasets.educationBaseIsochrone = state.datasets.isochrone;
    state.datasets.educationNewIsochrone = walks;
    const select = document.getElementById('schoolLevelFilter');
    select.disabled = false;
    select.addEventListener('change', () => {
      state.datasets.schools = allSchools.filter(r => select.value === 'all' || r.학교급구분 === select.value);
      const ids = new Set(state.datasets.schools.map(getSchoolId));
      state.datasets.isochrone = {type:'FeatureCollection', features:[...state.datasets.educationBaseIsochrone.features, ...walks.features].filter(f => ids.has(f.properties.학교ID))};
      clearDetailPanelSelection(); populateSchoolSearchOptions(); rerenderAll(); renderGuSummary();
      appendStatus(`학교급 ${select.options[select.selectedIndex].text}: ${state.datasets.schools.length}개 기관`);
    });
    document.getElementById('educationReportButton').addEventListener('click', () => {
      const row = allSchools.find(r => getSchoolId(r) === state.selectedSchoolId) || findSchoolBySearch(ui.schoolSearchInput?.value);
      if (row) openReport(row); else { ui.schoolSearchInput?.focus(); appendStatus('공개자료를 볼 학교를 검색하거나 지도에서 선택하세요.'); }
    });
    appendStatus(`새 학교급 ${schools.length}개 기관 · 학원 ${academies.length}개 시설`);
    renderAcademies();
  }
  function summary(row) {
    if (!row.analysis_version) return null;
    return `<div class="hc-name">${e(row.학교명)} · ${e(row.학교급구분)}</div><div class="hc-grid"><div>도보권 공원 ${num(row.iso_park_count,'개')}</div><div>추정 공원면적 비율 ${num(row.iso_green_ratio,'%')}</div><div>학생 ${num(row.current_students,'명')}</div><div>학원 ${num(row.context?.academy?.straight_500m_count,'개')}</div></div><div class="hc-foot">클릭하여 공통 분석·공개자료 보기</div>`;
  }
  function renderAcademies() {
    if ((state.overlays.academyMarkers || []).length || !isLayerOnById('academy')) return;
    clearOverlayGroup('academyMarkers');
    state.overlays.academyMarkers = [];
    const visible = isLayerOnById('academy');
    for (const a of academies) {
      if (a.lat == null || a.lng == null) continue;
      const marker = new kakao.maps.Marker({position:new kakao.maps.LatLng(a.lat,a.lng),image:createMarkerImage('#0891B2'),title:a.name});
      kakao.maps.event.addListener(marker, 'click', () => {
        state.infoWindow.setContent(`<div style="padding:12px;max-width:290px;color:#172033"><b>${e(a.name)}</b><p>${e(a.facility_type)} · ${e(categories[a.target_category])}${a.arts_sports?' · 예체능':''}</p><p>${e(a.address)}</p><small>${e(a.course_evidence.slice(0,4).join(' / '))}</small><p>기준 ${e(a.reference_date)} · 주소 기반 좌표</p><a href="${e(a.source_url)}" target="_blank" rel="noopener">공식 원자료</a></div>`);
        state.infoWindow.open(state.map,marker);
      });
      marker.setMap(visible ? state.map : null); state.overlays.academyMarkers.push(marker);
    }
  }
  function ensureModal() {
    let dialog = document.getElementById('educationReportDialog');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'educationReportDialog';
      dialog.innerHTML = '<button class="edu-close" aria-label="리포트 닫기">닫기 ×</button><div class="edu-body"></div>';
      document.body.appendChild(dialog); dialog.querySelector('button').onclick = () => dialog.close();
    }
    return dialog;
  }
  function table(headers, rows) {
    return `<div class="edu-table"><table><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderReport(row, body) {
    const c = row.context || {}, enrollment = row.enrollment || {}, route = routes?.[getSchoolId(row)];
    const actual = !!row.analysis_version;
    const population = regionalDemography[`${row.gu}|${row.학교급구분 || '초등학교'}`];
    const regionalForecast = regionalForecasts[`${row.gu}|${row.학교급구분 || '초등학교'}`];
    const regionalValidation = (regionalForecastValidation.summary||[]).filter(r=>r.school_level===(row.학교급구분||'초등학교'));
    const scienceResults = scienceAwards.schools?.[getSchoolId(row)] || [];
    const history = enrollment.history || row.studentTrend || [];
    const sourceRows = disclosures?.[getSchoolId(row)] || [];
    const groups = new Map();
    for (const r of sourceRows) { const key = `${r.title} · ${r.year}년`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }
    const matchedAcademies = c.academy?.facility_ids ? academies.filter(a=>c.academy.facility_ids.includes(a.facility_id)) : [];
    body.innerHTML = `<p class="edu-kicker">학교 생활권 · 공개자료 기반 정책 지원</p><h1>${e(row.학교명)}</h1><p>${e(row.학교급구분 || '초등학교')} · ${e(row.gu)} · ${e(row.소재지도로명주소 || '')}</p><button type="button" id="edu-ai-explain">이 학교의 분석 근거 설명</button>
      ${actual ? `<div class="edu-metrics"><div>도보권 공원<strong>${num(row.iso_park_count,'개')}</strong></div><div>추정 공원면적 비율<strong>${num(row.iso_green_ratio,'%')}</strong></div><div>학생·원아<strong>${num(row.current_students,'명')}</strong></div><div>직선 500m 학원<strong>${num(c.academy?.straight_500m_count,'개')}</strong></div></div>
      <h2>현재 격차</h2><p>${e(row.case_label || '좌표·보행망 자료 미확보')} · I-EEI와 같은 1%·5% 경계값을 사용한 검토용 분류입니다. 학교급별 정책 적합성은 담당자가 판단합니다.</p><p>공원 ${e((row.accessible_park_names || []).join(', ') || '관측 없음')}.</p>
      ${table(['주변 환경','직선 500m','도보 도달권'],Object.entries(c).map(([k,v])=>[({library:'도서관',playground:'놀이터',large_apartment:'대단지',redevelopment:'재개발',nightlife:'유흥 인허가',construction:'건축행정 기록',academy:'학원·교습소'})[k],num(v.straight_500m_count,'개'),num(v.walkshed_count,'개')]))}
      <p class="edu-note">관측된 좌표 보유 시설만 집계합니다. 도달권 내 지점 포함은 출입 가능성 확인과 다르며, 건축행정 기록은 현재 공사 여부를 뜻하지 않습니다.</p>
      <h2>접근 마찰</h2><p>${route?.status==='available' ? `${e(route.park_name)} 대표점까지 보행망 경로 ${num(route.route_distance_m,'m')} · 직선 대비 ${num(route.detour_ratio,'배')}. ${e(route.destination_basis)}.` : '유효한 대표점 보행 경로 미확보.'}</p><p>학교 중심과 보행망 연결거리 ${num(row.walk_origin_offset_m,'m')}. 횡단보도·출입구·통행허용은 현장 확인 대상입니다.</p>
      <h2>학교 내부 독서 공급</h2><p>1인당 장서 ${num(row.reading_gap?.books_per_student,'권')} · 동일 학교급 관측 중앙값 ${num(row.reading_gap?.same_level_median,'권')}. 도보권 도서관 ${num(c.library?.walkshed_count,'개')}.</p><p class="edu-note">학교도서관 공시가 없는 유치원은 내부 공급 미확보입니다. 중앙값은 적정 기준이 아닌 동일 학교급 내 비교 기준입니다. 정확한 공시연도·좌석·운영예산은 아래 학교도서관 공시에서 확인합니다.</p>
      <h2>현재·미래 수요</h2>${table(['연도','학생·원아 수'],history.map(h=>[h.year,num(h.students,'명')]))}
      <p>${e(enrollment.model_status === 'insufficient_history' ? '3개년 미만 이력: 장기 예측 미산출' : enrollment.model_status === 'weighted_trend_lightgbm' ? '가중 추세 + 학교급별 LightGBM 잔차 보정' : '가중 추세 모형')}</p>
      ${enrollment.forecast?.length ? table(['예측연도','지원 신호'],enrollment.forecast.map(h=>[h.year,num(h.students,'명')])) : ''}
      <p class="edu-note">학교급별 시간순 검증을 사용합니다. 초등학교의 검증 성능을 다른 학교급의 성능으로 인용하지 않으며, 장기 예측은 확정 수요가 아닙니다.</p>
      <h2>유사학교 비교</h2><p>${e(row.knn_basis || '비교에 필요한 학생수·추세 자료 미확보')}</p>${table(['학교','공원','추정 비율'],(row.similar_schools || []).map(s=>[s.school_name,num(s.park_count,'개'),num(s.green_ratio,'%')]))}
      <h2>250m 후보지 검토</h2><p>기존 후보지 중 1.5km 내 학교 인접 후보입니다. 학교 인접성과 주변 공원 부족(최근접 공원 직선거리)을 함께 비교합니다. 거리 가중치를 바꾸어 검토 순서를 조정할 수 있습니다.</p><p>2024년 ${e(row.학교급구분)} 해당 연령대(유치원 3~5세·초등 6~11세·중등 12~14세·고등 15~17세)의 추정 거주인구를 후보지 내부와 주변 직선 500m로 나누어 표시합니다. 1km 연령 인구를 100m 총인구 비중으로 배분한 값이며 실제 이용자·신규 수혜 인원·미래 예측이 아닙니다. 미확보는 0명이 아니며 후보지 간 인원을 합산하지 않습니다.</p><label>거리 가중치 <input id="edu-distance-weight" type="range" min="0" max="100" value="70"> <output id="edu-weight-value">70%</output></label><label>수요 시나리오 연도 <select id="edu-demand-year">${[2026,2027,2028,2029,2030,2031].map(y=>`<option value="${y}" ${y===2028?'selected':''}>${y}년</option>`).join('')}</select></label><p class="edu-note">시나리오는 선택 학교의 ${e(row.gu)} 해당 연령 성장률(예측연도 ÷ 2024년 관측)을 후보지 주변 추정 인구에 적용합니다. 후보지 행정구역·미래 공간 분포를 확인한 예측이 아니며 지역 경계·개발·이동 변화는 별도 검토해야 합니다. 2029~2031년은 4~6년 선행으로 별도 성능 검증이 없습니다.</p><div id="edu-candidates"></div>
      <h2>정책 검토</h2><p>기존 정책 규칙을 학교급별 공원·독서 여건에 적용한 조건부 검토안입니다. 담당자가 조건을 바꿔 확인합니다.</p><div class="edu-policy-controls"><label>예산 <select id="edu-budget"><option value="sufficient">충분</option><option value="moderate">보통</option><option value="constrained">제약</option></select></label> <label>부지 <select id="edu-site"><option value="available">확보 가능</option><option value="unavailable">확보 불가</option></select></label> <label>접근 개선 <select id="edu-access"><option value="feasible">가능</option><option value="infeasible">불가</option></select></label> <label><input id="edu-barrier" type="checkbox">보행 장벽이 있다고 가정</label></div><p id="edu-policy-action"></p><p class="edu-note">보행 장벽 기본값은 미확인 상태의 시나리오 가정입니다. 실제 장벽 없음이라는 판정이 아닙니다.</p>
      <details><summary>학원 분류·근거 (${matchedAcademies.length}개 관측)</summary>${table(['시설','대상','예체능'],matchedAcademies.map(a=>[a.name,categories[a.target_category],a.arts_sports?'해당':'미확인/비해당']))}<p>초급·중급·고급을 학교급으로 해석하지 않습니다. 학원은 유료 민간 환경요소이며 공공 활동공간을 대체하지 않습니다.</p></details>
      <details><summary>지정·지원사업 (${(row.designations||[]).length}건)</summary>${table(['사업','연도'],(row.designations||[]).map(d=>[d.program_name,d.school_year]))}</details>
      <details><summary>분석 범위와 한계</summary>${(row.limitations||[]).map(l=>`<p>${e(l)}</p>`).join('')}<p>기관 원자료 기준 ${e(row.데이터기준일자)} · ${e(row.id_method)}</p></details>` : `<p>초등학교의 기존 정밀 분석은 지도 ‘학교 진단’에서 확인할 수 있습니다. 아래는 새로 연결한 공개 공시입니다.</p>`}
      ${!actual ? `<h2>주변 학원·교습소</h2><p>직선 500m ${num(c.academy?.straight_500m_count,'개')} · 도보 도달권 ${num(c.academy?.walkshed_count,'개')}. 좌표 확보분의 관측 건수입니다.</p>${table(['시설','대상','예체능'],matchedAcademies.map(a=>[a.name,categories[a.target_category],a.arts_sports?'해당':'미확인/비해당']))}` : ''}
      <h2>지역 연령대 수요</h2>${population ? `<p>${e(population.region_name)} · ${e(population.age_band.join('~'))}세. ${e(population.scope)}</p>${table(['관측연도(12월)','주민등록 인구'],population.history.map(h=>[h.year,num(h.residents,'명')]))}<h3>무이동 코호트 시나리오</h3><p>${e(population.scenario_assumption)}</p>${table(['시나리오 연도','해당 연령으로 진입하는 인구'],population.cohort_scenario.map(h=>[h.year,num(h.residents,'명')]))}<p class="edu-note">${e(population.boundary_note)} 250m 후보지 수혜 인원으로 해석하지 않습니다.</p><a href="${e(population.source_url)}" target="_blank" rel="noopener">주민등록 인구통계</a>` : '<p>해당 행정구역·학교급 연결 자료 미확보. 인접 구의 수치를 대신 표시하지 않습니다.</p>'}
      <h3>지역 미래 수요 지원 예측</h3>${regionalForecast ? `<p>${e(({persistence:'최근 관측값 유지',trend:'최근 3개년 추세',prophet:'Prophet',prophet_xgb:'Prophet + XGBoost 잔차 보정'})[regionalForecast.selected_model.family])} · ${e(regionalForecast.scope)}</p>${table(['예측연도','해당 연령 거주인구'],regionalForecast.forecast.map(r=>[r.year,num(r.residents,'명')]))}<p>${e(regionalForecast.selected_model.selection_rule)}</p>${table(['별도 검증 선행기간','검증 건수','선택모형 평균 절대오차','최근값 유지 평균 절대오차'],regionalValidation.map(r=>[`${r.horizon}년`,r.n,num(r.selected_mae,'명'),num(r.persistence_mae,'명')]))}<p class="edu-note">검증 목표연도는 2023~2025년이며 모형 선택에 사용하지 않았습니다. 평균 절대오차는 해당 학교급의 구·군 합동 검증값으로, 이 학교나 후보지의 오차가 아닙니다. ${e(regionalForecast.limitations)}</p>` : '<p>해당 지역·학교급의 검증 가능한 예측 자료 미확보.</p>'}
      <h2>대외 성과 관측</h2><p>${e(row.award_coverage || '수집한 공식 자료에서 확인한 결과만 표시합니다. 자료 없음은 수상 없음이 아닙니다.')}</p>${(row.awards || []).map(a=>`<p>${e(a.year)} · ${e(a.event)} · ${e(a.category)} · <b>${e(a.result)}</b> <a href="${e(a.source_url)}" target="_blank" rel="noopener">교육청 근거</a></p>`).join('') || '<p>학교별 확인 기록 미확보</p>'}
      <h3>국립중앙과학관 공식 출품작 결과</h3><p>${e(scienceAwards.coverage)}</p>${scienceResults.map(a=>`<p>${e(a.year)} · ${e(a.event)} · ${e(a.category)} · <b>${e(a.result)}</b><br>${e(a.work_title)}<br>${e(a.participant_scope)} · <a href="${e(a.source_url)}" target="_blank" rel="noopener">학교명 근거</a> · <a href="${e(a.result_source_url)}" target="_blank" rel="noopener">수상 등급 근거</a><br>${e(a.result_basis)}</p>`).join('') || '<p>정확히 연결한 수상작 기록 미확보. 동명 학교는 지역 근거가 없으면 연결하지 않습니다.</p>'}<p class="edu-note">위 보도자료와 동일 작품이 포함될 수 있어 기록 수를 합산하지 않습니다. 공동 작품은 학교별 관측이며 학교 실력의 종합 점수가 아닙니다.</p>
      <h2>학교별 공개 공시 (${sourceRows.length}개 기록)</h2><p>장학금·체력·활동·교육여건 등 서로 다른 성격의 자료입니다. 수능 성적이나 학력 순위로 합산하지 않습니다. 공시 제외·비공개·결측 표시를 원문대로 보존합니다.</p>
      ${[...groups].map(([title,rows])=>`<details><summary>${e(title)} · ${rows.length}개 기록</summary><a href="${e(rows[0].source_url)}" target="_blank" rel="noopener">학교알리미 공개용 데이터</a>${rows.map(r=>table(['공시 필드','값'],Object.entries(r.values).map(([k,v])=>[`${labels[r.item]?.[k] || k} (${k})`,v == null ? '미공개/결측' : typeof v === 'object' ? JSON.stringify(v) : String(v)]))).join('')}</details>`).join('')}
      <p class="edu-note">수능 학교별 점수·대외수상 전수 실적은 확보되지 않았습니다. 교과별 학업성취 상세는 보안문자 입력 요구로 자동 수집하지 않았습니다. 자료 없음은 성과 없음이 아닙니다.</p>`;
    body.querySelector('#edu-ai-explain').onclick=()=>{
      if(typeof setSchoolPanelSelection==='function') setSchoolPanelSelection(row);
      body.closest('dialog').close();
      if(typeof askAiExplainer==='function') askAiExplainer('이 학교의 현재 공원 환경 격차와 분석 한계를 설명해줘.','school_explanation');
    };
    if (actual) {
      const slider = body.querySelector('#edu-distance-weight');
      const redraw = () => {
        const weight = Number(slider.value)/100;
        body.querySelector('#edu-weight-value').textContent = `${slider.value}%`;
        const ranked = (row.candidates||[]).map(c=>({...c,score:weight*(1-Math.min(1,c.straight_distance_m/1500))+(1-weight)*Math.min(1,(c.nearest_park_straight_m ?? 0)/1000)})).sort((a,b)=>b.score-a.score || a.straight_distance_m-b.straight_distance_m);
        const year=Number(body.querySelector('#edu-demand-year').value);
        const base=population?.history.find(h=>h.year===candidateAgeDemand.base_year)?.residents;
        const future=regionalForecast?.forecast.find(h=>h.year===year)?.residents;
        const factor=base>0 && future!=null ? future/base : null;
        body.querySelector('#edu-candidates').innerHTML = table(['격자','학교 직선거리','공원 직선거리','후보지 내부 추정 인구','주변 500m 추정 인구',`${year}년 지역비례 시나리오`],ranked.map(c=>{const d=candidateAgeDemand.candidates?.[c.grid_id];const current=d?.straight_500m?.levels?.[row.학교급구분]?.estimated_residents;return [c.grid_id,num(c.straight_distance_m,'m'),num(c.nearest_park_straight_m,'m'),num(d?.footprint?.levels?.[row.학교급구분]?.estimated_residents,'명'),num(current,'명'),num(current!=null && factor!=null ? current*factor : null,'명')];}));
      };
      slider.oninput = redraw; body.querySelector('#edu-demand-year').onchange=redraw; redraw();
      const policy = () => {
        const names = {external_supply_new:'외부 활동공간 신규 공급 검토',internal_investment:'학교 내부 자원 투자 검토',institution_link:'외부 기관 연계 검토',mobile_service:'이동형·순회 서비스 검토',access_route_improvement:'접근경로 개선 검토',shared_hub:'권역 공동활용·거점화 검토',maintain_monitor:'유지·모니터링'};
        const key = ['budget','site','access'].map(k=>body.querySelector(`#edu-${k}`).value).join('|');
        const action = row.policy_scenarios?.[String(body.querySelector('#edu-barrier').checked)]?.[key];
        body.querySelector('#edu-policy-action').textContent = names[action] || '정책 규칙 적용에 필요한 데이터 미확보';
      };
      for (const el of body.querySelectorAll('.edu-policy-controls select,.edu-policy-controls input')) el.onchange = policy;
      policy();
    }
  }
  async function openReport(row) {
    const request = ++reportRequest;
    const dialog = ensureModal(), body = dialog.querySelector('.edu-body');
    body.textContent = '학교별 공개자료를 불러오고 있습니다.';
    if (!dialog.open) dialog.showModal();
    try {
      const sid = getSchoolId(row);
      if (!routes) [labels, routes, regionalDemography, scienceAwards, candidateAgeDemand, regionalForecasts, regionalForecastValidation] = await Promise.all([json('disclosure_labels.json'),json('school_routes.json'),json('regional_demography.json'),json('science_awards.json'),json('candidate_age_demand.json'),json('regional_age_forecasts.json'),json('regional_age_forecast_validation.json')]);
      if (!disclosures[sid]) disclosures[sid] = await json(`disclosures/${encodeURIComponent(sid)}.json`);
      if (request === reportRequest) renderReport(row,body);
    } catch (err) { if (request === reportRequest) body.textContent = `공개자료 로딩 실패: ${err.message}`; }
  }
  function openStatistics() {
    const dialog=ensureModal(), body=dialog.querySelector('.edu-body');
    ++reportRequest;
    const rows=state.datasets.schools.filter(r=>state.selectedGu==='전체' || r.gu===state.selectedGu);
    const groups=['유치원','초등학교','중학교','고등학교'].map(level=>{
      const group=rows.filter(r=>(r.학교급구분||'초등학교')===level);
      const measured=group.filter(r=>r.iso_green_ratio!=null && r.iso_green_ratio!=='' && Number.isFinite(Number(r.iso_green_ratio)));
      const avg=measured.length ? measured.reduce((n,r)=>n+Number(r.iso_green_ratio),0)/measured.length : null;
      return [level,group.length,measured.length,num(avg,'%'),group.filter(r=>r.analysis_version ? r.enrollment?.forecast?.length : false).length];
    }).filter(r=>r[1]);
    body.innerHTML=`<p class="edu-kicker">선택 학교급·지역의 실제 관측값</p><h1>학교급별 분석 현황</h1>${table(['학교급','기관','환경 분석','평균 추정 공원면적 비율','새 수요모형 산출'],groups)}<p>초등학교의 기존 검토·보정값과 확장 학교급의 v3 도달권·공원 대체경계 추정값은 산출 기준이 다릅니다. 학교급별로 나누어 해석합니다.</p><h2>공원 환경 분포</h2>${table(['학교급','공원 관측 0개','1% 미만','1~5% 미만','5% 이상'],groups.map(g=>{const r=rows.filter(s=>(s.학교급구분||'초등학교')===g[0]);return [g[0],r.filter(s=>Number(s.iso_park_count)===0).length,r.filter(s=>Number(s.iso_park_count)>0&&Number(s.iso_green_ratio)<1).length,r.filter(s=>Number(s.iso_park_count)>0&&Number(s.iso_green_ratio)>=1&&Number(s.iso_green_ratio)<5).length,r.filter(s=>Number(s.iso_park_count)>0&&Number(s.iso_green_ratio)>=5).length];}))}<p>학원·교습소 원자료 ${num(academies.length,'개')} 시설 중 ${num(academies.filter(a=>a.lat!=null).length,'개')} 좌표 확보. 원자료 기준 2026-08-01.</p>`;
    if (!dialog.open) dialog.showModal();
  }
  return {init,summary,renderAcademies,openReport,openStatistics};
})();
