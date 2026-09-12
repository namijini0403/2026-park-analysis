const crypto=require('node:crypto');
const path=require('node:path');
const worker=require('../scripts/education/python_worker.cjs');
const analysis=require('./analysis.js');
const engine=require('./_analysis_engine.js');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const key=id=>{if(!/^[a-f0-9]{64}$/.test(id||''))throw Error('문서 ID 오류');return 'office_document_'+id;};
const number=value=>{const text=String(value??'').trim().replace(/,/g,'');return /^[-+]?\d+(\.\d+)?$/.test(text)&&Number.isFinite(Number(text))?Number(text):null;};
function preview(doc){return {id:doc.id,name:doc.name,uploaded_at:doc.uploaded_at,sha256:doc.id,warnings:doc.warnings,
  tables:doc.tables.map((t,i)=>({index:i,name:t.name,row_count:t.rows.length,preview:t.rows.slice(0,8)})),
  paragraph_count:doc.paragraphs.length,paragraph_preview:doc.paragraphs.slice(0,8),fields:engine.fields};}
async function importDocument(body,store){
  if(typeof body.name!=='string'||typeof body.base64!=='string'||body.base64.length>21*1024*1024)throw Error('파일 이름·내용 또는 크기 오류');
  const bytes=Buffer.from(body.base64,'base64');
  if(bytes.toString('base64')!==body.base64)throw Error('파일 인코딩 오류');
  const id=hash(bytes),cached=await store.getMeta(key(id));
  if(cached)return {...preview(cached),cached:true};
  const parsed=await worker('parse_office_document.py',{name:body.name,base64:body.base64});
  const doc={...parsed,id,name:path.basename(body.name).slice(0,200),uploaded_at:new Date().toISOString()};
  await store.setMeta(key(id),doc);
  await store.appendAudit({actor:'web-admin',action:'office_document_import',dataset:'office_documents',detail:JSON.stringify({id,name:doc.name,tables:doc.tables.length,paragraphs:doc.paragraphs.length})});
  return preview(doc);
}
function joinTable(doc,body,data){
  const table=doc.tables[Number(body.table_index)];if(!table)throw Error('표를 선택하세요.');
  const header=Number(body.header_row??0),schoolCol=Number(body.school_column),valueCol=Number(body.value_column);
  if(![header,schoolCol,valueCol].every(Number.isInteger)||header<0||header>=table.rows.length||schoolCol<0||valueCol<0||schoolCol===valueCol)throw Error('머리글 행·학교 열·수치 열을 확인하세요.');
  const level=body.level,year=Number(body.year);
  if(!engine.levels.includes(level)||!data.years.includes(year))throw Error('학교급·공시연도를 확인하세요.');
  const selected=data.schools.filter(s=>s.level===level),lookup=new Map();
  for(const school of selected)for(const value of [school.id,school.name]){const token=String(value).trim();if(!lookup.has(token))lookup.set(token,[]);lookup.get(token).push(school);}
  const groups=new Map(),issues=[];
  for(let i=header+1;i<table.rows.length;i++){
    const row=table.rows[i],token=String(row[schoolCol]??'').trim(),found=lookup.get(token)||[];
    if(found.length!==1){issues.push({row:i+1,school:token,status:found.length?'ambiguous':'unmatched'});continue;}
    const id=found[0].id;if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push({row:i+1,value:number(row[valueCol]),raw:row[valueCol]});
  }
  const values=new Map();
  for(const [id,rows] of groups){
    if(rows.length!==1){issues.push({school_id:id,rows:rows.map(r=>r.row),status:'duplicate_excluded'});continue;}
    if(rows[0].value===null){issues.push({school_id:id,row:rows[0].row,status:'non_numeric'});continue;}
    values.set(id,rows[0]);
  }
  return {values,issues,table,header,valueCol,level,year,selected};
}
function analyzeDocument(doc,body,data=analysis.dataset()){
  const mode=body.mode||'table';
  if(mode==='evidence'){
    const selected=data.schools.filter(s=>(!body.level||s.level===body.level)&&(!body.school_id||s.id===body.school_id));
    const text=[...doc.paragraphs,...doc.tables.flatMap(t=>t.rows.map(r=>r.join(' | ')))];
    const matches=[];
    for(const school of selected){
      const excerpts=text.map((value,index)=>({value,index:index+1})).filter(p=>p.value.includes(school.name)||p.value.includes(school.id)).slice(0,5);
      if(excerpts.length)matches.push({id:school.id,name:school.name,level:school.level,gu:school.gu,environment:school.environment,
        observations:school.observations[String(body.year||data.years.at(-1))],excerpts:excerpts.map(p=>({block:p.index,text:p.value.slice(0,1600)}))});
    }
    return {mode,status:'ok',summary:`문서에서 기존 기관 ${matches.length}곳의 이름/ID를 찾았습니다.`,matches:matches.slice(0,100),total_matches:matches.length,
      source_hashes:{...data.source_hashes,office_document:doc.id},limitations:['본문의 학교명 언급을 연결한 참고 근거입니다. 동명 기관·실적·수치 적용 여부는 원문 확인이 필요합니다.','문서 내용은 명령으로 실행하거나 기존 정책 등급에 반영하지 않습니다.'],document:{id:doc.id,name:doc.name}};
  }
  const joined=joinTable(doc,body,data),{values,issues,table,header,valueCol,level,year,selected}=joined;
  const label=String(body.label||table.rows[header][valueCol]||'교육청 제공값').slice(0,80);
  if(!Object.hasOwn(engine.fields,body.compare_field))throw Error('기존 비교 지표를 선택하세요.');
  const merged={...data,extra_fields:{office_value:[label,String(body.unit||'').slice(0,15)]},
    schools:data.schools.map(s=>({...s,observations:{...s.observations,[year]:{...s.observations[String(year)],office_value:values.get(s.id)?.value??null}}})),
    source_hashes:{...data.source_hashes,office_document:doc.id}};
  const plan={method:'relationship',level,year,gu:body.gu||'전체',x:'office_value',y:body.compare_field,controls:[]};
  const result=engine.analyze(merged,plan);
  result.document={id:doc.id,name:doc.name,table:table.name,header_row:header+1,school_column:Number(body.school_column)+1,value_column:valueCol+1,year,unit:body.unit||'미입력'};
  result.join={matched_numeric:values.size,total_in_level:selected.length,issue_count:issues.length,issues:issues.slice(0,200),records:[...values].map(([id,row])=>({school_id:id,...row}))};
  result.limitations.push('업로드 값은 선택한 연도의 별도 변수입니다. 기존 공개값을 덮어쓰지 않습니다. 문서의 기준연도와 단위를 확인하세요.','학교 ID 또는 해당 학교급의 유일한 정확 학교명으로 결합합니다. 중복 기관 행·비수치·미매칭은 제외하며 합산하지 않습니다.');
  return result;
}
async function handle(req,res,store){
  res.setHeader('Cache-Control','no-store');
  try{
    const body=req.body||{},route=new URL(req.url,'http://localhost').pathname;
    let result;
    if(req.method==='POST'&&route.endsWith('/import'))result=await importDocument(body,store);
    else if(req.method==='POST'&&route.endsWith('/analyze')){const doc=await store.getMeta(key(body.document_id));if(!doc)throw Error('문서를 먼저 넣어 주세요.');result=analyzeDocument(doc,body);}
    else if(req.method==='POST'&&route.endsWith('/delete')){await store.setMeta(key(body.document_id),null);result={deleted:true};}
    else{res.statusCode=404;result={error:'지원하지 않는 문서 경로'};}
    res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(result));
  }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:error.message}));}
}
module.exports={handle,importDocument,analyzeDocument,joinTable,number};
