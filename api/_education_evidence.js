"use strict";
const fs=require('node:fs');
const path=require('node:path');
let data;
let indicatorHistory;
const TOPIC=/학원|교습|예체능|수능|성취|학력|성적|운동부|선수 인원|수상|실적|메달|체육대회|발명|과학전람회|진학|졸업|취업|공시|장학|체력|동아리|방과후|paps/i;
function load(){
  if(!data) {
    try { data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_processed/context/education_school_evidence.json'),'utf8')); }
    catch { return {}; }
  }
  return data;
}
function resolve(context={}){
  const records=load();
  if(context.school_id) return records[String(context.school_id)]||null;
  const matches=Object.values(records).filter(r=>r.school_name===context.school_name);
  return matches.length===1?matches[0]:null;
}
const fmt=v=>v==null?'미확보':String(v);
function requestedYears(question){
  const years=new Set([...question.matchAll(/\b(20\d{2})\b/g)].map(m=>Number(m[1])));
  for(const match of question.matchAll(/(20\d{2})\s*년?\s*(?:~|부터|-)\s*(20\d{2})/g)) {
    const first=Number(match[1]),last=Number(match[2]);
    if(last>=first&&last-first<=30) for(let year=first;year<=last;year++) years.add(year);
  }
  return [...years].sort((a,b)=>a-b);
}
function demandText(row,q){
  const years=requestedYears(q);
  const currentOnly=/현재|지금/.test(q)&&!years.length&&!/미래|예측|전망|prophet|xgboost/i.test(q);
  let text=`현재 학생·원아 ${fmt(row.current_students)}명. `;
  if(!years.length||/주변|연령|거주|인구/.test(q)) text+=`학교 주변 해당 연령 거주인구(현재 배분 추정, 재학생 수·미래 예측 아님): ${JSON.stringify(row.current_age_demand)}. `;
  if(!currentOnly){
    const enrollment={...row.enrollment},regional=row.regional?{...row.regional}:null;
    if(years.length){
      enrollment.history=(enrollment.history||[]).filter(r=>years.includes(r.year));
      enrollment.forecast=(enrollment.forecast||[]).filter(r=>years.includes(r.year));
      if(regional) regional.forecast=(regional.forecast||[]).filter(r=>years.includes(r.year));
      text+=`요청 연도 ${years.join(', ')}만 이력·예측 행을 발췌했다. 해당 연도 행이 없으면 미확보이며 다른 연도로 대체하거나 외삽하지 않는다. `;
    }
    text+=`학교 이력·지원 예측: ${JSON.stringify(enrollment)}. 지역 통계 연결(2025년 경계 기준, 개편 후 구 전체 수치가 아님): ${JSON.stringify(row.statistical_region_2025)}. 지역 연령 예측: ${JSON.stringify(regional)}. 최근 연속 3개년 미만 이력인 기관은 학교별 장기 예측을 만들지 않는다. `;
  }
  return text+'학교 재학생·구군 연령 인구·후보지 시나리오는 서로 다른 모집단이다. 유치원 원아수는 만3·4·5세와 혼합 원아의 합이며 특수학급 수치는 별도 공시로 확인한다.';
}
function contextText(row,q){
  const selected={};
  for(const [key,terms] of [['library',/도서관|독서/],['large_apartment',/아파트|대단지/],['redevelopment',/재개발/],['nightlife',/유흥/],['construction',/공사/]]) {
    if(terms.test(q)) selected[key]=row.context?.[key]??null;
  }
  let text=`질문 분야의 환경 관측(미확보는 null): ${JSON.stringify(selected)}. 도달권 시설 포함은 실제 출입 확인과 다르다. `;
  if(/도서관|독서/.test(q)) text+=`내부 독서 공급: ${JSON.stringify(row.reading_gap)}. 내부 도서관 미공시는 0권이 아니다. `;
  if(/공사/.test(q)) text+='건축행정 기록은 현재 공사 여부가 아니다. ';
  if(/지정|연구학교|선도학교|중점|튜터/.test(q)) text+=`지정사업: ${JSON.stringify(row.designations)}. `;
  return text;
}
function chunk(row,topic,title,text){return {id:`education#${row.school_id}-${topic}`,title:`${row.school_name}: ${title}`,source:'education_public_data',tags:[title,row.school_level],body:`정의: ${row.school_name} (${row.school_level}, ${row.school_id}). ${text}\n\n해석: 서버에 저장된 공개자료 기반 분석이다. 초등 기존 보정값과 확장 학교급의 추정값을 직접 순위화하지 않는다.\n\n출처: data_processed/education 및 학교별 보고서의 공식 출처 링크.`};}
function build(row,question){
  const q=String(question||'');
  const parts=[];
  if(/학원|교습|예체능/.test(q)) parts.push(chunk(row,'academy','학원·교습소',`직선 500m ${fmt(row.academy.straight_500m_count)}개, 보행 도달권 ${fmt(row.academy.walkshed_count)}개 관측. 예체능 관측 ${fmt(row.academy.arts_sports_count)}개. 대상 분류 ${JSON.stringify(row.academy.target_categories||{})}. 학원은 주변 환경 시설이며 학교 분석 대상이 아니다. 좌표 확보 시설만 집계하고 교습과정으로 대상을 분류한다. 학원 수는 학력이나 교육 품질 점수가 아니다.`));
  if(/수능|성취|학력|성적|운동부|선수 인원|수상|실적|메달|체육대회|발명|과학전람회|진학|졸업|취업|공시|장학|체력|동아리|방과후|paps/i.test(q)) {
    let text=/수능|성취|학력|성적/.test(q)?'수능 학교별 점수는 미확보, 학업성취도 개별 공시는 보안문자 요구로 미수집이다. 미수집을 성적 0 또는 학력 저하로 해석하지 않는다.':'';
    if(/운동부|선수 인원/.test(q)) {
      const years=requestedYears(q), athletics=row.athletics||{};
      const observations=(athletics.observations||[]).filter(o=>!years.length||years.includes(Number(o.posted_date.slice(0,4))));
      text+=` 운동부 공개 게시 기록이며 현재 선수 총수·실적 점수가 아니다. ${observations.length}건 중 최근 최대 6건: ${JSON.stringify(observations.slice(0,6))}. ${athletics.coverage||'연결 자료 미확보'}`;
    }
    if(/진학|졸업|취업/.test(q)) {
      const years=requestedYears(q),progression=row.progression||{};
      const observations=(progression.observations||[]).filter(o=>!years.length||years.includes(o.year));
      text+=` 졸업 후 진로 관측: ${JSON.stringify(observations)}. ${progression.scope||'연결 자료 미확보'}. ${(progression.limitations||[]).join(' ')} 요청 연도 자료가 없으면 다른 연도로 대체하지 않는다. pending_publication은 미공개이며 0명이 아니다.`;
    }
    if(/수상|실적|메달|체육대회|발명|과학전람회/.test(q)) {
      const years=requestedYears(q);
      const events=['발명','과학전람회','체육대회'].filter(term=>q.includes(term));
      if(/메달/.test(q)&&!events.includes('체육대회')) events.push('체육대회');
      const related=row.awards.filter(r=>(!events.length||events.some(term=>r.event.includes(term)))&&(!years.length||years.includes(r.year)));
      text+=` 요청 범위: ${years.length?years.join(', ')+'년':'수집한 전체 연도'} · ${events.length?events.join(', '):'수집한 대회'}. 이 범위에 해당하는 이 학교의 확인 기록 ${related.length}건 중 최근 최대 6건: ${JSON.stringify([...related].sort((a,b)=>b.year-a.year).slice(0,6))}. 기록이 없으면 수집 범위에서 미확보이며 수상 없음이라는 뜻이 아니다. 다른 연도·대회의 실적으로 대체하지 않는다. ${row.award_coverage} 웹·보도자료·PDF 기록은 중복될 수 있어 합산하지 않는다. 학교단체상과 학생 작품 수상은 별도이며 확인 기록 수를 작품 수나 수상자 수로 바꾸지 않는다. 전체 기록은 학교별 보고서에서 확인한다.`;
    }
    if(/공시|장학|체력|동아리|방과후|paps/i.test(q)) {
      const years=requestedYears(q);
      const terms=['장학','체력','동아리','방과후'].filter(term=>q.includes(term));
      if(/paps/i.test(q)) terms.push('체력');
      let groups=row.public_indicators||[];
      if(years.length) {
        if(!indicatorHistory) {
          try { indicatorHistory=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_processed/education/school_public_indicators.json'),'utf8')).schools; }
          catch { indicatorHistory={}; }
        }
        groups=indicatorHistory[row.school_id]||[];
      }
      const indicators=groups.filter(g=>!terms.length||terms.some(term=>g.title.includes(term))).map(g=>({...g,observations:years.length?g.observations.filter(o=>years.includes(o.publication_year)):g.observations.slice(-1)}));
      text+=indicators.map(g=>g.observations.length?g.observations.map(o=>{const metrics=g.item==='90'?o.metrics.filter(m=>['derived_grade45_pct','RATE_SUM'].includes(m.field)):o.metrics.slice(0,2);return `${g.title} ${o.publication_year}년 공시: ${metrics.map(m=>`${m.label} ${m.value==null?'미확보':Number(m.value.toFixed(2))+m.unit}`).join(', ')||'공시 제외 또는 수치 미확보'}.`;}).join(' '):`${g.title}: 요청 범위 공시 미확보.`).join(' ');
      if(years.length) text+=` 요청 공시연도 ${years.join(', ')}. 해당 연도 자료가 없으면 다른 연도로 대체하지 않는다.`;
      text+=' 체력 수치는 공개 평가행 기준으로 전교생 비율이 아니다. 학교 종합 순위·인과 효과가 아니다.';
      text+=` ${years.length?'요청 공시연도':'최신 공시연도'} 활동·지원·체력 지표: ${JSON.stringify(indicators)}. 공시연도와 실제 평가기간을 혼동하지 않는다. PAPS 비율은 공개 평가행의 인원 합계 기준이며 전교생 비율이 아니다. 지표 간 참여 인원을 합산하거나 교육 품질·야외환경의 인과 효과로 해석하지 않는다.`;
      const titles=row.disclosure_titles.filter(title=>(!years.length||years.includes(Number(title.slice(0,4))))&&(!terms.length||terms.some(term=>title.includes(term))));
      text+=` 관련 공시 목록 ${titles.length}종 중 최대 12종: ${titles.slice(-12).join('; ')}. 세부 수치는 학교별 보고서에서 확인하며 이 근거에 없는 수치를 만들지 않는다.`;
    }
    parts.push(chunk(row,'performance','학교 공개 공시·성과',text));
  }
  if(/미래|예측|수요|인구|전망|학생수|원아|prophet|xgboost/i.test(q)) parts.push(chunk(row,'demand','현재·미래 수요',demandText(row,q)));
  if(/유사|knn|비교군|벤치마크/i.test(q)) parts.push(chunk(row,'similar','동일 학교급 유사학교',`${row.knn_basis||'유사학교 입력 미확보'}. ${JSON.stringify(row.similar_schools)}. 유사도는 학교 실력·성과 순위가 아니다.`));
  if(/후보|격자|추천|가중치|파레토|shap/i.test(q)) parts.push(chunk(row,'candidate','후보지 비교',`학교 1.5km 이내 학교급 확장 250m 탐색 격자 전체의 비교 설정: ${JSON.stringify(row.candidate_comparison)}. 기본 가중 점수 상위 최대 5개 예시(전체 후보는 학교별 보고서): ${JSON.stringify(row.candidates.slice(0,5))}. 점수는 거리·공원 부족·해당 연령 추정수요의 가중 기여도 합이다. 파레토와 66개 가중치 조합의 상위5 진입 비율은 비교 지원 신호이며 선정 확률·성능이 아니다. SHAP 학습모형이 아닌 직접 계산한 기여도이다. age_demand는 2024년 해당 학교급 연령의 주변 직선 500m 배분 추정이며 실제 이용자·신규 수혜 아님. 지역비례 미래 시나리오는 선택 학교 구·군 성장률 적용 가정이며 후보지 공간 분포 예측이 아니다. 토지 적합성은 미확인이다.`));
  if(/도보|보행|우회|접근|횡단|출입|도로|간선|내부 통행|투과|주거 구역/.test(q)) {
    const labels={motorway:'고속도로급',trunk:'도시 간선도로급',primary:'주요 간선',secondary:'중간급 간선',tertiary:'지구 내 간선',other:'기타 도로·보행로',unknown:'태그 미확보'};
    const {residential_scenario:scenario,...observedRoute}=row.route||{};
    const scenarioAsked=/내부 통행|투과|주거 구역/.test(q);
    if(scenarioAsked) {
      parts.push(chunk(row,'access','주거 구역 통행 가정',scenario ? `내부 통행 가능 가정이며 실제 접근성 판정이 아니다. 추가 면적 ${scenario.added_area_m2}㎡. 현재 ${scenario.baseline.area_m2}㎡ → 가정 ${scenario.scenario.area_m2}㎡, 공원 면적 비율 ${scenario.baseline.park_proxy_ratio_pct}% → ${scenario.scenario.park_proxy_ratio_pct}%. ${scenario.limitations}` : '주거 구역 통행 가정 자료 미확보.'));
    }
    const exposure=row.route?.road_exposure;
    const roadSummary=exposure ? `도로 유형별 경로 지표이며 실제 횡단 횟수·안전 판정이 아니다. ${Object.entries(exposure.groups).filter(([,v])=>v.segments>0).map(([k,v])=>`${labels[k]} ${v.length_m}m(${v.segments}구간)`).join(', ') || '보행망 간선 이동 없음; 양끝 연결선 제외'}. ` : '';
    if(!scenarioAsked) parts.push(chunk(row,'access','접근 마찰',`${roadSummary}${row.route?.status==='available' ? `${row.route.park_name} 대표점까지 ${row.route.route_distance_m}m, 직선 대비 ${row.route.detour_ratio}배.` : '유효 경로 미확보.'} ${JSON.stringify(observedRoute)}. 학교와 공원 대표점 간 경로이며 실제 출입구·통행 허용·횡단 안전을 검증한 경로가 아니다.`));
  }
  if(/유흥|공사|도서관|독서|재개발|아파트|대단지|지정|연구학교|선도학교|중점|튜터/.test(q)) parts.push(chunk(row,'context','주변 시설·내부 독서 공급',contextText(row,q)));
  if(!parts.length || /공원|녹지|격차|case|케이스|분류|정책|예산|부지/i.test(q)) parts.push(chunk(row,'current','현재 환경 격차',`도달권 공원 ${fmt(row.park_count)}개, 공개 공원면적 대체경계 기반 추정 비율 ${fmt(row.green_ratio)}%, 검토 분류 ${fmt(row.case_type)} (${fmt(row.case_label)}). v3 보행망 500m 도달권과 1%·5% 경계값을 사용한 검토용 분류이며 실제 녹피율이 아니다. 정책은 예산·부지·접근성 12개 조건 조합을 사람이 조정하며 자동 설치·예산 배정 결정을 하지 않는다.`));
  return parts.slice(0,3);
}
module.exports={resolve,build,isTopic:q=>TOPIC.test(String(q||''))};
