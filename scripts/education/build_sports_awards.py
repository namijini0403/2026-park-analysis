"""Official Incheon school medal observations, without athlete identities."""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT/'data/education_sources/sports_awards.json'
ALIASES = ROOT/'data/education_sources/sports_identity_aliases.json'
URL = 'https://meet.sports.or.kr/history/medal/sido/list.do'
NOTE = '대한체육회 2024·2025 전국체육대회 인천 메달 명세에서 현재 원장 학교명에 연결한 관측입니다. 공백 차이와 근거가 있는 특정 종목 표기를 구분해 기록합니다. 학교·종목·종별·세부종목·등급·일자별로 묶었습니다. 선수별 행 수와 관측 수는 메달 수가 아닙니다. 단체전·복식·개인전 중복 집계와 보도자료 중복을 피하기 위해 총 메달 수를 산출하지 않습니다. 선수 이름·선수 식별자는 저장하지 않습니다. 기록 없음은 수상 없음이 아닙니다.'


def parse(html, year):
    soup = BeautifulSoup(html, 'html.parser')
    groups = {}
    for table_no, table in enumerate(soup.select('table.res-tbl-wrap'), 1):
        heading = table.find_previous('h5').get_text(' ',strip=True)
        sport = re.search(r'인천\s*\[\s*(.+?)\s*\]', heading)
        if not sport:
            raise ValueError('Missing Incheon sport heading')
        for row_no, tr in enumerate(table.select('tr'), 1):
            cells = {td.get('data-label'):td.get_text(' ',strip=True) for td in tr.select('td[data-label]')}
            if not cells:
                continue
            if cells['시도'] != '인천' or cells['메달'] not in ['금','은','동'] or not cells['일자'].startswith(str(year)):
                raise ValueError('Unexpected medal row scope')
            key = (cells['소속'], sport[1], cells['종별'], cells['세부종목'], cells['메달'], cells['일자'])
            group = groups.setdefault(key, {'school_name':key[0], 'category':key[1], 'division':key[2], 'discipline':key[3], 'medal':key[4], 'date':key[5], 'source_rows':[]})
            group['source_rows'].append({'table':table_no,'row':row_no})
    if not groups:
        raise ValueError('No medal rows; do not interpret as zero awards')
    return list(groups.values())


def resolve_school(record, registry, aliases):
    name = record['school_name']
    matches = [r for r in registry if re.sub(r'\s+', '', r['학교명']) == re.sub(r'\s+', '', name)]
    if len(matches) == 1:
        return matches[0], 'Exact name after whitespace normalization', None
    if matches:
        return None, 'Ambiguous normalized school name', None
    for alias in aliases:
        if (name == alias['source_name'] and record['category'] == alias['category']
                and alias['discipline_contains'] in record['discipline']):
            matches = [r for r in registry if r['학교ID'] == alias['school_id'] and r['학교명'] == alias['registry_name']]
            if len(matches) == 1:
                return matches[0], alias['basis'], alias['source_url']
    return None, 'No verified current registry match', None


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--fetch',action='store_true'); args=parser.parse_args()
    if args.fetch:
        snapshots=[]
        for year, edition in [(2024,105),(2025,106)]:
            response=requests.get(URL,params={'searchGubun':'G','searchGameno':edition,'searchSidoCd':'04'},timeout=60)
            response.raise_for_status()
            snapshots.append({'year':year,'event':f'제{edition}회 전국체육대회','url':response.url,'sha256':hashlib.sha256(response.content).hexdigest(),'records':parse(response.text,year)})
        SOURCE.write_text(json.dumps(snapshots,ensure_ascii=False,indent=2),encoding='utf-8')
    snapshots=json.loads(SOURCE.read_text(encoding='utf-8'))
    registry=list(csv.DictReader((ROOT/'data_processed/education/institutions.csv').open(encoding='utf-8-sig')))
    aliases=json.loads(ALIASES.read_text(encoding='utf-8'))
    schools={}; held=[]
    for snapshot in snapshots:
        for record in snapshot['records']:
            school, basis, identity_url=resolve_school(record,registry,aliases)
            if school is None:
                if '학교' in record['school_name']:
                    reason='Outside target school levels: university' if '대학교' in record['school_name'] else 'Separate institution: broadcasting high school' if '방송통신고등학교' in record['school_name'] else basis
                    held.append({'year':snapshot['year'],'school_name':record['school_name'],'reason':reason})
                continue
            sid=school['학교ID']
            schools.setdefault(sid,[]).append({**record,'year':snapshot['year'],'event':snapshot['event'],'result':record['medal']+'메달 관측','source_url':snapshot['url'],'participant_scope':'school_event_medal_observation','result_basis':'학교별 결과 관측이며 메달 총수·선수 수 아님','identity_basis':basis,'identity_source_url':identity_url})
    result={'schools':schools,'coverage':NOTE,'unmatched_school_names':[dict(t) for t in sorted({tuple(r.items()) for r in held})], 'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
    result['identity_aliases_sha256']=hashlib.sha256(ALIASES.read_bytes()).hexdigest()
    (ROOT/'data_processed/education/sports_awards.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Sports:',len(schools),'schools;',sum(map(len,schools.values())),'observations;',len(result['unmatched_school_names']),'unmatched school/year pairs')


if __name__=='__main__': main()
