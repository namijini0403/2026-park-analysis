'use strict';
// Explicit source-backed columns; no composite scores or implicit imputation.
const modules=[require('./_environment_indicators'),require('./_public_extra_indicators'),require('./_resource_extra_indicators')];
const merge=key=>Object.assign({},...modules.map(m=>m[key]));
function load(schools){
 const byId=new Map(schools.map(s=>[s.id,{}])),sources={};
 for(const m of modules){const result=m.load(schools);Object.assign(sources,result.sources);for(const [id,values] of result.byId)if(byId.has(id))Object.assign(byId.get(id),values);}
 return {byId,sources};
}
module.exports={FILES:merge('FILES'),PUBLIC:merge('PUBLIC'),COLUMNS:merge('COLUMNS'),COLUMN_SOURCE:merge('COLUMN_SOURCE'),load};
