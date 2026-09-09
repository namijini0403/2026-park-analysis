"""Collect official science fair entry results; exact, nationally unambiguous attribution."""
import argparse
import hashlib
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'data/education_sources/science_awards'
OUT = ROOT / 'data_processed/education'
BASE = 'https://www.science.go.kr/mps/1079/bbs/423/'
LOCAL = threading.local()


def get(url, params=None):
    if not hasattr(LOCAL, 'session'):
        LOCAL.session = requests.Session()
    response = LOCAL.session.get(url, params=params, timeout=40)
    response.raise_for_status()
    return response


def detail(entry):
    path = CACHE / f"{entry['id']}.json"
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    url = BASE + 'moveBbsNttDetail.do?nttSn=' + entry['id']
    response = get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    fields = {}
    for label in ['학교', '대회명', '수상']:
        tag = soup.find('span', string=lambda s: s and s.strip() == label)
        if tag and tag.parent.find('strong'):
            fields[label] = tag.parent.find('strong').get_text(' ', strip=True)
    if '학교' not in fields or '수상' not in fields:
        raise ValueError(f'Missing attribution/result structure: {url}')
    record = {**entry, 'fields': fields, 'source_url': url, 'response_sha256': hashlib.sha256(response.content).hexdigest()}
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return record


def collect(years):
    CACHE.mkdir(parents=True, exist_ok=True)
    manifest = {'years': years, 'scope': '전국과학전람회 출품작 검색 결과 전체 페이지; 지도논문 제외', 'entries': [], 'failures': []}
    entries = {}
    for year in years:
        def page_rows(page):
            path = CACHE / f'list_{year}_{page}.json'
            if path.exists():
                return json.loads(path.read_text(encoding='utf-8'))
            response = get(BASE + 'moveBbsNttList.do', {'searchCnd':'aditfield7', 'searchKrwd':str(year), 'searchKrwd2':'entry', 'page':page})
            soup = BeautifulSoup(response.text, 'html.parser')
            output = []
            for row in soup.select('#bbsNttTable tbody.singlerow[onclick]'):
                ident = re.search(r"fn_moveBbsNttDetail\('([0-9]+)'", row['onclick'])[1]
                cells = [c.get_text(' ', strip=True) for c in row.find_all('td')]
                if int(cells[1]) != year or cells[3].startswith('(지도논문)'):
                    raise ValueError('Server did not honor entry/year filter')
                output.append({'id':ident, 'year':year, 'category':cells[2], 'title':cells[3], 'listed_result':cells[4], 'ordinal':int(cells[0])})
            path.write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
            return output
        first = page_rows(1)
        expected = first[0]['ordinal'] if first else 0
        page_count = (expected+9)//10
        seen = set()
        with ThreadPoolExecutor(max_workers=4) as executor:
            for rows in executor.map(page_rows, range(1,page_count+2)):
                for entry in rows:
                    if entry['id'] in seen:
                        raise ValueError('Repeated page: collection completeness cannot be established')
                    seen.add(entry['id'])
                    entries[entry['id']] = entry
        if len(seen) != expected:
            raise ValueError(f'Count mismatch: {len(seen)} != {expected}')
        print(f'{year}: {len(seen)} entries, {page_count} pages', flush=True)
    def safe(entry):
        try:
            return detail(entry), None
        except Exception as error:
            return None, {'id':entry['id'], 'error':str(error)}
    with ThreadPoolExecutor(max_workers=4) as executor:
        for index, (record, error) in enumerate(executor.map(safe, entries.values())):
            if record:
                manifest['entries'].append(record['id'])
            else:
                manifest['failures'].append(error)
            if (index+1)%100 == 0:
                print(f'Details {index+1}/{len(entries)}', flush=True)
    manifest['listed_count'] = len(entries)
    (CACHE/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--years', nargs='+', type=int, default=[2023,2024,2025])
    args = parser.parse_args()
    if args.fetch:
        collect(args.years)
    manifest = json.loads((CACHE/'manifest.json').read_text(encoding='utf-8'))
    registry = pd.read_csv(OUT/'institutions.csv').to_dict('records')
    nationwide = json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']
    name_ids = {}
    for school in nationwide:
        name_ids.setdefault(school['학교명'], set()).add(school['학교ID'])
    patterns = [(r,re.compile(r'(?<![가-힣])'+re.escape(r['학교명'])+r'(?![가-힣])')) for r in registry]
    linked, unmatched, ambiguous, missing_school = {}, [], [], []
    for ident in manifest['entries']:
        record = json.loads((CACHE/f'{ident}.json').read_text(encoding='utf-8'))
        if not record['fields']['학교']:
            missing_school.append({'id':ident,'year':record['year'],'title':record['title']})
        if record['fields']['수상'] and record['fields']['수상'] != record['listed_result']:
            raise ValueError(f'Conflicting result sources: {ident}')
        first = json.loads((CACHE/f"list_{record['year']}_1.json").read_text(encoding='utf-8'))
        page = (first[0]['ordinal']-record['ordinal'])//10+1
        result_url = record['source_url'] if record['fields']['수상'] else BASE+f"moveBbsNttList.do?searchCnd=aditfield7&searchKrwd={record['year']}&searchKrwd2=entry&page={page}"
        matches = [school for school, pattern in patterns if pattern.search(record['fields']['학교'])]
        if not matches and '인천' in record['fields']['학교']:
            unmatched.append({'id':ident, 'school_field':record['fields']['학교']})
        for school in matches:
            if len(name_ids.get(school['학교명'], set())) > 1 and not re.search(r'인천(?:광역시)?\s*'+re.escape(school['학교명']),record['fields']['학교']):
                ambiguous.append({'id':ident,'school_field':record['fields']['학교'],'candidate_school_id':school['학교ID']})
                continue
            linked.setdefault(school['학교ID'], []).append({'school_name':school['학교명'], 'school_level':school['학교급구분'],
                'event':record['fields']['대회명'], 'year':record['year'], 'category':record['category'],
                'result':record['fields']['수상'] or record['listed_result'], 'work_title':record['title'], 'source_url':record['source_url'],
                'result_source_url':result_url, 'result_basis':'상세 페이지' if record['fields']['수상'] else '목록의 동일 작품 수상 칸; 상세 수상 칸은 비어 있음',
                'participant_scope':'출품작(학생/교원 미분류); 지도논문 제외',
                'verification':'국립중앙과학관 출품작 상세의 학교명 정확 일치. 팀 작품은 학교별 관측이며 합산 시 중복 가능.'})
    pdf_source = ROOT/'data/education_sources/science_awards_2024_pdf.json'
    pdf_records = json.loads(pdf_source.read_text(encoding='utf-8'))['records'] if pdf_source.exists() else []
    for record in pdf_records:
        linked.setdefault(record['school_id'],[]).append(record)
    output = {'coverage':f"국립중앙과학관 {', '.join(map(str,manifest['years']))}년 전국과학전람회 출품작 검색 게시물(요약집 포함) {manifest['listed_count']}건 중 상세 {len(manifest['entries'])}건 확인. 웹 학교명 공란 {len(missing_school)}건은 그대로 보존하고, 2024 공식 요약집에서 {len(pdf_records)}개 학교-작품 실적을 별도 대조·보완함. 다른 대회·연도 전체 실적은 아님.",
              'schools':linked, 'unmatched_incheon':unmatched, 'ambiguous_school_names':ambiguous, 'missing_school_fields':missing_school, 'failures':manifest['failures']}
    (OUT/'science_awards.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Matched {len(linked)} schools / {sum(map(len,linked.values()))} school-work observations; failures {len(manifest["failures"])}', flush=True)


if __name__ == '__main__':
    main()
