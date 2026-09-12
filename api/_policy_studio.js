'use strict';
// A policy scenario is explicit, reproducible and never a default school score.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const hitl=require('./_hitl_analysis'),data=require('./_data_answers'),model=require('./_school_summary');
const VERSION=1, gates=['eligibility','safety','execution','route'];
const labels={eligibility:'지원 대상·이용 자격',safety:'안전',execution:'실행·수용 여건',route:'실제 이용 경로'};
const resources={books:{label:'장서 확충',factor:'books:books.total',unit:'권'},seats:{label:'도서관 좌석 확충',factor:'books:books.seats',unit:'석'},staff:{label:'사서 인력 확충',factor:'books:books.staff',unit:'명'},parks:{label:'공원 확충 검토',factor:'schools:parks',unit:'곳'}};
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const safeText=(v,max=1000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
let storePromise;
const store=()=>storePromise||=(import('../scripts/update_center/store.mjs').then(m=>m.createStore()));
async function inventory(p){
 const r=resources[p.resource];if(!r)throw Error('지원할 자원을 선택해 주세요.');
 const year=Number(p.year);if(!Number.isInteger(year)||year<2000||year>2100)throw Error('관측 기준연도를 선택해 주세요.');
 const result=await hitl.run({version:hitl.VERSION,question:'학교별 관측',scope:'all',level:p.level||'초등학교',year,factors:[{id:r.factor,direction:'observe',weight:null}]});
 const lookup=new Map();for(const section of result.visual.sections.filter(s=>s.statistics))for(const row of section.table.rows){if(lookup.has(row[0]))lookup.set(row[0],null);else lookup.set(row[0],row[1]);}
 const separate=new Set(model.read('data_processed/student_services/priorities.json').data.schools.filter(s=>s.separate_track).map(s=>s.id));
 const roster=model.registry().filter(s=>s.level===(p.level||'초등학교')&&(!p.gu||s.gu===p.gu));
 const sources=[...result.sources.flatMap(s=>s.provenance||[]),{path:'data_processed/education/analysis_dataset.json',sha256:model.read('data_processed/education/analysis_dataset.json').hash}],snapshot=hash(sources);
 return {resource:r,year,sources,snapshot,schools:roster.map(s=>({id:s.id,name:s.name,gu:s.gu,lat:s.lat,lng:s.lng,students:s.observations?.[year]?.students??null,track:separate.has(s.id)||/강화|옹진/.test(s.gu||'')?'island':'general',observed:lookup.get(s.name)??null}))};
}
async function reviews(){const s=await store(),versions=await s.listVersions('policy-evidence',5000);const records=[];for(const v of versions){const full=await s.getVersion(v.id);try{const r=JSON.parse(Buffer.from(full.snapshot,'base64').toString('utf8'));if(r.schema===VERSION)records.push({...r,version_id:v.id,created_at:v.created_at});}catch{}}
 return records.sort((a,b)=>b.created_at.localeCompare(a.created_at));}
function gateState(school,p,inv,records){
 const review=records.find(r=>r.school_id===school.id&&r.resource===p.resource&&r.year===inv.year);
 const current=review&&review.target===p.target&&review.snapshot===inv.snapshot&&Date.parse(review.valid_until+'T23:59:59Z')>=Date.now();
 const checks=gates.map(key=>({key,label:labels[key],status:current?review.checks[key].status:'unverified',reason:current?review.checks[key].reason:review?'목표 수량·원자료가 변경되었거나 확인 유효기간이 지났습니다.':'확인 담당자와 근거 문서가 등록되지 않았습니다.'}));
 return {checks,review:current?review.version_id:null,eligible:current&&checks.every(c=>['verified','not_applicable'].includes(c.status))};
}
function allocate(rows,budget,unitCost,weights){
 const maxGap=Math.max(1,...rows.map(r=>r.gap)),maxObserved=Math.max(1,...rows.map(r=>r.students||0));
 const total=weights.gap+weights.scale;
 const ordered=rows.map(r=>({...r,components:{gap:r.gap/maxGap,scale:finite(r.students)?r.students/maxObserved:null},comparison:((r.gap/maxGap)*weights.gap+((r.students||0)/maxObserved)*weights.scale)/total})).sort((a,b)=>b.comparison-a.comparison||a.name.localeCompare(b.name,'ko'));
 let remaining=Math.floor(budget/unitCost),tier=0,last=null;
 for(let i=0;i<ordered.length;){let end=i+1;while(end<ordered.length&&Math.abs(ordered[end].comparison-ordered[i].comparison)<1e-10)end++;
  const tied=ordered.slice(i,end),need=tied.reduce((n,r)=>n+r.gap,0);tier++;const can=Math.min(remaining,need);
  // Equal comparison values remain a tied tier. Fractional remainders are retained, never broken by school name.
  let used=0;for(const r of tied){r.order=tier;r.units=need?Math.floor(can*r.gap/need):0;r.cost=r.units*unitCost;r.remaining_gap=r.gap-r.units;used+=r.units;}
  remaining-=used;last=can<need?{tier,unassigned_units:remaining,reason:'동순위 안의 정수 단위 잔여분은 담당자 선택이 필요합니다.'}:last;
  if(can<need){for(const r of ordered.slice(end)){r.order=null;r.units=0;r.cost=0;r.remaining_gap=r.gap;}break;}i=end;
 }
 return {rows:ordered,spent:ordered.reduce((n,r)=>n+r.cost,0),remaining_budget:budget-ordered.reduce((n,r)=>n+r.cost,0),tie:last};
}
async function scenario(p,recordsOverride){
 if(p.version!==VERSION)throw Error('이전 추천을 복원하지 않습니다. 새 지원 조건으로 계산해 주세요.');
 const inv=await inventory(p),target=p.target,budget=p.budget,unitCost=p.unit_cost,w=p.weights;
 if(!safeText(p.preference,500))throw Error('지원 목적과 가중치를 선택한 이유를 입력해 주세요.');
 if(!['general','island'].includes(p.track))throw Error('일반 학교 또는 도서·농어촌 별도 검토를 선택해 주세요.');
 if(!Number.isInteger(target)||target<=0||target>1e7||!finite(budget)||budget<0||budget>1e13||!finite(unitCost)||unitCost<=0||unitCost>1e10)throw Error('학교당 목표 수량·총예산·단가를 확인해 주세요.');
 if(!w||!finite(w.gap)||!finite(w.scale)||w.gap<0||w.scale<0||w.gap>100||w.scale>100||w.gap+w.scale<=0)throw Error('가중치를 직접 설정해 주세요.');
 const records=recordsOverride||await reviews(),rows=inv.schools.filter(s=>s.track===p.track).map(s=>{const state=gateState(s,p,inv,records),valid=finite(s.observed)&&s.observed>=0;return {...s,...state,gap:valid?Math.max(0,Math.ceil(target-s.observed)):null,status:!valid?'자료 미확보':!state.eligible?'조건 확인 필요':s.observed>=target?'선택 목표 충족':'배분 비교 가능'};});
 for(const r of rows)if(r.status==='배분 비교 가능'&&w.scale>0&&(!finite(r.students)||r.students<0))r.status='동일 연도 학생 수 미확보';
 const eligible=rows.filter(r=>r.status==='배분 비교 가능'),allocation=allocate(eligible,budget,unitCost,w);
 const alternatives=[{gap:1,scale:0,label:'목표까지 남은 수량만 중시'},{gap:0,scale:1,label:'학생 규모만 중시'}].map(weights=>({label:weights.label,...allocate(eligible.filter(r=>!weights.scale||finite(r.students)&&r.students>=0),budget,unitCost,weights)}));
 const pending=rows.filter(r=>r.status!=='배분 비교 가능'),need=rows.filter(r=>r.gap>0),sources=inv.sources;
 const summary=eligible.length?`${eligible.length}개교가 필수 조건을 통과했습니다. 선택 가중치로 ${allocation.rows.filter(r=>r.units>0).length}개교에 ${allocation.rows.reduce((n,r)=>n+r.units,0).toLocaleString('ko')} ${inv.resource.unit}, ${allocation.spent.toLocaleString('ko')}원 배분안을 계산했습니다.`:`선택 목표 미달 관측은 ${need.length}개교입니다. 지금 지원 집행을 비교할 수 있는 학교는 0개교입니다. 아래에서 학교별 목표까지의 수량과 확인할 조건을 확인하세요.`;
 const headers=['학교','현재 '+inv.resource.unit,'선택 목표 '+inv.resource.unit,'목표까지 수량 '+inv.resource.unit,'이번 지원·예산','순서·다음 행동'];
 const tableRows=[...allocation.rows.map(r=>[r.name,r.observed,target,r.gap,`${r.units.toLocaleString('ko')}${inv.resource.unit} · ${r.cost.toLocaleString('ko')}원`,(r.order?`${r.order}단계${allocation.rows.filter(x=>x.order===r.order).length>1?' · 동순위':''}`:'예산 범위 밖')+` · 목표까지 ${r.remaining_gap}${inv.resource.unit} 남음`]),...pending.map(r=>[r.name,r.observed??'미확보',target,r.gap??'계산 보류','집행 보류',r.status==='조건 확인 필요'?r.checks.filter(c=>!['verified','not_applicable'].includes(c.status)).map(c=>c.label).join(' · '):r.status])];
 return {mode:'policy_scenario',answerable:true,summary,school_id:null,scenario:{version:VERSION,parameters:{resource:p.resource,year:inv.year,level:p.level||'초등학교',gu:p.gu||'',target,budget,unit_cost:unitCost,weights:w,preference:p.preference,track:p.track},snapshot:inv.snapshot,sources,created_at:new Date().toISOString(),schools:rows,allocation,alternatives},sources:[{id:'policy#snapshot',title:'지원량 계산에 사용한 관측 원장',source:sources[0]?.path,body:'수량은 사용자가 채택한 학교당 목표와 관측값의 차이입니다. 목표는 법정 기준이나 적정량 판정이 아닙니다.',provenance:sources}],visual:{title:'어느 학교에 · 어떤 순서로 · 얼마나',table:{headers,rows:tableRows},map:rows.filter(r=>finite(r.lat)&&finite(r.lng)).map(r=>({...r,detail:`${r.status} · 목표까지 ${r.gap??'미확보'}${inv.resource.unit}`})),sections:[{title:'가중치를 바꾸면 달라지는 배분',table:{headers:['학교','선택 가중치 배분 '+inv.resource.unit,...alternatives.map(a=>a.label+' '+inv.resource.unit)],rows:allocation.rows.map(r=>[r.name,r.units,...alternatives.map(a=>a.rows.find(x=>x.id===r.id)?.units??'학생 수 미확보 · 비교 보류')])}},{title:'자료 미확보·필수 확인 조건',table:{headers:['학교','상태','다음 확인'],rows:pending.map(r=>[r.name,r.status,r.checks.filter(c=>!['verified','not_applicable'].includes(c.status)).map(c=>c.label+': '+c.reason).join(' / ')])}}],notes:[`사용자가 선택한 목표: 학교당 ${target}${inv.resource.unit}. ${inv.year}년 관측이며 현재 재고의 재확인이 필요합니다.`,`명시한 정책 목적: ${p.preference}`,`총예산 ${budget.toLocaleString('ko')}원 · 가정 단가 ${unitCost.toLocaleString('ko')}원/${inv.resource.unit} · 미배분 ${allocation.remaining_budget.toLocaleString('ko')}원. 단가는 견적·부대비용 확인 전 가정입니다.`, '목표 차이와 동일 연도 학생 규모의 비중으로 이 자원·연도·검토 집단 안에서만 비교합니다. 학교 종합평가가 아닙니다. 학생 규모를 중시하면 수혜 대상이 큰 학교에 무게를 두는 정책 선택입니다.', '안전·자격·실행·이용 경로 미확인은 가중치로 상쇄하지 않습니다. 동순위의 잔여 정수 단위는 임의 배분하지 않습니다.']}};
}
async function review(p,token){
 const expected=process.env.POLICY_REVIEW_TOKEN||process.env.UPDATE_CENTER_TOKEN;if(!expected||!token||Buffer.byteLength(token)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected)))throw Error('근거 확인 등록은 설정된 관리자 인증이 필요합니다.');
 const inv=await inventory(p);if(!inv.schools.some(s=>s.id===p.school_id))throw Error('해당 학교와 학교급을 확인해 주세요.');
 if(!Number.isInteger(p.target)||p.target<=0||p.target>1e7)throw Error('먼저 이번 검토의 학교당 목표 수량을 입력해 주세요. 근거 확인은 해당 목표에 한해 적용됩니다.');
 if(!safeText(p.reviewer,100)||!/^\d{4}-\d{2}-\d{2}$/.test(p.valid_until||'')||(!Number.isFinite(Date.parse(p.valid_until+'T23:59:59Z'))||Date.parse(p.valid_until+'T23:59:59Z')<Date.now()))throw Error('확인 담당자와 유효기간을 입력해 주세요.');
 const checks={};for(const key of gates){const c=p.checks?.[key];if(!c||!['verified','not_applicable','failed','unverified'].includes(c.status)||!safeText(c.reason)||!safeText(c.source,1000)||!safeText(c.document,12000))throw Error(labels[key]+'의 상태·근거 위치·확인 내용·문서 발췌를 입력해 주세요.');checks[key]={status:c.status,reason:c.reason,source:c.source,document:c.document,document_hash:hash(c.document)};}
 const record={schema:VERSION,school_id:p.school_id,resource:p.resource,year:inv.year,target:p.target,reviewer:p.reviewer,valid_until:p.valid_until,checks,snapshot:inv.snapshot,sources:inv.sources};
 const s=await store(),v=await s.saveVersion({dataset:'policy-evidence',content_hash:hash(record),row_count:1,snapshot:Buffer.from(JSON.stringify(record)).toString('base64')});
 await s.appendAudit({actor:p.reviewer,action:'policy_evidence_review',dataset:'policy-evidence',detail:JSON.stringify({school_id:p.school_id,resource:p.resource,version_id:v.id})});
 return {summary:'담당자 근거 확인을 저장했습니다. 새로운 배분안을 계산하면 적용됩니다. 자동 사실 인증이나 정책 승인은 아닙니다.',version_id:v.id};
}
async function handle(p,token){
 if(p.action==='studio_sources'){const doc=require('js-yaml').load(fs.readFileSync(path.join(__dirname,'../data_sources.yaml'),'utf8'));return {sources:(doc.sources||[]).map(s=>({dataset:s.dataset,provider:s.provider,source_url:s.source_url,coverage:s.coverage,notes:s.notes,check:{type:s.check?.type},auto_apply:s.auto_apply===true}))};}
 if(p.action==='studio_inventory')return inventory(p);
 if(p.action==='studio_scenario')return scenario(p);
 if(p.action==='studio_review')return review(p,token);
 if(p.action==='studio_atlas'){const file=path.join(__dirname,'../data_processed/visual_atlas',p.dataset_id?String(p.dataset_id)+'.json':'index.json');if(p.dataset_id&&!data.catalog.some(e=>e.id===p.dataset_id))throw Error('등록된 자료를 선택해 주세요.');if(!fs.existsSync(file))throw Error('기본 시각 자료를 아직 제작하지 않았습니다.');const artifact=JSON.parse(fs.readFileSync(file,'utf8'));if(p.dataset_id){const entries=[...new Map((artifact.result?.sources||[]).flatMap(s=>s.provenance||[]).map(e=>[e.path+e.sha256,e])).values()];artifact.stale=entries.some(e=>{const f=path.resolve(__dirname,'..',e.path||'');return !f.startsWith(path.resolve(__dirname,'../data_processed')+path.sep)||!fs.existsSync(f)||hash(fs.readFileSync(f))!==e.sha256;});if(artifact.stale){const fresh=await require('../scripts/build_visual_atlas.cjs').buildDataset(data.catalog.find(e=>e.id===p.dataset_id));return {...fresh.artifact,stale:false,refreshed:true};}}return artifact;}
 throw Error('지원하지 않는 분석 요청입니다.');
}
module.exports={handle,inventory,scenario,allocate,gateState,review,resources,VERSION};
