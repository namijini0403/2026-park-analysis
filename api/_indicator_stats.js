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
function collect(filter,column){return summarize(table.build().rows.filter(r=>filter(r)&&finite(r[column])).map(r=>r[column]).sort((a,b)=>a-b));}
function population(column,level,opts={}){const island=!!opts.island;return collect(r=>r.level===level&&isIsland(r.gu)===island,column);}
function guPopulation(column,level,gu){if(!gu)return summarize([]);return collect(r=>r.level===level&&r.gu===gu,column);}
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
