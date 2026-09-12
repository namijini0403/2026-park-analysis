'use strict';
const crypto=require('node:crypto');
function select(q,u){
 if(u?.kind!=='document'||typeof u.name!=='string'||u.name.length>200||!Array.isArray(u.parts)||!u.parts.length||u.parts.length>1200||Buffer.byteLength(JSON.stringify(u))>800000)throw Error('문서 첨부 형식·크기를 확인해 주세요.');
 if(u.parts.some(p=>typeof p.text!=='string'||p.text.length>2000||typeof p.location!=='string'||p.location.length>160))throw Error('문서 본문·위치 정보를 확인해 주세요.');
 const terms=[...new Set(String(q).match(/[가-힣a-zA-Z0-9]{2,}/g)||[])],words=[...terms,...String(q).matchAll(/도서|장서|사서|공원|녹지|학생|예산|안전|돌봄|통학|수요|입주|개방|대기/g)].map(x=>Array.isArray(x)?x[0]:x);
 const scored=u.parts.map((p,i)=>({...p,i,score:words.reduce((n,t)=>n+(p.text.includes(t)?t.length:0),0)})).sort((a,b)=>b.score-a.score||a.i-b.i),summary=/요약|정리|내용|읽어/.test(q);
 const chosen=scored.filter(p=>p.score>0).slice(0,4);if(!chosen.length&&summary)chosen.push(...scored.slice(0,4));
 const hash=crypto.createHash('sha256').update(JSON.stringify(u.parts)).digest('hex');
 return chosen.map(p=>({id:'user-document#'+(p.i+1),title:u.name+' · '+p.location,source:'사용자 첨부 / '+u.name+' / '+p.location,body:p.text,attachment:{name:u.name,location:p.location,original_sha256:/^[a-f0-9]{64}$/.test(u.sha256||'')?u.sha256:null,text_sha256:hash,imported_at:u.imported_at||null,verified:false}}));
}
async function run(q,u){const sources=select(q,u),notice='사용자 첨부 문서의 발췌입니다. 기관 검증·안전 확인을 대신하지 않으며 수치 연결은 원본 표와 기준연도를 확인해야 합니다.';if(!sources.length)return {mode:'document_evidence',answerable:false,summary:'첨부 문서에서 질문과 맞는 문단을 찾지 못했습니다. 문서 안의 용어로 구체화하거나 문서 요약을 요청해 주세요.',sources:[],evidence:[]};const d=await require('./ai-explainer-v2').answerEvidence(q,sources);return {...d,mode:'document_evidence',summary:d.summary+'\n'+notice,sources,visual:{title:'첨부 문서에서 찾은 근거',table:{headers:['파일·위치','질문 관련 발췌'],rows:sources.map(s=>[s.title,s.body])},notes:[notice,'질문과 일치하는 문단 최대 4개만 해석에 사용합니다. 전체 문서를 읽은 결론이 아닙니다.']}};}
module.exports={select,run};
