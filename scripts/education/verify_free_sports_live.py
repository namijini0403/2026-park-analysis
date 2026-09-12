import hashlib,json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests
from scripts.education.walkin_sports import eligible
ROOT=Path(__file__).resolve().parents[2]
BASE='https://education-living-area-preview-production.up.railway.app'
paths=['index.html','assets/student-services.html','assets/student-services.js','data_processed/student_services/facilities.json','data_processed/student_services/priorities.json','data_processed/student_services/school_priorities.csv']
def check(path):
 r=requests.get(BASE+'/'+path,timeout=60);r.raise_for_status()
 local=(ROOT/'vercel_public'/path).read_bytes()
 assert hashlib.sha256(local).digest()==hashlib.sha256(r.content).digest(),path+' differs from release'
 return {'path':path,'http_status':r.status_code,'sha256':hashlib.sha256(r.content).hexdigest()}
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=4) as pool: checks=list(pool.map(check,paths))
 d=requests.get(BASE+'/data_processed/student_services/priorities.json',timeout=60).json()
 sports=[f for f in d['facilities'] if f['kind']=='sports']
 assert len(sports)==25 and all(eligible(f) for f in sports)
 assert all(f['latitude'] is not None and f['longitude'] is not None for f in sports)
 assert len(d['schools'])==272 and len(d['candidates'])==2121
 report={'deployment_id':'9bc69e1e-4d26-435d-8b53-f7e05189a1bd','deployment_status':'SUCCESS','url':BASE+'/assets/student-services.html','checks':checks,'sports':len(sports),'welfare':d['coverage']['counts']['welfare'],'schools':len(d['schools']),'candidates':len(d['candidates']),'policy':'public_free_walkin_students_v1','legacy_sports_excluded':27,'unit_tests':7,'ui_tests':['student_services','method_review'],'limitation':'Official explicit walk-in subset, not complete city inventory; no real browser visual QA available'}
 (ROOT/'contest_plan/free_sports_live_validation_20260911.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False))
