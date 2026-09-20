'use strict';
// Public HTTP + real follow-up response; renderer adapter checks map placement and geometry dispatch.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),tools=require('../api/_agent_tools');
const base='https://education-living-area-preview-production.up.railway.app';let dom;
(async()=>{
 const html=await(await fetch(base)).text();assert(html.includes('chat-map.js?v=inlinemap20260914'));
 dom=new JSDOM(html,{url:base,runScripts:'outside-only'});const w=dom.window,d=w.document,maps=[];let result,request;
 w.EducationMaps={ready:async()=>{},create(container){const map={container,points:[],shapes:[],point:(lat,lng)=>({lat,lng}),dot(group,p){this.points.push(p);},polygons(group,f){this.shapes.push(f);return [];},route(){return [];},fit(){},clear(){},select(){},destroy(){}};maps.push(map);return map;}};
 w.fetch=async(url,opts)=>{const r=await fetch(new URL(url,base),opts);if(url==='/api/chat'){request=JSON.parse(opts.body);result=await r.clone().json();}return r;};
 const files=['chat-workspace.js','chat-map.js','source-evidence.js','indicator-charts.js','school-profile.js','simple-app.js','chat-agent.js'];
 const scripts=await Promise.all(files.map(async f=>(await(await fetch(base+'/assets/'+f)).text())));scripts.forEach(s=>w.eval(s));
 const previous=tools.run('query_schools',{level:'초등학교'},{sort_by:'zone_walk_mismatch_pct',island:'exclude',limit:10}),ids=previous.visual.map.map(p=>p.id);
 w.ChatAgent.history.push({q:'도시 지역 초등학교 중 학구도 도보권 불일치가 큰 10곳',a:previous.llm.rows.map(r=>r.name).join(', '),school_ids:ids});
 d.getElementById('chat-scope').value='all';d.getElementById('question').value='이 10곳의 학구도 경계를 이 대화의 지도에서 같이 보여줘';await w.ChatAgent.submit();
 assert(result.answerable);assert.deepEqual(result.visual.map.map(p=>p.id).sort(),[...ids].sort());assert(result.visual.geometries.length>=10);assert.deepEqual(request.history[0].school_ids,ids);
 await new Promise(r=>setTimeout(r,30));const card=d.querySelector('.agent-inline-map');console.log('Map adapter state:',maps.length,card?.querySelector('.chat-map-status')?.textContent);assert(card);assert(!card.closest('details'));assert.equal(maps.length,1);assert.equal(maps[0].points.length,10);assert(maps[0].shapes.length>=10);
 assert(card.compareDocumentPosition(d.querySelector('.agent-inline-visual'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 const report={at:new Date().toISOString(),passed:true,summary:result.summary,school_ids:ids,points:maps[0].points.length,geometries:maps[0].shapes.length,ms:result.agent.ms,inline:true,browser_pixels_verified:false};
 const out=path.join(__dirname,'../outputs/inline-map');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'public-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));w.ChatMap.dispose(d.getElementById('messages'));dom.window.close();
})().catch(e=>{dom?.window.close();console.error(e);process.exitCode=1;});
