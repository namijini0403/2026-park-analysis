'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');let running=0;
async function extract(body){
 if(running>=2)throw Error('다른 문서를 읽고 있습니다. 잠시 후 다시 첨부해 주세요.');
 if(typeof body.name!=='string'||body.name.length>200||! /\.(pdf|docx|hwpx|hwp|xls)$/i.test(body.name))throw Error('PDF·DOCX·HWP·HWPX·XLS 문서를 선택해 주세요.');
 if(typeof body.base64!=='string'||body.base64.length>21*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))throw Error('첨부 파일 형식·15MB 크기 제한을 확인해 주세요.');
 const bytes=Buffer.from(body.base64,'base64');if(!bytes.length||bytes.length>15*1024*1024)throw Error('파일은 15MB 이내로 선택해 주세요.');
 running++;
 try{return await new Promise((resolve,reject)=>{const child=spawn(process.env.PYTHON_BIN||(process.platform==='win32'?'python':'python3'),[path.join(__dirname,'../scripts/education/parse_chat_attachment.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',failed=false;
  const fail=e=>{if(failed)return;failed=true;child.kill();reject(e);};const timer=setTimeout(()=>fail(Error('문서 읽기 시간이 초과됐습니다. 필요한 페이지·시트로 나누어 주세요.')),25000);
  child.stdout.setEncoding('utf8');child.stdout.on('data',data=>{output+=data.toString('utf8');if(Buffer.byteLength(output)>4*1024*1024)fail(Error('추출 내용이 너무 큽니다. 문서를 나누어 주세요.'));});
  // stderr may contain user text; do not log it.
  child.stderr.on('data',()=>{});child.on('error',()=>{clearTimeout(timer);fail(Error('문서 읽기 모듈을 시작하지 못했습니다.'));});child.stdin.on('error',()=>{});
  child.on('close',()=>{clearTimeout(timer);if(failed)return;try{const d=JSON.parse(output);if(d.error)throw Error(d.error);resolve({...d,name:body.name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),imported_at:new Date().toISOString()});}catch(e){reject(Error(e.message.startsWith('Unexpected')?'문서를 읽을 수 없습니다. 파일 형식을 확인해 주세요.':e.message));}});child.stdin.end(JSON.stringify(body));
 });}finally{running--;}
}
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');if(req.method!=='POST'){res.statusCode=405;return res.end(JSON.stringify({error:'POST 요청만 지원합니다.'}));}try{res.end(JSON.stringify(await extract(req.body||{})));}catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}};
module.exports.extract=extract;
