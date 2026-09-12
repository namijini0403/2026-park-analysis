const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),model=require('../api/_school_summary');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
// The ask page records questions in memory and saves one conversation on demand; the saved tab lists them.
assert(!html.includes('map-walk-route'),'park walk route is part of the 공원 layer, not a separate checkbox');
assert(html.includes('data-workspace="saved"')&&html.includes('id="workspace-saved"'));
assert(!html.includes('주제별 분석 대화'));
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;
const store=new Map();
// Minimal IndexedDB double: enough for put/get/getAll/delete inside one transaction.
w.indexedDB={open(){const req={};setTimeout(()=>{req.result={transaction(){const tx={};const os={put(v){store.set(v.id,v);return {result:v.id};},get(id){return {result:store.get(id)};},getAll(){return {result:[...store.values()]};},delete(id){store.delete(id);return {result:undefined};}};tx.objectStore=()=>os;setTimeout(()=>tx.oncomplete?.(),0);return tx;}};req.onsuccess?.();},0);return req;}};
w.crypto.randomUUID||=(()=>{let n=0;return()=>'id-'+(++n);})();
w.confirm=()=>true;
w.fetch=async(url)=>{if(url==='/api/chat')return {ok:true,json:async()=>({answerable:true,mode:'relative',summary:'학생당 장서 기준 가장 적은 학교: A초 2.4권/명',sources:[{id:'relative#x',title:'학교 장서',source:'data_processed/student_services/priorities.json',body:'계산'}],visual:{title:'학생당 장서',sections:[],notes:[]}})};const u=new URL(url,'http://localhost');return {ok:true,json:async()=>u.searchParams.get('id')?model.summary(u.searchParams.get('id'),u.searchParams.get('kind')):{schools:model.list()}};};
const tick=(ms=25)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 w.eval(['simple-app.js','hitl-workspace.js','analysis-topics.js'].map(f=>fs.readFileSync(path.join(root,'assets',f),'utf8')).join('\n'));await tick();
 const bar=d.querySelector('.chat-save-bar');assert(bar);assert(bar.querySelector('.chat-save').disabled);
 d.getElementById('question').value='어떤 학교에 책이 부족하니?';d.getElementById('chat-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(d.querySelectorAll('.message').length,1);assert(!bar.querySelector('.chat-save').disabled);assert.match(bar.querySelector('.chat-save-status').textContent,/이번 대화 1건/);
 assert.equal(store.size,0,'nothing is auto-saved');
 bar.querySelector('.chat-save-name').value='장서 검토';bar.querySelector('.chat-save').click();await tick(60);
 assert.equal(store.size,1);const saved=[...store.values()][0];assert.equal(saved.name,'장서 검토');assert.equal(saved.entries.length,1);assert.equal(saved.entries[0].status,'완료');assert.match(saved.entries[0].result.summary,/장서/);
 assert.match(bar.querySelector('.chat-save-status').textContent,/저장 완료/);
 // Continuing the same conversation and saving again updates the record instead of duplicating it.
 d.getElementById('question').value='부평구 학교는?';d.getElementById('chat-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();bar.querySelector('.chat-save').click();await tick(60);
 assert.equal(store.size,1);assert.equal([...store.values()][0].entries.length,2);
 // Saved tab lists the conversation with restore and delete actions.
 d.querySelector('.workspace-nav [data-workspace="saved"]').click();await tick(60);
 assert.equal(d.getElementById('workspace-saved').hidden,false);assert.equal(d.getElementById('workspace-ask').hidden,true);
 const items=d.querySelectorAll('#saved-list article');assert.equal(items.length,1);assert.match(items[0].textContent,/장서 검토/);assert.match(items[0].textContent,/질문 2건/);
 assert.equal(items[0].querySelectorAll('.saved-entry').length,2);
 // New conversation clears the in-memory session and the message log.
 bar.querySelector('.chat-new').click();assert.equal(d.querySelectorAll('.message').length,0);assert(bar.querySelector('.chat-save').disabled);
 items[0].querySelector('.saved-actions button.danger').click();await tick(60);assert.equal(store.size,0);assert.match(d.getElementById('saved-list').textContent,/저장된 대화가 없습니다/);
 console.log('PASS saved conversations: manual save only, update on re-save, saved tab list/restore/delete, no separate walk-route toggle');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
