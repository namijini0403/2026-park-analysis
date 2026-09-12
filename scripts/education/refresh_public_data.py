"""Isolated, reproducible public-data refresh. Never writes to the live data tree.

stdin: {root, work, kind}. stdout: manifest; progress goes to stderr.
The caller owns publication, versioning and rollback after every output validates.
"""
import contextlib
import csv
import hashlib
import importlib
import io
import json
import math
import re
import shutil
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import requests

CODE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(CODE))


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def request(session, method, url, **kwargs):
    for attempt in range(3):
        try:
            r = session.request(method, url, timeout=(15, 90), **kwargs)
            r.raise_for_status()
            if len(r.content) > 60*1024*1024:
                raise ValueError('Public response exceeds 60MB')
            # These public servers sometimes incorrectly advertise a Latin encoding.
            r.encoding = 'utf-8'
            return r
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2**attempt)


def json_response(response):
    return json.loads(response.content.decode('utf-8-sig'))


def validate_source_rows(rows, expected_keys, previous_count, label):
    if previous_count and len(rows)<previous_count*.8:
        raise ValueError(f'Public record loss exceeds 20%: {label}')
    if rows:
        present={k for row in rows for k in row}
        missing=set(expected_keys)-present
        if missing:raise ValueError(f'Public columns removed: {label}: {sorted(missing)}')


def standard(pk):
    session = requests.Session()
    request(session, 'GET', f'https://www.data.go.kr/data/{pk}/standard.do')
    meta = json_response(request(session, 'GET', 'https://www.data.go.kr/download/columList.json', params={'pk':pk, 'ext':'JSON'}))
    total = int(meta['totalCount'])
    if not 0 < total < 500000:
        raise ValueError('Invalid source totalCount')
    columns = {c['columCode']:c['columNm'] for c in meta['columList']}
    records = []
    for page in range(1, math.ceil(total/10000)+1):
        params = {k:meta['tableVO'][k] for k in ['colNmList','svcTableNm']}
        params.update(publicDataPk=pk, totalCount=total, perPage=10000, page=page)
        rows = json_response(request(session, 'GET', 'https://www.data.go.kr/download/standard.json', params=params))
        if not isinstance(rows,list):
            raise ValueError('Expected standard-data record array')
        records.extend({columns.get(k,k):v for k,v in row.items()} for row in rows)
    if len(records) != total:
        raise ValueError(f'Incomplete download: {len(records)}/{total}')
    return records


def libraries(root):
    from scripts.education.refresh_libraries import normalize
    return normalize(standard(15013109), root)


