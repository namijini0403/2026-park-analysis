import json,requests
from pathlib import Path
root=Path(__file__).resolve().parents[1]
local=json.loads((root/'data_processed/education/school_zones.geojson').read_text(encoding='utf-8'))
r=requests.get('https://education-living-area-preview-production.up.railway.app/data_processed/education/school_zones.geojson',timeout=40);r.raise_for_status();remote=r.json()
count=0;maximum=0;other=[]
def compare(a,b,p=''):
    global count,maximum
    if a==b:return
    if isinstance(a,(int,float)) and isinstance(b,(int,float)):
        count+=1;maximum=max(maximum,abs(a-b));return
    if type(a)!=type(b):other.append(p+':type');return
    if isinstance(a,dict):
        if a.keys()!=b.keys():other.append(p+':keys');return
        for k in a:compare(a[k],b[k],p+'/'+k)
    elif isinstance(a,list):
        if len(a)!=len(b):other.append(p+':length');return
        for i,(x,y) in enumerate(zip(a,b)):compare(x,y,p+'/'+str(i))
    else:other.append(p)
compare(local,remote)
result={'numeric_differences':count,'max_absolute_difference':maximum,'other_differences':other[:30],'source_hashes_equal':[s['sha256'] for s in local['metadata']['sources']]==[s['sha256'] for s in remote['metadata']['sources']]}
(root/'contest_plan/zone_normalization_comparison_20260911.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
