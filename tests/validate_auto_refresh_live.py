"""Exercise the deployed scheduler and check the bytes actually served to analysis/map."""
import hashlib
import json
import sys
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
BASE='https://education-living-area-preview-production.up.railway.app'
session=requests.Session();session.headers['x-update-center-token']='2026'
output=ROOT/'contest_plan/auto_refresh_live_validation.json'
report=json.loads(output.read_text(encoding='utf-8')) if output.exists() else {}
def get(route):
    response=session.get(BASE+route,timeout=90);response.raise_for_status();return response
def save():output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

action=sys.argv[1]
if action in ['libraries','school_public_disclosures']:
    before=get('/api/data-revision').json()
    response=session.post(BASE+'/api/update-center/scan',json={'dataset':action},timeout=1800)
    response.raise_for_status();body=response.json()
    report[action]={'response':body,'before':before,'after':get('/api/data-revision').json()};save()
    assert body['summary']['error']==0 and body['summary']['red']==0,body
    assert body['summary']['unchanged'] or any(e['status']=='applied' for e in body['events']),body
    print(action,body['summary'],[(e['dataset'],e['status']) for e in body['events']],flush=True)
elif action=='inspect':
    for name in ['assets/data-refresh.js','update-center.html']:
        response=get('/'+name)
        assert response.content==(ROOT/'vercel_public'/name).read_bytes()
    coverage=get('/api/update-center/coverage').json();schedule=get('/api/update-center/schedule').json()['schedule']
    assert coverage['counts']['validated_auto_apply']==3
    assert schedule['enabled'] and schedule['timer_armed'] and schedule['interval_min']==1440
    report['coverage']=coverage;report['schedule']=schedule
    expected=get('/data_processed/education/analysis_dataset.json').json()
    library=get('/data_processed/education/library_access_preview.json').json()
    assert len(expected['schools'])==917
    assert len(library['schools'])==917 and library['candidate_count']==7304
    response=session.post(BASE+'/api/analysis',json={'question':'초등학교 학생수와 도서관 수는 관련 있어?','plan':{'method':'relationship','level':'초등학교','gu':'전체','year':2026,'x':'students','y':'library','controls':[]}},timeout=90)
    report['analysis_http_status']=response.status_code
    report['versions']=get('/api/update-center/versions').json()
    report['served']={name:hashlib.sha256(get('/data_processed/'+name).content).hexdigest() for name in [
        'libraries.csv','school_library_access.csv','education/analysis_dataset.json','education/school_statistics.json','education/library_access_scenarios.json','context/education_school_evidence.json']}
    report['restore']=get('/api/update-center/restore-status').json();save()
    assert response.ok,response.text[:500]
    print('Live assets, daily scheduler, 917-school analysis and 7,304 library candidates verified',flush=True)
elif action=='persistence':
    for name,sha in report['served'].items():assert hashlib.sha256(get('/data_processed/'+name).content).hexdigest()==sha,name
    report['after_redeploy_restore']=get('/api/update-center/restore-status').json();save()
    print('All refreshed serving artifacts survived redeployment',flush=True)
