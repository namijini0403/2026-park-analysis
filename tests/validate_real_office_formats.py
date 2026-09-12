import sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'/'education'))
from parse_office_document import extract
files=['교육청보고 서식.docx','붙임2 (양식5) 예선기관 추천팀 참가자 현황.xlsx','교육공공데이터 AI활용 공모전 추가 제출 서류.hwpx','8회 교육공공데이터 일반부분 대상 성과 보고.hwp']
results=[]
for name in files:
    file=ROOT.parent/name
    result=extract(name,file.read_bytes())
    results.append({'format':file.suffix,'file':name,'tables':len(result['tables']),'paragraphs':len(result['paragraphs']),'warnings':result['warnings']})
(ROOT/'contest_plan/office_format_validation_20260911.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8');print(json.dumps(results,ensure_ascii=False))
