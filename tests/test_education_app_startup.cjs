// Execute the real page's boot/data/filter paths; only the external map SDK and network are mocked.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/',pretendToBeVisual:true});
const w=dom.window,errors=[];
w.console.error=(...args)=>errors.push(args.map(String).join(' '));
w.console.warn=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
class MapObject {
  constructor(options={}){this.options=options;this.position=options.position;this.map=options.map;this.events={};}
  setMap(map){this.map=map;} getMap(){return this.map;}
  setOptions(options){Object.assign(this.options,options);} setZIndex(){} setImage(){}
  setPosition(position){this.position=position;} getPosition(){return this.position;}
  setContent(content){this.content=content;} open(){} close(){} clear(){}
  addMarkers(markers){this.markers=markers;} removeMarkers(){}
}
class MapView extends MapObject {
  constructor(node,options){super(options);this.level=options.level;}
  getLevel(){return this.level;} setLevel(level){this.level=level;}
  panTo(center){this.center=center;} relayout(){} setDraggable(){}
}
class LatLng {constructor(lat,lng){this.lat=lat;this.lng=lng;}getLat(){return this.lat;}getLng(){return this.lng;}}
w.kakao={maps:{Map:MapView,LatLng,Marker:MapObject,MarkerClusterer:MapObject,InfoWindow:MapObject,
  Circle:MapObject,CustomOverlay:MapObject,Polygon:MapObject,MarkerImage:MapObject,Point:MapObject,Size:MapObject,
  event:{addListener(target,event,handler){(target.events[event] ||= []).push(handler);}},load(callback){callback();}}};
const fetched=[];
w.fetch=async(input)=>{
  const url=new URL(String(input),'http://localhost/');
  assert.equal(url.origin,'http://localhost','No real external API calls in app boot test');
  const file=path.resolve(root,decodeURIComponent(url.pathname).replace(/^\//,''));
  assert(file.startsWith(root+path.sep));
  fetched.push(url.pathname);
  if(!fs.existsSync(file))return {ok:false,status:404};
  return {ok:true,status:200,text:async()=>fs.readFileSync(file,'utf8'),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
};
const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const education=fs.readFileSync(path.join(root,'assets/education-layers.js'),'utf8');
w.eval(education+'\n'+inline+'\nwindow.__app={state,init,getAiSchoolContext,setSchoolPanelSelection};');
(async()=>{
  const app=w.__app;
  await app.init();
  assert.deepEqual(errors,[],'App boot must complete without runtime errors');
  const selector=w.document.getElementById('schoolLevelFilter');
  assert.equal(selector.disabled,false,'Boot must initialize the education extension');
  assert.equal(app.state.datasets.educationAllSchools.length,916);
  assert.equal(app.state.datasets.schools.length,272);
  assert(fetched.includes('/data_processed/education/school_analysis.json'));
  for(const [level,count] of [['유치원',369],['중학교',146],['고등학교',129]]){
    selector.value=level;selector.dispatchEvent(new w.Event('change'));
    assert.equal(app.state.datasets.schools.length,count);
    assert.equal(app.state.overlays.schoolMarkers.length,count);
    const school=app.state.datasets.schools[0];
    const marker=app.state.overlays.schoolMarkers[0];
    assert(marker.events.click?.length);
    for(const click of marker.events.click) await click();
    assert.equal(app.state.selectedSchoolId,school.학교ID);
    const context=app.getAiSchoolContext();
    assert.equal(context.school_level,level);
    assert.equal(context.analysis_version,'education_v1');
    assert.equal(context.school_id,school.학교ID);
    assert.equal(context.iso_child_6_12,undefined,'No elementary model facts in extended AI context');
    await w.EducationLayers.openReport(school);
    assert(w.document.querySelector('.edu-body').textContent.includes(school.학교명));
  }
  const academy=w.document.getElementById('toggleAcademy');
  academy.checked=true;academy.dispatchEvent(new w.Event('change'));
  assert.equal(app.state.overlays.academyMarkers.length,6743);
  assert(app.state.overlays.academyMarkers.every(m=>m.map===app.state.map));
  academy.checked=false;academy.dispatchEvent(new w.Event('change'));
  assert(app.state.overlays.academyMarkers.every(m=>m.map===null));
  assert.deepEqual(errors,[],'Real rendering/filter functions must not throw');
  console.log('Full page boot passed: actual loadData, extension initialization, school markers, filters, report and AI context.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
