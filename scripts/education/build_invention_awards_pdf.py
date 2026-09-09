"""2024 student invention awards: cross-check official roster and work summaries."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import fitz
import pandas as pd
import requests

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'data/education_sources/invention_awards_2024.pdf'
OUT=ROOT/'data/education_sources/invention_awards_2024_pdf.json'
URL='https://www.science.go.kr/mps/bbs/424/downBbsNttFile.do?atchmnflSn=75800'
PRIZES=r'대통령상|국무총리상|최우수상|특상|우수상|장려상'


def extract(document,registry,national_ids):
    patterns=[(r,re.compile(r'(?<![가-힣])'+re.escape(r['학교명'])+r'(?![가-힣])')) for r in registry]
    roster={};current=None;award=None
    # Student roster at physical pages 15–23; teacher thesis awards start at 24.
    for index in range(14,23):
        for line in document[index].get_text().splitlines():
            line=line.strip()
            heading=re.search(r'ㅇ('+PRIZES+r')',re.sub(r'\s+','',line))
            if heading:award=heading[1]
            if re.fullmatch(r'[123]\d{3}',line):
                current=line
                if current in roster:raise ValueError('Duplicate student roster work number')
                roster[current]={'result':award,'page':index+1,'lines':[]}
            elif current:roster[current]['lines'].append(line)
    if len(roster)!=299:raise ValueError(f'Expected official 299-work roster, found {len(roster)}')
    records={};unresolved=[]
    for index,page in enumerate(document):
        text=re.sub(r'\s+',' ',page.get_text()).strip()
        if not text.startswith('작품명 '):continue
        header=re.search(r'^작품명 (.*?) 출품(?:부문|분야) (.*?) 출품번호 (\d{4}) ',text)
        if not header:continue
        roles=re.sub(r'출\s*품\s*자','출품자',text)
        roles=re.sub(r'지도\s*교원','지도교원',roles)
        if '출품자' not in roles or '지도교원' not in roles:continue
        student=roles.split('출품자',1)[1].split('지도교원',1)[0]
        heading=roles[:roles.index('지도교원')]
        prize=re.search(PRIZES,heading)
        for school,pattern in patterns:
            if not pattern.search(student):continue
            number=header[3];entry=roster.get(number)
            reason=None
            if national_ids.get(school['학교명'],set())!={school['학교ID']}:reason='national school-name ambiguity'
            elif not entry or not prize or entry['result']!=prize[0] or not pattern.search('\n'.join(entry['lines'])):
                reason='roster/summary mismatch'
            if reason:
                unresolved.append({'school_id':school['학교ID'],'work_number':number,'page':index+1,'reason':reason})
                continue
            key=(school['학교ID'],number)
            if key in records:continue  # Major-award explanations and later summaries repeat the same work.
            records[key]={'school_id':school['학교ID'],'school_name':school['학교명'],'school_level':school['학교급구분'],
                          'year':2024,'event':'제45회 전국학생과학발명품경진대회','work_number':number,'work_title':header[1],
                          'category':header[2],'result':prize[0],'participant_scope':'학생 출품작',
                          'source_url':URL+f'#page={index+1}','result_source_url':URL+f"#page={entry['page']}",
                          'summary_page':index+1,'roster_page':entry['page'],
                          'result_basis':f"공식 요약집 PDF 파일 {entry['page']}쪽 학생 수상자 명단과 {index+1}쪽 작품 설명을 작품번호·학교명·등급으로 대조"}
    return {'records':list(records.values()),'unresolved':unresolved,'student_roster_works':len(roster)}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');args=parser.parse_args()
    if args.fetch and not SOURCE.exists():
        r=requests.get(URL,timeout=120);r.raise_for_status()
        if not r.content.startswith(b'%PDF'):raise ValueError('Expected official PDF')
        SOURCE.write_bytes(r.content)
    document=fitz.open(SOURCE)
    registry=pd.read_csv(ROOT/'data_processed/education/institutions.csv').to_dict('records')
    ids={}
    for r in json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']:
        ids.setdefault(r['학교명'],set()).add(r['학교ID'])
    result=extract(document,registry,ids)
    result.update(source_url=URL,source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),pdf_pages=len(document),
                  scope='학생 수상자 명단과 작품 설명의 일치분. 개인 이름은 추출 결과에 보존하지 않음.')
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"Verified invention PDF: {len(result['records'])}; unresolved {len(result['unresolved'])}")


if __name__=='__main__':main()
