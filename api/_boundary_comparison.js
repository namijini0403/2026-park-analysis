'use strict';
const model=require('./_school_summary'),data=require('./_data_answers');
const worker=require('../scripts/education/python_worker.cjs');
const criteria={mismatch:['전체 모양이 서로 다른 비율','100 × (1 − 겹친 면적 ÷ 두 구역의 합집합 면적)'],zone_outside:['학구도 중 도보권 밖 비율','100 × (학구도 면적 − 겹친 면적) ÷ 학구도 면적'],walk_outside:['도보권 중 학구도 밖 비율','100 × (도보권 면적 − 겹친 면적) ÷ 도보권 면적']};
let cached;
async function observations(){
 const sources=['zones','walkshed'].flatMap(id=>{const e=data.catalog.find(e=>e.id===id),b=data.read(e);return [{path:e.file,sha256:b.hash},...(b.extraSource?[b.extraSource]:[])];});
 const key=JSON.stringify(sources)+model.read('data_processed/education/analysis_dataset.json').hash;
 if(cached?.key!==key){const promise=worker('compare_school_boundaries.py',{schools:model.registry()},{timeout:60000});cached={key,promise};promise.catch(()=>{if(cached?.promise===promise)cached=null;});}
 const result=await cached.promise;if(JSON.stringify(result.sources)!==JSON.stringify(sources))throw Error('경계 자료가 갱신되었습니다. 잠시 후 다시 비교해 주세요.');return result;
}
async function run(ctx,criterion='mismatch'){
 if(!Object.hasOwn(criteria,criterion))throw Error('비교 기준을 다시 선택해 주세요.');
 const result=await observations(),registry=model.registry(),byId=new Map(registry.map(s=>[s.id,s]));
 const separate=new Set(model.read('data_processed/student_services/priorities.json').data.schools.filter(s=>s.separate_track).map(s=>s.id));
 const rows=result.rows.map(r=>({...r,...byId.get(r.id)})).filter(r=>(ctx.level==='전체'||r.level===ctx.level)&&(!ctx.gu||r.gu===ctx.gu)&&(!ctx.school_id||r.id===ctx.school_id));
 const number=Number(ctx.question.match(/(?:상위|하위|top)\s*(\d+)|(?:(\d+)\s*(?:개|곳))/i)?.slice(1).find(Boolean)||10),limit=Math.min(100,Math.max(1,number));
 const low=/하위|가장\s*(잘|일치)|작은|낮은/.test(ctx.question);
 const excluded=rows.filter(r=>r.status!=='computed'||ctx.year&&r.zone_dates?.some(d=>!d.startsWith(String(ctx.year))));
 const valid=rows.filter(r=>!excluded.includes(r));
 const island=r=>separate.has(r.id)||/옹진|강화/.test(r.gu||'');
 const chosen=[],sections=[false,true].flatMap(track=>{
  const group=valid.filter(r=>island(r)===track).sort((a,b)=>(low?1:-1)*(a[criterion]-b[criterion])||a.name.localeCompare(b.name,'ko'));
  const head=group.slice(0,limit),cut=head.at(-1)?.[criterion];
  // Include all ties at the cutoff at the displayed precision.
  const selected=group.filter((r,i)=>i<limit||Number(r[criterion].toFixed(3))===Number(cut?.toFixed(3)));
  chosen.push(...selected);if(!group.length)return [];
  return [{title:(track?'도서·농어촌 별도 검토':'일반 지역')+` · 유효 ${group.length}개 중 ${selected.length}개`,table:{headers:['학교',criteria[criterion][0]+' %','학구도 면적 ㎡','보행권 면적 ㎡','겹친 면적 ㎡','학구도 기준일'],rows:selected.map(r=>[r.name,Number(r[criterion].toFixed(3)),Math.round(r.zone_m2),Math.round(r.walk_m2),Math.round(r.intersection_m2),r.zone_dates.join(', ')])},chart:{kind:'bar',unit:'%',points:selected.map(r=>({name:r.name,value:Number(r[criterion].toFixed(3))}))},notes:[`${criteria[criterion][0]} ${low?'작은':'큰'} 값 순입니다. 표시값 동점은 함께 포함합니다. 지원·학교 품질 순위가 아닙니다.`]}];
 });
 const ids=new Set(chosen.map(r=>r.id)),geometries=['zones','walkshed'].flatMap(id=>data.read(data.catalog.find(e=>e.id===id)).data.features.filter(f=>id==='zones'?f.properties.schools?.some(s=>ids.has(s.id)):ids.has(f.properties.학교ID)).map(f=>({...f,properties:{...f.properties,name:(id==='zones'?'학구도 · ':'보행 500m · ')+(f.properties.name||f.properties.학교명),color:id==='zones'?'#8359ae':'#25866d'}})));
 const summary=`${ctx.level} ${ctx.gu||'전체'}: 요청 범위 ${rows.length}개 중 계산 가능 ${valid.length}개, 보류 ${excluded.length}개입니다. ‘${criteria[criterion][0]}’ 기준으로 ${low?'작은':'큰'} 값을 일반 지역과 도서·농어촌으로 나누어 최대 ${limit}개씩 표시했습니다. 가중치는 사용하지 않았습니다.`;
 return {answerable:true,mode:'boundary_comparison',summary,school_id:ctx.school_id,sources:result.sources.map((s,i)=>({id:'boundary#'+i,title:i?'보행망 500m 도달권':'공식 학구도',source:s.path,provenance:[s],body:criteria[criterion][1]})),review:{decision:'deferred',criterion,context:ctx,gates:{eligibility:'unverified',safety:'unverified',execution:'unverified',route:'unverified'}},visual:{title:'학구도와 보행 500m 도달권의 공간 비교',map:chosen.map(r=>({name:r.name,lat:r.lat,lng:r.lng})),geometries,sections:[...sections,{title:'자료 미확보·조건 불일치로 계산 보류',table:{headers:['학교','이유'],rows:excluded.map(r=>[r.name,r.reason||'요청 연도의 학구도 자료 미확보'])}}],notes:[criteria[criterion][1],'면적은 EPSG:5179 미터 좌표로 변환해 계산합니다. 한 학교에 연결된 여러 학구는 합집합으로 처리합니다.','보라색은 공식 학구도, 초록색은 보행망 500m 도달권입니다. 원형 반경으로 대체하지 않았습니다.','면적 비율이며 학생의 거주·통학 비율이 아닙니다. 도로망 도달권은 실제 출입구·통행 허용·안전을 검증한 통학권이 아닙니다.','두 자료의 기준 시점과 도형 생성 방법이 다릅니다. 누락을 0으로 채우지 않았으며 투자 우선순위로 해석하지 않습니다.']},comparison:{criterion,formula:criteria[criterion][1],scope_count:rows.length,valid:valid.length,excluded:excluded.length,limit,crs:result.crs}};
}
module.exports={run,criteria};
