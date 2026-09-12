import base64,hashlib,io,json,zipfile
from pathlib import Path
import requests
from openpyxl import Workbook
ROOT=Path(__file__).resolve().parents[1]
BASE='https://education-living-area-preview-production.up.railway.app'
s=requests.Session();s.headers['x-update-center-token']='2026'
checks=[]
for file in ['index.html','assets/school-zones.js','assets/office-documents.js','office-documents.html','data_processed/education/school_zones.geojson']:
    response=s.get(BASE+'/'+file,timeout=40);response.raise_for_status()
    expected=(ROOT/'vercel_public'/file).read_bytes()
    assert response.content==expected,file+' differs'
    checks.append({'file':file,'sha256':hashlib.sha256(expected).hexdigest(),'status':response.status_code})
schedule=s.get(BASE+'/api/update-center/schedule',timeout=30);schedule.raise_for_status()
coverage=s.get(BASE+'/api/update-center/coverage',timeout=30);coverage.raise_for_status()
schools=json.loads((ROOT/'data_processed/education/analysis_dataset.json').read_text(encoding='utf-8'))['schools']
schools=[row for row in schools if row['level']=='초등학교'][:12]
book=Workbook();book.active.append(['학교명','활동횟수'])
for i,row in enumerate(schools):book.active.append([row['name'],i+1])
xlsx=io.BytesIO();book.save(xlsx)
def post(route,body,timeout=90):
    response=s.post(BASE+'/api/update-center/'+route,json=body,timeout=timeout)
    response.raise_for_status();return response.json()
formats=[]
for ext,data in [('xlsx',xlsx.getvalue())]:
    imported=post('documents/import',{'name':'통합분석_검증.'+ext,'base64':base64.b64encode(data).decode()})
    try:
        result=post('documents/analyze',{'document_id':imported['id'],'mode':'table','table_index':0,'school_column':0,'value_column':1,'level':'초등학교','year':2026,'compare_field':'students'})
        assert result['join']['matched_numeric']==12
        formats.append({'format':ext,'matched':12,'status':result['status'],'document_deleted':True})
    finally:post('documents/delete',{'document_id':imported['id']})
for ext,file in [('docx','word/document.xml'),('hwpx','Contents/section0.xml')]:
    archive=io.BytesIO()
    with zipfile.ZipFile(archive,'w') as z:z.writestr(file,'<root><p><t>'+schools[0]['name']+' 야외활동 검토 자료</t></p></root>')
    imported=post('documents/import',{'name':'근거검증.'+ext,'base64':base64.b64encode(archive.getvalue()).decode()})
    try:
        result=post('documents/analyze',{'document_id':imported['id'],'mode':'evidence','level':'초등학교','school_id':schools[0]['id'],'year':2026})
        assert result['matches'][0]['id']==schools[0]['id'];formats.append({'format':ext,'evidence_match':True,'document_deleted':True})
    finally:post('documents/delete',{'document_id':imported['id']})
assert requests.get(BASE+'/api/update-center/coverage',timeout=30).status_code==401
assert requests.get(BASE+'/data/update_center_store.json',timeout=30).status_code==404
pre={'url':BASE,'files':checks,'schedule':schedule.json(),'coverage_counts':coverage.json()['counts'],'formats':formats,'unauthorized':401,'private_path':404}
(ROOT/'contest_plan/data_integration_live_validation_20260911.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2),encoding='utf-8')
print('Live files, XLSX/DOCX/HWPX, joins/evidence, deletion, auth and private paths PASS',flush=True)
scan=post('scan',{'dataset':'school_zones'},timeout=700)
pre['school_zones_scan']=scan
(ROOT/'contest_plan/data_integration_live_validation_20260911.json').write_text(json.dumps(pre,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(scan,ensure_ascii=True)[:7000],flush=True)
