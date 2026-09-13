'use strict';
const fs=require('node:fs'),path=require('node:path');
const FILES=['rag/policy-guide.md','rag/analysis-guide.md'];
function chunks(){return FILES.flatMap(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8').split(/^### /m).slice(1).map(part=>{const lines=part.trim().split('\n'),m=lines.shift().match(/^\[chunk: ([^\]]+)\]\s*(.*)/);return {id:m[1],title:m[2],source:file,tags:lines.shift().replace(/^tags: /,'').split(', '),body:lines.join('\n').trim()};}));}
function retrieve(q){const query=String(q||'')+(/서비스|사용법|뭐 하는|어떻게 쓰|어떻게 사용/.test(q)?' 목적 사용법':'');return chunks().map(c=>({...c,score:c.tags.reduce((n,t)=>n+(query.toLowerCase().includes(t.toLowerCase())?2:0),0)+(query.includes(c.title)?3:0)})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,3);}
module.exports={chunks,retrieve};
