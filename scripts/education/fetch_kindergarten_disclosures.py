"""Download public kindergarten disclosures from the site's documented download form."""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import pandas as pd
import requests

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/education_sources/kindergarten'
BASE='https://e-childschoolinfo.moe.go.kr'


def fetch(timing,item,title):
    path=OUT/f'{timing}_{item}.json'
    params={'combineSidoCode':'28','combineSidoName':'인천광역시','timingListCode':str(timing),'gongsiListCode':item,'ExcelCsv':'3'}
    if not path.exists():
        response=requests.get(BASE+'/download/getOpenData.do',params=params,timeout=60)
        response.raise_for_status()
        data=response.json()
        if not isinstance(data.get('header'),list) or not isinstance(data.get('body'),list):
            raise ValueError('Unexpected download schema')
        # Retain institutional facts; omit individual principal/representative names.
        keep=[i for i,label in enumerate(data['header']) if label not in ['대표자명','원장명']]
        data={'header':[data['header'][i] for i in keep],'body':[[row[i] for i in keep] for row in data['body']],
              'response_sha256':hashlib.sha256(response.content).hexdigest(),'source_url':BASE+'/openData.do','request':params}
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    data=json.loads(path.read_text(encoding='utf-8'))
    return {'timing':timing,'item':item,'title':title,'file':path.name,'rows':len(data['body']),'status':'available' if data['body'] else 'empty'}


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    jobs={(year*10+1,'05','일반 현황') for year in range(2013,2027)}
    # The selected download periods include complementary April/October disclosures.
    for timing in [20252,20261]:
        response=requests.get(BASE+f'/gongsi/{timing}/findGongsiList.do',timeout=30)
        response.raise_for_status()
        for title,item in response.json().items():jobs.add((timing,item,title))
    jobs=sorted({(timing,item): (timing,item,'일반 현황' if item=='05' else title) for timing,item,title in jobs}.values())
    def safe(job):
        try:return fetch(*job)
        except Exception as error:return {'timing':job[0],'item':job[1],'title':job[2],'status':'failed','error':str(error)}
    with ThreadPoolExecutor(max_workers=4) as executor:
        records=list(executor.map(safe,jobs))
    for record in records:
        if record['status']=='available' and record['item']=='05' and str(record['timing']).endswith('1'):
            source=json.loads((OUT/record['file']).read_text(encoding='utf-8'))
            target=OUT/f"유치원 일반 현황_{record['timing']}_인천광역시.csv"
            pd.DataFrame(source['body'],columns=source['header']).to_csv(target,index=False,encoding='utf-8-sig')
    (OUT/'manifest.json').write_text(json.dumps({'source_url':BASE+'/openData.do','records':records},ensure_ascii=False,indent=2),encoding='utf-8')
    print([(r['timing'],r['item'],r.get('rows'),r['status']) for r in records],flush=True)


if __name__=='__main__':main()
