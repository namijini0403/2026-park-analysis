const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'assets/hybrid-walk-review.html'),'utf8'),{url:'http://localhost/assets/hybrid-walk-review.html',runScripts:'outside-only'});
const w=dom.window;
w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,'assets',url),'utf8'))});
(async()=>{
 w.eval(fs.readFileSync(path.join(root,'assets/hybrid-walk-review.js'),'utf8'));
 for(let i=0;i<100&&!w.document.querySelector('#detail svg');i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(w.document.querySelector('#error').textContent,'');
 assert.equal(w.document.querySelectorAll('#school option').length,53);
 assert(w.document.querySelector('#detail svg'));
 assert.match(w.document.body.textContent,/기존 정책 거리는 유지/);
 assert.match(w.document.body.textContent,/미조회 지점은 접근 불가를 뜻하지 않습니다/);
 const form=w.document.querySelector('#review-form');
 assert.equal(form.elements.school_lon.value,'','Representative coordinate must not be prefilled as entrance');
 for(const kind of ['school','park']){
  form.elements[kind+'_lon'].value='126.7';form.elements[kind+'_lat'].value='37.5';
  form.elements[kind+'_evidence'].value='official-record';
  form.elements[kind+'_identity'].checked=true;form.elements[kind+'_open'].checked=true;
 }
 form.elements.reviewer.value='test-reviewer';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.match(w.document.querySelector('#save-status').textContent,/임시 기록/);
 const select=w.document.querySelector('#school');const first=select.value;
 select.selectedIndex=1;select.dispatchEvent(new w.Event('change'));
 select.value=first;select.dispatchEvent(new w.Event('change'));
 assert.equal(form.elements.school_evidence.value,'official-record','Draft must survive school switching');
 assert.match(w.document.querySelector('#detail').textContent,/근거 확인 필요/,'Draft must not alter published verification state');
 const data=JSON.parse(fs.readFileSync(path.join(root,'data_processed/education/hybrid_walk_review.json'),'utf8'));
 assert.equal(data.policy.auto_replace_manual,false);
 assert(data.summary.api_calls_this_run<=18);
 assert.equal(data.summary.verified_endpoint_pairs,0);
 for(const row of Object.values(data.schools)){
  assert.equal(row.adopted_basis,'legacy_review_preserved');
  for(const c of row.comparisons)if(c.osm_distance_m===null||c.kakao_distance_m===null)assert.equal(c.comparison,'unavailable');
 }
 console.log('Hybrid walking UI/data: 53 schools, geometry, missing routes, isolated drafts, preserved manual decisions passed');
 w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
