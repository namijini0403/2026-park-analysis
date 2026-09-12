// Older persisted cards must not restore automatic cross-resource priorities.
const fs=require('fs'),path=require('path');
function normalize(data){
 if(data.schema_version===2)return data;
 return {schema_version:2,generated_note:'기존 카드의 자동 우선 선택 해제',schools:Object.fromEntries(Object.entries(data.schools||{}).map(([id,c])=>[id,{
  '학교명':c['학교명'],separate_track:!!c.separate_track,status:'pending',primary_module:null,base:{primary_action:null,alternative:null},stability:null,scenarios:{},evidence:[],
  options:[{module:'park',label:'공원·학교 활동공간 검토',condition:'활동면적·출입구 경로·안전·개방조건 확인'},{module:'reading',label:'도서관 연계·학교 장서 보완 검토',condition:'장서 구성·이용시간·운영인력·수요 확인'}],note:'과거 자동 우선순위를 해제했습니다. 최신 원자료로 관측 카드를 갱신해야 합니다.'}]))};
}
function apply(root){
 const source=path.join(root,'data_processed/school_library_access.csv');
 if(fs.existsSync(source)){require('child_process').execFileSync('python',[path.join(root,'scripts/reading_module/apply_reading_gap_types.py')],{stdio:'pipe'});const target=path.join(root,'vercel_public/data_processed/school_library_access.csv');if(fs.existsSync(target)&&fs.realpathSync(source)!==fs.realpathSync(target))fs.copyFileSync(source,target);}
 for(const rel of ['data_processed/policy_action_cards.json','vercel_public/data_processed/policy_action_cards.json']){const p=path.join(root,rel);if(fs.existsSync(p)){const old=JSON.parse(fs.readFileSync(p,'utf8'));if(old.schema_version!==2)fs.writeFileSync(p,JSON.stringify(normalize(old)));}}}
module.exports={normalize,apply};
