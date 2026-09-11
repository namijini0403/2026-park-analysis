// Execute the real page's boot/data/filter paths; only the external map SDK and network are mocked.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/',pretendToBeVisual:true});
const w=dom.window,errors=[];
const resizeObservers=[];
w.ResizeObserver=class {constructor(callback){this.callback=callback;}observe(target){this.target=target;resizeObservers.push(this);}};
w.addEventListener('error',event=>errors.push(String(event.error||event.message)));
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
  setBounds(bounds){this.bounds=bounds;}
  panTo(center){this.center=center;} getCenter(){return this.center;} setCenter(center){this.center=center;}
  relayout(){this.relayoutCount=(this.relayoutCount||0)+1;} setDraggable(){}
}
class LatLng {constructor(lat,lng){this.lat=lat;this.lng=lng;}getLat(){return this.lat;}getLng(){return this.lng;}}
w.kakao={maps:{Map:MapView,LatLng,Marker:MapObject,MarkerClusterer:MapObject,InfoWindow:MapObject,
  Polyline:MapObject,LatLngBounds:class {constructor(){this.points=[];}extend(point){this.points.push(point);}},Circle:MapObject,CustomOverlay:MapObject,Polygon:MapObject,MarkerImage:MapObject,Point:MapObject,Size:MapObject,
  event:{addListener(target,event,handler){(target.events[event] ||= []).push(handler);}},load(callback){callback();}}};
