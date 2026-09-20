'use strict';
require('./_env');// 로컬 개발: 리포 루트/워크스페이스 루트 .env 의 GOOGLE_MAPS_BROWSER_KEY (구 map.env 는 .env 로 통합됨)
// This is intentionally a browser key. Restrict it to website referrers and
// Maps JavaScript API / Places UI Kit in Google Cloud. Never return other envs.
function browserKey(){
 const configured=(process.env.GOOGLE_MAPS_BROWSER_KEY||'').trim();
 return /^AIza[\w-]{35}$/.test(configured)?configured:'';
}
module.exports=function(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
 const key=browserKey();res.end(req.method==='HEAD'?'':JSON.stringify({enabled:!!key,key}));
};
module.exports.browserKey=browserKey;
