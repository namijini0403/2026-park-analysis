"""Official student service inventory. Cached HTML + exact-address geocoding.

python -m scripts.education.fetch_student_services [--refresh] [--offline]
No keyword/place guessing. Unresolved locations remain in the inventory.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from scripts.context.kakao_client import KakaoLocalClient, coord_valid

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT/'data/student_services/raw'
OUT = ROOT/'data_processed/student_services'
CARE = 'https://www.ice.go.kr/ice/ad/func/spnt/spntList.do?mi=10916'
OFFLINE = False


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')


def fetch(url, name, refresh=False, post=None):
    path = RAW/(name+'.html')
    meta = RAW/(name+'.json')
    # Keep content-addressed originals even if a later refresh fails validation.
    archive=RAW/'snapshots'
    archive.mkdir(parents=True,exist_ok=True)
    if path.exists() and meta.exists():
        old=path.read_bytes();old_hash=hashlib.sha256(old).hexdigest()
        previous=archive/(old_hash+'.html')
        if not previous.exists():previous.write_bytes(old)
    if refresh or not path.exists() or not meta.exists():
        if OFFLINE: raise ValueError('Offline snapshot missing: '+name)
        response = requests.post(url, data=post, timeout=40) if post is not None else requests.get(url, timeout=40)
        response.raise_for_status()
        response.encoding = 'utf-8'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(response.text, encoding='utf-8')
        write(meta, {'url': url, 'request':post, 'retrieved_at': datetime.now(timezone.utc).isoformat(),
                     'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    metadata=json.loads(meta.read_text(encoding='utf-8'))
    if hashlib.sha256(path.read_bytes()).hexdigest()!=metadata['sha256']:
        raise ValueError('Raw snapshot hash mismatch: '+name)
    saved=archive/(metadata['sha256']+'.html')
    if not saved.exists():saved.write_bytes(path.read_bytes())
    metadata['raw_file']=str(saved.relative_to(ROOT)).replace('\\','/')
    write(meta,metadata)
    return BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser'), metadata


def record(identifier, name, kind, address, url, source):
    return dict(id=identifier, name=name, kind=kind, address=address, source_url=url,
                source_snapshot=source, latitude=None, longitude=None, coordinate_status='unresolved',
                child_access='conditional' if kind != 'sports' else 'unknown',
                capacity=None, vacancies=None, fee=None, opening_hours=None,
                eligibility_note='대상 학년·신청자격·정원·대기·운영시간 확인 필요',
                evidence_date=None)


def care_rows(soup):
    rows=[]
    for tr in soup.select('tr'):
        cells=tr.select('td')
        if len(cells)!=6 or not cells[0].get_text(strip=True).isdigit(): continue
        _, kind, name, address, phone, _ = [c.get_text(' ',strip=True) for c in cells]
        link=cells[-1].find('a',href=True)
        if not link: raise ValueError('Care detail link missing')
        url=urljoin(CARE,link['href'])
        identifier=re.search(r'insttSn=(\d+)',url)
        if not identifier: raise ValueError('Care ID missing')
        row=record('care-'+identifier[1],name,'welfare',address,url,'care')
        row.update(subtype=kind, phone=phone,
                   service_scope='enrolled_school' if kind=='초등돌봄교실' else 'community',
                   eligibility_note='재학생 대상 학교 내 돌봄; 다른 학교 학생의 개방시설로 계산하지 않음' if kind=='초등돌봄교실' else '초등돌봄포털 등재; 시설별 학년·자격·신청·잔여정원 확인 필요')
        if kind=='아이돌봄서비스':
            row.update(service_scope='home_visit', eligibility_note='가정 방문 서비스 운영기관 주소; 이용시설 접근성 계산에서 제외')
        rows.append(row)
    if len(rows)<100 or len({r['id'] for r in rows})!=len(rows):
        raise ValueError('Unexpected care inventory or duplicate IDs')
    return rows


def locate(row, client):
    # Provider uses new 2026 district names. Preserve original addresses;
    # never rewrite administrative boundaries to force a match.
    query=re.sub(r'\([^)]*\)','',row['address']).strip()
    docs=client.search_address(query).get('documents',[])
    exact=[d for d in docs if d.get('address_type') in ['ROAD_ADDR','REGION_ADDR']]
    coordinates={(d.get('x'),d.get('y')) for d in exact}
    if len(coordinates)==1:
        lng,lat=next(iter(coordinates));lat,lng=float(lat),float(lng)
        if coord_valid(lat,lng):
            row.update(latitude=lat,longitude=lng,coordinate_status='address_geocoded',
                       coordinate_query=query,coordinate_provider='Kakao Local address API',
                       matched_address=exact[0].get('address_name'))


def build(refresh=False, offline=False):
    global OFFLINE
    OFFLINE=offline
    if refresh and offline: raise ValueError('--refresh and --offline cannot be combined')
    from scripts.education.walkin_sports import collect, POLICY
    care,cm=fetch(CARE,'care',refresh)
    rows=care_rows(care);sr,sources,review=collect(fetch,record,refresh);rows+=sr
    write(ROOT/'data/student_services/sports_access_review.json',{'policy':POLICY,'review':review,
        'legacy_sports_excluded':27,'legacy_reason':'유료·강습·대관·예약 또는 무신청 이용 근거 미확보'})
    client=KakaoLocalClient(cache_path=ROOT/'data/student_services/geocode_cache.json',offline=offline)
    try:
        for i,row in enumerate(rows):
            locate(row,client)
            if i%50==0:
                client.save();print('geocoded',i,'/',len(rows),flush=True)
    finally: client.save()
    # Keep a single location/service even when the official directory has duplicates.
    groups={}
    for row in rows:
        key=(row['name'].replace(' ',''),row['address'].replace(' ',''),row['subtype'])
        if key in groups: groups[key].setdefault('duplicate_source_ids',[]).append(row['id'])
        else: groups[key]=row
    rows=list(groups.values())
    write(OUT/'facilities.json',{'facilities':rows,'sources':{'care':cm,**sources},
        'coverage':{'care':'인천교육청 초등돌봄포털 전체 표시 목록. 실제 운영·정원 전수 확인 아님',
                    'sports':'공유누리 인천 야외 구기시설 중 공공·무료·전체/학생 대상·시설별 예약 없이 사용 명시 시설만. 전수 공급 아님',
                    'sports_access_policy':POLICY,
                    'sports_reviewed':len(review),'sports_excluded':sum(not r['included'] for r in review),
                    'legacy_sports_excluded':27,
                    'counts':dict(Counter(r['kind'] for r in rows)),
                    'subtypes':dict(Counter(r['subtype'] for r in rows)),
                    'unresolved':dict(Counter(r['kind'] for r in rows if r['latitude'] is None)),
                    'raw_care_count':len(care_rows(care))},
        'limitations':['주소 지오코딩은 건물 위치이며 실제 출입구가 아님',
                        '시설 수 0은 수집된 좌표의 미관측이며 실제 시설 부재 확정이 아님',
                        '아동 개인 정보·자격·취약 여부를 추정하지 않음']})
    print(json.dumps({'counts':dict(Counter(r['kind'] for r in rows)),
                      'mapped':sum(r['latitude'] is not None for r in rows)},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');parser.add_argument('--offline',action='store_true')
    args=parser.parse_args();build(args.refresh,args.offline)