def disclosures(root):
    """Refresh registered public items, including new current-year publication periods.
    Match by existing official code, or unique exact name within a school level.
    Missing/withdrawn observations are retained as such, never as numeric zero.
    """
    edu = root/'data_processed/education'
    registry = list(csv.DictReader((edu/'institutions.csv').open(encoding='utf-8-sig')))
    linked = {p.stem:read(p) for p in (edu/'disclosures').glob('*.json')}
    names = defaultdict(list)
    codes = defaultdict(set)
    source_columns = defaultdict(set)
    levels = {'02':'초등학교','03':'중학교','04':'고등학교'}
    for school in registry:
        names[(school['학교명'],school['학교급구분'])].append(school['학교ID'])
    for sid, rows in linked.items():
        for row in rows:
            source_columns[row.get('source_file','')].update(row.get('values',{}))
            code = row.get('values',{}).get('SCHUL_CODE')
            if code:
                codes[code].add(sid)
    specs = read(edu/'disclosure_coverage.json')['sources']
    specs = [s for s in specs if s.get('file') and s.get('year',0)>=date.today().year-1]
    specs = {(s['item'],s['year'],s['school_level_code'],str(s['depth'])):dict(s) for s in specs}
    contracts = {}
    for item in sorted({s['item'] for s in specs.values()}):
        page = request(requests.Session(),'POST','https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l3.do',data={'GO_NO':item}).text
        key = re.search(r'APIKEY\s*:\s*"([^"]+)"',page)
        if not key:
            raise ValueError(f'Schoolinfo public request contract unavailable: {item}')
        depths = sorted(set(re.findall(r'id="depthNm_([^"]+)"',page)))
        contracts[item] = key.group(1)
        templates = {s['school_level_code']:s for s in specs.values() if s['item']==item}
        for level, template in templates.items():
            for depth in depths:
                year = date.today().year
                spec = dict(template,year=year,depth=depth,file=f'{item}_{year}_{level}_{depth}.json',rows=0)
                specs.setdefault((item,year,level,depth),spec)

    def fetch(spec):
        params = {'APIKEY':contracts[spec['item']], 'APITYPE':spec['item'], 'DEPTHNO':spec['depth'],
                  'SCHULKNDCODE':spec['school_level_code'], 'PBANYR':spec['year'], 'LCTNSCCODE':'04'}
        payload = json_response(request(requests.Session(),'POST','https://www.schoolinfo.go.kr/openData.do',data=params))
        if not isinstance(payload.get('list'),list):
            if not spec.get('rows'):
                return spec,[] # unpopulated publication period; no existing observation erased
            raise ValueError('Schoolinfo missing list: '+spec['file'])
        expected=source_columns.get(spec['file'])
        if expected is None:
            expected={key for name,keys in source_columns.items() if name.startswith(spec['item']+'_') and name.endswith(f"_{spec['school_level_code']}_{spec['depth']}.json") for key in keys}
        validate_source_rows(payload['list'],expected,spec.get('rows',0),spec['file'])
        return spec,payload['list']

    responses = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for response in pool.map(fetch,specs.values()):
            responses.append(response)
            if len(responses)%30==0:print(f'Schoolinfo: {len(responses)}/{len(specs)} responses validated',file=sys.stderr,flush=True)
    replacements = {s['file'] for s,_ in responses}
    previous_count = sum(r.get('source_file') in replacements for rows in linked.values() for r in rows)
    new = {sid:[r for r in rows if r.get('source_file') not in replacements] for sid,rows in linked.items()}
    unmatched = []
    count = 0
    for spec, rows in responses:
        for values in rows:
            ids = list(codes.get(values.get('SCHUL_CODE'),set())) or names[(values.get('SCHUL_NM'),levels[spec['school_level_code']])]
            if len(ids)!=1:
                unmatched.append({'file':spec['file'],'name':values.get('SCHUL_NM')})
                continue
            new.setdefault(ids[0],[]).append({'item':spec['item'],'title':spec['title'],'year':spec['year'],
                'depth':str(spec['depth']),'source_file':spec['file'],'source_url':spec['source_url'],'values':values})
            count += 1
    if previous_count and count < previous_count*.9:
        raise ValueError(f'Schoolinfo coverage fell >10%: {previous_count} -> {count}')
    coverage=read(edu/'disclosure_coverage.json')
    replaced={s['file'] for s,_ in responses}
    coverage['sources']=[s for s in coverage['sources'] if s.get('file') not in replaced]+[
        dict(s,rows=len(rows),sha256=digest(rows),status='available' if rows else 'no_rows_in_public_response') for s,rows in responses]
    coverage['sources'].sort(key=lambda s:(s.get('file',''),s.get('item','')))
    write(edu/'disclosure_coverage.json',coverage)

    # Kindergarten public form publishes its own period list. No guessed future periods.
    page = request(requests.Session(),'GET','https://e-childschoolinfo.moe.go.kr/openData.do').text
    timings = sorted({int(x) for x in re.findall(r'(20\d{2}[12])',page) if int(x)//10>=date.today().year-1})
    if not timings:
        raise ValueError('Kindergarten publication periods unavailable')
    kg_specs = []
    for timing in timings:
        items = json_response(request(requests.Session(),'GET',f'https://e-childschoolinfo.moe.go.kr/gongsi/{timing}/findGongsiList.do'))
        kg_specs.extend((timing,item,title) for title,item in items.items())
    kg_count = 0
    for timing,item,title in kg_specs:
        params={'combineSidoCode':'28','combineSidoName':'인천광역시','timingListCode':str(timing),'gongsiListCode':item,'ExcelCsv':'3'}
        payload=json_response(request(requests.Session(),'GET','https://e-childschoolinfo.moe.go.kr/download/getOpenData.do',params=params))
        if not isinstance(payload.get('header'),list) or not isinstance(payload.get('body'),list):
            raise ValueError('Kindergarten response schema changed')
        filename=f'{timing}_{item}.json'
        expected=source_columns.get(filename,set())
        if expected-set(payload['header']):raise ValueError('Kindergarten columns removed: '+filename)
        old_count=sum(r.get('source_file')==filename for rows in new.values() for r in rows)
        added=defaultdict(list)
        for values in payload['body']:
            record={k:v for k,v in zip(payload['header'],values) if k not in ['대표자명','원장명']}
            matches=[s for s in registry if s['학교급구분']=='유치원' and s['학교명']==record.get('유치원명') and s['설립형태']==record.get('설립유형')
                     and (not record.get('교육지원청명') or s.get('education_support_name')==record['교육지원청명'])]
            if len(matches)>1 and record.get('주소'):
                matches=[s for s in matches if re.sub(r'\s+','',s['소재지도로명주소'])==re.sub(r'\s+','',record['주소'])]
            if len(matches)!=1:
                unmatched.append({'file':filename,'name':record.get('유치원명')})
                continue
            added[matches[0]['학교ID']].append({'item':'KG'+item,'title':f'유치원 {title} ({timing%10}차)','year':timing//10,
                'depth':str(timing%10),'source_file':filename,'source_url':'https://e-childschoolinfo.moe.go.kr/openData.do','values':record})
        n=sum(map(len,added.values()))
        if old_count and n<old_count*.9:
            raise ValueError(f'Kindergarten coverage fell >10%: {filename}')
        for sid in new:
            new[sid]=[r for r in new[sid] if r.get('source_file')!=filename]+added.get(sid,[])
        kg_count+=n
    changed=[]
    sortkey=lambda r:(r['source_file'],digest(r['values']))
    for sid, rows in new.items():
        rows=sorted(rows,key=sortkey)
        if digest(rows)!=digest(sorted(linked.get(sid,[]),key=sortkey)):
            changed.append(sid)
            write(edu/'disclosures'/f'{sid}.json',rows)
    return {'changed_schools':len(changed),'schoolinfo_records':count,'kindergarten_records':kg_count,
            'unmatched_count':len(unmatched),'unmatched_examples':unmatched[:30],'source_hash':digest(new)}


def build(kind, root, work):
    if work.exists():
        raise ValueError('Work directory must be new')
    work.mkdir(parents=True)
    shutil.copytree(root/'data_processed',work/'data_processed')
    inputs={p.relative_to(work).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (work/'data_processed').rglob('*') if p.is_file()}
    # Builders run against this isolated tree, with only public dependency seeds.
    seed = root/'refresh_seed'
    if seed.exists():
        shutil.copytree(seed,work/'data',dirs_exist_ok=True)
        inputs.update({p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in seed.rglob('*') if p.is_file()})
    seeded=set()
    if (seed/'processed_inputs').exists():
        for p in (seed/'processed_inputs').rglob('*'):
            if p.is_file():
                relative=p.relative_to(seed/'processed_inputs');dest=work/'data_processed'/relative
                if not dest.exists():
                    dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);seeded.add(dest)
    shutil.copytree(root/'modules',work/'modules')
    if kind=='libraries':
        result=libraries(work)
        if result['changed']:
            from scripts.education.refresh_libraries import rebuild
            rebuild(work)
    elif kind=='disclosures':
        result=disclosures(work)
        if result['changed_schools']:
            for name in ['build_public_indicators','build_school_statistics']:
                module=importlib.import_module('scripts.education.'+name)
                module.ROOT=work;module.DATA=work/'data_processed/education'
                module.main()
    else:
        raise ValueError('Unknown refresh pipeline')
    changed=result.get('changed',result.get('changed_schools',0))
    if changed:
        module=importlib.import_module('scripts.education.build_analysis_dataset')
        module.ROOT=work;module.DATA=work/'data_processed';module.EDU=module.DATA/'education'
        module.main()
        coverage=work/'data_processed/education/library_refresh_coverage.json'
        if coverage.exists():
            analysis_path=work/'data_processed/education/analysis_dataset.json'
            analysis=read(analysis_path)
            analysis['limitations']=list(dict.fromkeys(analysis['limitations']+[read(coverage)['limitation']]))
            write(analysis_path,analysis)
        module=importlib.import_module('scripts.education.build_ai_school_evidence')
        module.ROOT=work;module.DATA=work/'data_processed/education'
        module.main()
    files=[]
    for file in (work/'data_processed').rglob('*'):
        if not file.is_file() or file in seeded:continue
        rel=file.relative_to(work).as_posix()
        old=root/rel
        sha=hashlib.sha256(file.read_bytes()).hexdigest()
        if not old.exists() or hashlib.sha256(old.read_bytes()).hexdigest()!=sha:
            if file.suffix=='.json':read(file) # reject malformed/nonfinite JSON at writer
            files.append({'target':rel,'sha256':sha,'bytes':file.stat().st_size})
    return {'kind':kind,'files':files,'result':result,'work':str(work),'input_hashes':inputs}


if __name__=='__main__':
    try:
        args=json.load(sys.stdin)
        with contextlib.redirect_stdout(sys.stderr):
            result=build(args['kind'],Path(args['root']),Path(args['work']))
        print(json.dumps(result,ensure_ascii=False,allow_nan=False))
    except Exception as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False))
        sys.exit(1)
