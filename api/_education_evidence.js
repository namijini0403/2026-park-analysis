"use strict";
const fs=require('node:fs');
const path=require('node:path');
let data;
const TOPIC=/학원|교습|예체능|수능|성취|학력|성적|수상|실적|공시|장학|체력|동아리|paps/i;
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
function chunk(row,topic,title,text){return {id:`education#${row.school_id}-${topic}`,title:`${row.school_name}: ${title}`,source:'education_public_data',tags:[title,row.school_level],body:`정의: ${row.school_name} (${row.school_level}, ${row.school_id}). ${text}\n\n해석: 서버에 저장된 공개자료 기반 분석이다. 초등 기존 보정값과 확장 학교급의 추정값을 직접 순위화하지 않는다.\n\n출처: data_processed/education 및 학교별 보고서의 공식 출처 링크.`};}
function build(row,question){
  const q=String(question||'');
  const parts=[];
  if(/학원|교습|예체능/.test(q)) parts.push(chunk(row,'academy','학원·교습소',`직선 500m ${fmt(row.academy.straight_500m_count)}개, 보행 도달권 ${fmt(row.academy.walkshed_count)}개 관측. 예체능 관측 ${fmt(row.academy.arts_sports_count)}개. 대상 분류 ${JSON.stringify(row.academy.target_categories||{})}. 학원은 주변 환경 시설이며 학교 분석 대상이 아니다. 좌표 확보 시설만 집계하고 교습과정으로 대상을 분류한다. 학원 수는 학력이나 교육 품질 점수가 아니다.`));
  if(/수능|성취|학력|성적|수상|실적|공시|장학|체력|동아리|paps/i.test(q)) {
    let text='수능 학교별 점수는 미확보, 학업성취도 개별 공시는 보안문자 요구로 미수집이다. 미수집을 성적 0 또는 학력 저하로 해석하지 않는다.';
    if(/수상|실적/.test(q)) text+=` ${row.award_coverage} 이 학교 확인 기록 ${row.awards.length}건 중 최근 최대 6건: ${JSON.stringify([...row.awards].sort((a,b)=>b.year-a.year).slice(0,6))}. 웹·보도자료·PDF 기록은 중복될 수 있어 합산하지 않는다. 전체 기록은 학교별 보고서에서 확인한다.`;
    if(/공시|장학|체력|동아리|paps/i.test(q)) {
      const terms=['장학','체력','동아리'].filter(term=>q.includes(term));
      if(/paps/i.test(q)) terms.push('체력');
      const titles=row.disclosure_titles.filter(title=>!terms.length||terms.some(term=>title.includes(term)));
      text+=` 관련 공시 목록 ${titles.length}종 중 최대 12종: ${titles.slice(-12).join('; ')}. 세부 수치는 학교별 보고서에서 확인하며 이 근거에 없는 수치를 만들지 않는다.`;
    }
    parts.push(chunk(row,'performance','학교 공개 공시·성과',text));
  }
  if(/미래|예측|수요|인구|전망|학생수|원아|prophet|xgboost/i.test(q)) parts.push(chunk(row,'demand','현재·미래 수요',`현재 학생·원아 ${fmt(row.current_students)}명. 학교 이력·지원 예측: ${JSON.stringify(row.enrollment)}. 지역 연령 예측: ${JSON.stringify(row.regional)}. 학교 재학생·구군 연령 인구·후보지 시나리오는 서로 다른 모집단이다. 최근 연속 3개년 미만 이력인 기관은 학교별 장기 예측을 만들지 않으며 구·군 연령 인구 예측과 구분한다. 유치원 원아수는 만3·4·5세와 혼합 원아의 합이며 특수학급 수치는 별도 공시로 확인한다.`));
  if(/유사|knn|비교군|벤치마크/i.test(q)) parts.push(chunk(row,'similar','동일 학교급 유사학교',`${row.knn_basis||'유사학교 입력 미확보'}. ${JSON.stringify(row.similar_schools)}. 유사도는 학교 실력·성과 순위가 아니다.`));
  if(/후보|격자|추천|가중치|파레토|shap/i.test(q)) parts.push(chunk(row,'candidate','후보지 비교',`학교 1.5km 이내 학교급 확장 250m 탐색 격자 전체의 비교 설정: ${JSON.stringify(row.candidate_comparison)}. 기본 가중 점수 상위 최대 5개 예시(전체 후보는 학교별 보고서): ${JSON.stringify(row.candidates.slice(0,5))}. 점수는 거리·공원 부족·해당 연령 추정수요의 가중 기여도 합이다. 파레토와 66개 가중치 조합의 상위5 진입 비율은 비교 지원 신호이며 선정 확률·성능이 아니다. SHAP 학습모형이 아닌 직접 계산한 기여도이다. age_demand는 2024년 해당 학교급 연령의 주변 직선 500m 배분 추정이며 실제 이용자·신규 수혜 아님. 지역비례 미래 시나리오는 선택 학교 구·군 성장률 적용 가정이며 후보지 공간 분포 예측이 아니다. 토지 적합성은 미확인이다.`));
  if(/도보|보행|우회|접근|횡단|출입/.test(q)) parts.push(chunk(row,'access','접근 마찰',`${JSON.stringify(row.route)}. 학교와 공원 대표점 간 경로이며 실제 출입구·통행 허용·횡단 안전을 검증한 경로가 아니다.`));
  if(/유흥|공사|도서관|독서|재개발|아파트|대단지|지정|연구학교|선도학교|중점|튜터/.test(q)) parts.push(chunk(row,'context','주변 시설·내부 독서 공급',`환경 관측: ${JSON.stringify(row.context)}. 내부 독서 공급: ${JSON.stringify(row.reading_gap)}. 지정사업: ${JSON.stringify(row.designations)}. 건축행정 기록은 현재 공사 여부가 아니며 도달권 시설 포함은 실제 출입 확인과 다르다. 내부 도서관 미공시는 0권이 아니다.`));
  if(!parts.length || /공원|녹지|격차|case|케이스|분류|정책|예산|부지/i.test(q)) parts.push(chunk(row,'current','현재 환경 격차',`도달권 공원 ${fmt(row.park_count)}개, 공개 공원면적 대체경계 기반 추정 비율 ${fmt(row.green_ratio)}%, 검토 분류 ${fmt(row.case_type)} (${fmt(row.case_label)}). v3 보행망 500m 도달권과 1%·5% 경계값을 사용한 검토용 분류이며 실제 녹피율이 아니다. 정책은 예산·부지·접근성 12개 조건 조합을 사람이 조정하며 자동 설치·예산 배정 결정을 하지 않는다.`));
  return parts.slice(0,3);
}
module.exports={resolve,build,isTopic:q=>TOPIC.test(String(q||''))};
