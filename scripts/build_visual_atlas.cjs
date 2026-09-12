'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const data=require('../api/_data_answers'),hitl=require('../api/_hitl_analysis');
const out=path.join(__dirname,'../data_processed/visual_atlas'),pending=new Map();
async function buildDataset(e,created_at=new Date().toISOString()){
 if(pending.has(e.id))return pending.get(e.id);
 const task=(async()=>{fs.mkdirSync(out,{recursive:true});
  const defs=hitl.definitions(e),sections=[],sources=[];
  const basic=data.run('자료 보여줘',{dataset_id:e.id});
  sections.push({title:e.title+' · 원장·위치',...basic.visual,table:basic.export_table||basic.visual.table});sources.push(...basic.sources);
  const numeric=defs.filter(f=>f.field);for(let i=0;i<numeric.length;i+=16){const d=await hitl.run({version:hitl.VERSION,question:'기본 자료 분포',scope:'all',level:'전체',factors:numeric.slice(i,i+16).map(f=>({id:f.id,direction:'observe',weight:null}))});sections.push(...d.visual.sections.filter(s=>s.statistics));sources.push(...d.sources);}
  const result={mode:'visual_atlas',summary:'미리 제작한 원자료 관측입니다. 자료 미확보는 부족 확정이 아닙니다.',sources:[...new Map(sources.map(s=>[s.id,s])).values()],visual:{title:e.title,sections}};
  const artifact={version:1,id:e.id,title:e.title,created_at,result},content=JSON.stringify(artifact),file=path.join(out,e.id+'.json');fs.writeFileSync(file+'.tmp',content);fs.renameSync(file+'.tmp',file);const metadata={id:e.id,title:e.title,sections:sections.length,sha256:crypto.createHash('sha256').update(content).digest('hex'),bytes:Buffer.byteLength(content)};
  const indexFile=path.join(out,'index.json');if(fs.existsSync(indexFile)){const index=JSON.parse(fs.readFileSync(indexFile));index.datasets=index.datasets.map(d=>d.id===e.id?metadata:d);index.updated_at=created_at;fs.writeFileSync(indexFile,JSON.stringify(index,null,2));}
  return {artifact,metadata};})();pending.set(e.id,task);try{return await task;}finally{pending.delete(e.id);}
}
async function build(){
 const created_at=new Date().toISOString(),datasets=[];
 for(const e of data.catalog){const {metadata}=await buildDataset(e,created_at);datasets.push(metadata);console.log(e.id,metadata.sections);}
 fs.writeFileSync(path.join(out,'index.json'),JSON.stringify({version:1,created_at,datasets},null,2));console.log('Prepared',datasets.length,'datasets');return datasets;
}
if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});module.exports={build,buildDataset};
