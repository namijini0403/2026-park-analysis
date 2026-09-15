'use strict';
// 영역 1개의 전체 분포. 학교급 안에서 육지 통계를 기본으로 하고 도서지역(강화·옹진)은 따로 센다.
// 미확보는 분포·평균에서 제외하고 사유별로 센다.
const table=require('./_school_table'),stats=require('./_indicator_stats'),profileModel=require('./_school_profile');
const finite=Number.isFinite,LEVELS=['유치원','초등학교','중학교','고등학교'],BINS=12;
const round=(v,d=1)=>finite(v)?Number(v.toFixed(d)):null;
// 선형 보간: 정렬된 관측값의 (n-1)*p 위치. 수염은 이상치 추정 없이 실제 최소·최대다.
function quantile(values,p){
 if(!values.length)return null;
 const pos=(values.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);
 return values[lo]+(values[hi]-values[lo])*(pos-lo);
}
// 차트에 넣기 전 반올림으로 좁은 관측 범위를 벗어나지 않도록 원래 정밀도를 보존한다.
function distribution(s){return {n:s.n,mean:s.n?s.values.reduce((a,b)=>a+b,0)/s.n:null,median:quantile(s.values,.5),min:s.min,max:s.max,q1:quantile(s.values,.25),q3:quantile(s.values,.75)};}
function histogram(values){
 if(!values.length)return [];
 const min=values[0],max=values[values.length-1];
 if(min===max)return [{from:min,to:max,count:values.length}];
 const width=(max-min)/BINS,bins=[];
 for(let i=0;i<BINS;i++)bins.push({from:min+width*i,to:i===BINS-1?max:min+width*(i+1),count:0});
 for(const v of values){let i=Math.floor((v-min)/width);if(i>=BINS)i=BINS-1;if(i<0)i=0;bins[i].count++;}
 return bins;
}
function coverageOf(column,rows,built){
 const missing=new Map();let available=0;
 for(const r of rows){
  if(finite(r[column])){available++;continue;}
  const m=profileModel.indicator(column,r,built).missing||{reason:'not_collected',detail:'이 학교의 값이 원자료에 없습니다.'};
  if(!missing.has(m.reason))missing.set(m.reason,{reason:m.reason,detail:m.detail,n:0});
  missing.get(m.reason).n++;
 }
 return {total:rows.length,available,missing_n:rows.length-available,missing:[...missing.values()].sort((a,b)=>b.n-a.n)};
}
function domainStats({domain,level,schoolId=null}){
 const meta=table.DOMAINS.find(d=>d.id===domain);
 if(!meta)throw Error('알 수 없는 영역입니다: '+domain);
 if(!LEVELS.includes(level))throw Error('알 수 없는 학교급입니다: '+level);
 const t=table.build(),levelRows=t.rows.filter(r=>r.level===level);
 const generalRows=levelRows.filter(r=>!stats.isIsland(r.gu)),islandRows=levelRows.filter(r=>stats.isIsland(r.gu));
 const selected=schoolId?t.byId.get(schoolId):null;
 const numericColumns=Object.entries(table.COLUMNS).filter(([,c])=>c.domain===domain&&c.type!=='text'&&c.type!=='bool').map(([col])=>col);
 const columns=numericColumns.filter(col=>col!=='paps');
 const indicators=columns.map(column=>{
  const c=table.COLUMNS[column];
  const main=stats.population(column,level,{island:false,built:t}),isl=stats.population(column,level,{island:true,built:t});
  const guMap=new Map();
  for(const r of levelRows){if(!r.gu)continue;if(!guMap.has(r.gu))guMap.set(r.gu,{values:[],total:0});const g=guMap.get(r.gu);g.total++;if(finite(r[column]))g.values.push(r[column]);}
  const gu=[...guMap.entries()].map(([name,g])=>{const s=stats.summarize(g.values.sort((a,b)=>a-b));return {name,track:stats.isIsland(name)?'island':'general',total:g.total,missing_n:g.total-s.n,...distribution(s)};}).sort((a,b)=>b.n-a.n);
  let sel=null;
  if(selected&&selected.level===level&&finite(selected[column])){
   const island=stats.isIsland(selected.gu),pop=island?isl:main;
   sel={name:selected.name,value:selected[column],population_n:pop.n,percentile:stats.percentile(pop.values,selected[column]),rank:stats.rank(pop.values,selected[column]),track:island?'island':'general'};
  }
  return {column,label:c.label,unit:c.unit||'',direction:c.direction,note:c.note||null,
   overall:distribution(main),island:distribution(isl),
   observations:levelRows.map(r=>({id:r.id,name:r.name,gu:r.gu,track:stats.isIsland(r.gu)?'island':'general',value:finite(r[column])?r[column]:null})),
   histogram:histogram(main.values),island_histogram:histogram(isl.values),gu,
   coverage:{...coverageOf(column,levelRows,t),general:coverageOf(column,generalRows,t),island:coverageOf(column,islandRows,t)},selected:sel};
 });
 return {domain,label:meta.label,level,school_id:schoolId,indicators,
  catalog:Object.entries(table.COLUMNS).filter(([id,c])=>id!=='paps'&&c.domain&&c.type!=='text'&&c.type!=='bool').map(([id,c])=>({column:id,label:c.label,domain:c.domain,unit:c.unit||''})),
  quantile_method:'linear_interpolation_n_minus_1',
  excluded_indicators:numericColumns.includes('paps')?[{column:'paps',reason:'definition_conflict',detail:'PAPS 등급 정의가 자료 간 일치하지 않아 원자료 확인 전 비교를 보류합니다.'}]:[]};
}
module.exports={domainStats,histogram,quantile};
