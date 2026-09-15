/* Observed data only. Missing values are never coerced to zero. */
window.StatisticalCharts=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const finite=Number.isFinite, fmt=v=>finite(v)?v.toLocaleString('ko-KR',{maximumSignificantDigits:8}):'자료 없음';
 const label=v=>Array.isArray(v)?v.join(' · '):String(v||'');
 function extent(values,zero=false){let lo=Math.min(...values),hi=Math.max(...values);if(zero){lo=Math.min(0,lo);hi=Math.max(0,hi);}if(lo===hi){const pad=Math.abs(lo)*.1||1;lo-=pad;hi+=pad;}return [lo,hi];}
 const scale=(domain,a,b)=>v=>a+(v-domain[0])/(domain[1]-domain[0])*(b-a);
 const ticks=d=>Array.from({length:5},(_,i)=>d[0]+(d[1]-d[0])*i/4);
 const empty=()=>'<p class="statistical-chart statistical-chart-empty">표시할 관측값이 없습니다. 자료 없음은 0이 아닙니다.</p>';
 function wrap(c,body,height,caption,kind){return `<figure class="statistical-chart statistical-chart-${kind}"><div class="statistical-chart-scroll" tabindex="0" role="region" aria-label="${esc(c.title||'관측 자료')} 그래프"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${height}" role="img" aria-label="${esc(c.title||'관측 자료')}"><title>${esc(c.title||'관측 자료')}</title>${body}</svg></div><figcaption>${caption}</figcaption></figure>`;}
 function dotPlot(c){
  const pts=c.points||[],valid=pts.filter(p=>finite(p.value));if(!valid.length)return empty();
  const d=extent(valid.map(p=>p.value),true),X=scale(d,240,615),height=94+pts.length*44,unit=c.unit??'',missing=pts.length-valid.length,hasForecast=/예측/.test(c.title||'')||pts.some(p=>p.forecast===true||/예측/.test(p.name||'')),valueLabel=hasForecast?'표시값':'관측값';
  let body=ticks(d).map(v=>`<path class="sc-grid" d="M${X(v)} 30V${height-49}"/><text class="sc-tick" x="${X(v)}" y="${height-28}" text-anchor="middle">${esc(fmt(v))}</text>`).join('');
  body+=`<text class="sc-axis" x="615" y="18" text-anchor="end">${valueLabel}${unit?' ('+esc(unit)+')':''}</text>`;
  body+=pts.map((p,i)=>{const y=54+i*44,name=String(p.name||'이름 미확인'),long=[...name].length>15,lines=long?[[...name].slice(0,15).join(''),[...name].slice(15,29).join('')+([...name].length>29?'…':'')]:[name];
   return `<g><title>${esc(name)}: ${esc(fmt(p.value))}${finite(p.value)?esc(unit):''}</title><text class="sc-name" x="12" y="${y-(long?7:0)}">${lines.map((s,j)=>`<tspan x="12" dy="${j?17:0}">${esc(s)}</tspan>`).join('')}</text>${finite(p.value)?`<path class="sc-row" d="M240 ${y-4}H615"/><circle class="${p.selected?'sc-selected':'sc-dot'}" cx="${X(p.value)}" cy="${y-4}" r="${p.selected?7:5}"/><text class="sc-value" x="705" y="${y}" text-anchor="end">${esc(fmt(p.value))}${esc(unit)}</text>`:`<text class="sc-missing" x="435" y="${y}" text-anchor="middle">자료 없음</text>`}</g>`;
  }).join('');
  return wrap(c,body,height,`${hasForecast?'표시':'관측'} ${valid.length.toLocaleString('ko-KR')}개${missing?' · 자료 없음 '+missing+'개':''} · 점의 위치는 ${valueLabel}입니다.${hasForecast?' 예측값이 포함되어 있으며 실제 관측과 다를 수 있습니다.':''} 학교 종합점수나 지원 순위가 아닙니다.${pts.some(p=>p.selected)?' 테두리가 있는 주황색 점은 선택 항목입니다.':''}`,'dot');
 }
 function xy(c,isLine){
  const pts=c.points||[],valid=pts.filter(p=>finite(p.x)&&finite(p.y));if(!valid.length)return empty();
  const xd=extent(valid.map(p=>p.x)),yd=extent(valid.map(p=>p.y)),X=scale(xd,90,675),Y=scale(yd,300,48);
  let body=ticks(yd).map(v=>`<path class="sc-grid" d="M90 ${Y(v)}H675"/><text class="sc-tick" x="80" y="${Y(v)+4}" text-anchor="end">${esc(fmt(v))}</text>`).join('');
  body+=ticks(xd).map(v=>`<path class="sc-grid" d="M${X(v)} 48V300"/><text class="sc-tick" x="${X(v)}" y="325" text-anchor="middle">${esc(fmt(v))}</text>`).join('');
  body+=`<text class="sc-axis" x="90" y="22">${esc(label(c.y)||'Y 관측값')}</text><text class="sc-axis" x="385" y="355" text-anchor="middle">${esc(label(c.x)||'X 관측값')}</text>`;
  const forecast=p=>p.name==='예측'||p.forecast===true;
  if(isLine)body+=pts.slice(1).map((p,i)=>{const prev=pts[i];if(!finite(p.x)||!finite(p.y)||!finite(prev.x)||!finite(prev.y))return '';return `<path class="sc-line${forecast(p)||forecast(prev)?' sc-forecast':''}" d="M${X(prev.x)} ${Y(prev.y)}L${X(p.x)} ${Y(p.y)}"/>`;}).join('');
  body+=valid.slice().sort((a,b)=>Number(!!a.selected)-Number(!!b.selected)).map(p=>`<circle class="${p.selected?'sc-selected':forecast(p)?'sc-predicted':'sc-dot'}" cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.selected?7:isLine?4:3.5}"${!isLine&&!p.selected?' opacity=".65"':''}><title>${esc(p.name||'관측')}: ${esc(label(c.x)||'X')} ${esc(fmt(p.x))}, ${esc(label(c.y)||'Y')} ${esc(fmt(p.y))}</title></circle>`).join('');
  const missing=pts.length-valid.length,hasForecast=valid.some(forecast);
  return wrap(c,body,375,`${isLine||hasForecast?'표시':'실측점'} ${valid.length.toLocaleString('ko-KR')}개${missing?' · 좌표 또는 값 없음 '+missing+'개 (제외)':''} · ${isLine?(hasForecast?'실선은 관측, 주황색 점과 점선은 예측입니다.':'실선은 관측값의 변화를 연결합니다.'):'각 점은 한 항목입니다. 겹친 점이 있을 수 있으며 인과관계를 뜻하지 않습니다.'}${!isLine&&hasForecast?' 예측값이 포함되어 있으며 실제 관측과 다를 수 있습니다.':''}${valid.some(p=>p.selected)?' 테두리가 있는 주황색 점은 선택 항목입니다.':''}${isLine&&missing?' 결측 구간은 연결하지 않습니다.':''} 정확한 값은 점에 마우스를 올리거나 표에서 확인하세요.` ,isLine?'line':'scatter');
 }
 return {dotPlot,scatter:c=>xy(c,false),line:c=>xy(c,true)};
})();
