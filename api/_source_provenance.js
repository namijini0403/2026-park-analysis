'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),catalog=require('./_data_catalog');
const cache=new Map(),publicSources=require('./_public_sources');
function read(file){try{const p=path.join(root,file),mtime=fs.statSync(p).mtimeMs,old=cache.get(file);if(old?.mtime===mtime)return old.data;const data=JSON.parse(fs.readFileSync(p,'utf8'));cache.set(file,{mtime,data});return data;}catch{return null;}}
const safeURL=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&![...u.searchParams.keys()].some(k=>/key|token|secret|password/i.test(k))?u.href:null;}catch{return null;}};
function enrich(d){
 if(!Array.isArray(d.sources))return d;
 const registry=read('data_processed/source_provenance/index.json');
 d.sources=d.sources.map((s,i)=>{
  const used=[...new Set([s.source,...(s.provenance||[]).map(p=>p.path)].filter(p=>typeof p==='string'&&/^(data_processed|rag)\/[\w./-]+$/.test(p)&&!p.split('/').includes('..')))];
  const originals=[],files=[],seen=new Set();const direct=safeURL(s.url||s.source);if(direct)originals.push({url:direct,title:s.title||'응답에 연결된 원문',kind:'answer',locator:s.id});
  const inferred=catalog.find(e=>e.id===s.id?.split(/[#:\/]/)[1]);if(!used.length&&inferred)used.push(inferred.file);
  function collect(file,upstream=false,depth=0){if(seen.has(file)||depth>2)return;seen.add(file);const ref=registry?.files[file],entry=ref&&read('data_processed/source_provenance/'+ref.id+'.json');
   if(!upstream)files.push({path:file,sha256:(s.provenance||[]).find(p=>p.path===file)?.sha256||null,row:(s.provenance||[]).find(p=>p.path===file)?.row||null});
   if(!entry)return;const actual=(s.provenance||[]).find(p=>p.path===file)?.sha256;
   // A changed source snapshot must not inherit old provenance as if it were current.
   if(actual&&actual!==entry.sha256){const target=files.find(f=>f.path===file);if(target)target.registry_status='자료 변경 후 출처 목록 재확인 필요';return;}
   if(file==='data_processed/student_services/priorities.json'&&(/(?:#|:)books(?::|$)/.test(s.id||'')||/장서|사서/.test(s.title||''))){for(const f of ['data_processed/school_library_access.csv','data_processed/education/school_statistics.json'])collect(f,true,depth+1);return;}
   for(const o of entry.originals)originals.push({...o,via:file,kind:upstream?'upstream':o.kind});
   for(const f of entry.upstream)collect(f,true,depth+1);
  }
  used.forEach(f=>collect(f));
  // Every analysis file maps to its public portal page so the reader can open the original data, not a local path.
  for(const f of used){if(files.find(x=>x.path===f)?.registry_status)continue;for(const o of publicSources.forFile(f))originals.push({...o,via:f});}
  const byUrl=new Map();for(const o of originals)if(safeURL(o.url)&&!byUrl.has(o.url))byUrl.set(o.url,o);const unique=[...byUrl.values()];
  const indexLinks=used.filter(f=>registry?.files[f]).map(f=>({path:'data_processed/source_provenance/'+registry.files[f].id+'.json',label:f}));
  const uploaded=s.id==='user-upload'||s.id?.startsWith('user-document#');if(uploaded)files.push({path:s.source,sha256:s.attachment?.original_sha256||null,row:s.attachment?.location||null});return {...s,citation_id:'S'+(i+1),source_chain:{version:1,originals:unique.slice(0,8),original_count:unique.length,files,index_links:indexLinks,status:uploaded?'user_provided':unique.length?'recorded':'original_unavailable',scope:uploaded?'사용자가 첨부한 자료입니다. 공개 원문 URL과 기관 검증 상태는 제공되지 않았습니다. 원본 파일은 첨부자에게 확인하세요.':'원본 링크는 이 자료집의 출처입니다. 개별 수치는 분석 파일의 학교·행·연도를 함께 확인하세요.'}};
 });return d;
}
module.exports={enrich,safeURL};