const fetched=[];
let holdBaseline=false,releaseBaseline;
w.fetch=async(input)=>{
  const url=new URL(String(input),'http://localhost/');
  assert.equal(url.origin,'http://localhost','No real external API calls in app boot test');
  const file=path.resolve(root,decodeURIComponent(url.pathname).replace(/^\//,''));
  assert(file.startsWith(root+path.sep));
  fetched.push(url.pathname);
  if(!fs.existsSync(file))return {ok:false,status:404};
  const response={ok:true,status:200,text:async()=>fs.readFileSync(file,'utf8'),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
  if(holdBaseline && url.pathname==='/data_processed/candidate_grid_final.geojson') return await new Promise(resolve=>{releaseBaseline=()=>resolve(response);});
  return response;
};
const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const education=fs.readFileSync(path.join(root,'assets/education-layers.js'),'utf8');
w.eval(fs.readFileSync(path.join(root,'assets/education-statistics.js'),'utf8'));
w.eval(fs.readFileSync(path.join(root,'assets/education-networks.js'),'utf8'));
w.eval(fs.readFileSync(path.join(root,'assets/education-questions.js'),'utf8'));
w.eval(education+'\n'+inline+'\nwindow.__app={state,init,getAiSchoolContext,setSchoolPanelSelection,loadCandidateLayer,runShortcutAction};');
(async()=>{
  const app=w.__app;
  await app.init();
  assert.deepEqual(errors,[],'App boot must complete without runtime errors');
  const selector=w.document.getElementById('schoolLevelFilter');
  assert.equal(selector.disabled,false,'Boot must initialize the education extension');
  assert.equal(app.state.datasets.educationAllSchools.length,917);
  assert.equal(app.state.datasets.schools.length,272);
  const mapResize=resizeObservers.find(observer=>observer.target.id==='map');
  const camera=new LatLng(37.5,126.7);
  app.state.map.setCenter(camera);
  app.state.map.events.center_changed.forEach(callback=>callback());
  app.state.map.center=new LatLng(38,127); // SDK center drifts when container dimensions change.
  mapResize.callback();
  assert.equal(app.state.map.getCenter(),camera,'Viewport resizing preserves the map center');
  assert.equal(app.state.map.relayoutCount,1);
  assert.equal(app.state.clusterer.markers.length,272,'Overview groups schools at the initial zoom');
  assert(w.document.querySelector('.workspace-header .map-search-box #guFilter'));
  assert.equal(w.document.querySelectorAll('.workspace-header nav > button').length,3);
  assert.equal(w.document.getElementById('workspaceMore').open,false);
  await app.runShortcutAction('report');
  assert.equal(app.state.selectedSchoolId,null,'No arbitrary school is selected for a report');
  assert.equal(w.document.activeElement.id,'schoolSearchInput');
  assert(w.document.querySelector('.map-search-status').textContent.includes('먼저 학교'));
  const menu=w.document.getElementById('mapDisplayMenu');
  assert.equal(menu.open,false,'Map controls start collapsed');
  assert.equal(w.document.getElementById('mapDisplayCount').textContent,'학교만');
  assert.equal(w.document.getElementById('mapPolicyColors').checked,false);
  assert.equal(w.document.getElementById('mapReachScope').value,'selected');
  assert(w.document.querySelector('#mapDiagnosticFilters .case-filter-group'));
  const routedSchool=app.state.datasets.educationAllSchools.find(r=>r.analysis_version&&JSON.parse(fs.readFileSync(path.join(root,'data_processed/education/school_routes.json'),'utf8'))[r.학교ID].status==='available');
  await w.EducationLayers.openReport(routedSchool);
  w.document.getElementById('edu-show-route').click();
  const routeOverlays=[...app.state.overlays.educationRoute];
  assert(routeOverlays.length>=4);
  assert(routeOverlays.every(o=>o.map===app.state.map));
  assert(routeOverlays.some(o=>o.options.strokeStyle==='shortdash'));
  assert(app.state.map.bounds.points.length>2);
  assert.equal(w.document.getElementById('educationReportDialog').open,false);
  app.setSchoolPanelSelection(app.state.datasets.schools[0]);
  assert(routeOverlays.every(o=>o.map===null));
  assert.equal(app.state.overlays.educationRoute.length,0);

  assert(fetched.includes('/data_processed/education/school_analysis.json'));
  const baselineRequests=()=>fetched.filter(p=>p==='/data_processed/candidate_grid_final.geojson').length;
  const initialRequests=baselineRequests();
  const bufferToggle=w.document.getElementById('toggleBuffer');
  const reachScope=w.document.getElementById('mapReachScope');
  reachScope.value='filtered';reachScope.dispatchEvent(new w.Event('change'));
  bufferToggle.checked=true;bufferToggle.dispatchEvent(new w.Event('change'));
  for(const [level,count] of [['유치원',369],['중학교',147],['고등학교',129]]){
    const oldBuffers=[...app.state.overlays.bufferPolygons];
    selector.value=level;selector.dispatchEvent(new w.Event('change'));
    assert.equal(app.state.datasets.schools.length,count);
    const schoolIds=new Set(app.state.datasets.schools.map(s=>s.학교ID));
    assert.equal(app.state.datasets.buffer.features.length,count);
    assert.equal(app.state.overlays.bufferPolygons.length,count);
    assert(app.state.overlays.bufferPolygons.every(p=>schoolIds.has(p.__schoolKeys[0]) && p.map===app.state.map));
    assert(oldBuffers.every(p=>p.map===null),'Previous school-level buffers must be removed');
    assert.equal(app.state.overlays.schoolMarkers.length,count);
    assert(app.state.overlays.candidateMarkers.length>0);
    assert(app.state.overlays.candidateMarkers.every(p=>p.__educationKind==='extended_survey_grid'));
    assert.equal(app.state.datasets.candidateFeatures.length,0);
    const school=app.state.datasets.schools[0];
    const marker=app.state.overlays.schoolMarkers[0];
    assert(marker.events.click?.length);
    w.document.getElementById('educationReportDialog')?.close();
    for(const click of marker.events.click) await click();
    assert.equal(app.state.selectedSchoolId,school.학교ID);
    assert.equal(w.document.getElementById('educationReportDialog').open,false,'School selection keeps the map visible');
    assert(w.document.getElementById('openSelectedEducationReport'),'Detailed report remains available on request');
    assert.equal(new Set(app.state.datasets.isochrone.features.map(f=>f.properties.학교ID)).size,count,'Every school level has its own walkshed');
    const walkToggle=w.document.getElementById('toggleIsochrone');
    walkToggle.checked=true;reachScope.value='selected';reachScope.dispatchEvent(new w.Event('change'));
    const visibleWalks=app.state.overlays.isochronePolygons.filter(p=>p.map===app.state.map);
    assert(visibleWalks.length>0);
    assert(visibleWalks.every(p=>p.__schoolKeys.includes(school.학교ID)),'Only the selected school walkshed is shown');
    assert(app.state.overlays.bufferPolygons.filter(p=>p.map===app.state.map).every(p=>p.__schoolKeys.includes(school.학교ID)));
    walkToggle.checked=false;reachScope.value='filtered';reachScope.dispatchEvent(new w.Event('change'));
    const context=app.getAiSchoolContext();
    assert.equal(context.school_level,level);
    assert.equal(context.analysis_version,'education_v1');
    assert.equal(context.school_id,school.학교ID);
    assert.equal(context.iso_child_6_12,undefined,'No elementary model facts in extended AI context');
    await w.EducationLayers.openReport(school);
    assert(w.document.querySelector('.edu-body').textContent.includes(school.학교명));
    const grid=app.state.overlays.candidateMarkers[0];
    grid.events.click[0]();
    const schoolPicker=w.document.getElementById('edu-candidate-school');
    assert([...schoolPicker.options].every(o=>o.textContent.includes(level)));
    await w.document.getElementById('edu-candidate-open-school').onclick();
    assert.equal(app.state.selectedPanelData.학교급구분,level);
    assert.equal(w.document.getElementById('edu-map-candidate').value,grid.__gridId);
  }
  assert.equal(baselineRequests(),initialRequests,'Extended filters must not reload elementary candidates');
  const corrected=app.state.datasets.educationAllSchools.find(s=>s.학교ID==='B000030928');
  assert.equal(corrected.학교명,'인천검단가온중학교');
  assert.equal(corrected.학교급구분,'중학교');
  await w.EducationLayers.openReport(corrected);
  assert(w.document.querySelector('.edu-body').textContent.includes('인천검단가온중학교'));
  assert(w.document.querySelector('.edu-body').textContent.includes('졸업 후 진로 현황'));
  assert(corrected.disclosure_count>0);
  assert(corrected.candidates.length>0);
  const district=w.document.getElementById('guFilter');
  for(const gu of ['제물포구','영종구','서해구','검단구']) assert([...district.options].some(o=>o.value===gu));
  selector.value='유치원';selector.dispatchEvent(new w.Event('change'));
  for(const gu of ['제물포구','영종구','서해구','검단구']){
    district.value=gu;district.dispatchEvent(new w.Event('change'));
    const expected=app.state.datasets.schools.filter(s=>s.gu===gu);
    assert(expected.length>0);
    assert.equal(app.state.selectedGu,gu);
    assert.equal(app.state.overlays.schoolMarkers.filter(m=>m.map===app.state.map).length,expected.length);
    w.EducationLayers.openStatistics();
    const statsRow=w.document.querySelector('.edu-body table tbody tr');
    assert.equal(statsRow.children[0].textContent,'유치원');
    assert.equal(statsRow.children[1].textContent,String(expected.length));
    assert(app.state.overlays.candidateMarkers.length>0);
  }
  const searched=app.state.datasets.schools.find(s=>s.gu==='서해구' && s.학교명==='인천건지초등학교병설유치원');
  const search=w.document.getElementById('schoolSearchInput');
  search.value=searched.학교명;search.dispatchEvent(new w.Event('change'));
  assert.equal(district.value,'서해구','Search must not blank the district selector');
  assert.equal(app.state.selectedGu,'서해구');
  assert.equal(app.state.selectedSchoolId,searched.학교ID);
  district.value='전체';district.dispatchEvent(new w.Event('change'));
  const restoredSchool=app.state.datasets.educationAllSchools.find(s=>s.statistical_region_2025?.historical_address);
  assert(restoredSchool);
  await w.EducationLayers.openReport(restoredSchool);
  const restoredReport=w.document.querySelector('.edu-body').textContent;
  assert(restoredReport.includes(restoredSchool.statistical_region_2025.historical_address));
  assert(restoredReport.includes('2025년 행정구역 기준 지역 전체 통계'));
  assert(!restoredReport.includes('해당 지역·학교급의 검증 가능한 예측 자료 미확보'));
  assert(restoredReport.includes(`2025년 행정구역 ${restoredSchool.statistical_region_2025.region_name} 전체`));
  const unresolvedSchool=app.state.datasets.educationAllSchools.find(s=>s.statistical_region_2025?.basis==='unverified');
  await w.EducationLayers.openReport(unresolvedSchool);
  assert(w.document.querySelector('.edu-body').textContent.includes('해당 지역·학교급의 검증 가능한 예측 자료 미확보'));
  // A late elementary response must not replace the newly selected middle-school grid.
  holdBaseline=true;selector.value='초등학교';selector.dispatchEvent(new w.Event('change'));
  assert(releaseBaseline);
  selector.value='중학교';selector.dispatchEvent(new w.Event('change'));
  releaseBaseline();holdBaseline=false;
  await new Promise(resolve=>setTimeout(resolve,0));
  assert(app.state.overlays.candidateMarkers.every(p=>p.__educationKind==='extended_survey_grid'));
  assert.equal(app.state.datasets.candidateFeatures.length,0);
  selector.value='all';selector.dispatchEvent(new w.Event('change'));await app.loadCandidateLayer();
  assert.equal(app.state.datasets.buffer.features.length,917);
  assert.equal(new Set(app.state.datasets.buffer.features.map(f=>f.properties.학교ID)).size,917);
  assert.equal(app.state.overlays.candidateMarkers.filter(p=>p.__educationKind==='extended_survey_grid').length,3083);
  assert.equal(app.state.overlays.candidateMarkers.filter(p=>p.__educationKind==='elementary_baseline').length,1535);
  selector.value='초등학교';selector.dispatchEvent(new w.Event('change'));await app.loadCandidateLayer();
  assert.equal(app.state.datasets.buffer.features.length,272);
  assert(app.state.datasets.buffer.features.every(f=>app.state.datasets.educationBaseBuffer.features.includes(f)));
  bufferToggle.checked=false;bufferToggle.dispatchEvent(new w.Event('change'));
  assert(app.state.overlays.bufferPolygons.every(p=>p.map===null));
  assert.equal(app.state.overlays.candidateMarkers.length,1535);
  assert(app.state.overlays.candidateMarkers.every(p=>p.__educationKind==='elementary_baseline'));
  const academy=w.document.getElementById('toggleAcademy');
  const facilityScope=w.document.getElementById('mapFacilityScope');
  app.setSchoolPanelSelection(app.state.datasets.schools[0]);
  academy.checked=true;academy.dispatchEvent(new w.Event('change'));
  assert.equal(app.state.overlays.academyMarkers.length,6810);
  const nearbyAcademies=app.state.overlays.academyMarkers.filter(m=>m.map===app.state.map);
  assert(nearbyAcademies.length>0 && nearbyAcademies.length<6810,'Facility view is limited to the selected school surroundings');
  facilityScope.value='all';facilityScope.dispatchEvent(new w.Event('change'));
  assert(app.state.overlays.academyMarkers.every(m=>m.map===app.state.map));
  academy.checked=false;academy.dispatchEvent(new w.Event('change'));
  assert(app.state.overlays.academyMarkers.every(m=>m.map===null));
  w.document.querySelector('[data-map-preset="walk"]').click();
  assert.equal(w.document.getElementById('toggleIsochrone').checked,true);
  assert.equal(w.document.getElementById('toggleParks').checked,true);
  assert.equal(w.document.getElementById('toggleLibrary').checked,false);
  assert.equal(reachScope.value,'selected');
  w.document.querySelector('[data-map-preset="none"]').click();
  assert.equal(w.document.getElementById('mapDisplayCount').textContent,'학교만');
  assert(app.state.overlays.isochronePolygons.every(p=>p.map===null));
  menu.open=true;w.document.getElementById('mapDisplayClose').click();assert.equal(menu.open,false);
  w.document.getElementById('statisticsShortcutButton').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert(w.document.querySelector('#educationCorrelations .edu-stat-result'));
  assert(w.document.querySelector('#educationCorrelations').textContent.includes('Pearson'));
  assert.equal(w.document.querySelector('#educationCorrelations [data-filter="level"]').value,'초등학교');
  const statsPanel=w.document.getElementById('education-statistics-panel');
  assert.equal(statsPanel.hidden,false);
  w.document.getElementById('education-insights-tab').click();
  for(let i=0;i<30&&!w.document.querySelector('#educationRoadResilience select');i++) await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(statsPanel.hidden,true);
  assert.equal(w.document.querySelectorAll('.edu-insight-card').length,5);
  assert(w.document.querySelector('#educationQuestionAnalysis form'));
  assert.equal(w.document.querySelector('.edu-precomputed-insights').open,false,'Precomputed results do not overwhelm the question screen');
  assert(w.document.querySelector('#educationRoadResilience select'));
  w.document.getElementById('education-insights-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft'}));
  assert.equal(statsPanel.hidden,false);
  assert.equal(w.document.getElementById('education-statistics-tab').getAttribute('aria-selected'),'true');
  w.document.getElementById('insightsShortcutButton').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(w.document.getElementById('education-insights-panel').hidden,false);
  assert.equal(w.document.getElementById('education-statistics-panel').hidden,true);
  await app.runShortcutAction('guide');
  const guide=w.document.getElementById('guideOverlay');
  assert.equal(guide.querySelectorAll('.workspace-quick-guide ol > li').length,4);
  assert.equal(guide.querySelector('.workspace-guide-reference').open,false);
  assert.equal(guide.querySelectorAll('#guideTitle').length,1);
  assert(guide.querySelector('.workspace-quick-guide').textContent.includes('질문 분석'));
  guide.querySelector('[data-guide-action="map"]').click();
  assert.equal(guide.classList.contains('is-open'),false);
  assert.deepEqual(errors,[],'Real rendering/filter functions must not throw');
  console.log('Full page boot passed: actual loadData, extension initialization, school markers, filters, report and AI context.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
