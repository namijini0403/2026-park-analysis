"""Official downloadable boundaries, Incheon only; no inferred kindergarten zones.

stdout is one GeoJSON document. SHP topology retained; 2m display simplification.
Source discovery uses bulletin attachments, not a pinned semester URL.
"""
import csv
import hashlib
import io
import json
import re
import sys
import os
from pathlib import Path
import zipfile
from datetime import datetime, timezone
import requests
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform
from shapely import make_valid

BASE = 'https://schoolzone.emac.kr'
LIST = BASE + '/publicData/publicDataList.do'
KINDS = [('elementary', '초등학교 통학구역', '초등학교'),
         ('middle', '중학교 학구 및 학군', '중학교'),
         ('high', '고등학교 학교군', '고등학교'),
         ('high_nonstandard', '고등학교 비평준화지역', '고등학교'),
         ('links', '학교-학구도 연계정보', None)]

def fetch_zones(session=None):
    session = session or requests.Session()
    response = session.get(LIST, timeout=30); response.raise_for_status()
    rows = re.findall(r'<tr[^>]*>.*?</tr>', response.content.decode('utf-8'), re.S)
    sources, features, links = [], [], {}
    for kind, title, level in KINDS:
        row = next((r for r in rows if title in r), None)
        if not row: raise ValueError('공식 최신 목록에서 항목을 찾지 못했습니다: '+title)
        attrs = dict(re.findall(r'data-(\w+)="([^"]+)"', row))
        params = {k: attrs[k] for k in ('nttId','atchFileId','fileSn')}
        if not (re.fullmatch(r'FILE_[A-Za-z0-9_]+',params['atchFileId']) and params['nttId'].isdigit() and params['fileSn'].isdigit()):
            raise ValueError('공식 첨부파일 식별자 형식 변경')
        # Provider bulletin attachment IDs are versioned; HTTP validators still detect
        # replacements at an existing ID without downloading an unchanged archive.
        cache_root=Path(os.environ.get('UPDATE_CENTER_HOME',Path(__file__).resolve().parents[2]/'data'/'update_center'))/'source_cache'
        cache_root.mkdir(parents=True,exist_ok=True)
        cached=cache_root/(attrs['atchFileId']+'.zip');meta=cached.with_suffix('.json')
        validators=json.loads(meta.read_text()) if meta.exists() else {}
        headers={}
        if cached.exists():
            if validators.get('etag'):headers['If-None-Match']=validators['etag']
            if validators.get('modified'):headers['If-Modified-Since']=validators['modified']
        response = session.get(BASE+'/publicData/publicDataFileDownload.do', params=params, headers=headers, timeout=90)
        response.raise_for_status()
        content=cached.read_bytes() if response.status_code==304 and cached.exists() else response.content
        if len(content)>100*1024*1024: raise ValueError('학구도 다운로드 크기 초과')
        z = zipfile.ZipFile(io.BytesIO(content))
        if response.status_code!=304:
            cached.write_bytes(content);meta.write_text(json.dumps({'etag':response.headers.get('ETag'),'modified':response.headers.get('Last-Modified')}))
        if sum(i.file_size for i in z.infolist())>200*1024*1024: raise ValueError('학구도 압축해제 크기 초과')
        read = lambda ext: z.read(next(n for n in z.namelist() if n.lower().endswith(ext)))
        source = {'kind':kind,'title':title,'url':response.url,'sha256':hashlib.sha256(content).hexdigest()}
        sources.append(source)
        if kind == 'links':
            for record in csv.DictReader(io.StringIO(read('.csv').decode('cp949'))):
                if record.get('시도교육청명') != '인천광역시교육청': continue
                links.setdefault(record['학구ID'], []).append({'id':record['학교ID'],'name':record['학교명'],'level':record['학교급구분']})
            continue
        crs = CRS.from_wkt(read('.prj').decode())
        project = Transformer.from_crs(crs, 4326, always_xy=True).transform
        reader = shapefile.Reader(shp=io.BytesIO(read('.shp')), dbf=io.BytesIO(read('.dbf')), shx=io.BytesIO(read('.shx')), encoding='cp949')
        for record in reader.iterShapeRecords():
            props = record.record.as_dict()
            if props.get('SD_CD') != '28': continue
            geom = shape(record.shape.__geo_interface__)
            repaired = not geom.is_valid
            if repaired:
                original_area = geom.area
                geom = make_valid(geom)
                if geom.geom_type == 'GeometryCollection':
                    from shapely.ops import unary_union
                    geom = unary_union([g for g in geom.geoms if g.geom_type in ('Polygon','MultiPolygon')])
                if abs(geom.area-original_area)>max(1,original_area*.001): raise ValueError('경계 보정 면적 변화 초과')
            if geom.is_empty or geom.geom_type not in ('Polygon','MultiPolygon'): raise ValueError('유효하지 않은 공식 경계: '+props['HAKGUDO_ID'])
            geom = transform(project, geom.simplify(2, preserve_topology=True))
            if not (124 < geom.bounds[0] < 128 and 36 < geom.bounds[1] < 39): raise ValueError('좌표계 검사 실패')
            features.append({'type':'Feature','geometry':mapping(geom),'properties':{
                'zone_id':props['HAKGUDO_ID'],'name':props['HAKGUDO_NM'],'zone_type':props['HAKGUDO_GB'],
                'level':level,'kind':kind,'reference_date':props['BASE_DT'],'updated_date':props['UPD_DT'],
                'office':props['EDU_NM'],'source_url':response.url,'topology_repaired':repaired}})
        source['count'] = sum(f['properties']['kind']==kind for f in features)
    for f in features: f['properties']['schools'] = links.get(f['properties']['zone_id'], [])
    if not all(any(f['properties']['level']==level for f in features) for level in ['초등학교','중학교','고등학교']):
        raise ValueError('필수 학교급 경계 누락')
    ids=[f['properties']['zone_id'] for f in features]
    if len(ids)!=len(set(ids)): raise ValueError('중복 학구 ID')
    return {'type':'FeatureCollection','features':sorted(features,key=lambda f:f['properties']['zone_id']),
        'metadata':{'provider':'한국교육시설안전원','source_url':LIST,'coverage':'인천광역시 공식 공개 학구도',
            'sources':sources,'display_simplification_m':2,'crs':'EPSG:4326',
            'kindergarten':{'status':'not_published','note':'이 공식 공개자료의 대상은 초·중·고입니다. 유치원 학구 경계는 제공하지 않습니다.'},
            'limitations':['통학구역·학교군은 직선/도보 500m 생활권과 다릅니다.','경계만으로 배정 가능 학교를 확정하지 않습니다. 공동·일방 학구와 예외학교는 교육청 고시 확인이 필요합니다.']}}

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    result=json.dumps(fetch_zones(),ensure_ascii=False,separators=(',',':'))
    if len(sys.argv)>1:
        from pathlib import Path
        Path(sys.argv[1]).write_text(result,encoding='utf-8')
    else: print(result)
