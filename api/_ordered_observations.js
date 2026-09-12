'use strict';
const h=require('./_hitl_analysis');
async function run(p){
 const plan=h.plan(p),candidates=plan.candidates.filter(f=>f.field);
 const factor=candidates.find(f=>f.id===p.factor_id)||(candidates.length===1?candidates[0]:null);
 if(!factor)return {answerable:false,mode:'clarification',summary:candidates.length?'정렬할 지표가 여러 개입니다. 하나를 선택해 주세요.':'이 질문에 대해 정렬 가능한 수치 지표를 특정하지 못했습니다. 항목과 비교 기준을 구체적으로 적어 주세요.',sources:[],candidates};
 const direction=/하위|적은|낮은|작은|짧은|가까운/.test(p.question)?'lower':'higher';
 const limit=Math.min(100,Math.max(1,Number(p.question.match(/(?:상위|하위|top)\s*(\d+)|(\d+)\s*(?:개|곳)/i)?.slice(1).find(Boolean)||10)));
 const raw=await h.run({...p,version:h.VERSION,factors:[{id:factor.id,direction,weight:null}],uploads:[]});
 const sections=raw.visual.sections.filter(s=>s.statistics||s.table?.rows.some(r=>r.includes('미확보'))).map(s=>{
  if(!s.statistics)return s;
  const sorted=[...s.table.rows].sort((a,b)=>(direction==='higher'?-1:1)*(a[1]-b[1])||String(a[0]).localeCompare(String(b[0]),'ko'));
  const cutoff=sorted[Math.min(limit,sorted.length)-1]?.[1],rows=sorted.filter((r,i)=>i<limit||r[1]===cutoff);
  return {...s,table:{...s.table,rows},chart:{kind:'bar',unit:factor.label,points:rows.map(r=>({name:r[0],value:r[1]}))},notes:[...s.notes,`유효 ${sorted.length}개 중 ${rows.length}개 표시. 요청 경계의 동점은 함께 포함합니다.`]};
 });
 return {...raw,mode:'ordered_observations',summary:`‘${factor.label}’의 ${direction==='higher'?'큰':'작은'} 값부터 최대 ${limit}개씩 확인합니다. 학교급·연도·단위·도서지역을 분리하며 동점은 함께 표시합니다. 관측값 정렬이며 지원 순위가 아닙니다.`,visual:{title:factor.label+' 관측값 비교',sections,notes:raw.visual.notes},comparison:{factor:factor.id,direction,limit}};
}
module.exports={run};
