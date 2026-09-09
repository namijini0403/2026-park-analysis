"""School-only extraction from the official final 2026 HWPX result tables."""
import hashlib
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'outputs/education_sources/invention_awards_2026.hwpx'
OUT=ROOT/'data/education_sources/invention_awards_2026_results.json'
URL='https://www.science.go.kr/mps/1111/bbs/208/moveBbsNttDetail.do?nttSn=49217'
DOWNLOAD='https://www.science.go.kr/mps/bbs/208/downBbsNttFile.do?atchmnflSn=76588'
NS={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
PRIZES=[('대통령상',1),('국무총리상',1),('최우수상',10),('특상',50),('우수상',100),('장려상',137)]


def table_rows(table):
    grid={}
    for row in table.findall('hp:tr',NS):
        for cell in row.findall('hp:tc',NS):
            address=cell.find('hp:cellAddr',NS).attrib
            span=cell.find('hp:cellSpan',NS).attrib
            text=' '.join(''.join(cell.itertext()).split())
            for y in range(int(address['rowAddr']),int(address['rowAddr'])+int(span['rowSpan'])):
                for x in range(int(address['colAddr']),int(address['colAddr'])+int(span['colSpan'])):
                    if (y,x) in grid: raise ValueError('Overlapping table cells')
                    grid[y,x]=text
    return [[grid.get((y,x),'') for x in range(int(table.attrib['colCnt']))] for y in range(int(table.attrib['rowCnt']))]


def main():
    with zipfile.ZipFile(RAW) as archive:
        root=ET.fromstring(archive.read('Contents/section1.xml'))
    tables=root.findall('.//hp:tbl',NS)
    if len(tables)!=11: raise ValueError('Unexpected official result table structure')
    def headings(element):
        if element.tag.endswith('}tbl'): return ''
        return (element.text or '')+''.join(headings(child) for child in element)
    titles=re.findall(r'ㅇ(대통령상|국무총리상|최우수상|특상|우수상|장려상)',re.sub(r'\s+','',headings(root)))
    if titles[:6]!=[prize for prize,_ in PRIZES]: raise ValueError('Award heading order changed')
    registry=pd.read_csv(ROOT/'data_processed/education/institutions.csv').to_dict('records')
    local={r['학교명']:r for r in registry if r['학교급구분']!='유치원'}
    national=defaultdict(set)
    for row in json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']:
        national[row['학교명']].add(row['학교ID'])
    records=[];ambiguous=[];seen=set()
    for index,(prize,count) in enumerate(PRIZES):
        rows=table_rows(tables[index])
        if [''.join(v.split()) for v in rows[0]]!=['분야','출품번호','소속','학년','성명'] or len(rows)-1!=count:
            raise ValueError('Student result table headers/count changed')
        for level,number,name,grade,_ in rows[1:]:
            level=level.split('(')[0].strip()
            if number in seen: raise ValueError('Duplicate student work number')
            seen.add(number)
            school=local.get(name)
            if not school: continue
            if len(national[name])!=1 or school['학교급구분']!=level:
                ambiguous.append({'work_number':number,'school_name':name,'reason':'national_name_or_school_level_not_unique'})
                continue
            records.append({'school_id':school['학교ID'],'school_name':name,'school_level':level,
                            'event':'전국학생과학발명품경진대회','year':2026,'category':'학생작품대회',
                            'result':prize,'work_number':number,'work_title':None,
                            'work_title_status':'not_listed_in_official_result','award_scope':'student_work',
                            'source_url':URL,'result_source_url':DOWNLOAD,'source_table':index+1,
                            'result_basis':'2026-08-28 최종 심사결과 명단','participant_scope':'학생작품; 지도교원·지도논문 제외',
                            'verification':'공식 최종 HWPX의 소속·학교급 대조, 전국 학교명 유일성 확인. 개인 이름 미보존.'})
    if len(seen)!=299: raise ValueError('Expected 299 student works')
    groups=table_rows(tables[9])
    if groups[0]!=['지역','학교명','지역','학교명']: raise ValueError('School group header changed')
    for row in groups[1:]:
        for region,name in [row[:2],row[2:]]:
            if region!='인천': continue
            school=local.get(name)
            if not school: raise ValueError(f'Unmatched Incheon group award: {name}')
            records.append({'school_id':school['학교ID'],'school_name':name,'school_level':school['학교급구분'],
                            'event':'전국학생과학발명품경진대회','year':2026,'category':'학교 단체',
                            'result':'학교단체상','work_title':'학교단체상','award_scope':'school_group',
                            'source_url':URL,'result_source_url':DOWNLOAD,'source_table':10,
                            'result_basis':'2026-08-28 최종 심사결과 학교단체상 명단',
                            'participant_scope':'학교단체상; 개별 작품 수상과 별도',
                            'verification':'공식 학교단체상 표의 인천 지역·학교명 정확 일치.'})
    output={'source_url':URL,'download_url':DOWNLOAD,'source_sha256':hashlib.sha256(RAW.read_bytes()).hexdigest(),
            'publication_date':'2026-08-28','student_works_checked':len(seen),'records':records,'ambiguous':ambiguous,
            'scope':'최종 심사결과 학생작품 299건과 학교단체상만 확인. 교원 개인·지도논문 제외. 작품명 미기재는 null; 학생 이름 미보존.'}
    OUT.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{len(records)} school award observations; {len(ambiguous)} ambiguous student affiliations held')


if __name__=='__main__':main()
