// UI state tests use this small renderer double; verify_kakao_maps.cjs checks the real SDK.
module.exports=w=>{
 w.EducationMaps={ready:()=>Promise.resolve(),create(container){
  const groups=new Map(),point=(lat,lng)=>({lat,lng});
  const add=(group,kind)=>{const node=w.document.createElement('div');node.dataset.testMapGroup=group;node.dataset.testMapKind=kind;container.append(node);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(node);return node;};
  return {point,fit(){},select(){},close(){},open(position,content){const node=add('popup','popup');if(typeof content==='string')node.innerHTML=content;else node.append(content);},clear(group){for(const n of groups.get(group)||[])n.remove();groups.delete(group);},destroy(){container.replaceChildren();},
   dot(group,position,options={}){const node=add(group,'dot');if(options.count)node.dataset.schoolCount=options.count;node.onclick=options.onClick;return node;},
   circle(group){return add(group,'circle');},
   polygons(group,feature){add(group,'polygon');return [point(37.4,126.6)];},
   route(group){add(group,'route');return [point(37.4,126.6)];}
  };
 }};
};
