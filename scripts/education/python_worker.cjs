const {spawn}=require('node:child_process');
const path=require('node:path');
module.exports=function pythonWorker(script,input,{timeout=120000,maxBytes=25*1024*1024}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.PYTHON_BIN||'python',[path.join(__dirname,script)],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
    let out=[],err=[],size=0,settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(Error('문서/자료 처리 시간이 초과되었습니다.'));},timeout);
    child.on('error',error=>finish(error));
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){child.kill();finish(Error('처리 결과 크기 초과'));}else out.push(chunk);});
    child.stderr.on('data',chunk=>{if(Buffer.concat(err).length<10000)err.push(chunk);});
    child.on('close',code=>{
      try{const value=JSON.parse(Buffer.concat(out).toString('utf8'));if(code!==0||value.error)throw Error(value.error||'처리 실패');finish(null,value);}
      catch(error){finish(Error(code!==0?(Buffer.concat(out).toString('utf8').slice(0,600)||Buffer.concat(err).toString('utf8').slice(-600)):error.message));}
    });
    child.stdin.on('error',()=>{});child.stdin.end(input?JSON.stringify(input):'');
  });
};
