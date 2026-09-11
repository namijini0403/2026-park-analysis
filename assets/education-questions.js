/* Question -> validated plan -> computed evidence -> chart. */
(function(global){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v==null?'미산출':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:3});
  const fields={students:'학생·원아 수',student_change:'학생·원아 전년 대비 증감',student_change_pct:'학생·원아 전년 대비 증감률',age_residents:'직선 500m 해당 연령 추정 거주인구',classes:'학급 수',teachers:'수업교원 수',kg_teachers:'일반 교사 수',class_size:'학급당 인원',parks:'도보권 공원 수',green:'추정 공원면적 비율',academy:'직선 500m 학원 수',library:'도보권 도서관 수',nearest_library:'공공·어린이 도서관 직선거리',academy_density:'학원 밀도',shared_park_area:'공유 반영 공원면적',paps:'PAPS 4·5등급 비율',afterschool:'방과후 참여 학생',clubs:'자율동아리 참여 학생'};
  const methods={relationship:'관계·조건 보정',difference:'두 지역의 분포 차이',inequality:'격차·불평등 분포',trend:'학생·원아 수 추세',spatial:'공간적 집중',library:'도서관 접근·추천',academy_clusters:'학원 밀집 구역',network:'지정학교·확산 시나리오',resilience:'도로 구간 중단'};
  const clusters={'high-high':['높은 값의 군집','#b43a3a'],'low-low':['낮은 값의 군집','#205eb2'],'high-low':['높은 값의 공간 이상치','#e18333'],'low-high':['낮은 값의 공간 이상치','#479daf'],not_detected:['미검출','#8b98a3']};
  const levels=['유치원','초등학교','중학교','고등학교'];
  const option=(value,label=value)=>`<option value="${esc(value)}">${esc(label)}</option>`;
  function chartSvg(chart){
    if(!chart)return '';
    const text=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${esc(value)}</text>`;
    let content='',description='분석 결과 그래프';
    if(['scatter','line','lorenz','map'].includes(chart.kind)){
      const map=chart.kind==='map',points=chart.points||[],xs=points.map(p=>map?p.lng:p.x),ys=points.map(p=>map?p.lat:p.y);
      if(!points.length)return '<p>표시할 관측값이 없습니다.</p>';
      const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      let xspan=xmax-xmin||1,yspan=ymax-ymin||1;
      // Preserve approximate local geographic aspect ratio in the coordinate map.
      if(map){const ratio=620/280/Math.cos((ymin+ymax)/2*Math.PI/180);if(xspan/yspan<ratio)xspan=yspan*ratio;else yspan=xspan/ratio;}
      const x0=(xmin+xmax-xspan)/2,y0=(ymin+ymax-yspan)/2;
      const px=v=>70+(v-x0)/xspan*620,py=v=>320-(v-y0)/yspan*280;
      const vals=points.map(p=>p.value).filter(v=>v!=null),vmin=Math.min(...vals),vmax=Math.max(...vals);
      if(chart.kind==='lorenz')content+='<path d="M70 320L690 40" stroke="#93a4af" stroke-dasharray="6 5" fill="none"/>';
      if(['line','lorenz'].includes(chart.kind))content+=`<polyline points="${points.map((p,i)=>`${px(xs[i])},${py(ys[i])}`).join(' ')}" fill="none" stroke="#087b99" stroke-width="3"/>`;
      if(map)for(const p of points){
        const polygons=p.geometry?.type==='Polygon'?[p.geometry.coordinates]:p.geometry?.type==='MultiPolygon'?p.geometry.coordinates:[];
        for(const polygon of polygons)content+=`<path d="${polygon.map(ring=>ring.map(([x,y],i)=>`${i?'L':'M'}${px(x)} ${py(y)}`).join(' ')+'Z').join(' ')}" fill="#288f9f" fill-opacity=".15" stroke="#288f9f" stroke-width="1" fill-rule="evenodd"/>`;
      }
      const valueColor=value=>{const t=(value-vmin)/(vmax-vmin||1);return `rgb(${Math.round(30+175*t)},${Math.round(115-50*t)},${Math.round(180-135*t)})`;};
      content+=points.map((p,i)=>`<circle cx="${px(xs[i])}" cy="${py(ys[i])}" r="${map?5:4}" fill="${map?(p.cluster?clusters[p.cluster][1]:valueColor(p.value)):'#167994'}" fill-opacity=".7"><title>${esc(p.name||p.x)} · ${map?fmt(p.value):`${fmt(p.x)} / ${fmt(p.y)}`}</title></circle>`).join('');
      const xlabel=map?'경도':chart.kind==='lorenz'?'기관 누적 비율':`${chart.x?.[0]||''} (${chart.x?.[1]||''})`;
      const ylabel=map?`${chart.field?.[0]} · ${fmt(vmin)}~${fmt(vmax)} ${chart.field?.[1]||''}`:chart.kind==='lorenz'?'지표 누적 비율':`${chart.y?.[0]||''} (${chart.y?.[1]||''})`;
      content+=text(70,22,ylabel)+text(380,380,xlabel,'text-anchor="middle"')+text(70,342,fmt(x0))+text(690,342,fmt(x0+xspan),'text-anchor="end"')+text(62,320,fmt(y0),'text-anchor="end"')+text(62,44,fmt(y0+yspan),'text-anchor="end"');
      description=map?`공개 좌표를 사용한 공간도. 배경지도와 실제 도로는 표시하지 않습니다. ${points[0].cluster?'빨강: 높은 값의 군집 · 파랑: 낮은 값의 군집 · 주황/청록: 공간 이상치 · 회색: 미검출. 지도 내 BH q≤0.05.':'파랑은 작은 값, 붉은색은 큰 값입니다.'}`:'분석 결과. 아래 표에서 개별 값을 확인할 수 있습니다.';
    }else if(chart.kind==='box'){
      const min=Math.min(...chart.groups.map(g=>g.min)),max=Math.max(...chart.groups.map(g=>g.max)),py=v=>320-(v-min)/(max-min||1)*280;
      chart.groups.forEach((g,i)=>{const x=220+i*320;content+=`<path d="M${x} ${py(g.min)}V${py(g.max)}M${x-30} ${py(g.min)}H${x+30}M${x-30} ${py(g.max)}H${x+30}" stroke="#197b92"/><rect x="${x-60}" y="${py(g.q3)}" width="120" height="${Math.max(1,py(g.q1)-py(g.q3))}" fill="#c2e3ea" stroke="#197b92"/><path d="M${x-60} ${py(g.median)}H${x+60}" stroke="#153f52" stroke-width="3"/>${text(x,350,`${g.name} (n=${g.n})`,'text-anchor="middle"')}`;});
      content+=text(70,22,chart.y?.join(' · '))+text(60,320,fmt(min),'text-anchor="end"')+text(60,44,fmt(max),'text-anchor="end"');
    }else if(chart.kind==='bars'){
      const max=Math.max(...chart.groups.map(g=>g.value),1);
      chart.groups.forEach((g,i)=>{const y=60+i*90;content+=`<rect x="240" y="${y}" width="${g.value/max*400}" height="38" fill="#217c95"/>${text(230,y+25,g.name,'text-anchor="end"')}${text(650,y+25,fmt(g.value))}`;});
    }
    return `<svg class="edu-stat-scatter" data-chart-kind="${esc(chart.kind)}" viewBox="0 0 760 400" role="img" aria-label="${esc(description)}"><rect width="760" height="400" fill="white"/><g font-size="12" fill="#2c4656"><path d="M70 40V320H690" fill="none" stroke="#879ba7"/>${content}</g></svg><p class="edu-note">${esc(description)}</p>`;
  }
  function table(chart){
    const rows=chart?.points?.map(p=>chart.kind==='map'?[p.name,fmt(p.value),fmt(p.lat),fmt(p.lng),p.cluster?clusters[p.cluster][0]:'—',fmt(p.local_q)]:[p.name||p.x,fmt(p.x),fmt(p.y)])||chart?.groups?.map(g=>[g.name,...(chart.kind==='box'?[g.n,g.min,g.q1,g.median,g.q3,g.max]:[g.value])])||[];
    const headings=chart?.kind==='map'?['기관·후보','값','위도','경도','공간 분류','보정 q']:chart?.kind==='box'?['지역','기관 수','최소','25%','중앙','75%','최대']:chart?.kind==='bars'?['항목','개수']:['기관·연도','X','Y'];
    return `<details><summary>계산에 사용한 표시값 (${rows.length}행)</summary><div class="edu-table"><table><thead><tr>${headings.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  function download(result){const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`분석기록_${result.analysis_id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function mount(container,initialLevel='초등학교',initialGu='전체'){
    const districts=['전체','중구','동구','미추홀구','연수구','남동구','부평구','계양구','서구','강화군','옹진군','제물포구','영종구','서해구','검단구'];
    container.innerHTML=`<h2>데이터에 직접 질문하기</h2><p>질문에 맞는 계산 방법을 선택하고, 실제 공개 수치로 답합니다. 분석 조건과 사용 자료를 확인하고 바꿀 수 있습니다.</p>
      <form data-question="form"><label for="education-analysis-question">궁금한 관계나 변화를 적어 주세요</label><textarea id="education-analysis-question" data-question="input" maxlength="500" rows="3" placeholder="예: 중학교 학원 수와 학생 수는 관련 있어?" required></textarea>
      <div class="edu-stat-controls"><label>학교급<select data-question="level">${levels.map(l=>option(l)).join('')}</select></label><label>지역<select data-question="gu">${districts.map(g=>option(g)).join('')}</select></label><label>공시연도<select data-question="year">${[2026,2025].map(y=>option(y)).join('')}</select></label></div>
      <button type="submit" data-question="submit">분석 실행</button></form>
      <details class="edu-question-suggestions"><summary>질문 예시 8가지 보기</summary><div class="edu-question-examples">${['학원 수와 학생 수는 관련 있어?','학생 수 증감 추세를 보여줘','공원 면적의 불평등 분포는?','공원 부족이 공간적으로 몰려 있어?','도서관 추천 후보를 보여줘','학원가 밀집 구역을 보여줘','선도학교 확산 시나리오','길이 막히면 공원에 갈 수 있어?'].map(q=>`<button type="button" data-example="${esc(q)}">${esc(q)}</button>`).join('')}</div></details>
      <p class="edu-note">관측값의 관계를 탐색합니다. 수능·대학별 실적 등 미확보 변수는 대신 추정하지 않습니다. 도서관·학원 밀집·확산·도로 중단 사전 계산은 지역 ‘전체’에서 조회합니다.</p>
      <div data-question="result" aria-live="polite"></div><details><summary>이 브라우저의 최근 분석 기록</summary><div data-question="history"></div></details>`;
    const el=k=>container.querySelector(`[data-question="${k}"]`);el('level').value=levels.includes(initialLevel)?initialLevel:'초등학교';el('gu').value=districts.includes(initialGu)?initialGu:'전체';
    let last=null,request=0,history=[];
    try{history=JSON.parse(localStorage.getItem('education-analysis-history')||'[]');if(!Array.isArray(history))history=[];}catch{}
    function showHistory(){el('history').innerHTML=history.slice(0,10).map((r,i)=>`<p><button type="button" data-history="${i}">${esc(r.question)}</button> · ${esc(r.summary)}</p>`).join('')||'아직 기록이 없습니다.';el('history').querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>{el('input').value=history[Number(b.dataset.history)].question;execute(history[Number(b.dataset.history)].plan);});}
    function render(result){
      last=result;
      const plan=result.plan;
      el('result').innerHTML=`<h3>${esc(result.status==='error'?'질문·조건 확인':methods[result.method]||'분석 결과')}</h3><p class="edu-analysis-answer">${esc(result.summary)}</p>${result.record?`<p class="edu-note">${esc(result.record.planner)} · ${esc(plan.level)} · ${esc(plan.gu||'전체')} · 공시 ${esc(plan.year)}년</p>`:''}${chartSvg(result.chart)}${table(result.chart)}
        ${result.metrics?`<details><summary>계산 수치 확인</summary><pre>${esc(JSON.stringify(result.metrics,null,2))}</pre></details>`:''}
        ${(result.limitations||[]).map(t=>`<p class="edu-note">${esc(t)}</p>`).join('')}
        ${(result.sources||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(' · ')}
        ${result.download?`<p><a href="${esc(result.download)}" download>전체 사전 계산 결과·근거</a></p>`:''}
        ${plan?'<details data-question="edit"><summary>분석 조건 바꾸기</summary><div data-question="plan-controls"></div><button type="button" data-question="rerun">바꾼 조건으로 재분석</button></details><button type="button" data-question="download">질문·조건·결과 기록 내려받기</button>':''}`;
      const academyRows=(result.chart?.points||[]).filter(p=>p.target_categories);
      if(academyRows.length){
        const labels={elementary:'초등',middle:'중등',high:'고등',secondary:'중·고등',integrated:'통합',kindergarten:'유아',mixed:'복합',unknown:'대상 미확인'};
        const detail=document.createElement('details');
        detail.innerHTML='<summary>학원 밀집 구역의 대상·예체능 구성</summary>'+academyRows.map(p=>`<p><strong>${esc(p.name)}</strong><br>${Object.entries(p.target_categories).map(([key,n])=>`${esc(labels[key]||key)} ${n}개`).join(' · ')} · 예체능 ${p.arts_sports}개<br>${(p.example_addresses||[]).map(esc).join('<br>')}</p>`).join('');
        el('result').appendChild(detail);
      }
      if(!plan)return;
      el('level').value=plan.level;el('gu').value=plan.gu||'전체';el('year').value=String(plan.year);
      const select=(key,label,options,value)=>`<label>${label}<select data-plan="${key}">${options.map(([v,l])=>option(v,l)).join('')}</select></label>`;
      let controls='';
      if(['relationship','difference','inequality','spatial','trend'].includes(plan.method)){
        controls+=select('x','분석 변수',Object.entries(fields),plan.x);
        if(plan.method==='relationship')controls+=select('y','두 번째 변수',Object.entries(fields),plan.y)+`<label>보정 변수 (최대 3개·복수 선택)<select multiple data-plan="controls">${Object.entries(fields).map(([k,v])=>option(k,v)).join('')}</select></label>`+`<label><input type="checkbox" data-plan="adjust_gu" ${plan.adjust_gu?'checked':''}> 지역 조건도 보정</label>`;
        if(plan.method==='difference')controls+=['group_a','group_b'].map(k=>select(k,k==='group_a'?'비교 지역 A':'비교 지역 B',districts.slice(1).map(g=>[g,g]),plan[k])).join('');
      }else if(plan.method==='library')controls+=select('radius_m','직선 접근 반경',[500,1000,1500,2000,2500].map(v=>[v,`${v}m`]),plan.radius_m)+select('supply','기존 공급 범위',[['public_children','공공·어린이 도서관'],['including_small','작은도서관 포함']],plan.supply);
      else if(plan.method==='academy_clusters')controls+=select('cluster_radius','연결 반경',[200,300,500].map(v=>[v,`${v}m`]),plan.cluster_radius||300)+select('minimum_facilities','최소 시설 수',[5,10].map(v=>[v,`${v}개`]),plan.minimum_facilities||10);
      else if(plan.method==='network')controls+=select('network_radius','학교 연결 반경',[1000,3000,5000].map(v=>[v,`${v}m`]),plan.network_radius||3000)+select('probability','가정한 전파 확률',[.05,.15,.3].map(v=>[v,`${v*100}%`]),plan.probability||.15);
      el('plan-controls').innerHTML=controls;
      container.querySelectorAll('[data-plan]').forEach(s=>{if(s.type==='checkbox')return;const k=s.dataset.plan;if(k==='controls'){[...s.options].forEach(o=>o.selected=(plan.controls||[]).includes(o.value));return;}const value=plan[k]??({cluster_radius:300,minimum_facilities:10,network_radius:3000,probability:.15}[k]);if(value!=null)s.value=String(value);});
      el('rerun').onclick=()=>{const next={...last.plan,level:el('level').value,gu:el('gu').value,year:Number(el('year').value)};container.querySelectorAll('[data-plan]').forEach(s=>{const k=s.dataset.plan;if(k==='controls')next.controls=[...s.selectedOptions].map(o=>o.value);else next[k]=s.type==='checkbox'?s.checked:s.value;});execute(next);};
      el('download').onclick=()=>download(last);
    }
    async function execute(plan){
      const question=el('input').value.trim();if(!question)return;
      const id=++request;el('submit').disabled=true;el('result').textContent='질문과 데이터 구조를 확인하고 계산하고 있습니다.';
      try{
        const response=await fetch('./api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,options:{level:el('level').value,gu:el('gu').value,year:Number(el('year').value)},...(plan?{plan}:{})})});
        const result=await response.json();if(id!==request||!container.isConnected)return;render(result);
        el('result').scrollIntoView?.({block:'start',behavior:'auto'});
        if(result.status==='ok'){history=[{question,plan:result.plan,summary:result.summary},...history].slice(0,10);try{localStorage.setItem('education-analysis-history',JSON.stringify(history));}catch{}showHistory();}
      }catch(error){if(id===request&&container.isConnected)el('result').textContent='분석 서버에 연결하지 못했습니다. 잠시 후 다시 실행해 주세요.';}
      finally{if(id===request&&container.isConnected)el('submit').disabled=false;}
    }
    el('form').onsubmit=event=>{event.preventDefault();execute();};
    container.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{el('input').value=b.dataset.example;el('input').focus();});
    showHistory();
  }
  global.EducationQuestions={mount,chartSvg};
})(window);
