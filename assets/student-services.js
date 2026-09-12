'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'미확보':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1});
const table=(heads,rows)=>`<table><thead><tr>${heads.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const sourceLink=f=>/^https:\/\/(www\.)?(ice\.go\.kr|incheon\.go\.kr|data\.go\.kr|sports\.imfm\.or\.kr|ic-sports\.or\.kr|eshare\.go\.kr)\//.test(f.source_url)?`<a href="${esc(f.source_url)}" target="_blank" rel="noreferrer">공식 출처</a>`:'출처 확인';
let data,selected;
function verified(v){return ['use','safety','execution','route'].every(k=>v.verification?.[k]==='verified'&&v.evidence?.[k]?.source_url)&&v.comparison_eligible===true;}
function compareCandidates(rows,k,preference){
 const valid=rows.filter(c=>verified(c.layers[k]));
 if(!preference)return valid.sort((a,b)=>a.id.localeCompare(b.id));
 return valid.filter(c=>Number.isFinite(c.layers[k].verified_metrics?.[preference])).sort((a,b)=>{const d=a.layers[k].verified_metrics[preference]-b.layers[k].verified_metrics[preference];return (preference==='route_m'?d:-d)||a.id.localeCompare(b.id);});
}
function renderSchools(){
 const q=$('search').value.trim(),ss=data.schools.filter(s=>s.name.includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 if(!ss.some(s=>s.id===selected))selected=ss[0]?.id;
 $('schools').innerHTML=ss.map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.name)}${s.separate_track?' · 도서지역':''}</option>`).join('');
 $('school-count').textContent=`${ss.length}개 학교 · 가나다순 · 지원 순위가 아닙니다.`;render();
}
function render(){
 const s=data.schools.find(s=>s.id===selected),k=$('kind').value;
 if(!s){$('detail').innerHTML='<p>일치하는 학교가 없습니다.</p>';}else{
 const l=s.layers[k],a=l.access,near=data.facilities.filter(f=>(a.facility_ids||[]).includes(f.id));
 const facts=k==='books'?`학생당 장서 <b>${num(s.books.per_student)}권</b><br>사서 <b>${num(s.books.staff)}명</b><p class="muted">원자료 기준 ${esc(s.books.year||'미확보')}</p>`:`지도 도달권 안 <b>${num(a.network_count)}곳 관측</b><p class="muted">시설 대표점 기준이며 실제 출입구 경로 확인은 필요합니다.</p>`;
 $('detail').innerHTML=`<h2>${esc(s.name)}</h2><p><span class="status">판단 보류</span> ${s.separate_track?'도서지역은 별도로 검토합니다.':'지금 자료만으로 지원 우선순위를 정하지 않습니다.'}</p><div class="steps"><article><h3>1. 확인된 사실</h3>${facts}<p>재학생 ${num(s.students)}명 <span class="muted">(${esc(s.student_year||'연도 미확보')})</span></p></article><article><h3>2. 더 확인할 조건</h3>${l.reasons.map(r=>`<p>${esc(r)}</p>`).join('')}</article><article><h3>3. 함께 검토할 방법</h3>${l.alternatives.map(o=>`<p><b>${esc(o.name)}</b><br><span class="muted">조건: ${esc(o.condition)}</span></p>`).join('')}<p class="muted">나열 순서는 우선순위가 아닙니다.</p></article></div>${near.length?`<details><summary>주변에서 관측된 시설 ${near.length}곳</summary>${facilityTable(near)}</details>`:''}<details><summary>미래 학생 수 참고</summary><p>2029년 ${num(s.future.students)}명 예상</p><p class="muted">${esc(s.future.note)}</p></details>`;
 }
 showFacilities();showCandidates();
}
function showFacilities(){const k=$('kind').value==='books'?'library':$('kind').value,q=$('facility-search').value.trim(),fs=data.facilities.filter(f=>f.kind===k&&(f.name+' '+(f.address||'')).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 $('coverage').textContent=k==='sports'?'무료·무신청 이용 안내가 확인된 25곳입니다. 모두 부평구에 있으며, 다른 지역에 시설이 없다는 뜻은 아닙니다.':'수집된 기관 목록입니다. 개방조건·이용자격·정원은 별도 확인이 필요합니다.';
 $('facilities').innerHTML=fs.length?facilityTable(fs):'<p>검색 결과가 없습니다.</p>';
}
function showCandidates(){const k=$('kind').value,p=$('preference').value;if(k==='books'){$('comparison-note').textContent='학교 장서는 설치 지점 순위로 비교하지 않습니다.';$('candidates').innerHTML='';return;}
 const linked=data.candidates.filter(c=>c.school_ids.includes(selected));const compared=compareCandidates(linked,k,p);const only=$('verified-only').checked;
 const rows=p||only?compared:linked.sort((a,b)=>a.id.localeCompare(b.id));
 $('comparison-note').textContent=p?`선택 기준에 따른 조건부 비교: ${compared.length}개. 조건 미확인 대안은 순위에서 제외합니다. 현재 검증된 대안이 없으면 순위를 만들지 않습니다.`:`순위 없이 ${rows.length}개 조사 지점을 표시합니다. 이용·안전·실행·경로 조건을 모두 확인한 뒤 비교할 수 있습니다.`;
 $('candidates').innerHTML=rows.length?table(['조사 지점','확인 상태',...(p?['선택 기준값']:[])],rows.slice(0,100).map(c=>[esc(c.id),verified(c.layers[k])?'조건 확인':'판단 보류 · 이용/안전/실행/경로 미확인',...(p?[num(c.layers[k].verified_metrics[p])+(p==='route_m'?' m':'명')]:[])])):'<p>비교 가능한 대안이 아직 없습니다. 먼저 이용조건·경로·부지 근거를 확보해야 합니다.</p>';
}
function facilityTable(fs){return table(['시설·유형','주소','위치','이용조건·프로그램','근거'],fs.map(f=>{const p=f.program_evidence;return [`${esc(f.name)}<br><span class="muted">${esc(f.subtype)}</span>`,esc(f.address||'기존 도서관 좌표자료'),f.latitude==null?'좌표 미확보':`${f.latitude.toFixed(6)}, ${f.longitude.toFixed(6)}`,esc(f.eligibility_note)+(f.walkin_access?`<details><summary>무신청 이용 근거</summary><p>${esc(f.walkin_access.specific_notice)}</p><p>${esc(f.walkin_access.hours)}</p><p>확인 ${esc(f.walkin_access.checked_at.slice(0,10))}</p></details>`:'')+(p?`<details><summary>게시된 어린이 프로그램</summary><p>${esc(p.audience)}${p.minimum_age?` · 만 ${p.minimum_age}세 이상`:''}</p><p>${(p.time_slots||[]).map(esc).join(' / ')} ${(p.days||[]).map(esc).join(' / ')}</p><p>반별 정원 ${num(p.class_capacity)}명 · 현재 빈자리 미확보</p><p>월 요금: ${Object.entries(p.monthly_fee_krw).map(([key,v])=>`${esc(({resident_3_days:'관내 주3회',resident_2_days:'관내 주2회',nonresident_3_days:'관외 주3회',nonresident_2_days:'관외 주2회',children_3_days:'어린이 주3회',children_2_days:'어린이 주2회'})[key])} ${num(v)}원`).join(' / ')}</p><p>${sourceLink(p)} · 수집 ${esc(p.retrieved_at.slice(0,10))}</p></details>`:''),sourceLink(f)]}));}

async function start(){try{const r=await fetch('../data_processed/student_services/priorities.json');if(!r.ok)throw Error('자료를 불러오지 못했습니다.');data=await r.json();if(data.schema_version!==2)throw Error('새 관측 자료가 준비되지 않았습니다. 잠시 후 다시 열어주세요.');
 $('method').innerHTML=`<ul>${data.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>이용·안전·실행 조건은 점수로 상쇄하지 않습니다. 비교 기준은 사용자가 선택하며, 확인되지 않은 대안은 순위에서 제외합니다.</p><details><summary>출처·수집 시각</summary>${table(['출처','수집 시각'],Object.entries(data.sources).map(([k,v])=>[esc(k),esc(v.retrieved_at)]))}</details>`;
 $('search').addEventListener('input',renderSchools);$('schools').addEventListener('change',()=>{selected=$('schools').value;render();});$('kind').addEventListener('change',()=>{$('preference').value='';render();});$('facility-search').addEventListener('input',showFacilities);$('preference').addEventListener('change',showCandidates);$('verified-only').addEventListener('change',showCandidates);
 $('export').addEventListener('click',()=>{const k=$('kind').value;const out={schema_version:2,school:data.schools.find(s=>s.id===selected),kind:k,preference:$('preference').value||null,compared_candidates:k==='books'?[]:compareCandidates(data.candidates.filter(c=>c.school_ids.includes(selected)),k,$('preference').value).map(c=>c.id),input_hashes:data.input_hashes,limitations:data.limitations};const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='student-service-observations.json';a.click();URL.revokeObjectURL(url);});renderSchools();
 }catch(e){$('error').textContent=e.message;$('export').disabled=true;}}
start();
