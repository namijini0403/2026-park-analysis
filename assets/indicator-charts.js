'use strict';
// 지표 시각화 SVG. 순수 함수로 문자열만 만든다 (DOM을 만지지 않는다).
// 규칙: 백분위는 값이 큰 쪽 기준 고정이며 방향으로 뒤집지 않는다. 미확보는 0이 아니라 값 없음으로 그린다.
(function(global){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=Number.isFinite;
const ARROW={up:'↑',down:'↓',neutral:'·'};
const num=v=>finite(v)?(Math.round(v*10)/10).toLocaleString('ko-KR'):'';

// 가로 백분위 막대. 채움 길이 = 백분위. 구 백분위가 있을 때만 눈금을 그린다.
function percentileBar(o){
 const W=260,H=44,PAD=1,TRACK_Y=26,TRACK_H=10;
 const p=finite(o.percentile)?Math.max(0,Math.min(100,o.percentile)):0;
 const fill=PAD+(W-PAD*2)*p/100;
 const head=esc(num(o.value)+(o.unit?' '+o.unit:''));
 const foot=finite(o.n)&&finite(o.rank)?esc(o.n+'개교 중 '+o.rank+'위'):'';
 let mark='';
 if(finite(o.guPercentile)){
  const gx=PAD+(W-PAD*2)*Math.max(0,Math.min(100,o.guPercentile))/100;
  mark=`<line class="gu-mark" x1="${gx.toFixed(1)}" y1="${TRACK_Y-4}" x2="${gx.toFixed(1)}" y2="${TRACK_Y+TRACK_H+4}"></line>`
   +`<title>${esc(o.guName||'구')} 평균 백분위 ${esc(num(o.guPercentile))}%</title>`;
 }
 return `<svg class="pct-bar" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${head} · 백분위 ${esc(num(o.percentile))}퍼센트">`
  +`<text class="pct-value" x="0" y="12">${head}</text>`
  +`<text class="pct-meta" x="${W}" y="12" text-anchor="end">백분위 (값이 큰 쪽) ${esc(num(o.percentile))}%</text>`
  +`<rect class="track" x="${PAD}" y="${TRACK_Y}" width="${W-PAD*2}" height="${TRACK_H}" rx="5"></rect>`
  +(finite(o.percentile)?`<rect class="fill" x="${PAD}" y="${TRACK_Y}" width="${Math.max(0,fill-PAD).toFixed(1)}" height="${TRACK_H}" rx="5"></rect>`:'')
  +mark
  +(foot?`<text class="pct-meta" x="0" y="${H-2}">${foot}</text>`:'')
  +`</svg>`;
}

// 분포 히스토그램. 선택 학교가 속한 구간에 selected 표시.
function histogram(o){
 const bins=Array.isArray(o.bins)?o.bins:[];
 if(!bins.length)return '';
 const W=320,H=90,BASE=70,gap=2;
 const max=Math.max(...bins.map(b=>b.count))||1;
 const bw=(W-gap*(bins.length-1))/bins.length;
 const sel=finite(o.selectedValue)?bins.findIndex((b,i)=>o.selectedValue>=b.from&&(i===bins.length-1?o.selectedValue<=b.to:o.selectedValue<b.to)):-1;
 const bars=bins.map((b,i)=>{
  const h=Math.max(1,(BASE-6)*b.count/max),x=i*(bw+gap);
  return `<rect class="bar${i===sel?' selected':''}" x="${x.toFixed(1)}" y="${(BASE-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}">`
   +`<title>${esc(num(b.from))}~${esc(num(b.to))}${esc(o.unit||'')} · ${b.count}개교</title></rect>`;
 }).join('');
 return `<svg class="histogram" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="값 분포">`
  +bars
  +`<line class="axis" x1="0" y1="${BASE}" x2="${W}" y2="${BASE}"></line>`
  +`<text class="axis-label" x="0" y="${H-4}">${esc(num(bins[0].from))}${esc(o.unit||'')}</text>`
  +`<text class="axis-label" x="${W}" y="${H-4}" text-anchor="end">${esc(num(bins[bins.length-1].to))}${esc(o.unit||'')}</text>`
  +`</svg>`;
}

// 레이더. 축 = 영역 대표 지표 1개씩이며 영역을 합산하지 않는다.
// 값이 없는 축은 0으로 찍지 않고 점선 축으로만 남긴다 (없음과 0을 구분한다).
function radar(o){
 const axes=Array.isArray(o.axes)?o.axes:[],basis=o.basis==='gu'?'gu':'overall';
 const S=300,C=S/2,R=104;
 const valueOf=a=>basis==='gu'?a.percentile_gu:a.percentile_overall;
 const open=`<svg class="radar" viewBox="0 0 ${S} ${S}" width="100%" height="${S}" role="img" aria-label="영역 대표 지표 상대 위치">`;
 if(!axes.length||!axes.some(a=>finite(valueOf(a))))
  return open+`<text class="radar-empty" x="${C}" y="${C}" text-anchor="middle">표시할 값이 없습니다.</text></svg>`;
 const n=axes.length;
 const pt=(i,r)=>{const t=-Math.PI/2+i*2*Math.PI/n;return [C+r*Math.cos(t),C+r*Math.sin(t)];};
 let rings='';
 for(const f of [0.25,0.5,0.75,1]){
  const d=axes.map((_,i)=>{const [x,y]=pt(i,R*f);return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ');
  rings+=`<polygon class="ring" points="${d}"></polygon>`;
 }
 let spokes='',labels='';
 axes.forEach((a,i)=>{
  const v=valueOf(a),has=finite(v);
  const [ex,ey]=pt(i,R);
  spokes+=`<line class="spoke${has?'':' broken'}" x1="${C}" y1="${C}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"${has?'':' stroke-dasharray="3 3"'}></line>`;
  const [lx,ly]=pt(i,R+22);
  const anchor=lx>C+4?'start':lx<C-4?'end':'middle';
  labels+=`<text class="axis-name" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${esc(a.domain_label||'')} ${ARROW[a.direction]||'·'}</text>`
   +`<text class="axis-sub" x="${lx.toFixed(1)}" y="${(ly+12).toFixed(1)}" text-anchor="${anchor}">${has?esc(a.label||'')+' '+esc(num(v))+'%':'미확보'}</text>`;
 });
 const filled=axes.map((a,i)=>({a,i,v:valueOf(a)})).filter(x=>finite(x.v));
 const poly=filled.map(x=>{const [px,py]=pt(x.i,R*Math.max(0,Math.min(100,x.v))/100);return `${px.toFixed(1)},${py.toFixed(1)}`;}).join(' ');
 const shape=filled.length>=3?`<polygon class="area" points="${poly}"></polygon>`
  :filled.length===2?`<polyline class="area-line" points="${poly}"></polyline>`:'';
 const dots=filled.map(x=>{const [px,py]=pt(x.i,R*Math.max(0,Math.min(100,x.v))/100);
  return `<circle class="dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3"><title>${esc(x.a.domain_label)} · ${esc(x.a.label)} ${esc(num(x.v))}%</title></circle>`;}).join('');
 return open+rings+spokes+shape+dots+labels+`</svg>`;
}

global.IndicatorCharts={percentileBar,histogram,radar,escapeText:esc,ARROW};
})(typeof window!=='undefined'?window:globalThis);
