const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let release;const waiting=new Promise(resolve=>release=resolve),requests=[];w.ChatWorkspace={show:()=>{}};
 w.fetch=async(url,o)=>{const p=JSON.parse(o.body);requests.push(p);if(p.action==='hitl_plan')await waiting;return {ok:true,json:async()=>p.action==='hitl_plan'?{workflow:'direct',context:{school_id:null,level:'초등학교'},summary:'바로 조회'}:{mode:'dataset',summary:'조회 완료',sources:[]}};};
 w.eval(fs.readFileSync('assets/hitl-analysis.js','utf8'));
 const input=d.getElementById('question');input.value='도서관 목록 보여줘';d.getElementById('chat-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(input.value,'');input.value='학생 수 분포를 보여줘';release();await new Promise(resolve=>setTimeout(resolve,50));assert.equal(input.value,'학생 수 분포를 보여줘');assert.equal(requests.length,2);assert(!d.getElementById('send').disabled);dom.window.close();console.log('PASS next question typed during analysis is preserved');
})().catch(e=>{console.error(e);process.exitCode=1;});
