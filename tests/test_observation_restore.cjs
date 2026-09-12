const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');const {apply}=require('../scripts/policy_cards/observed_cards.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'observed-restore-'));
for(const p of ['data_processed','vercel_public/data_processed','scripts/reading_module'])fs.mkdirSync(path.join(root,p),{recursive:true});
fs.copyFileSync(path.join(__dirname,'../scripts/reading_module/apply_reading_gap_types.py'),path.join(root,'scripts/reading_module/apply_reading_gap_types.py'));
const csv='학교ID,학교명,iso_public_library_count,인당장서수,사서합계,external_shortage,internal_shortage,demand_high,reading_gap_type\ns1,학교,0,10,0,True,True,True,direct_investment_first\n';
for(const p of ['data_processed','vercel_public/data_processed']){fs.writeFileSync(path.join(root,p,'school_library_access.csv'),csv);fs.writeFileSync(path.join(root,p,'policy_action_cards.json'),JSON.stringify({schools:{s1:{primary_module:'park',base:{primary_action:'external_supply_new'},stability:1}}}));}
apply(root);for(const p of ['data_processed','vercel_public/data_processed']){const c=JSON.parse(fs.readFileSync(path.join(root,p,'policy_action_cards.json')));assert.equal(c.schools.s1.base.primary_action,null);assert.equal(c.schools.s1.primary_module,null);assert(!fs.readFileSync(path.join(root,p,'school_library_access.csv'),'utf8').includes('direct_investment_first'));}
console.log('Persisted legacy recommendations cannot reappear after restore');
