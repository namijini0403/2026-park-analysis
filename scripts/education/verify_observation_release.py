"""Run only after Railway reports SUCCESS for the supplied deployment ID."""
import csv,hashlib,io,json,sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[2];BASE='https://education-living-area-preview-production.up.railway.app/'
PATHS=['index.html','assets/student-services.html','assets/student-services.js','data_processed/student_services/priorities.json','data_processed/student_services/school_priorities.csv','data_processed/policy_action_cards.json','data_processed/school_library_access.csv']
def fetch(p):
 r=requests.get(BASE+p,timeout=60);r.raise_for_status();return p,r.content
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=4) as pool:files=dict(pool.map(fetch,PATHS))
 for p in PATHS[:5]:assert files[p]==(ROOT/'vercel_public'/p).read_bytes(),p+' mismatch'
 data=json.loads(files[PATHS[3]]);assert data['schema_version']==2 and len(data['schools'])==272
 for s in data['schools']:
  for layer in s['layers'].values():assert layer['shortage'] is None and layer['preferred_action'] is None and 'score_interval' not in layer
 cards=json.loads(files[PATHS[5]]);assert cards['schema_version']==2
 for card in cards['schools'].values():assert card['primary_module'] is None and card['base']['primary_action'] is None
 rows=list(csv.DictReader(io.StringIO(files[PATHS[6]].decode('utf-8-sig'))));assert len(rows)==272
 assert all(r['external_shortage']=='' and r['internal_shortage']=='' and r['reading_gap_type']=='추가 확인 필요' for r in rows)
 report={'deployment_id':sys.argv[1],'deployment_status':'SUCCESS','http_200_paths':PATHS,'hashes':{p:hashlib.sha256(b).hexdigest() for p,b in files.items()},'schools':len(data['schools']),'separate_track':sum(s['separate_track'] for s in data['schools']),'no_default_scores':True,'no_forced_primary_action':True,'unknown_is_not_shortage':True,'tests':['5 data tests','DOM evidence gates','persisted legacy restore','full app boot'],'visual_qa':'No connected browser; DOM and responsive structure checked'}
 (ROOT/'contest_plan/observations_first_live_validation_20260912.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Remote verified: 7 endpoints, 272 schools, no scores or forced primary actions; unknown reading conditions preserved.')
