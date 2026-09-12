'use strict';
// Shared by the conversational plan and direct questions. School level is a scope, not a topic.
const catalog=require('./_data_catalog');
const compact=s=>String(s||'').toLowerCase().replace(/\s+/g,'');
const spatial=q=>/학구|통학구역|학교\s*구역/.test(q)&&/도보|보행|도달권|500\s*m|500\s*미터/i.test(q)&&/안\s*맞|불일치|겹|중첩|차이|비교|일치/.test(q);
const allScope=q=>/전체|학교별|군.?구별|지역별|상위\s*\d*|하위\s*\d*|top\s*\d+|가장|학교.*\d+\s*(개|곳)/i.test(q);
function resolve(question,datasetId){
 const q=String(question||''),token=compact(q),matches=new Map();
 const add=(id,reason)=>{if(!matches.has(id))matches.set(id,reason);};
 if(spatial(q)){
  add('zones','질문에 지정한 공식 학구도 경계');add('walkshed','질문에 지정한 보행망 500m 도달권');
  return {workflow:'overlap',matches,summary:'학구도와 보행 500m 도달권을 겹쳐 비교합니다. 두 지도는 모두 필요하며 가중치는 필요하지 않습니다.'};
 }
 for(const e of catalog){
  const terms=e.terms.filter(t=>!['학교','보행','도보','경로'].includes(t));
  const term=terms.find(t=>token.includes(compact(t)));
  if(term)add(e.id,`질문의 ‘${term}’에 해당하는 자료`);
 }
 if(/학생|원아|학급|교원|교사/.test(q))add('schools','질문에 나온 학생·학급·교원 관측');
 if(/학교\s*(목록|현황|통계)/.test(q))add('schools','학교 기본 현황 요청');
 if(/연구학교|선도학교/.test(q))add('designations','교육청의 연구·선도학교 지정 명단');
 if(/도서관|장서|독서/.test(q)){
  if(/지원|개선|검토|장서|사서|독서/.test(q))add('books','학교 안 도서관의 장서·사서 관측');
  if(/지원|개선|검토|거리|접근|인근|외부|분포/.test(q))add('library_access','학교 밖 도서관까지의 직선거리 관측');
  if(/목록|시설|개방|운영|이용조건/.test(q)||!matches.size)add('services','도서관 시설과 이용조건');
 }
 if(/도보|보행|도달권|500\s*m권|500\s*미터권/i.test(q)){
  if(/공원/.test(q)&&/경로|거리|우회/.test(q))add('routes','공원까지의 경로를 명시한 질문');
  else if(!/도서관|돌봄|체육|운동|통학\s*경로/.test(q))add('walkshed','학교 주변 보행망 도달 범위');
 }
 if(/등교|하교|통학|교통안전/.test(q)&&!/학구|통학구역/.test(q)){
  add('zones','통학구역을 확인하기 위한 경계 자료');
  if(/안전|위험|인력/.test(q))add('construction','주변 공사 신고 관측 — 통학 위험의 확정값은 아님');
 }
 if(/미래|향후|예측|전망/.test(q)&&/학생|원아|학교/.test(q)){add('forecast','학생 수 예측 요청');add('school_validation','예측값을 해석하기 위한 오차 근거');}
 if(/미래|향후|예측|전망/.test(q)&&/인구/.test(q)&&!/학생|원아/.test(q)){add('regional_forecast','지역 인구 예측 요청');add('validation','인구 예측 모형의 오차 근거');}
 // A menu choice is an explicit selection. A stale choice is cleared by the browser on typing.
 if(datasetId&&catalog.some(e=>e.id===datasetId))add(datasetId,'사용자가 직접 선택한 자료');
 const policy=/지원|투자|예산|우선|정책|개선|배치|선정|추천|의사결정/.test(q);
 const relationship=/상관|회귀|연관|관계/.test(q);
 const ordered=!policy&&/상위|하위|top\s*\d|가장|많은.*학교|적은.*학교|높은.*학교|낮은.*학교|순위/i.test(q);
 const direct=!policy&&(relationship||/목록|명단|보여|지도|현황|몇|얼마|분포|추세|증감|예측|전망|검증|사용법|어떻게\s*사용/.test(q));
 return {workflow:ordered?'ordered':direct?'direct':'factors',matches,summary:ordered?'요청한 관측값을 정렬합니다. 하나의 비교 지표를 선택해 주세요. 가중치는 필요하지 않습니다.':direct?'요청한 자료와 분석 방법으로 바로 확인합니다. 요소별 가중치 설정은 필요하지 않습니다.':'함께 볼 요소를 체크해 주세요. 여러 개를 선택할 수 있고, 중요도를 정하지 않아도 바로 분석할 수 있습니다.'};
}
function relevantFactor(f,q){
 if(!f.field)return true;
 const key=f.field;
 if(f.dataset==='schools')return ({students:/학생|원아/,classes:/학급/,teachers:/교원|교사/,parks:/공원/,green:/녹지/})[key]?.test(q)||false;
 if(f.dataset==='books')return key.startsWith('books.')||/학생/.test(q);
 if(f.dataset==='indicators'&&f.selector){const tokens=['장학금','학비','동아리','방과후','체력'];const topic=tokens.find(t=>q.includes(t))||(/paps/i.test(q)?'체력':null);return !topic||(f.selector.group+' '+f.selector.label).includes(topic);}
 return true;
}
module.exports={resolve,spatial,allScope,relevantFactor};
