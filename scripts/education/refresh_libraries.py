"""Rebuild all library-dependent serving artifacts using existing policy rules."""
import csv
import hashlib
import importlib
import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point
from scripts.education.refresh_public_data import digest, read, write

COLUMNS=['도서관명','유형','구','위도','경도','장서수','열람좌석수','평일운영','휴관일','기준일','좌표출처']


def normalize(records, root):
    target=root/'data_processed/libraries.csv'
    old=list(csv.DictReader(target.open(encoding='utf-8-sig')))
    existing={(r['도서관명'],r['구']):r for r in old}
    geo_path=root/'data/raw_library/geocoded_missing_libraries.csv'
    geocodes={(r['도서관명'],r['주소']):r for r in csv.DictReader(geo_path.open(encoding='utf-8-sig'))} if geo_path.exists() else {}
    rows=[];unresolved=[]
    # Providers publish overlapping snapshots. Pick the newest dated institution row,
    # retaining an older official coordinate only when its normalized address is identical.
    import re
    grouped={}
    addr=lambda r:re.sub(r'\s+','',str(r.get('소재지도로명주소') or r.get('소재지지번주소') or ''))
    for r in records:
        if not (str(r.get('시도명','')).startswith('인천') or addr(r).startswith('인천')):continue
        gu={'깅화군':'강화군'}.get(r.get('시군구명'),r.get('시군구명'))
        grouped.setdefault((r.get('도서관명'),gu),[]).append(r)
    selected=[]
    for group in grouped.values():
        group=sorted(group,key=lambda r:str(r.get('데이터기준일자','')),reverse=True)
        latest=dict(group[0])
        if not latest.get('위도') or not latest.get('경도'):
            prior=next((r for r in group if addr(r)==addr(latest) and r.get('위도') and r.get('경도')),None)
            if prior:latest.update(위도=prior['위도'],경도=prior['경도'],_coord_source='동일주소 과거 공식좌표')
        selected.append(latest)
    for r in selected:
        address=r.get('소재지도로명주소') or r.get('소재지지번주소') or ''
        if not (address.startswith('인천') or str(r.get('시도명','')).startswith('인천')):continue
        import re
        match=re.search(r'([가-힣]+[구군])',address)
        gu=r.get('시군구명') or (match[1] if match else '')
        gu={'깅화군':'강화군'}.get(gu,gu)
        name=r.get('도서관명','').strip()
        if not name:raise ValueError('Library name missing')
        kind=str(r.get('도서관유형','')).replace('도서관','')
        if kind not in ['공공','어린이','작은','대학','전문']:kind='기타'
        row={'도서관명':name,'유형':kind,'구':gu,'위도':r.get('위도') or '', '경도':r.get('경도') or '',
             '장서수':r.get('자료수(도서)') or '', '열람좌석수':r.get('열람좌석수') or '',
             '평일운영':f"{r.get('평일운영시작시각','')}~{r.get('평일운영종료시각','')}",
             '휴관일':r.get('휴관일') or '', '기준일':r.get('데이터기준일자') or '', '좌표출처':r.get('_coord_source','원본')}
        # Address changes cannot reuse a coordinate previously inferred for another address.
        try:lat,lng=float(row['위도']),float(row['경도'])
        except (TypeError,ValueError):
            cached=geocodes.get((name,address))
            if not cached or cached.get('geocode_status') not in ['success','ok','resolved']:
                unresolved.append({'name':name,'address':address,'coordinate_status':'unresolved','source_url':'https://www.data.go.kr/data/15013109/standard.do'})
                continue
            lat,lng=float(cached['위도']),float(cached['경도'])
            row.update(위도=lat,경도=lng,좌표출처=cached.get('geocode_source','verified_address_cache'))
        if not 36<=lat<=39 or not 124<=lng<=128:raise ValueError('Library coordinate out of bounds: '+name)
        for col in ['위도','경도','장서수','열람좌석수']:
            if row[col]!='':
                value=float(str(row[col]).replace(',',''))
                if not np.isfinite(value) or value<0:raise ValueError('Invalid library numeric value')
                row[col]=str(value) if col in ['위도','경도'] else str(int(value))
        rows.append(row)
    unique={}
    for row in rows:
        key=(row['도서관명'],row['구'])
        if key in unique and row!=unique[key]:raise ValueError('Conflicting duplicate library: '+str(key))
        unique[key]=row
    rows=sorted(unique.values(),key=lambda r:(r['구'],r['도서관명']))
    if not rows or len(rows)<len(old)*.8 or len(rows)>len(old)*1.2:
        raise ValueError(f'Library row-count change exceeds 20%: {len(old)} -> {len(rows)}')
    # Source omissions do not erase independently verified local facilities. A mismatch
    # in coverage must be resolved explicitly before automatic replacement is enabled.
    if len(set(existing)-set(unique))>len(old)*.1:
        raise ValueError('Library identity removals exceed 10%; source coverage differs')
    key=lambda r:(r['구'],r['도서관명'])
    coverage={'source_records':len(rows)+len(unresolved),'mapped_records':len(rows),'unresolved':unresolved,
              'limitation':'좌표 미확보 시설은 원문 명칭·주소로 보존합니다. 지도·접근성·추천은 좌표 확보 시설만 사용한 하한 관측치이며, 0은 실제 시설 부재를 뜻하지 않습니다.'}
    old_coverage=root/'data_processed/education/library_refresh_coverage.json'
    changed=digest(rows)!=digest(sorted(old,key=key)) or not old_coverage.exists() or digest(read(old_coverage))!=digest(coverage)
    write(old_coverage,coverage)
    if changed:
        with target.open('w',encoding='utf-8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=COLUMNS);writer.writeheader();writer.writerows(rows)
    return {'changed':changed,'rows':len(rows),'unresolved':len(unresolved),'previous_rows':len(old),'source_hash':digest(rows),
            'source_url':'https://www.data.go.kr/data/15013109/standard.do'}


def rebuild(root):
    data=root/'data_processed';edu=data/'education'
    libs=pd.read_csv(data/'libraries.csv')
    public=libs['유형'].isin(['공공','어린이']).to_numpy()
    points=gpd.GeoSeries(gpd.points_from_xy(libs['경도'],libs['위도']),crs=4326)
    walk=gpd.read_file(data/'school_isochrone_500m.geojson').to_crs(4326).set_index('학교ID')
    access=pd.read_csv(data/'school_library_access.csv',dtype=str,keep_default_na=False)
    coords=pd.read_csv(data/'schools.csv').set_index('학교ID')
    for idx,row in access.iterrows():
        sid=row['학교ID']
        if sid not in walk.index:raise ValueError('Missing school walkshed: '+sid)
        mask=points.intersects(walk.loc[sid].geometry).to_numpy()
        access.loc[idx,'iso_library_count']=str(int(mask.sum()))
        access.loc[idx,'iso_public_library_count']=str(int((mask&public).sum()))
        lat,lng=np.radians(float(coords.loc[sid,'위도'])),np.radians(float(coords.loc[sid,'경도']))
        a=np.sin((np.radians(libs['위도'].to_numpy())-lat)/2)**2+np.cos(lat)*np.cos(np.radians(libs['위도'].to_numpy()))*np.sin((np.radians(libs['경도'].to_numpy())-lng)/2)**2
        distances=2*6371000*np.arcsin(np.minimum(1,np.sqrt(a)));near=int(distances.argmin())
        for col,src in [('nearest_library_name','도서관명'),('nearest_library_type','유형'),('nearest_library_coord_source','좌표출처')]:access.loc[idx,col]=str(libs.iloc[near][src])
        access.loc[idx,'nearest_library_euclid_m']=str(round(float(distances[near]),2))
    access.to_csv(data/'school_library_access.csv',index=False)
    gap=importlib.import_module('scripts.reading_module.apply_reading_gap_types')
    gap.ACCESS_CSV=data/'school_library_access.csv';gap.FORECAST_CSV=data/'school_enrollment_forecast_20260418_model1.csv'
    df=gap.load_access();forecast=gap.load_forecast();dist=gap.compute_distribution(df,forecast)
    classified,*_=gap.classify(df,forecast,dist)
    classified[gap.BASE_COLUMNS+gap.ADDED_COLUMNS].to_csv(gap.ACCESS_CSV,index=False)
    policy=importlib.import_module('scripts.policy_cards.build_policy_cards')
    for name in ['PARK_CSV','LIBRARY_CSV','FORECAST_CSV','READING_YAML','OUTPUT_JSON']:
        setattr(policy,name,root/getattr(policy,name).relative_to(policy.ROOT))
    policy.ROOT=root
    policy.main()
    analysis=read(edu/'school_analysis.json')
    source_coverage=read(edu/'library_refresh_coverage.json')
    extended=gpd.read_file(edu/'walkshed_500m.geojson').to_crs(4326).set_index('학교ID')
    for school in analysis:
        sid=school['학교ID']
        if sid not in extended.index:continue
        mask=points.intersects(extended.loc[sid].geometry).to_numpy()
        context=school.setdefault('context',{}).setdefault('library',{})
        context['walkshed_count']=int(mask.sum())
        context['public_walkshed_count']=int((mask&public).sum())
        context['unresolved_source_records']=len(source_coverage['unresolved'])
        context['coverage']='partial_geocoded_records' if source_coverage['unresolved'] else 'observed_geocoded_records'
        institution=pd.read_csv(edu/'institutions.csv').set_index('학교ID').loc[sid]
        circle=gpd.GeoSeries([Point(float(institution['경도']),float(institution['위도']))],crs=4326).to_crs(5179).buffer(500).to_crs(4326).iloc[0]
        context['straight_500m_count']=int(points.intersects(circle).sum())
        if 'reading_gap' in school:
            external=bool(mask.any());school['reading_gap']['external_observed']=external
            for barrier in (False,True):
                action=policy.park_base_action(school['case_type'],barrier)
                if school['reading_gap'].get('internal_low') and school['case_type']>=3:
                    action='institution_link' if external else 'internal_investment'
                school.setdefault('policy_scenarios',{})[str(barrier).lower()]=policy.build_scenarios(action,barrier)
    write(edu/'school_analysis.json',analysis)
    module=importlib.import_module('scripts.education.analyze_library_access')
    module.ROOT=root;module.DATA=data;module.EDU=edu;module.SOURCE=root/'data/education_sources/candidate_age_allocation.json'
    saved=sys.argv;sys.argv=['analyze_library_access','--raw-dir',str(root/'data/grid')]
    try:module.main()
    finally:sys.argv=saved
    for name in ['library_access_scenarios.json','library_access_preview.json']:
        result=read(edu/name)
        result['missing_library_coordinates']=len(source_coverage['unresolved'])
        result['source_coverage']={k:v for k,v in source_coverage.items() if k!='unresolved'}
        result['limitations']=list(dict.fromkeys(result['limitations']+[source_coverage['limitation']]))
        write(edu/name,result)
