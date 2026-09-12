'use strict';
// Single-indicator relative position: every school's value, overall mean/median, district (군·구) means and the
// selected school's rank/percentile. No weights, no composite score. Ties share a rank. Missing values are excluded
// and counted, never treated as zero.
const model=require('./_school_summary'),data=require('./_data_answers');
const finite=Number.isFinite,round=(v,d=1)=>finite(v)?Number(v.toFixed(d)):null;
const LEVELS=['초등학교','중학교','고등학교','유치원'];
const ISLAND=/옹진|강화/;
function latest(s,key){const years=Object.keys(s.observations||{}).sort();for(let i=years.length-1;i>=0;i--){const v=s.observations[years[i]]?.[key];if(finite(v))return {value:v,year:Number(years[i])};}return null;}
function csvById(){const b=data.read({id:'relative-library-csv',file:'data_processed/school_library_access.csv'}),map=new Map();for(const r of b.data){if(map.has(r.학교ID))map.set(r.학교ID,null);else map.set(r.학교ID,r);}return {map,hash:b.hash};}
function jsonBy(file,key='schools'){const b=model.read(file),rows=b.data[key];return {map:new Map((Array.isArray(rows)?rows:Object.entries(rows).map(([id,r])=>({id,...r}))).map(r=>[r.id,r])),hash:b.hash,data:b.data};}
// Each metric: how to read one school, which levels have data, whether a small value is the usual "shortage" reading.
const metrics=[
 {id:'books_per_student',label:'학생당 장서',unit:'권/명',match:/장서|책|도서\s*(보유|권|수)|(보유|권|수)\s*도서/,levels:['초등학교'],file:'data_processed/student_services/priorities.json',shortLow:true,decimals:1,
  read(s,ctx){const r=ctx.priorities.map.get(s.id),c=ctx.library.map.get(s.id);const v=r?.books?.per_student;return finite(v)?{value:v,year:Number(r.books?.year)||null,extra:{'장서 수':c?.matched===1?c.장서수:null,'학생 수(장서 기준)':c?.matched===1?c.학생수:null,'사서':r?.books?.staff??null}}:null;},
  extras:['장서 수','학생 수(장서 기준)','사서'],sources:['data_processed/student_services/priorities.json','data_processed/school_library_access.csv'],
  check:'장서 최신성·대출 수요·희망도서·사서 근무시간을 확인해야 부족 여부와 지원 규모를 정할 수 있습니다.'},
 {id:'books_total',label:'장서 총수',unit:'권',match:/장서\s*(총|총수|합계)|총\s*장서/,levels:['초등학교'],file:'data_processed/school_library_access.csv',shortLow:true,decimals:0,
  read(s,ctx){const c=ctx.library.map.get(s.id);return c?.matched===1&&finite(c.장서수)?{value:c.장서수,year:Number(c.기준일)||null,extra:{'학생 수(장서 기준)':c.학생수,'학생당 장서':c.인당장서수}}:null;},extras:['학생 수(장서 기준)','학생당 장서'],sources:['data_processed/school_library_access.csv'],check:'학생 규모가 다르면 총수만으로 비교할 수 없습니다. 학생당 장서와 함께 보세요.'},
 {id:'library_seats',label:'학교도서관 좌석',unit:'석',match:/좌석/,levels:['초등학교'],file:'data_processed/school_library_access.csv',shortLow:true,decimals:0,
  read(s,ctx){const c=ctx.library.map.get(s.id);return c?.matched===1&&finite(c.좌석수)?{value:c.좌석수,year:Number(c.기준일)||null,extra:{'좌석당 학생':c.좌석당학생수}}:null;},extras:['좌석당 학생'],sources:['data_processed/school_library_access.csv'],check:'혼잡 시간대와 공간 여건을 확인한 뒤 좌석 재배치·이용시간 분산을 검토합니다.'},
 {id:'books_staff',label:'사서 인원',unit:'명',match:/사서/,levels:['초등학교'],file:'data_processed/school_library_access.csv',shortLow:true,decimals:0,
  read(s,ctx){const c=ctx.library.map.get(s.id);return c?.matched===1&&finite(c.사서합계)?{value:c.사서합계,year:Number(c.기준일)||null,extra:{'사서교사':c.사서교사수,'사서직원':c.사서직원수}}:null;},extras:['사서교사','사서직원'],sources:['data_processed/school_library_access.csv'],check:'근무시간·겸임 여부를 확인한 뒤 공동 배치 등을 검토합니다.'},
 {id:'students',label:'학생 수',unit:'명',match:/학생\s*수|재학생|원아\s*수|원아|학생이\s*(많|적)|학생/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:false,decimals:0,read:s=>latest(s,'students'),sources:['data_processed/education/analysis_dataset.json'],check:'학생 수는 규모이며 지원 필요성이 아닙니다. 학생당 지표와 함께 보세요.'},
 {id:'classes',label:'학급 수',unit:'개',match:/학급\s*수|학급이/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:false,decimals:0,read:s=>latest(s,'classes'),sources:['data_processed/education/analysis_dataset.json']},
 {id:'class_size',label:'학급당 학생 수',unit:'명',match:/학급당|과밀|밀집도|학급\s*규모/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:false,decimals:1,read:s=>latest(s,'class_size'),sources:['data_processed/education/analysis_dataset.json'],check:'학급당 학생 수가 크면 공간·인력 여건을 확인합니다.'},
 {id:'teachers',label:'교원 수',unit:'명',match:/교원|교사/,levels:['초등학교','중학교','고등학교'],file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:0,read:s=>latest(s,'teachers'),sources:['data_processed/education/analysis_dataset.json']},
 {id:'students_per_teacher',label:'교원 1인당 학생 수',unit:'명',match:/교원\s*1인당|교사\s*1인당|교원당|교사당/,levels:['초등학교','중학교','고등학교'],file:'data_processed/education/analysis_dataset.json',shortLow:false,decimals:1,read(s){const a=latest(s,'students'),b=latest(s,'teachers');return a&&b&&b.value>0?{value:a.value/b.value,year:a.year}:null;},sources:['data_processed/education/analysis_dataset.json']},
 {id:'paps',label:'PAPS 4·5등급 비율',unit:'%',match:/체력|paps|저체력/i,levels:['초등학교','중학교','고등학교'],file:'data_processed/education/analysis_dataset.json',shortLow:false,decimals:1,read:s=>latest(s,'paps'),sources:['data_processed/education/analysis_dataset.json'],check:'비율이 높을수록 저체력 학생이 많다는 뜻입니다. 측정 학년·인원을 확인하세요.'},
 {id:'afterschool',label:'방과후 참여 학생',unit:'명',match:/방과후/,levels:['초등학교','중학교','고등학교'],file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:0,read:s=>latest(s,'afterschool'),sources:['data_processed/education/analysis_dataset.json']},
 {id:'clubs',label:'자율동아리 참여 학생',unit:'명',match:/동아리/,levels:['초등학교','중학교','고등학교'],file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:0,read:s=>latest(s,'clubs'),sources:['data_processed/education/analysis_dataset.json']},
 {id:'route_distance_m',label:'가장 가까운 공원까지 보행 거리',unit:'m',match:/공원.{0,12}(거리|멀|가까|경로)|(거리|멀|가까).{0,8}공원/,levels:LEVELS,file:'data_processed/education/school_routes.json',shortLow:false,decimals:0,
  read(s,ctx){if(s.level==='초등학교'){const n=ctx.nearest.map.get(s.id);return n&&finite(n.nearest_park_dist_m)?{value:n.nearest_park_dist_m,year:null,extra:{'공원':n.nearest_park_name,'직선거리':null}}:null;}const r=ctx.routes.data[s.id];return r?.status==='available'&&finite(r.route_distance_m)?{value:r.route_distance_m,year:null,extra:{'공원':r.park_name,'직선거리':r.straight_distance_m}}:null;},extras:['공원','직선거리'],sources:['data_processed/education/school_routes.json','data_processed/school_nearest_park.csv'],check:'대표점 기준 보행망 최근접 공원 거리입니다(초등학교는 공공 공원 대상 최근접 거리 원장). 출입구·통행 허용·안전은 별도 확인합니다.'},
 {id:'shared_area_per_student',label:'학생당 공동 이용 공원면적',unit:'㎡/명',match:/공원\s*면적|면적/,levels:LEVELS,file:'data_processed/education/shared_parks.json',shortLow:true,decimals:1,
  read(s,ctx){const r=ctx.shared.map.get(s.id);return r&&finite(r.shared_area_per_student)?{value:r.shared_area_per_student,year:Number(ctx.shared.data.student_year)||null,extra:{'도보권 공원 수':r.park_count,'공유 학교 수':r.sharing_school_count}}:null;},extras:['도보권 공원 수','공유 학교 수'],sources:['data_processed/education/shared_parks.json'],check:'공원 면적을 도보권이 겹치는 학교의 학생 수로 나눈 값입니다. 실제 이용 가능 면적이 아닙니다.'},
 {id:'parks',label:'도보권 공원 수',unit:'곳',match:/공원/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:0,read:s=>finite(s.environment?.parks)?{value:s.environment.parks,year:null}:null,sources:['data_processed/education/analysis_dataset.json'],check:'보행망 500m 도달권 안 공원 대표점 수입니다. 출입구·개방 조건은 별도 확인합니다.'},
 {id:'green',label:'추정 녹지비율',unit:'%',match:/녹지/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:1,read:s=>finite(s.environment?.green)?{value:s.environment.green,year:null}:null,sources:['data_processed/education/analysis_dataset.json']},
 {id:'library_distance_m',label:'공공·어린이도서관 직선거리',unit:'m',match:/도서관.{0,10}(거리|멀|가까)|(거리|멀|가까).{0,8}도서관/,levels:LEVELS,file:'data_processed/education/library_access_preview.json',shortLow:false,decimals:0,
  read(s,ctx){const r=ctx.libraryAccess.map.get(s.id),v=r?.nearest_m?.public_children;return finite(v)?{value:v,year:null,extra:{'작은도서관 포함':r.nearest_m?.including_small}}:null;},extras:['작은도서관 포함'],sources:['data_processed/education/library_access_preview.json'],check:'직선거리이며 도보 경로·개방시간·아동 이용조건은 별도 확인합니다.'},
 {id:'library',label:'도보권 도서관 수',unit:'곳',match:/도서관/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:0,read:s=>finite(s.environment?.library)?{value:s.environment.library,year:null}:null,sources:['data_processed/education/analysis_dataset.json'],check:'대표점 도달권 포함 여부입니다. 실제 출입구 도보 검증이 아닙니다.'},
 {id:'academy',label:'주변 학원 수',unit:'곳',match:/학원|사교육/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:false,decimals:0,read:s=>finite(s.environment?.academy)?{value:s.environment.academy,year:null}:null,sources:['data_processed/education/analysis_dataset.json']},
 {id:'forecast_change_pct',label:'3년 후 예측 학생 수 변화율',unit:'%',match:/(미래|전망|예측|향후).{0,12}(학생|원아)|(학생|원아).{0,12}(미래|전망|예측|향후|감소|증가)/,levels:LEVELS,file:'data_processed/education/analysis_dataset.json',shortLow:true,decimals:1,
  read(s){const now=latest(s,'students'),f=(s.forecast||[]).find(p=>p.horizon===3);return now&&f&&now.value>0?{value:(f.students-now.value)/now.value*100,year:now.year,extra:{'현재 학생 수':now.value,[f.year+'년 예측']:f.students}}:null;},extras:['현재 학생 수','예측 학생 수'],sources:['data_processed/education/analysis_dataset.json'],check:'모형 예측이며 확정 수요가 아닙니다. 주거사업·학구 조정 가능성을 함께 확인합니다.'},
];
const TRIGGER=/부족|모자|적은|적니|적나|적어|많은|많니|많나|낮은|낮니|높은|높니|긴|짧은|먼|멀|가까운|순위|랭킹|상위|하위|top|어떤\s*학교|어느\s*학교|어디|평균|상대|위치|비교|분포|통계|현황|가장|제일|최소|최대|최저|최고|얼마나|어느\s*정도|수준|편차|백분위|등수|몇\s*위|순서/i;
const EXCLUDE=/상관|회귀|연관|관계|목록|명단|지도\s*보여|경로\s*보여|사용법|어떻게\s*사용|추천|종합\s*점수|가중치|시나리오|검증|오차|성능/;
// Policy questions (지원·예산·우선) keep the factor-and-lever review unless they explicitly ask for a rank, extreme or average.
const STRONG=/부족|모자|적은|적니|적나|적어|많은|많니|많나|낮은|낮니|높은|높니|긴|짧은|먼|멀|가까운|순위|랭킹|상위|하위|top|가장|제일|최소|최대|최저|최고|평균|백분위|등수|몇\s*위|분포|통계/i;
const POLICY=/지원|투자|예산|우선|정책|개선|배치|선정|의사결정/;
function detect(q){
 const text=String(q||'');if(!TRIGGER.test(text)||EXCLUDE.test(text))return [];if(POLICY.test(text)&&!STRONG.test(text))return [];
 const found=metrics.filter(m=>m.match.test(text));
 // Specific metrics win over their generic family (e.g. 학생당 장서 over 학생 수, 공원 거리 over 공원 수).
 const ids=new Set(found.map(m=>m.id));
 if(ids.has('books_per_student')||ids.has('books_total')||ids.has('library_seats')||ids.has('books_staff'))for(const id of ['students','library','library_distance_m'])ids.delete(id);
 if(ids.has('students_per_teacher')){ids.delete('students');ids.delete('teachers');}
 if(ids.has('class_size')){ids.delete('students');ids.delete('classes');}
 if(ids.has('route_distance_m')||ids.has('shared_area_per_student'))ids.delete('parks');
 if(ids.has('library_distance_m'))ids.delete('library');
 if(ids.has('forecast_change_pct'))ids.delete('students');
 if(ids.has('shared_area_per_student')&&!/공원/.test(text))ids.delete('shared_area_per_student');
 if(ids.size>1&&ids.has('students')&&!/학생\s*수|재학생|원아/.test(text))ids.delete('students');
 return metrics.filter(m=>ids.has(m.id)).slice(0,3);
}
function direction(q,m){if(/많은|많니|많나|높은|높니|높아|큰|긴|먼|멀|과밀|상위|최대|최고|최장/.test(q))return 'higher';if(/부족|모자|적은|적니|적나|적어|낮은|낮니|낮아|작은|짧은|가까운|하위|최소|최저|최단/.test(q))return 'lower';return m.shortLow?'lower':'higher';}
function context(){return {priorities:jsonBy('data_processed/student_services/priorities.json'),library:csvById(),shared:jsonBy('data_processed/education/shared_parks.json'),libraryAccess:jsonBy('data_processed/education/library_access_preview.json'),routes:{data:model.read('data_processed/education/school_routes.json').data},nearest:(()=>{const b=data.read({id:'relative-nearest-park-csv',file:'data_processed/school_nearest_park.csv'}),map=new Map();for(const r of b.data)map.set(r.학교ID,r);return {map,hash:b.hash};})()};}
function stats(values){const v=values.filter(finite).sort((a,b)=>a-b),n=v.length;if(!n)return {n:0};const mean=v.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/n);return {n,mean,median:(v[(n-1)>>1]+v[n>>1])/2,min:v[0],max:v[n-1],q1:v[Math.floor((n-1)*.25)],q3:v[Math.floor((n-1)*.75)],sd};}
const signed=(v,d)=>finite(v)?(v>0?'+':'')+round(v,d):'—';
function analyze(m,{level,gu,schoolId,dir,limit,ctx}){
 const roster=model.registry().filter(s=>s.level===level);
 const rows=roster.map(s=>{const r=m.read(s,ctx);return {id:s.id,name:s.name,gu:s.gu,lat:s.lat,lng:s.lng,island:ISLAND.test(s.gu||''),value:r?.value??null,year:r?.year??null,extra:r?.extra||{}};});
 const withValue=rows.filter(r=>finite(r.value)),missing=rows.length-withValue.length;
 // Island schools (강화·옹진) are reviewed separately; they never set the mainland mean or ranks.
 const own=schoolId?rows.find(r=>r.id===schoolId):null;
 const track=(gu&&ISLAND.test(gu))||(own?.island&&!gu)?'island':'general';
 const valid=withValue.filter(r=>(track==='island')===r.island),other=withValue.filter(r=>(track==='island')!==r.island);
 if(!valid.length)return null;
 const all=stats(valid.map(r=>r.value)),byGu=new Map();
 for(const r of valid){if(!byGu.has(r.gu))byGu.set(r.gu,[]);byGu.get(r.gu).push(r.value);}
 const guStats=[...byGu].map(([name,vals])=>({name,...stats(vals)})).sort((a,b)=>a.mean-b.mean);
 const guMean=new Map(guStats.map(g=>[g.name,g.mean]));
 const sorted=[...valid].sort((a,b)=>(dir==='lower'?a.value-b.value:b.value-a.value)||a.name.localeCompare(b.name,'ko'));
 let rank=0;sorted.forEach((r,i)=>{if(i===0||r.value!==sorted[i-1].value)rank=i+1;r.rank=rank;r.percentile=round((dir==='lower'?sorted.filter(x=>x.value<=r.value).length:sorted.filter(x=>x.value>=r.value).length)/sorted.length*100,1);r.vs_mean=r.value-all.mean;r.vs_gu=r.value-guMean.get(r.gu);});
 const guRank=new Map();for(const r of sorted){const n=(guRank.get(r.gu)||0)+1;guRank.set(r.gu,n);r.gu_rank=n;r.gu_n=byGu.get(r.gu).length;}
 const cutoff=sorted[Math.min(limit,sorted.length)-1]?.value;
 let listed=sorted.filter((r,i)=>i<limit||r.value===cutoff);if(gu)listed=sorted.filter(r=>r.gu===gu);
 if(own&&finite(own.value)&&!listed.some(r=>r.id===own.id)&&valid.includes(own))listed=[...listed,own];
 const years=[...new Set(valid.map(r=>r.year).filter(Boolean))].sort();
 const otherSorted=[...other].sort((a,b)=>(dir==='lower'?a.value-b.value:b.value-a.value));
 return {rows,valid,missing,all,guStats,sorted,listed,own,years,dir,track,other:otherSorted};
}
function sections(m,a,{level,gu,limit}){
 const d=m.decimals,u=m.unit,dirLabel=a.dir==='lower'?'작은 값부터':'큰 값부터',period=a.years.length?a.years.join('·')+'년 기준':'보유 스냅샷';
 const own=a.own&&finite(a.own.value)?a.own:null;
 const summaryRows=[['유효 학교 수',a.all.n+'개교'],['자료 미확보 학교',a.missing+'개교'],['전체 평균',round(a.all.mean,d)+u],['중앙값',round(a.all.median,d)+u],['최솟값',round(a.all.min,d)+u+' · '+a.sorted.filter(r=>r.value===a.all.min).slice(0,3).map(r=>r.name).join(', ')],['최댓값',round(a.all.max,d)+u+' · '+a.sorted.filter(r=>r.value===a.all.max).slice(0,3).map(r=>r.name).join(', ')],['표준편차',round(a.all.sd,d)+u]];
 if(own)summaryRows.push([own.name+' 관측값',round(own.value,d)+u],['전체 순위 ('+dirLabel+')',a.all.n+'개교 중 '+own.rank+'위 · 백분위 '+own.percentile+'%'],['전체 평균 대비',signed(own.vs_mean,d)+u],[own.gu+' 평균 대비',signed(own.vs_gu,d)+u+' (구 평균 '+round(a.rows.length?a.guStats.find(g=>g.name===own.gu)?.mean:null,d)+u+')'],[own.gu+' 안 순위',own.gu_n+'개교 중 '+own.gu_rank+'위']);
 else if(a.own)summaryRows.push([a.own.name,'이 지표의 유효값 미확보 · 판단 보류']);
 const bins=8,step=(a.all.max-a.all.min)/bins||1,hist=Array.from({length:bins},(_,i)=>({name:round(a.all.min+i*step,d)+'~'+round(a.all.min+(i+1)*step,d),value:0}));for(const r of a.valid)hist[Math.min(bins-1,Math.floor((r.value-a.all.min)/step))].value++;
 const s1={title:m.label+' · '+level+(a.track==='island'?' 도서지역':' 도시지역')+' 요약 · '+period,table:{headers:['항목','값'],rows:summaryRows},chart:{kind:'bar',unit:'개교',title:m.label+' 분포',points:hist},notes:['막대는 값 구간별 학교 수입니다. '+(m.check||'')]};
 const s2={title:m.label+' · 군·구별 평균',table:{headers:['군·구','학교 수','평균','중앙값','최솟값','최댓값','전체 평균 대비'],rows:a.guStats.map(g=>[g.name+(own&&g.name===own.gu?' ★':''),g.n,round(g.mean,d),round(g.median,d),round(g.min,d),round(g.max,d),signed(g.mean-a.all.mean,d)])},chart:{kind:'bar',unit:u,title:'군·구별 평균 · 전체 평균 '+round(a.all.mean,d)+u,points:a.guStats.map(g=>({name:g.name,value:round(g.mean,d),selected:!!own&&g.name===own.gu}))},notes:['평균이 작은 군·구부터 표시합니다. 전체 평균 '+round(a.all.mean,d)+u+'. 강화·옹진군은 도서지역이므로 도시 지역과 분리해 검토합니다.']};
 const extras=m.extras||[];
 const rowOf=r=>[r.rank+'위',r.name+(own&&r.id===own.id?' ★':''),r.gu+(r.island?' (도서)':''),round(r.value,d),...extras.map(k=>r.extra[k]??'미확보'),signed(r.vs_mean,d),signed(r.vs_gu,d),r.percentile+'%',r.gu_n+'개교 중 '+r.gu_rank+'위'];
 const headers=['순위','학교','군·구',m.label+' ('+u+')',...extras,'전체 평균 대비','구 평균 대비','백분위','구 안 순위'];
 const s3={title:m.label+' · 학교별 순위 ('+dirLabel+(gu?' · '+gu:' · 상위 '+limit+'개교')+')',table:{headers,rows:a.listed.map(rowOf)},chart:{kind:'bar',unit:u,title:'학교별 '+m.label,points:a.listed.slice(0,40).map(r=>({name:r.name,value:round(r.value,d),selected:!!own&&r.id===own.id}))},map:a.listed.filter(r=>finite(r.lat)&&finite(r.lng)).map(r=>({name:r.name,lat:r.lat,lng:r.lng,selected:!!own&&r.id===own.id,detail:r.rank+'위 · '+round(r.value,d)+u+' · '+r.gu,value:round(r.value,d)})),notes:['가중치 없는 단일 지표 순위입니다. 동점은 같은 순위이며 백분위는 '+(a.dir==='lower'?'이 값 이하':'이 값 이상')+' 학교 비율입니다. ★는 선택 학교입니다. 지원 확정이나 학교 평가가 아닙니다.']};
 const extraSections=[];if(a.other.length){const label=a.track==='general'?'도서지역(강화·옹진) 별도 검토':'도시지역 학교 참고';extraSections.push({title:m.label+' · '+label,table:{headers:['학교','군·구',m.label+' ('+u+')',...extras],rows:a.other.map(r=>[r.name+(a.own&&r.id===a.own.id?' ★':''),r.gu,round(r.value,d),...extras.map(k=>r.extra[k]??'미확보')])},notes:['도서·농어촌 지역은 이동·운영 여건이 달라 도시 지역과 같은 순위로 비교하지 않습니다. 값만 참고용으로 나열합니다.']});}
 return {sections:[s1,s2,s3,...extraSections],export:{headers,rows:a.sorted.map(rowOf)}};
}
function summarize(m,a,level,gu){
 const d=m.decimals,u=m.unit,own=a.own&&finite(a.own.value)?a.own:null,w=u==='m'?{lower:'가까운',higher:'먼',less:'짧',more:'긺'}:u==='%'?{lower:'낮은',higher:'높은',less:'낮음',more:'높음'}:{lower:'적은',higher:'많은',less:'적음',more:'많음'},dirWord=w[a.dir],delta=v=>!finite(v)?'—':v===0?'같음':Math.abs(round(v,d))+u+' '+(v<0?w.less:w.more);
 const lead=a.sorted.slice(0,5).map(r=>r.name+' '+round(r.value,d)+u).join(', ');
 const lines=[`${level} ${a.rows.length}개교 중 ${a.track==='island'?'도서지역(강화·옹진)':'도시지역'} ${a.all.n}개교(${m.label} 유효값 기준${a.other.length?', '+(a.track==='island'?'도시지역':'도서지역')+' '+a.other.length+'개교는 별도 표시':''})입니다. 전체 평균 ${round(a.all.mean,d)}${u}, 중앙값 ${round(a.all.median,d)}${u}, 범위 ${round(a.all.min,d)}~${round(a.all.max,d)}${u}입니다.`,
  `${m.label} 기준 가장 ${dirWord} 학교: ${lead}${a.sorted.length>5?' 순입니다.':'입니다.'}`,
  `군·구별 평균은 ${a.guStats[0].name} ${round(a.guStats[0].mean,d)}${u}(가장 작음)부터 ${a.guStats.at(-1).name} ${round(a.guStats.at(-1).mean,d)}${u}(가장 큼)까지입니다.`];
 if(gu){const g=a.guStats.find(x=>x.name===gu);if(g)lines.push(`${gu}: ${g.n}개교 평균 ${round(g.mean,d)}${u}, 전체 평균보다 ${delta(g.mean-a.all.mean)}.`);}
 if(own)lines.push(`${own.name}: ${round(own.value,d)}${u}. ${a.all.n}개교 중 ${dirWord} 쪽에서 ${own.rank}위(백분위 ${own.percentile}%)이며 전체 평균보다 ${delta(own.vs_mean)}, ${own.gu} 평균보다 ${delta(own.vs_gu)}입니다. ${own.gu} 안에서는 ${own.gu_n}개교 중 ${own.gu_rank}위입니다.`);
 else if(a.own)lines.push(`${a.own.name}은(는) 이 지표의 유효값이 없어 판단을 보류합니다.`);
 lines.push('가중치 없는 단일 지표의 관측 순위입니다. '+(m.check||'이용·안전·실행 조건은 별도로 확인합니다.'));
 return lines.join('\n');
}
function run(q,p={}){
 const found=p.metric_id?metrics.filter(m=>m.id===p.metric_id):detect(q);if(!found.length)return null;
 const registry=model.registry(),named=[...registry].sort((a,b)=>b.name.length-a.name.length).find(s=>q.includes(s.name)||(s.name.replace(/^인천/,'').length>4&&q.includes(s.name.replace(/^인천/,''))));
 const school=named||(p.school_id&&!/전체|학교별/.test(q)?registry.find(s=>s.id===p.school_id):null)||(p.school_id?registry.find(s=>s.id===p.school_id):null);
 const askedLevel=LEVELS.find(l=>q.includes(l));
 let levels=askedLevel?[askedLevel]:school?[school.level]:p.level==='전체'?LEVELS:[LEVELS.includes(p.level)?p.level:'초등학교'];
 const gu=[...new Set(registry.map(s=>s.gu).filter(Boolean))].sort((a,b)=>b.length-a.length).find(g=>q.includes(g))||null;
 const limit=Math.min(100,Math.max(3,Number(q.match(/(?:상위|하위|top)\s*(\d+)|(\d+)\s*(?:개교|개|곳|위)/i)?.slice(1).find(Boolean))||20));
 const ctx=context(),out=[],notes=[],skipped=[],levelRows=[];let exportTable=null,summary=[],primaryOwn=null;
 for(const m of found)for(const level of levels){
  if(!m.levels.includes(level)){skipped.push(`${m.label}은(는) ${level} 자료를 보유하지 않습니다.`);continue;}
  const a=analyze(m,{level,gu,schoolId:school?.id||null,dir:direction(q,m),limit,ctx});if(!a){skipped.push(`${level} ${m.label} 유효값이 없습니다.`);continue;}
  const s=sections(m,a,{level,gu,limit});out.push(...s.sections);levelRows.push([level+' · '+m.label,a.all.n,a.missing,round(a.all.mean,m.decimals),round(a.all.median,m.decimals),round(a.all.min,m.decimals),round(a.all.max,m.decimals)]);
  if(!exportTable)exportTable={headers:['학교급·지표',...s.export.headers],rows:[]};exportTable.rows.push(...s.export.rows.map(r=>[level+' · '+m.label,...r]));
  summary.push((found.length>1||levels.length>1?'['+m.label+' · '+level+'] ':'')+summarize(m,a,level,gu));if(!primaryOwn&&a.own)primaryOwn=a.own;
 }
 if(!out.length){if(!skipped.length)return null;return {answerable:false,mode:'relative',summary:skipped.join(' ')+' 학교급이나 지표를 바꿔 질문해 주세요.',sources:[],visual:{title:'상대 위치 분석',sections:[],notes:skipped}};}
 const files=[...new Set(found.flatMap(m=>m.sources))];
 const sources=files.map(f=>({id:'relative#'+f.split('/').pop(),title:({'priorities.json':'학교 장서·사서 관측','school_library_access.csv':'학교도서관 현황(장서·좌석·학생 수)','analysis_dataset.json':'학교 공시·환경 관측','school_routes.json':'공원 보행 경로','shared_parks.json':'공원 공동 이용 면적','library_access_preview.json':'도서관 거리 관측'})[f.split('/').pop()]||f,source:f,body:'학교별 값·전체 평균·군·구 평균·순위·백분위를 서버에서 계산했습니다. 결측은 제외하고 개수를 표시합니다.',provenance:[{path:f,sha256:f.endsWith(".csv")?data.read({id:"relative-"+f,file:f}).hash:model.read(f).hash}]}));
 notes.push('같은 학교급·같은 지표끼리만 비교합니다. 가중치나 종합점수는 만들지 않으며 결측은 0으로 채우지 않습니다.',...skipped);
 return {answerable:true,mode:'relative',school_id:school?.id||null,summary:summary.join('\n\n'),sources,relative:{metrics:found.map(m=>m.id),levels,gu,limit,direction:direction(q,found[0])},visual:{title:found.map(m=>m.label).join(' · ')+' 상대 위치 분석',sections:out,notes,table:levelRows.length>1?{headers:['학교급·지표','유효 학교','미확보','평균','중앙값','최솟값','최댓값'],rows:levelRows}:{headers:exportTable.headers.slice(1),rows:exportTable.rows.slice(0,1500).map(r=>r.slice(1))}},export_table:exportTable};
}
module.exports={run,detect,metrics,direction,analyze};
