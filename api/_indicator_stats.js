'use strict';
// 지표 하나의 상대 위치. 모집단은 언제나 "같은 학교급 + 같은 육지/도서 구분"이며 결측은 제외한다(0이 아니다).
// 백분위는 방향과 무관하게 고정이다: 값이 클수록 크다. _relative_position.js의 질문 방향 백분위와 다른 값이다.
const table=require('./_school_table');
const ISLAND_GU=['강화군','옹진군'],MIN_GU_N=10;
const finite=Number.isFinite;
const isIsland=gu=>ISLAND_GU.includes(gu||'');
const round=(v,d=1)=>finite(v)?Number(v.toFixed(d)):null;
function summarize(values){
 const n=values.length;
 if(!n)return {n:0,values:[],mean:null,median:null,min:null,max:null};
 const mid=n/2,median=n%2?values[(n-1)/2]:(values[mid-1]+values[mid])/2;
 return {n,values,mean:round(values.reduce((a,b)=>a+b,0)/n,2),median:round(median,2),min:values[0],max:values[n-1]};
}
// 모집단은 (컬럼 × 학교급 × 구분)마다 한 번만 만든다. 프로필 하나가 지표 45개를 훑고 커버리지 계산은
// 학교마다 다시 부르기 때문에, 캐시가 없으면 917행 필터·정렬을 수만 번 반복하게 된다.
// 원자료 파일이 바뀌면 table.build()가 새 캐시를 주므로 그 key로 통째로 버린다.
// table.build()는 호출마다 원자료 15개를 statSync 하므로, 이미 만든 결과가 있으면 넘겨받아 재사용한다.
let memo={key:null,map:new Map()};
function cached(cacheKey,build,built){
 const t=built||table.build();
 if(memo.key!==t.key)memo={key:t.key,map:new Map()};
 if(!memo.map.has(cacheKey))memo.map.set(cacheKey,build(t));
 return memo.map.get(cacheKey);
}
function collect(t,filter,column){return summarize(t.rows.filter(r=>filter(r)&&finite(r[column])).map(r=>r[column]).sort((a,b)=>a-b));}
function population(column,level,opts={}){const island=!!opts.island;return cached('p|'+column+'|'+level+'|'+island,t=>collect(t,r=>r.level===level&&isIsland(r.gu)===island,column),opts.built);}
function guPopulation(column,level,gu,built){if(!gu)return summarize([]);return cached('g|'+column+'|'+level+'|'+gu,t=>collect(t,r=>r.level===level&&r.gu===gu,column),built);}
function percentile(values,v){
 if(!values.length||!finite(v))return null;
 let below=0,ties=0;
 for(const x of values){if(x<v)below++;else if(x===v)ties++;}
 return round(100*(below+0.5*ties)/values.length,1);
}
function rank(values,v){
 if(!values.length||!finite(v))return null;
 let above=0;for(const x of values)if(x>v)above++;
 return above+1;
}
module.exports={population,guPopulation,percentile,rank,summarize,isIsland,ISLAND_GU,MIN_GU_N};
