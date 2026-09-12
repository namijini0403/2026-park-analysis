'use strict';
// One deterministic calculation for the API and local slider updates.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuestionConclusion=api;})(typeof window!=='undefined'?window:globalThis,()=>{
 const round=n=>Math.round(n*10)/10;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function option(f,question){
  if(f.id.startsWith('books:books.staff'))return '사서 근무시간·업무량 확인 후 공동 배치 또는 근무시간 보완';
  if(f.id.startsWith('books:books.seats'))return '실제 혼잡 시간과 공간 여건 확인 후 좌석 재배치 또는 이용시간 분산';
  if(f.id.startsWith('books:'))return '장서 최신성·대출 수요 확인 후 도서 구입·교체 또는 학교 간 공동 이용';
  if(f.id.startsWith('library_access:'))return '외부 도서관의 실제 도보 경로·개방시간 확인 후 연계 이용, 순회대출 또는 교내 독서 거점 보완';
  if(/parks|green|shared_parks|grid_demand|candidate/.test(f.id))return '출입구·이용 가능 시간·부지 조건 확인 후 기존 공간 공동 이용 또는 새 활동공간 후보 비교';
  if(/forecast|school_demand|cohort/.test(f.id))return '예측 오차와 실제 유입 확인 후 단계적 정원·시설 확보 대안 비교';
  if(/routes|walkshed|resilience/.test(f.id))return '실제 통행 가능 경로 확인 후 출입구 연결·우회 동선 개선 대안 비교';
  if(f.id==='schools:students')return /도서|독서|장서/.test(question)?'학생 규모와 이용률에 맞춘 도서관 운영시간·공동 이용 용량 검토':'학생 규모와 실제 이용 수요를 확인해 지원 용량·운영시간 검토';
  return '관측 차이의 원인과 실제 이용 수요를 확인한 뒤 가능한 지원 방안 비교';
 }
 function build(factors,sections,context){
  const weighted=factors.some(f=>f.weight!==null),total=factors.reduce((s,f)=>s+(f.weight||0),0);
  const cards=factors.map(f=>{
   const share=weighted&&total?round((f.weight||0)/total*100):null;
   const groups=sections.filter(s=>s.factor_id===f.id&&s.statistics).map(s=>{
    const rows=s.table.rows,values=rows.map(r=>r[1]),lo=Math.min(...values),hi=Math.max(...values);
    // Show exact observed extremes, including all ties; never imply a normative shortage threshold.
    const extreme=f.direction==='lower'?lo:f.direction==='higher'?hi:null;
    const members=rows.filter(r=>extreme===null?r[1]===lo||r[1]===hi:r[1]===extreme).map(r=>({name:r[0],value:r[1]}));
    const own=s.statistics.selected;
    const names=members.slice(0,3).map(m=>m.name+' '+m.value).join(', ')+(members.length>3?' 외 '+(members.length-3)+'곳':'');
    const fact=own?`${own.name}의 관측값은 ${own.value}, 같은 범위 중앙값은 ${s.statistics.median}입니다.`:rows.length?`${f.direction==='lower'?'가장 작은':f.direction==='higher'?'가장 큰':'최솟값·최댓값'} 관측: ${names}.`:'유효한 관측값이 없습니다.';
    return {title:s.title,year:s.comparison_year,track:s.comparison_track,n:s.statistics.n,excluded:s.statistics.excluded,median:s.statistics.median,min:rows.length?lo:null,max:rows.length?hi:null,members,own,fact,rows:rows.map(r=>({name:r[0],value:r[1]}))};
   });
   const ownGroup=groups.find(g=>g.own),representative=ownGroup||groups.find(g=>g.track==='일반 검토')||groups[0];
   const available=groups.some(g=>g.n>0),numeric=!!f.field||f.id.startsWith('upload:');
   const observation=(context.school_id&&numeric&&!ownGroup?'선택 학교의 유효값이 없어 해당 학교 판단을 보류합니다.':representative?.fact)||(numeric?'선택 범위의 유효값이 없어 이 변수의 판단을 보류합니다.':'지도·기록의 확인 상태를 아래 출처 자료에서 확인합니다.');
   const direction={lower:'작은 값',higher:'큰 값',observe:'양쪽 관점'}[f.direction];
   const implication=(!available||(context.school_id&&!ownGroup))&&numeric?'추가 자료 확보 후 비교':f.direction==='observe'?`검토할 선택지: ${option(f,context.question)}. 작은 값·큰 값 중 중시할 방향을 정하면 관측 대상을 좁힐 수 있습니다`:`${direction}을 중시하는 조건에서 검토할 선택지: ${option(f,context.question)}`;
   return {id:f.id,label:f.label,share,direction:f.direction,groups,observation,implication,available,numeric};
  }).sort((a,b)=>(b.share||0)-(a.share||0));
  const active=cards.filter(c=>c.share===null||c.share>0),max=active[0]?.share,leaders=active.filter(c=>c.share===max);
  const focus=leaders.map(c=>c.label).join(' · ');
  const headline=!active.length?'반영할 변수의 가중치를 하나 이상 올려 주세요.':weighted?leaders.length===active.length?`선택한 ${active.length}개 변수를 같은 비중으로 검토합니다.`:`현재 설정에서는 ${focus}을(를) 가장 중시합니다 (${max}%).`:`선택한 ${active.length}개 변수의 관측을 함께 비교합니다.`;
  const conclusion=leaders.map(c=>`${c.label}: ${c.observation} ${c.implication}.`).join('\n');
  const checks='지원 확정 전에는 이용 대상·안전·실행 가능성·출입구 경로 근거를 확인해야 합니다. 관측 최솟값·최댓값은 지원 순위나 부족 확정이 아닙니다.';
  const alternatives=active.map(c=>({id:c.id,label:c.label,text:`${c.label}을(를) 가장 중시하면 → ${c.observation} ${c.implication}.`}));
  return {headline,conclusion,checks,cards,alternatives,context,weighted};
 }
 function reweight(result,factors){
  const d=JSON.parse(JSON.stringify(result)),byId=new Map(factors.map(f=>[f.id,f])),total=factors.reduce((s,f)=>s+(f.weight||0),0);
  d.review.factors.forEach(f=>{const v=byId.get(f.id);if(v){f.weight=v.weight;f.direction=v.direction;}f.share_percent=total?Math.round((f.weight||0)/total*100000)/1000:null;});
  d.conclusion=build(d.review.factors,d.visual.sections,d.review.context);d.summary=d.conclusion.headline+'\n'+d.conclusion.conclusion+'\n'+d.conclusion.checks;
  d.visual.table={headers:['변수','비중 %','확인된 관측','이 설정에서 할 일'],rows:d.conclusion.cards.map(c=>[c.label,c.share??'동일',c.observation,c.implication])};
  d.visual.chart=null;return d;
 }
 function render(container,d,onAlternative){
  const c=d.conclusion;if(!c)return;
  container.innerHTML='<section class="question-conclusion"><h4>3. 이 설정으로 도출한 답변</h4><p class="conclusion-headline">'+esc(c.headline)+'</p><p class="conclusion-text">'+esc(c.conclusion)+'</p><p class="fine">'+esc(c.checks)+'</p><div class="conclusion-evidence"></div><details class="conclusion-alternatives"><summary>다른 변수를 중시하면 결론이 어떻게 달라질까요?</summary>'+c.alternatives.map(a=>'<p>'+esc(a.text)+'</p><button type="button" data-emphasize="'+esc(a.id)+'">'+esc(a.label)+' 중시해 보기</button>').join('')+'</details></section>';
  const list=container.querySelector('.conclusion-evidence');
  for(const card of c.cards){
   const el=document.createElement('details');el.className='conclusion-variable';el.open=card.share===c.cards[0]?.share;
   el.innerHTML='<summary>'+esc(card.label)+' · '+esc(card.share===null?'동일 비중':card.share+'%')+'</summary><p>'+esc(card.observation)+'</p><p>'+esc(card.implication)+'</p>';
   for(const g of card.groups){
    const item=document.createElement('div');item.className='conclusion-group';
    item.innerHTML='<h5>'+esc(g.title)+'</h5><p class="fine">유효 '+g.n+'건 · 제외 '+g.excluded+'건 · 가로 위치는 실제 관측값입니다. 점을 누르면 해당 학교와 값이 나옵니다.</p>';
    if(g.n){
     const band=document.createElement('div');band.className='conclusion-range';const buckets=new Map();
     // Quantized display coordinates prevent overlapping controls; original values are preserved in the drilldown.
     const slots=typeof window!=='undefined'&&window.innerWidth<700?10:20;
     for(const r of g.rows){const x=g.max===g.min?50:Math.round((r.value-g.min)/(g.max-g.min)*slots)*100/slots;if(!buckets.has(x))buckets.set(x,[]);buckets.get(x).push(r);}
     const detail=document.createElement('div');detail.className='conclusion-members';
     for(const [x,members] of buckets){const b=document.createElement('button');b.type='button';b.className='conclusion-dot';b.style.left=(4+x*.92)+'%';b.setAttribute('aria-label',members.map(m=>m.name+' '+m.value).join(', '));b.title=members.length+'곳 · '+members[0].value;b.textContent=members.length;b.onclick=()=>{detail.innerHTML='<p>'+members.length+'곳 · '+esc(card.label)+'</p><div class="table-scroll"><table><thead><tr><th>학교·대상</th><th>관측값</th></tr></thead><tbody>'+members.map(m=>'<tr><td>'+esc(m.name)+'</td><td>'+esc(m.value)+'</td></tr>').join('')+'</tbody></table></div>';};band.append(b);}
     item.append(band);const labels=document.createElement('div');labels.className='conclusion-axis';labels.innerHTML='<span>최솟값 '+g.min+'</span><span>중앙값 '+g.median+'</span><span>최댓값 '+g.max+'</span>';item.append(labels,detail);
    }el.append(item);
   }list.append(el);
  }
  container.querySelectorAll('[data-emphasize]').forEach(b=>b.onclick=()=>onAlternative?.(b.dataset.emphasize));
 }
 return {build,reweight,render};
});
