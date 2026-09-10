/* Deterministic statistics on server-owned observations. No generated code execution. */
const math = require('../assets/education-statistics.js');
const fields = {
  students:['학생·원아 수','명'], classes:['학급 수','개'], teachers:['수업교원 수','명'], kg_teachers:['일반 교사 수','명'],
  student_change:['학생·원아 전년 대비 증감','명'], student_change_pct:['학생·원아 전년 대비 증감률','%'], age_residents:['직선 500m 해당 연령 추정 거주인구','명'],
  class_size:['학급당 학생·원아','명'], parks:['도보권 공원 수','개'], green:['추정 공원면적 비율','%'],
  academy:['직선 500m 학원·교습소','개'], library:['도보권 도서관','개'],
  nearest_library:['가장 가까운 공공·어린이 도서관 직선거리','m'], academy_density:['직선 500m 학원 밀도','개/㎢'],
  shared_park_area:['공유 반영 공원면적','㎡/명'], paps:['PAPS 4·5등급 비율','%'],
  afterschool:['방과후 참여 학생','명'], clubs:['자율동아리 참여 학생','명']
};
const levels=['유치원','초등학교','중학교','고등학교'];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fmt=v=>v==null?'미산출':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:3});
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function quantile(a,p){const b=a.slice().sort((a,b)=>a-b);if(!b.length)return null;const x=(b.length-1)*p,i=Math.floor(x);return b[i]+(b[Math.min(i+1,b.length-1)]-b[i])*(x-i);}
function random(seed=20260910){let s=seed>>>0;return ()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
function shuffle(a,rng){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function fdr(p){const sorted=p.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=[];let ceiling=1;for(let j=sorted.length-1;j>=0;j--){ceiling=Math.min(ceiling,sorted[j].v*sorted.length/(j+1));out[sorted[j].i]=ceiling;}return out;}
function residuals(values,columns){
  const average=mean(values),centered=values.map(v=>v-average),basis=[];
  for(const column of columns){
    const columnMean=mean(column);let v=column.map(x=>x-columnMean);
    for(const q of basis){const dot=v.reduce((s,x,i)=>s+x*q[i],0);v=v.map((x,i)=>x-dot*q[i]);}
    const norm=Math.sqrt(v.reduce((s,x)=>s+x*x,0));
    if(norm>1e-9)basis.push(v.map(x=>x/norm));
  }
  let result=centered;
  for(const q of basis){const dot=result.reduce((s,x,i)=>s+x*q[i],0);result=result.map((x,i)=>x-dot*q[i]);}
  return {values:result,rank:basis.length};
}
function distance(a,b){
  const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;
  return 12742000*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2));
}
function validatePlan(plan,dataset){
  if(!levels.includes(plan.level))throw Error('학교급 하나를 선택해 주세요. 서로 다른 학교급을 섞지 않습니다.');
  if(!['relationship','difference','inequality','trend','spatial'].includes(plan.method))throw Error('지원하지 않는 계산 방법입니다.');
  if(!dataset.years.includes(Number(plan.year)))throw Error('선택한 공시연도 자료가 없습니다.');
  for(const key of [plan.x,...(plan.y?[plan.y]:[]),...(plan.controls||[])])if(!Object.hasOwn(fields,key))throw Error('확인되지 않은 분석 변수입니다.');
  if(plan.method==='relationship'&&(!plan.y||plan.x===plan.y))throw Error('서로 다른 변수 두 개를 선택해 주세요.');
  if((plan.controls||[]).some(k=>k===plan.x||k===plan.y))throw Error('분석 변수 자신을 보정 변수로 사용할 수 없습니다.');
  if((plan.controls||[]).length>3)throw Error('보정 변수는 최대 세 개입니다.');
  if(plan.method==='trend'&&plan.x!=='students')throw Error('여러 해의 추세 분석은 학생·원아 수 이력에 지원합니다.');
}
function analyze(dataset,plan){
  validatePlan(plan,dataset);
  const selected=dataset.schools.filter(s=>s.level===plan.level&&(!plan.gu||plan.gu==='전체'||s.gu===plan.gu)&&(!plan.school_id||s.id===plan.school_id));
  const rows=selected.map(s=>{
    const history=s.enrollment_trend.observations,current=history.find(r=>r.year===Number(plan.year))?.students,previous=history.find(r=>r.year===Number(plan.year)-1)?.students;
    const change=finite(current)&&finite(previous)?current-previous:null;
    return {...s,values:{...(s.observations[String(plan.year)]||{}),...s.environment,student_change:change,student_change_pct:change!=null&&previous>0?change/previous*100:null}};
  });
  const result={status:'ok',plan,method:plan.method,n_total:rows.length,source_hashes:dataset.source_hashes,
    limitations:['학교급·지역·공시연도를 고정한 탐색입니다. 환경 변수는 현재 스냅샷이므로 공시연도와 같은 시점이라고 단정하지 않습니다.',
      '관측 관계는 인과효과나 학교 품질 순위가 아닙니다. 결측·생활권 중복·미관측 지역 특성과 많은 질문 탐색의 영향을 받습니다.'],metrics:{}};
  if([plan.x,plan.y,...(plan.controls||[])].includes('age_residents'))result.limitations.push('거주 연령 수요는 2024년 1km 연령 인구를 100m 총인구 비중으로 배분하고 인천 경계 안 격자 중심점으로 집계한 추정입니다. 실제 재학생·시설 이용자와 다르며 기존 면적 교차 방식과 수치가 다를 수 있습니다.');
  const insufficient=message=>({...result,status:'insufficient',summary:message,chart:null});
  if(plan.method==='relationship'){
    const controls=plan.controls||[],keys=[plan.x,plan.y,...controls];
    const valid=rows.filter(r=>keys.every(k=>finite(r.values[k])));
    if(valid.length<Math.max(8,controls.length+5))return insufficient('함께 확보된 표본이 부족합니다. 지역 범위를 넓히거나 보정 변수를 줄여 주세요.');
    const xs=valid.map(r=>r.values[plan.x]),ys=valid.map(r=>r.values[plan.y]);
    const raw=math.pearson(math.ranks(xs),math.ranks(ys));
    let rho=raw,columns=controls.map(k=>math.ranks(valid.map(r=>r.values[k]))),effectiveControls=0;
    if(plan.adjust_gu){const districts=[...new Set(valid.map(r=>r.gu))].filter(Boolean);columns.push(...districts.slice(1).map(g=>valid.map(r=>r.gu===g?1:0)));}
    if(columns.length){const rx=residuals(math.ranks(xs),columns),ry=residuals(math.ranks(ys),columns);effectiveControls=rx.rank;if(valid.length<effectiveControls+8)return insufficient('지역과 보정 변수 수에 비해 표본이 부족합니다.');rho=rx.values.reduce((s,v)=>s+v*v,0)<1e-12||ry.values.reduce((s,v)=>s+v*v,0)<1e-12?null:math.pearson(rx.values,ry.values);}
    if(rho==null)return insufficient('변수의 값이 일정하거나 보정 뒤 변동이 남지 않아 관계를 계산할 수 없습니다.');
    result.metrics={n:valid.length,excluded:rows.length-valid.length,spearman:raw,partial_spearman:columns.length?rho:null,effective_controls:effectiveControls,pearson:math.pearson(xs,ys)};
    result.summary=`${fields[plan.x][0]}와 ${fields[plan.y][0]}를 함께 확보한 ${valid.length}곳에서 ${columns.length?'조건을 보정한 순위상관':'순위상관'}은 ${fmt(rho)}입니다. 값이 ${rho>=0?'같은':'반대'} 방향으로 움직이는 정도를 나타내며, 원인이나 정책 효과를 뜻하지 않습니다.`;
    result.chart={kind:'scatter',x:fields[plan.x],y:fields[plan.y],points:valid.map(r=>({id:r.id,name:r.name,x:r.values[plan.x],y:r.values[plan.y]}))};
    if(columns.length)result.limitations.push('산점도는 원래 관측값입니다. 부분 순위상관은 순위값에서 보정 변수·지역 더미의 선형 성분을 제거한 잔차 상관입니다. 보정되지 않은 교란은 남습니다.');
    if(['students','classes','class_size'].includes(plan.x)&&['students','classes','class_size'].includes(plan.y))result.limitations.push('학생 수·학급 수·학급당 인원은 계산상 연결되어 있어 독립적인 발견으로 해석하지 않습니다.');
  }else if(plan.method==='difference'){
    if(!plan.group_a||!plan.group_b||plan.group_a===plan.group_b)return insufficient('비교할 서로 다른 지역 두 곳을 선택해 주세요.');
    const a=rows.filter(r=>r.gu===plan.group_a&&finite(r.values[plan.x])),b=rows.filter(r=>r.gu===plan.group_b&&finite(r.values[plan.x]));
    if(a.length<5||b.length<5)return insufficient('각 비교 지역에 공개값을 확보한 기관이 최소 5곳 필요합니다.');
    const av=a.map(r=>r.values[plan.x]),bv=b.map(r=>r.values[plan.x]);let wins=0;
    for(const x of av)for(const y of bv)wins+=Math.sign(x-y);
    const delta=wins/(av.length*bv.length);
    result.metrics={n_a:a.length,n_b:b.length,median_a:quantile(av,.5),median_b:quantile(bv,.5),cliffs_delta:delta};
    result.summary=`${plan.group_a}와 ${plan.group_b}의 ${fields[plan.x][0]} 분포를 비교했습니다. Cliff의 δ=${fmt(delta)}이며, 무작위로 한 기관씩 골랐을 때 앞 지역 값이 클 가능성과 작을 가능성의 차이입니다. 0에 가까울수록 방향의 우세가 작습니다.`;
    result.chart={kind:'box',x:['지역',''],y:fields[plan.x],groups:[[plan.group_a,av],[plan.group_b,bv]].map(([name,v])=>({name,n:v.length,min:Math.min(...v),q1:quantile(v,.25),median:quantile(v,.5),q3:quantile(v,.75),max:Math.max(...v)}))};
    result.limitations.push('집단 차이는 학교 규모·선택 편향을 보정하지 않았습니다. 상자 양끝은 최솟값과 최댓값이며 통계적 유의성 판정을 하지 않습니다.');
  }else if(plan.method==='inequality'){
    const valid=rows.filter(r=>finite(r.values[plan.x])),v=valid.map(r=>r.values[plan.x]).sort((a,b)=>a-b);
    if(v.length>=5&&v[0]<0){
      result.metrics={n:v.length,excluded:rows.length-v.length,gini:null,p10:quantile(v,.1),median:quantile(v,.5),p90:quantile(v,.9)};
      result.summary=`${fields[plan.x][0]}에는 음수가 있어 지니계수 대신 분위수 분포를 비교합니다. 하위 10% 지점은 ${fmt(result.metrics.p10)}, 중앙값은 ${fmt(result.metrics.median)}, 상위 10% 지점은 ${fmt(result.metrics.p90)}${fields[plan.x][1]}입니다.`;
      result.chart={kind:'box',y:fields[plan.x],groups:[{name:plan.level,n:v.length,min:v[0],q1:quantile(v,.25),median:quantile(v,.5),q3:quantile(v,.75),max:v.at(-1)}]};
      return result;
    }
    const total=v.reduce((s,x)=>s+x,0);if(v.length<5||total<=0)return insufficient('음수가 없는 관측값 5곳 이상과 양의 합계가 필요합니다.');
    const gini=2*v.reduce((s,x,i)=>s+(i+1)*x,0)/(v.length*total)-(v.length+1)/v.length;
    let sum=0;const points=[{x:0,y:0},...v.map((x,i)=>({x:(i+1)/v.length,y:(sum+=x)/total}))];
    result.metrics={n:v.length,excluded:rows.length-v.length,gini,p10:quantile(v,.1),median:quantile(v,.5),p90:quantile(v,.9)};
    result.summary=`${fields[plan.x][0]}의 기관 간 지니계수는 ${fmt(gini)}입니다. 0이면 모든 기관의 값이 같고, 값이 커질수록 일부 기관에 수치가 집중됩니다. 하위 10% 지점은 ${fmt(result.metrics.p10)}${fields[plan.x][1]}입니다.`;
    result.chart={kind:'lorenz',points};result.limitations.push('기관을 동일 가중치로 비교합니다. 학생별 불평등·주민별 불평등이 아니며 비율·거리 지표의 지니계수는 복지 수준을 직접 뜻하지 않습니다.');
  }else if(plan.method==='trend'){
    const scope=plan.school_id?selected.filter(s=>s.id===plan.school_id):selected;
    if(!scope.length)return insufficient('선택 범위에서 기관을 찾지 못했습니다.');
    const byYear=new Map();for(const s of scope)for(const r of s.enrollment_trend.observations)byYear.set(r.year,(byYear.get(r.year)||0)+1);
    const years=[...byYear.keys()].sort((a,b)=>a-b);
    if(years.length<2)return insufficient('비교할 두 해 이상의 실제 학생·원아 관측이 없습니다.');
    const cohort=scope.filter(s=>years.every(year=>s.enrollment_trend.observations.some(r=>r.year===year)));
    if(!cohort.length)return insufficient('전체 관측 기간을 공통으로 확보한 기관이 없습니다. 기관을 선택해 개별 이력을 확인해 주세요.');
    const points=years.map(year=>({x:year,y:cohort.reduce((sum,s)=>sum+s.enrollment_trend.observations.find(r=>r.year===year).students,0)}));
    const slopes=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)slopes.push((points[j].y-points[i].y)/(points[j].x-points[i].x));
    result.metrics={cohort:cohort.length,excluded:scope.length-cohort.length,years,sen_slope:quantile(slopes,.5),change:points.at(-1).y-points[0].y};
    result.summary=`${years[0]}~${years.at(-1)}년을 모두 관측한 동일 기관 ${cohort.length}곳의 학생·원아 수를 비교했습니다. 연도 쌍별 기울기 중앙값은 연 ${fmt(result.metrics.sen_slope)}명입니다.`;
    result.chart={kind:'line',x:['관측연도','년'],y:['동일 기관 학생·원아 합계','명'],points};
    result.limitations.push('모든 해를 공통 관측한 기관만 사용해 신설·폐원·결측 기관이 제외될 수 있습니다. 합계 추세는 주변 거주 연령 인구나 미래 예측이 아닙니다.');
  }else if(plan.method==='spatial'){
    const valid=rows.filter(r=>finite(r.values[plan.x])&&finite(r.lat)&&finite(r.lng));
    const links=valid.map((r,i)=>valid.map((other,j)=>({j,d:i===j?Infinity:distance(r,other)})).filter(p=>p.d<=3000).sort((a,b)=>a.d-b.d).slice(0,8).map(p=>p.j));
    const used=valid.map((_,i)=>i).filter(i=>links[i].length),index=new Map(used.map((i,j)=>[i,j]));
    const weights=used.map(i=>links[i].filter(j=>index.has(j)).map(j=>index.get(j))),values=used.map(i=>valid[i].values[plan.x]);
    if(values.length<10)return insufficient('3km 안의 이웃이 있는 유효 기관이 최소 10곳 필요합니다.');
    function moran(v){const m=mean(v),z=v.map(x=>x-m),den=z.reduce((s,x)=>s+x*x,0);if(!den)return null;return z.reduce((s,x,i)=>s+x*mean(weights[i].map(j=>z[j])),0)/den;}
    const observed=moran(values);if(observed==null)return insufficient('값이 일정해 공간적 집중을 계산할 수 없습니다.');
    const rng=random(),expected=-1/(values.length-1);let extreme=0;
    for(let i=0;i<499;i++)if(Math.abs(moran(shuffle(values,rng))-expected)>=Math.abs(observed-expected))extreme++;
    result.metrics={n:values.length,excluded:rows.length-values.length,moran_i:observed,permutation_p:(extreme+1)/500,permutations:499,seed:20260910};
    const m=mean(values),scale=Math.sqrt(mean(values.map(v=>(v-m)**2))),z=values.map(v=>(v-m)/scale),local=[];
    for(let i=0;i<z.length;i++){
      const lag=mean(weights[i].map(j=>z[j])),value=z[i]*lag,expectation=-z[i]*z[i]/(z.length-1);let count=0;
      for(let trial=0;trial<499;trial++){
        const sample=new Set();while(sample.size<weights[i].length){const j=Math.floor(rng()*z.length);if(j!==i)sample.add(j);}
        const simulated=z[i]*mean([...sample].map(j=>z[j]));if(Math.abs(simulated-expectation)>=Math.abs(value-expectation))count++;
      }
      local.push({local_i:value,p:(count+1)/500,quadrant:`${z[i]>=0?'high':'low'}-${lag>=0?'high':'low'}`});
    }
    const adjusted=fdr(local.map(r=>r.p));
    result.summary=`3km 내 최대 8개 이웃을 비교한 전역 Moran의 I=${fmt(observed)}입니다. 양수는 비슷한 값이 이웃하는 경향, 음수는 다른 값이 이웃하는 경향을 나타냅니다. 탐색적 순열 p=${fmt(result.metrics.permutation_p)}입니다.`;
    result.chart={kind:'map',field:fields[plan.x],points:used.map((i,j)=>({id:valid[i].id,name:valid[i].name,lat:valid[i].lat,lng:valid[i].lng,value:valid[i].values[plan.x],local_i:local[j].local_i,local_p:local[j].p,local_q:adjusted[j],cluster:adjusted[j]<=.05?local[j].quadrant:'not_detected'}))};
    result.metrics.local_cluster_counts=Object.fromEntries(['high-high','low-low','high-low','low-high','not_detected'].map(label=>[label,result.chart.points.filter(p=>p.cluster===label).length]));
    result.summary+=' 공간도는 국소 Moran의 조건부 순열과 지도 내 BH 보정을 거쳐 분류합니다.';
    result.limitations.push('거리 가중치는 행별 합이 1인 최근접 이웃 방식입니다. 3km 이웃이 없는 기관은 제외합니다. 국소 검정은 자신의 값을 고정하고 499회 이웃을 다시 뽑으며 지도 내 BH q≤0.05일 때만 군집 유형을 표시합니다. 지형 장벽·도로 동선·여러 질문 간 다중검정은 미반영입니다. 표시되지 않은 기관도 격차가 없다는 뜻은 아닙니다.');
  }
  return result;
}
module.exports={fields,levels,analyze,validatePlan,quantile,residuals,distance,fdr,clusterMath:math};
