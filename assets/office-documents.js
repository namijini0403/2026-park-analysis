(()=>{
  const $=id=>document.getElementById(id);let doc=null,result=null;
  const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('token').value=localStorage.getItem('update_center_token')||'';
  async function api(action,body){const r=await fetch('/api/update-center/documents/'+action,{method:'POST',headers:{'Content-Type':'application/json','x-update-center-token':$('token').value},body:JSON.stringify(body)});const data=await r.json();if(!r.ok||data.error)throw Error(data.error||`HTTP ${r.status}`);return data;}
  async function busy(button,fn){button.disabled=true;$('status').textContent='처리 중입니다…';try{await fn();}catch(error){$('status').textContent=error.message;}finally{button.disabled=false;}}
  function columns(){const table=doc.tables[Number($('table').value)],row=table?.preview[Number($('header').value)-1]||[];
    for(const id of ['schoolColumn','valueColumn'])$(id).innerHTML=row.map((v,i)=>`<option value="${i}">${i+1}. ${e(v||'빈 머리글')}</option>`).join('');
    const school=row.findIndex(v=>/학교ID|학교명|기관명|school_id|school_name|유치원명/i.test(v));$('schoolColumn').value=String(Math.max(0,school));$('valueColumn').value=String(school===1?0:1);
    $('preview').innerHTML=table?`<p>${e(table.name)} · ${table.row_count}행 (앞 8행 미리보기)</p><table>${table.preview.map(r=>'<tr>'+r.map(v=>`<td>${e(v)}</td>`).join('')+'</tr>').join('')}</table>`:`<pre>${e(doc.paragraph_preview.join('\n'))}</pre>`;
  }
  $('upload').onclick=()=>busy($('upload'),async()=>{
    const file=$('file').files[0];if(!file)throw Error('파일을 선택하세요.');if(file.size>15*1024*1024)throw Error('15MB 이하 파일을 선택하세요.');
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
    doc=await api('import',{name:file.name,base64});$('mapping').hidden=false;$('resultSection').hidden=true;
    $('docInfo').textContent=`${doc.name} · 표 ${doc.tables.length}개 · 본문 ${doc.paragraph_count}개`;
    $('table').innerHTML=doc.tables.map(t=>`<option value="${t.index}">${e(t.name)}</option>`).join('');
    $('compare').innerHTML=Object.entries(doc.fields).map(([key,label])=>`<option value="${key}">${e(label[0])}</option>`).join('');
    $('compare').value='parks';$('mode').value=doc.tables.length?'table':'evidence';columns();$('status').textContent=doc.warnings.join('\n')||'문서를 읽었습니다. 연결 조건을 확인하세요.';
  });
  $('table').onchange=columns;$('header').onchange=columns;
  $('analyze').onclick=()=>busy($('analyze'),async()=>{
    result=await api('analyze',{document_id:doc.id,mode:$('mode').value,level:$('level').value,year:Number($('year').value),table_index:Number($('table').value),header_row:Number($('header').value)-1,school_column:Number($('schoolColumn').value),value_column:Number($('valueColumn').value),unit:$('unit').value,compare_field:$('compare').value});
    $('resultSection').hidden=false;$('summary').textContent=result.summary;$('chart').replaceChildren();
    const points=result.chart?.points;
    if(points?.length&&result.chart.kind==='scatter'){
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      $('chart').innerHTML=`<svg viewBox="0 0 650 350" role="img" aria-label="교육청 수치와 기존 지표 산점도"><path d="M60 20V300H630" fill="none" stroke="#64748b"/>${points.map(p=>`<circle cx="${60+(p.x-xmin)/(xmax-xmin||1)*555}" cy="${290-(p.y-ymin)/(ymax-ymin||1)*260}" r="4" fill="#0f766e"><title>${e(p.name)}: ${p.x}, ${p.y}</title></circle>`).join('')}<text x="70" y="325">${e(result.chart.x.join(' · '))} (${xmin}–${xmax})</text><text x="65" y="16">${e(result.chart.y.join(' · '))} (${ymin}–${ymax})</text></svg>`;
    }
    $('result').innerHTML=(result.join?`<p>수치 연결 ${result.join.matched_numeric}곳 · 확인/제외 ${result.join.issue_count}건 · 비교 표본 ${result.metrics?.n??'부족'}</p><details><summary>연결·제외 내역</summary><pre>${e(JSON.stringify(result.join,null,2))}</pre></details>`:'')+(result.matches||[]).map(s=>`<details><summary>${e(s.name)} · ${e(s.level)}</summary><pre>${e(JSON.stringify(s,null,2))}</pre></details>`).join('')+`<ul>${result.limitations.map(s=>`<li>${e(s)}</li>`).join('')}</ul>`;
    $('status').textContent='분석 완료. 결과에 원문 해시와 공개자료 해시가 함께 기록되었습니다.';
  });
  $('remove').onclick=()=>busy($('remove'),async()=>{await api('delete',{document_id:doc.id});doc=null;result=null;$('mapping').hidden=true;$('resultSection').hidden=true;$('status').textContent='저장한 추출 문서를 삭제했습니다.';});
  $('download').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='교육청_통합분석.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
