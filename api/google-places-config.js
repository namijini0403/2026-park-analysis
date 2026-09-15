'use strict';
const fs=require('node:fs'),path=require('node:path');
// This is intentionally a browser key. Restrict it to website referrers and
// Maps JavaScript API / Places UI Kit in Google Cloud. Never return other envs.
function browserKey(){
 const configured=process.env.GOOGLE_MAPS_BROWSER_KEY;
 if(configured)return /^AIza[\w-]{35}$/.test(configured)?configured:'';
 for(const file of [path.join(__dirname,'../map.env'),path.join(__dirname,'../../map.env')]){
  if(!fs.existsSync(file))continue;
  const text=fs.readFileSync(file,'utf8');
  const named=text.match(/^\s*GOOGLE_MAPS_BROWSER_KEY\s*=\s*["']?(AIza[\w-]{35})["']?\s*$/m);
  if(named)return named[1];
  // Also accept the user's original file containing only the key.
  const bare=text.trim();if(/^AIza[\w-]{35}$/.test(bare))return bare;
  const labelled=bare.match(/^구글맵\s*:\s*(AIza[\w-]{35})$/);if(labelled)return labelled[1];
 }
 return '';
}
module.exports=function(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
 const key=browserKey();res.end(req.method==='HEAD'?'':JSON.stringify({enabled:!!key,key}));
};
module.exports.browserKey=browserKey;
