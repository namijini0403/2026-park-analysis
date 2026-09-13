const assert=require('node:assert/strict');
const profileApi=require('../api/school-profile'),domainApi=require('../api/domain-stats');
function call(handler,url,method='GET'){return new Promise(res=>{const fake={statusCode:200,setHeader(){},end(b){res({status:this.statusCode,body:b?JSON.parse(b):null});}};handler({method,url},fake);});}
(async()=>{
 const ok=await call(profileApi,'/api/school-profile?id=B000002949');
 assert.equal(ok.status,200);assert.equal(ok.body.school.name,'인천신흥초등학교');assert.equal(ok.body.domains.length,9);
 const bad=await call(profileApi,'/api/school-profile?id=없는학교');
 assert.equal(bad.status,400);assert(bad.body.error);
 const noId=await call(profileApi,'/api/school-profile');
 assert.equal(noId.status,400);
 const post=await call(profileApi,'/api/school-profile?id=B000002949','POST');
 assert.equal(post.status,405);
 const d=await call(domainApi,'/api/domain-stats?domain=park&level=초등학교&school=B000002949');
 assert.equal(d.status,200);assert.equal(d.body.domain,'park');assert(d.body.indicators.length>0);
 const dDefault=await call(domainApi,'/api/domain-stats?domain=park');
 assert.equal(dDefault.status,200);assert.equal(dDefault.body.level,'초등학교','학교급 기본값');
 const dBad=await call(domainApi,'/api/domain-stats?domain=없음&level=초등학교');
 assert.equal(dBad.status,400);
 console.log('test_profile_http: OK');
})();
