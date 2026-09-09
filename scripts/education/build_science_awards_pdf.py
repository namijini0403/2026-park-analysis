"""Attribute 2024 science fair awards using independently checked roster/summary rows."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import fitz
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT/'data/education_sources/science_awards_2024.pdf'
OUT = ROOT/'data/education_sources/science_awards_2024_pdf.json'
URL = 'https://www.science.go.kr/mps/bbs/423/downBbsNttFile.do?atchmnflSn=75801'


def extract(document, registry, national_ids):
    patterns = [(r,re.compile(r'(?<![가-힣])'+re.escape(r['학교명'])+r'(?![가-힣])')) for r in registry]
    # Printed student award roster precedes teacher and mentor awards.
    roster, current, award = {}, None, None
    for index in range(12,34):
        for line in document[index].get_text().splitlines():
            line = line.strip()
            heading = re.search(r'○\s*(대통령상|국무총리상|최우수상|특상|우수상|장려상)',line)
            if heading:
                award = heading[1]
            if re.fullmatch(r'1[1-5]\d{2}',line):
                current = line
                roster[current] = {'result':award,'page':index+1,'lines':[]}
            elif current:
                roster[current]['lines'].append(line)
    results, unresolved = [], []
    for index,page in enumerate(document):
        header = re.sub(r'\s+',' ',page.get_text()).strip()[:1400]
        if not header.startswith('작품명 '):
            continue
        match = re.search(r'^작품명 (.*?) 분 야 (.*?) 작품번호 (\d{4}) (.*?) 구 분',header)
        if not match or '출품학생' not in header or '지도교원' not in header:
            continue
        students = header.split('출품학생',1)[1].split('지도교원',1)[0]
        schools = [row for row,pattern in patterns if pattern.search(students)]
        for school in schools:
            number, result = match[3], match[4].replace(' ','')
            if len(national_ids.get(school['학교명'],set())) != 1:
                unresolved.append({'school_id':school['학교ID'],'work_number':number,'page':index+1,'reason':'national school-name ambiguity'})
                continue
            entry = roster.get(number)
            if not entry or result != entry['result'] or school['학교명'] not in '\n'.join(entry['lines']):
                unresolved.append({'school_id':school['학교ID'],'work_number':number,'page':index+1,'reason':'roster/summary mismatch'})
                continue
            results.append({'school_id':school['학교ID'],'school_name':school['학교명'],'school_level':school['학교급구분'],
                            'year':2024,'event':'제70회 전국과학전람회','work_number':number,'work_title':match[1],
                            'category':match[2].replace(' ',''),'result':result,'participant_scope':'학생 출품작',
                            'source_url':URL+f'#page={index+1}','result_source_url':URL+f"#page={entry['page']}",
                            'result_basis':f"공식 요약집 PDF 파일 {entry['page']}쪽 학생 수상자 명단과 {index+1}쪽 작품 설명을 작품번호·학교명·등급으로 대조",
                            'summary_page':index+1,'roster_page':entry['page']})
    return {'records':results,'unresolved':unresolved,'student_roster_works':len(roster)}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--fetch',action='store_true')
    args=parser.parse_args()
    if args.fetch and not SOURCE.exists():
        response=requests.get(URL,timeout=120)
        response.raise_for_status()
        if not response.content.startswith(b'%PDF'):
            raise ValueError('Expected PDF')
        SOURCE.write_bytes(response.content)
    document=fitz.open(SOURCE)
    registry=pd.read_csv(ROOT/'data_processed/education/institutions.csv').to_dict('records')
    national_ids={}
    for row in json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']:
        national_ids.setdefault(row['학교명'],set()).add(row['학교ID'])
    result=extract(document,registry,national_ids)
    result.update(source_url=URL,source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),pdf_pages=len(document),
                  scope='학생 소속만 연결; 지도교원 소속을 학생 실적으로 전용하지 않음. 명단·설명 두 표의 일치분만 수록.')
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"Verified PDF awards: {len(result['records'])}; unresolved {len(result['unresolved'])}")


if __name__=='__main__':
    main()
