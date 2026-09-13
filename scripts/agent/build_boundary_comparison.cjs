// Precomputes 학구도 vs 보행 500m 도달권 면적 비교 for every school (needs local Python + shapely/pyproj).
// Output is committed so the production container (no Python) can answer instantly.
const fs=require('node:fs'),path=require('node:path');
const worker=require('../education/python_worker.cjs');
const model=require('../../api/_school_summary.js');
(async()=>{
 const schools=model.registry().map(s=>({id:s.id}));
 const result=await worker('compare_school_boundaries.py',{schools},{timeout:300000});
 const out={generated_at:new Date().toISOString(),crs:result.crs,sources:result.sources,rows:result.rows};
 const file=path.join(__dirname,'../../data_processed/education/boundary_comparison.json');
 fs.writeFileSync(file,JSON.stringify(out));
 const computed=result.rows.filter(r=>r.status==='computed').length;
 console.log(`wrote ${path.relative(process.cwd(),file)} · ${result.rows.length} rows · computed ${computed}`);
})().catch(e=>{console.error(e);process.exit(1);});
