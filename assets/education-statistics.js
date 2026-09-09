/* Exploratory, within-school-level correlations. No missing-value imputation. */
(function(global){
  const finite=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&typeof v!=='boolean'&&Number.isFinite(Number(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v==null?'산출 불가':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:3});
  function ranks(values){
    const sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v), out=[];
    for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].v===sorted[i].v)j++;for(let k=i;k<j;k++)out[sorted[k].i]=(i+j+1)/2;i=j;}
    return out;
  }
  function pearson(x,y){
    const n=x.length;if(n<3)return null;
    const mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
    let xx=0,yy=0,xy=0;
    for(let i=0;i<n;i++){const a=x[i]-mx,b=y[i]-my;xx+=a*a;yy+=b*b;xy+=a*b;}
    return xx>0&&yy>0?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
  }
  function analyze(rows,x,y){
    const pairs=rows.filter(r=>finite(r.values[x])&&finite(r.values[y]));
    const xs=pairs.map(r=>Number(r.values[x])),ys=pairs.map(r=>Number(r.values[y]));
    return {pairs,n:pairs.length,excluded:rows.length-pairs.length,pearson:pearson(xs,ys),spearman:pearson(ranks(xs),ranks(ys))};
  }
  const fields=[
    ['students','학생·원아 수','명','공시'],['classes','학급 수','개','공시'],
    ['teachers','수업교원 수','명','공시','school'],['staff','직위별 교원 총계','명','공시','school'],
    ['kg_teachers','일반 교사 수','명','공시','kg'],['class_size','학급당 학생·원아','명','공시'],
    ['parks','도보권 공원 수','개','환경'],['green','추정 공원면적 비율','%','환경'],
    ['academy','직선 500m 학원','개','환경'],['library','도보권 도서관','개','환경'],
    ['apartment','직선 500m 대단지','개','환경'],['redevelopment','직선 500m 재개발','개','환경'],
    ['paps','PAPS 4·5등급 비율','%','공시','school'],['afterschool','방과후 참여 학생','명','공시','school'],
    ['clubs','자율동아리 참여 학생','명','공시','school']
  ];
  let dataPromise;
  async function mount(container,schools,initialLevel,initialGu){
    container.innerHTML='<h2>변수 조합 상관분석</h2><p>공시 통계자료를 불러오고 있습니다.</p>';
    try{
      if(!dataPromise)dataPromise=fetch('./data_processed/education/school_statistics.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).catch(e=>{dataPromise=null;throw e;});
      const data=await dataPromise;if(!container.isConnected)return;
      const levels=['초등학교','유치원','중학교','고등학교'];
      const districts=[...new Set(schools.map(s=>s.gu).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
      const option=(value,text=value)=>`<option value="${esc(value)}">${esc(text)}</option>`;
      container.innerHTML=`<h2>변수 조합 상관분석</h2><p>학교 한 곳을 관측 단위로 삼아 두 변수의 관계를 탐색합니다. 행렬의 숫자를 누르면 해당 조합으로 전환됩니다.</p>
        <div class="edu-stat-controls"><label>학교급<select data-filter="level">${levels.map(l=>option(l)).join('')}</select></label><label>지역<select data-filter="gu">${['전체',...districts].map(g=>option(g)).join('')}</select></label><label>공시연도<select data-filter="year">${data.years.slice().reverse().map(y=>option(y,`${y}년`)).join('')}</select></label><label>행렬 계수<select data-filter="method">${option('pearson','Pearson · 선형 관계')}${option('spearman','Spearman · 순위 관계')}</select></label></div>
        <p class="edu-note">학교급을 섞어 계산하지 않습니다. 환경 변수는 현재 앱에 탑재된 분석 스냅샷이며 공시연도를 바꿔도 고정됩니다. 공시연도와 실제 조사·활동연도는 다를 수 있어 동일 시점 자료라고 단정할 수 없습니다. 초등과 확장 학교급은 공원 산출 기준이 다릅니다.</p>
        <div class="edu-stat-controls"><label>X 변수<select data-filter="x"></select></label><label>Y 변수<select data-filter="y"></select></label></div>
        <div class="edu-stat-result" aria-live="polite"></div><div class="edu-stat-matrix"></div>
        <p class="edu-note">두 변수 모두 확보된 학교만 계산합니다. 결측은 0으로 대체하지 않으며 조합마다 표본 수가 다릅니다. 3곳 미만 또는 변동이 없는 변수는 산출 불가입니다. 상관관계는 인과관계나 정책 효과가 아닙니다. 학교 규모·지역 특성, 중첩된 500m 생활권, 결측 선택편향이 관계에 영향을 줄 수 있습니다. 학생 수·학급 수·학급당 인원처럼 계산상 연결된 변수의 상관은 독립된 발견이 아닙니다. 많은 조합을 탐색하는 화면이며 통계적 유의성 판정을 하지 않습니다. PAPS는 공개 평가행 기준 비율이고 전교생 비율이나 학력 점수가 아닙니다.</p>`;
      const select=k=>container.querySelector(`[data-filter="${k}"]`);
      select('level').value=levels.includes(initialLevel)?initialLevel:'초등학교';
      select('gu').value=districts.includes(initialGu)?initialGu:'전체';
      function draw(reset=false){
        const level=select('level').value,year=select('year').value,gu=select('gu').value;
        const available=fields.filter(f=>!f[4]||(f[4]==='kg')===(level==='유치원'));
        for(const key of ['x','y']){
          const old=select(key).value;select(key).innerHTML=available.map(f=>option(f[0],`${f[1]} (${f[2]} · ${f[3]})`)).join('');
          select(key).value=!reset&&available.some(f=>f[0]===old)?old:key==='x'?'academy':'students';
        }
        const rows=schools.filter(s=>s.level===level&&(gu==='전체'||s.gu===gu)).map(s=>({...s,values:{...(data.schools[s.id]?.[year]||{}),...s.environment}}));
        const x=select('x').value,y=select('y').value,method=select('method').value;
        const a=analyze(rows,x,y),xf=available.find(f=>f[0]===x),yf=available.find(f=>f[0]===y);
        const cells=a.pairs.map(r=>`<tr><td>${esc(r.name)}</td><td>${fmt(r.values[x])}</td><td>${fmt(r.values[y])}</td></tr>`).join('');
        const paths=[...new Map(a.pairs.flatMap(r=>(r.values.sources||[]).map(s=>[s.url,s.url]))).values()];
        container.querySelector('.edu-stat-result').innerHTML=`<h3>${esc(level)} · ${esc(gu)} · 공시 ${esc(year)}년</h3><div class="edu-metrics"><div>분석 대상 / 전체<strong>${a.n} / ${rows.length}</strong></div><div>결측 제외<strong>${a.excluded}</strong></div><div>Pearson r<strong>${fmt(a.pearson)}</strong></div><div>Spearman ρ<strong>${fmt(a.spearman)}</strong></div></div>${x===y?'<p>같은 변수를 선택했습니다. 자기상관은 새로운 관계를 뜻하지 않습니다.</p>':''}${a.pearson==null?'<p>3곳 미만이거나 변수 값이 일정하여 상관계수를 계산할 수 없습니다.</p>':''}${scatter(a.pairs,x,y,xf,yf)}<details><summary>분석 대상 학교와 사용값 (${a.n}곳)</summary><div class="edu-table"><table><thead><tr><th>학교·유치원</th><th>${esc(xf[1])}</th><th>${esc(yf[1])}</th></tr></thead><tbody>${cells}</tbody></table></div></details><p class="edu-note">${paths.map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener">공식 공시 출처</a>`).join(' · ')} · 환경 원자료·산출 정의는 학교별 보고서를 참고하세요.</p>`;
        container.querySelector('.edu-stat-matrix').innerHTML=`<h3>전체 조합 행렬 · ${method==='pearson'?'Pearson r':'Spearman ρ'}</h3><div class="edu-table"><table><thead><tr><th>변수</th>${available.map(f=>`<th>${esc(f[1])}</th>`).join('')}</tr></thead><tbody>${available.map(f=>`<tr><th>${esc(f[1])}</th>${available.map(g=>{const pair=analyze(rows,f[0],g[0]),v=pair[method];return `<td><button type="button" data-x="${f[0]}" data-y="${g[0]}" title="${esc(f[1]+' × '+g[1])}" style="background:${v==null?'#eef2f6':v>=0?`rgba(30,130,170,${.08+Math.abs(v)*.35})`:`rgba(218,128,45,${.08+Math.abs(v)*.35})`}">${v==null?'—':v.toFixed(2)}<small>n=${pair.n}</small></button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
        container.querySelectorAll('[data-x]').forEach(button=>button.onclick=()=>{select('x').value=button.dataset.x;select('y').value=button.dataset.y;draw();container.querySelector('.edu-stat-result').scrollIntoView?.({block:'nearest'});});
      }
      container.querySelectorAll('select').forEach(el=>el.onchange=()=>draw(el.dataset.filter==='level'));
      draw();
    }catch(error){if(container.isConnected)container.innerHTML=`<h2>상관분석 자료 로딩 실패</h2><p>${esc(error.message)} · 통계창을 다시 열어 주세요.</p>`;}
  }
  function scatter(rows,x,y,xf,yf){
    if(!rows.length)return '<p>두 변수가 함께 확보된 학교가 없습니다.</p>';
    const xs=rows.map(r=>Number(r.values[x])),ys=rows.map(r=>Number(r.values[y]));
    const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    const px=v=>70+(v-xmin)/(xmax-xmin||1)*620,py=v=>325-(v-ymin)/(ymax-ymin||1)*285;
    return `<svg class="edu-stat-scatter" viewBox="0 0 760 400" role="img" aria-label="${esc(xf[1]+'와 '+yf[1]+' 산점도. 각 점은 학교 한 곳이며 상세 값은 아래 표에서 확인할 수 있습니다.')}"><rect width="760" height="400" fill="white"/><path d="M70 40V325H690" fill="none" stroke="#7a8da2"/>${rows.map(r=>`<circle cx="${px(Number(r.values[x]))}" cy="${py(Number(r.values[y]))}" r="4" fill="#187d9c" fill-opacity=".6"><title>${esc(r.name)} · ${esc(xf[1])} ${fmt(r.values[x])}${esc(xf[2])} · ${esc(yf[1])} ${fmt(r.values[y])}${esc(yf[2])}</title></circle>`).join('')}<g font-size="12" fill="#31465e"><text x="70" y="345">${fmt(xmin)}</text><text x="690" y="345" text-anchor="end">${fmt(xmax)}</text><text x="60" y="325" text-anchor="end">${fmt(ymin)}</text><text x="60" y="44" text-anchor="end">${fmt(ymax)}</text><text x="380" y="380" text-anchor="middle">${esc(xf[1])} (${esc(xf[2])})</text><text x="70" y="20">${esc(yf[1])} (${esc(yf[2])})</text></g></svg>`;
  }
  const api={mount,analyze,ranks,pearson};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else global.EducationStatistics=api;
})(typeof window==='undefined'?globalThis:window);
