const model=require('./_school_summary');
const FILE='data_processed/context/school_designations.json';
function designation(question){
 if(!/연구학교|선도학교/.test(question))return null;
 const year=Number(question.match(/20\d{2}/)?.[0]||new Date().getFullYear());
 const terms=['연구학교','선도학교'].filter(t=>question.includes(t));
 const level=['초등학교','중학교','고등학교','유치원'].find(t=>question.includes(t));
 const gu=[...new Set(model.registry().map(s=>s.gu))].find(g=>g&&question.includes(g));
 const bundle=model.read(FILE),schools=model.registry();
 const named=schools.filter(s=>question.includes(s.name));
 const records=bundle.data.records.filter(r=>r.verification_status==='official_roster'&&(!named.length||named.some(s=>s.name===r.school_name))&&Number(r.school_year)===year&&terms.some(t=>r.designation_type.includes(t))&&(!level||(level==='고등학교'?/고|특성화/.test(r.school_level):r.school_level===level)));
 const rows=records.map(r=>{
  const matches=schools.filter(s=>s.id===r.match?.school_id||s.name===r.school_name);
  const s=matches.length===1?matches[0]:null;
  return {id:r.designation_id,school_id:s?.id,name:r.school_name,level:r.school_level,gu:s?.gu||'지역 미확인',type:r.designation_type,program:r.program_name,year,lat:s?.lat??null,lng:s?.lng??null,source_url:r.source?.url,source_title:r.source?.title,retrieved_at:r.source?.retrieved_at,period:r.period_basis==='school_year_only'?'학년도 명단 · 당일 운영 미확인':`${r.designation_start_date||'?'} ~ ${r.designation_end_date||'?'}`};
 }).filter(r=>!gu||r.gu===gu).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.type.localeCompare(b.type,'ko'));
 const names=new Set(rows.map(r=>r.name)),points=[...new Map(rows.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)).map(r=>[r.name,{name:r.name,lat:r.lat,lng:r.lng,detail:rows.filter(x=>x.name===r.name).map(x=>x.type).join(' · ')}])).values()];
 const counts=terms.map(t=>({name:t,value:new Set(rows.filter(r=>r.type.includes(t)).map(r=>r.name)).size}));
 const sources=[...new Map(rows.map(r=>[r.source_url,{id:r.source_url,title:r.source_title,url:r.source_url,source:r.source_url,body:`원문 수집일 ${r.retrieved_at||'미확인'}. ${year}학년도 지정 자료.`,provenance:[{path:FILE,sha256:bundle.hash}]}])).values()];
 sources.push({id:'designations#snapshot',title:'지정학교 정규화 원장',source:FILE,body:`조회: ${year}년 ${terms.join('·')} / ${level||'모든 학교급'} / ${gu||'인천 전체'}. ${rows.length}건. 수집한 원장 범위의 결과이며 전체 사업을 빠짐없이 포함한다는 뜻은 아닙니다.`,provenance:[{path:FILE,sha256:bundle.hash}]});
 const summary=`${year}학년도 ${level||'모든 학교급'} · ${gu||'인천 전체'}에서 수집 원장 기준 ${names.size}개 학교, ${rows.length}건의 지정을 확인했습니다. ${counts.map(c=>`${c.name} ${c.value}개교`).join(', ')}입니다. 중복 지정 학교가 있어 유형별 수를 더하면 학교 수와 다를 수 있습니다. 지정 여부는 교육 성과나 지원 우선순위를 뜻하지 않습니다.`;
 return {answerable:true,mode:'roster',summary,sources,visual:{title:`${year} 연구·선도학교`,map:points,chart:{kind:'bar',points:counts},table:{headers:['학교','학교급','지역','지정 유형','사업','학년도','기간 확인','출처'],rows:rows.map(r=>[r.name,r.level,r.gu,r.type,r.program,r.year,r.period,{url:r.source_url,label:'교육청 원문'}])},notes:[`${names.size}개교 중 지도 표시 ${points.length}개교 · 위치 미확인 ${names.size-points.length}개교도 표에 포함했습니다.`, '학교 대표 위치이며 출입구 보행 접근성을 확인한 지도가 아닙니다.','수집 원장 기준입니다. 현재 운영·추가 지정·해제 여부는 하단 원문에서 확인해야 합니다.'],records:rows}};
}
function enrich(answer,id,question){
 if(answer.visual)return answer;
 const c=answer.calculation,s=model.registry().find(s=>s.id===id);
 if(c){answer.visual={title:'질문 조건에 따른 분석',chart:c.chart,table:c.chart?.kind==='bar'?{headers:['조건','기관 수'],rows:c.chart.points.map(p=>[p.name,p.value])}:c.chart?.groups?{headers:['지역','기관 수','최솟값','1사분위','중앙값','3사분위','최댓값'],rows:c.chart.groups.map(g=>[g.name,g.n,g.min,g.q1,g.median,g.q3,g.max])}:c.chart?.points?{headers:c.chart.kind==='map'?(c.chart.points.some(p=>p.cluster)?['학교','관측값','군집','보정 q값']:['위치','관측값']):[...(c.chart.kind==='scatter'?['학교']:[]),c.chart.x?.[0]||'누적 기관 비율',c.chart.y?.[0]||'누적 관측값 비율'],rows:c.chart.points.map(p=>c.chart.kind==='map'?(c.chart.points.some(p=>p.cluster)?[p.name,p.value,p.cluster,p.local_q]:[p.name,p.value]):[...(c.chart.kind==='scatter'?[p.name]:[]),p.x,p.y])}:null,notes:[c.method==='network'?'전체 일반학교 대상 지정 확산 가정':c.method==='academy_clusters'?'인천 전체 등록 학원·교습소 대상':`${c.plan.level} · ${c.plan.gu} · ${c.plan.year}년 공시 기준`,...(c.limitations||[])]};
  answer.sources.push({id:'analysis#data',title:'분석 관측 원장',source:'data_processed/education/analysis_dataset.json',body:'선택 범위와 결측 제외 조건으로 서버에서 계산했습니다.',provenance:[{path:'data_processed/education/analysis_dataset.json',sha256:model.read('data_processed/education/analysis_dataset.json').hash}]});
 }else if(s&&answer.rows){answer.visual={title:s.name+' 관련 자료',map:[{name:s.name,lat:s.lat,lng:s.lng,detail:'선택 학교'},...answer.rows.facilities.map(f=>({...f,detail:f.condition}))],table:{headers:['확인 항목','관측 자료','기준·한계'],rows:answer.rows.facts.map(f=>[f.label,f.value,f.note])},notes:['학교 대표 위치입니다. 시설의 실제 출입구 경로는 별도 확인해야 합니다.']};
  if(/미래|예측|전망/.test(question)){const points=[...(s.enrollment_trend?.observations||[]).map(p=>({x:p.year,y:p.students,name:'관측'})),...(s.forecast||[]).map(p=>({x:p.year,y:p.students,name:'예측'}))];answer.visual.chart={kind:'line',x:['연도','년'],y:['학생 수','명'],points};answer.visual.table={headers:['연도','학생 수','구분'],rows:points.map(p=>[p.x,p.y,p.name])};answer.visual.notes.push('점선은 모형 예측입니다. 실제 재학생 수나 확정 수요가 아닙니다.');}
 }
 return answer;
}
module.exports={designation,enrich};
