import requests,json,base64,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://education-living-area-preview-production.up.railway.app'
s=requests.Session();s.headers['x-update-center-token']='2026'
file=ROOT/'contest_plan/live_persistence_20260911.json'
def get(route):
    r=s.get(BASE+route,timeout=40);r.raise_for_status();return r.json()
def post(route,body):
    r=s.post(BASE+'/api/update-center/documents/'+route,json=body,timeout=90);r.raise_for_status();return r.json()
if sys.argv[1]=='before':
    body='학교명,검증값\n인천석암초등학교,1'
    doc=post('import',{'name':'재배포보존_검증후삭제.csv','base64':base64.b64encode(body.encode()).decode()})
    r=s.get(BASE+'/data_processed/education/school_zones.geojson',timeout=40);r.raise_for_status()
    result={'document_id':doc['id'],'before_sha256':hashlib.sha256(r.content).hexdigest(),'versions_before':get('/api/update-center/versions?dataset=school_zones'),'before_events':get('/api/update-center/events?limit=3')}
    file.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Before redeploy: synthetic document saved and active zone hash recorded')
else:
    result=json.loads(file.read_text(encoding='utf-8'))
    try:
        evidence=post('analyze',{'document_id':result['document_id'],'mode':'evidence','level':'초등학교'})
        assert evidence['status']=='ok'
        r=s.get(BASE+'/data_processed/education/school_zones.geojson',timeout=40);r.raise_for_status()
        result['after_sha256']=hashlib.sha256(r.content).hexdigest()
        assert result['before_sha256']==result['after_sha256'],'Active zone version lost on redeploy'
        result['restore_status']=get('/api/update-center/restore-status')
        result['document_survived']=True
        result['schedule']=get('/api/update-center/schedule')
    finally:
        post('delete',{'document_id':result['document_id']});result['test_document_deleted']=True
        file.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Live redeploy: document and v001 zone hash preserved, test document deleted PASS')
    r=s.post(BASE+'/api/update-center/scan',json={'dataset':'school_zones'},timeout=700);r.raise_for_status()
    scan=r.json();result['second_scan']=scan
    file.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    assert scan['summary']['unchanged']==1 and not scan['events'],'Expected stable source after restart'
    print('Live subsequent collection: unchanged source, no duplicate version PASS')
