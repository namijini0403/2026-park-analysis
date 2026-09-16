'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const routes=read('data_processed/education/school_routes.json');
const schools=read('data_processed/education/analysis_dataset.json').schools.filter(s=>s.level==='초등학교');
const table=require('../api/_school_table').build(),stats=require('../api/_indicator_stats');
const priority=require('../api/_data_answers').csv(fs.readFileSync(path.join(root,'data_processed/school_priority.csv'),'utf8'));
const priorityBy=new Map(priority.map(s=>[s['학교ID'],s]));
assert.equal(schools.length,272);
assert.equal(schools.filter(s=>routes[s.id]).length,272,'Every elementary school has an explicit route outcome');
assert.equal(Object.keys(routes).length,917,'Keep the existing 645 other school routes');
let available=0,missing=0;
for(const school of schools){
 const r=routes[school.id],row=table.byId.get(school.id),legacy=priorityBy.get(school.id)?.nearest_park_dist_m;
 assert.equal(row.nearest_park_m,legacy==null||String(legacy).trim()===''?null:Number(legacy),'Keep the independent legacy nearest park distance');
 if(r.status!=='available'){
  missing++;
  for(const key of ['route_distance_m','straight_distance_m','detour_ratio'])assert(r[key]==null,'Missing route must not become zero: '+school.id+' '+key);
  assert.equal(row.park_route_m,null);assert.equal(row.park_detour_ratio,null);
  continue;
 }
 available++;
 assert(Number.isFinite(r.route_distance_m)&&r.route_distance_m>=0&&r.route_distance_m<=15000);
 assert(Number.isFinite(r.straight_distance_m)&&r.straight_distance_m>=0);
 assert(r.origin_snap_m<=150&&r.destination_snap_m<=150);
 assert(r.park_id&&r.park_name);
 assert.match(r.destination_basis,/대표점.*출입구 아님/);
 assert(Array.isArray(r.route_coordinates)&&r.route_coordinates.length>=2);
 const origin=r.route_coordinates[0];
 assert(Math.abs(origin[0]-school.lng)<1e-6&&Math.abs(origin[1]-school.lat)<1e-6,'Route geometry starts at the analysis school coordinate');
 if(r.straight_distance_m===0){
  assert.equal(r.detour_ratio,null,'Zero denominator must not fabricate a detour ratio');
 }else{
  assert(Number.isFinite(r.detour_ratio)&&r.detour_ratio>=0);
  // The builder rounds metres to 0.1 and the unrounded ratio to 0.001.
  const lower=Math.max(0,r.route_distance_m-.05)/(r.straight_distance_m+.05)-.00051;
  const upper=(r.route_distance_m+.05)/Math.max(Number.EPSILON,r.straight_distance_m-.05)+.00051;
  assert(r.detour_ratio>=lower&&r.detour_ratio<=upper,'Paired distances and ratio must agree within source rounding');
 }
 assert.equal(row.park_route_m,Math.round(r.route_distance_m));
 if(r.detour_ratio==null)assert.equal(row.park_detour_ratio,null);
 else assert(Math.abs(row.park_detour_ratio-r.detour_ratio)<=.005000001,'Display ratio keeps source precision within two-decimal rounding');
}
assert(available>0,'The elementary addition must provide calculated routes');
const domain=require('../api/_domain_stats').domainStats({domain:'park',level:'초등학교'});
for(const column of ['park_route_m','park_detour_ratio']){
 const indicator=domain.indicators.find(i=>i.column===column);assert(indicator);
 assert.equal(indicator.coverage.general.total,242);assert.equal(indicator.coverage.island.total,30);
 for(const track of ['general','island']){
  const cohort=schools.filter(s=>stats.isIsland(s.gu)===(track==='island'));
  const valid=cohort.filter(s=>Number.isFinite(table.byId.get(s.id)[column])).length;
  assert.equal(indicator.coverage[track].available,valid);
  assert.equal(indicator.coverage[track].missing_n,cohort.length-valid);
 }
}
console.log(`PASS elementary routes: ${available} calculated, ${missing} deferred; 242 general / 30 island, legacy distances retained`);
