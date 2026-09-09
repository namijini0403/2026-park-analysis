"""School athletics public board observations; posting dates are not reporting periods."""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'data/education_sources/school_athletics.json'
URL='https://www.ice.go.kr/ice/na/ntt/selectNttList.do'
NOTE='교육청 학교운동부 예산현황 공개 목록의 2024년 이후 게시 기록입니다. 게시일은 선수 인원 조사일·회계기간이 아닙니다. 반복 게시와 여러 종목의 인원을 합산하지 않으며 전교생 활동률이나 학교 실적 점수가 아닙니다. 경비의 첨부파일 참조 문구는 금액 미확보입니다. 기록 없음은 운동부 없음이 아닙니다.'


def count(value):
    cleaned=value.replace(',','').strip()
    return int(re.sub(r'\s*명$','',cleaned)) if re.fullmatch(r'\d+\s*명?',cleaned) else None


def parse(html):
    soup=BeautifulSoup(html,'html.parser'); table=soup.select_one('table')
    if table is None or '선수인원' not in table.get_text(): raise ValueError('Unexpected athletics board')
    output=[]
    for row in table.select('tbody tr'):
        cells=row.select('td'); link=row.select_one('a.nttInfoBtn[data-id]')
        if len(cells)!=5 or link is None: raise ValueError('Unexpected athletics row')
        name,sport,athletes,budget,date=[c.get_text(' ',strip=True) for c in cells]
        if not re.fullmatch(r'20\d{2}\.\d{2}\.\d{2}\.',date): raise ValueError('Invalid posting date')
        output.append({'post_id':link['data-id'],'school_name':name,'sport':sport,'athletes_raw':athletes,'athletes':count(athletes),'budget_raw':budget,'posted_date':date.rstrip('.').replace('.','-'),'source_url':f"https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?bbsId=1723&mi=11849&nttSn={link['data-id']}"})
    return output


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');args=parser.parse_args()
    if args.fetch:
        records=[]; pages=[]; seen=set(); previous=None
        for page in range(1,142):
            response=requests.get(URL,params={'bbsId':1723,'mi':11849,'listCo':100,'currPage':page},timeout=60);response.raise_for_status()
            rows=parse(response.text)
            if not rows: raise ValueError('Empty page before date boundary')
            for row in rows:
                if row['post_id'] in seen: raise ValueError('Repeated pagination record')
                if previous and row['posted_date']>previous: raise ValueError('Posting order changed; retry snapshot')
                seen.add(row['post_id']);previous=row['posted_date']
                if row['posted_date']>='2024-01-01': records.append(row)
            pages.append({'url':response.url,'sha256':hashlib.sha256(response.content).hexdigest(),'rows':len(rows)})
            print('Athletics page',page,'through',rows[-1]['posted_date'],flush=True)
            if rows[-1]['posted_date']<'2024-01-01': break
        else: raise ValueError('Date boundary not reached')
        SOURCE.write_text(json.dumps({'records':records,'pages':pages},ensure_ascii=False,indent=2),encoding='utf-8')
    source=json.loads(SOURCE.read_text(encoding='utf-8'))
    registry=list(csv.DictReader((ROOT/'data_processed/education/institutions.csv').open(encoding='utf-8-sig')))
    schools={};unmatched=[]
    for row in source['records']:
        hits=[r for r in registry if re.sub(r'\s+','',r['학교명'])==re.sub(r'\s+','',row['school_name'])]
        if len(hits)==1: schools.setdefault(hits[0]['학교ID'],[]).append(row)
        else: unmatched.append(row)
    result={'schools':schools,'unmatched':unmatched,'coverage':NOTE,'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
    (ROOT/'data_processed/education/school_athletics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Athletics',len(schools),'schools',sum(map(len,schools.values())),'observations',len(unmatched),'unmatched')


if __name__=='__main__':main()
