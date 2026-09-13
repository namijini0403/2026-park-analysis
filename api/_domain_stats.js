'use strict';
// 영역 1개의 전체 분포. 학교급 안에서 육지 통계를 기본으로 하고 도서지역(강화·옹진)은 따로 센다.
// 미확보는 분포·평균에서 제외하고 사유별로 센다.
const table=require('./_school_table'),stats=require('./_indicator_stats'),profileModel=require('./_school_profile');
const finite=Number.isFinite,LEVELS=['유치원','초등학교','중학교','고등학교'],BINS=12;
const round=(v,d=1)=>finite(v)?Number(v.toFixed(d)):null;
function histogram(values){
 if(!values.length)return [];
 const min=values[0],max=values[values.length-1];
 if(min===max)return [{from:min,to:max,count:values.length}];
 const width=(max-min)/BINS,bins=[];
 for(let i=0;i<BINS;i++)bins.push({from:round(min+width*i,2),to:round(min+width*(i+1),2),count:0});
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
 return {available,missing:[...missing.values()].sort((a,b)=>b.n-a.n)};
}
function domainStats({domain,level,schoolId=null}){
 const meta=table.DOMAINS.find(d=>d.id===domain);
 if(!meta)throw Error('알 수 없는 영역입니다: '+domain);
 if(!LEVELS.includes(level))throw Error('알 수 없는 학교급입니다: '+level);
 const t=table.build(),levelRows=t.rows.filter(r=>r.level===level);
 const selected=schoolId?t.byId.get(schoolId):null;
 const columns=Object.entries(table.COLUMNS).filter(([,c])=>c.domain===domain&&c.type!=='text'&&c.type!=='bool').map(([col])=>col);
 const indicators=columns.map(column=>{
  const c=table.COLUMNS[column];
  const main=stats.population(column,level,{island:false,built:t}),isl=stats.population(column,level,{island:true,built:t});
  const guMap=new Map();
  for(const r of levelRows){if(!r.gu||!finite(r[column]))continue;if(!guMap.has(r.gu))guMap.set(r.gu,[]);guMap.get(r.gu).push(r[column]);}
  const gu=[...guMap.entries()].map(([name,vals])=>{const s=stats.summarize(vals.sort((a,b)=>a-b));return {name,n:s.n,mean:s.mean,median:s.median};}).sort((a,b)=>b.n-a.n);
  let sel=null;
  if(selected&&selected.level===level&&finite(selected[column])){
   const island=stats.isIsland(selected.gu),pop=island?isl:main;
   sel={value:selected[column],percentile:stats.percentile(pop.values,selected[column]),rank:stats.rank(pop.values,selected[column]),track:island?'island':'general'};
  }
  return {column,label:c.label,unit:c.unit||'',direction:c.direction,note:c.note||null,
   overall:{n:main.n,mean:main.mean,median:main.median,min:main.min,max:main.max},
   island:{n:isl.n,mean:isl.mean,median:isl.median},
   histogram:histogram(main.values),gu,coverage:coverageOf(column,levelRows,t),selected:sel};
 });
 return {domain,label:meta.label,level,school_id:schoolId,indicators};
}
module.exports={domainStats,histogram};
