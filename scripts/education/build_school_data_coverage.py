"""School-by-school coverage inventory; counts describe linked records, not achievement."""
import csv
import hashlib
import io
import json
from collections import Counter

from scripts.education.build_ai_school_evidence import ROOT, DATA


def main():
    hashes = {}

    def content(path):
        raw = path.read_bytes()
        hashes[str(path.relative_to(ROOT))] = hashlib.sha256(raw).hexdigest()
        return raw.decode('utf-8-sig')

    def read(name):
        return json.loads(content(DATA/name))

    registry = list(csv.DictReader(io.StringIO(content(DATA/'institutions.csv'))))
    ids = [r['학교ID'] for r in registry]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate registry identities')
    baseline = {r['학교ID'] for r in csv.DictReader(io.StringIO(content(ROOT/'data_processed/schools.csv')))}
    analysis = {r['학교ID']:r for r in read('school_analysis.json')}
    age = read('school_age_demand.json')['schools']
    routes = read('school_routes.json')
    academy = read('academy_school_context.json')
    indicators = read('school_public_indicators.json')['schools']
    science = read('science_awards.json')['schools']
    invention = read('invention_awards.json')['schools']
    progression = read('school_progression.json')['schools']
    for label, linked in [('analysis',analysis),('age',age),('routes',routes),('academy',academy),('indicators',indicators),('science',science),('invention',invention)]:
        if set(linked)-set(ids):
            raise ValueError(f'{label}: unknown school IDs')
    if set(analysis)!=set(age) or set(analysis)!=set(routes):
        raise ValueError('Extended age/route files do not cover the analysis identities')
    rows = []
    for school in registry:
        sid, level = school['학교ID'], school['학교급구분']
        result = analysis.get(sid, {})
        name_level = next((kind for kind in ['초등학교','중학교','고등학교','유치원'] if school['학교명'].endswith(kind)),None)
        disclosures = read(f'disclosures/{sid}.json')
        linked_items = sorted({r['item'] for r in disclosures})
        output = {'학교ID':sid, '학교명':school['학교명'], '학교급':level, '원자료_지역명':school['gu'],
                  '학교명_학교급_대조':'불일치 검토 필요' if name_level and name_level!=level else '명칭상 불일치 없음',
                  '원자료_기준일':school['데이터기준일자'],
                  '앱_분석': '확장 분석' if result else '기존 초등 분석' if sid in baseline else '미편입',
                  '확장_환경_분석':result.get('analysis_status','기존 초등 별도 기준' if sid in baseline else '미편입'),
                  '확장_KNN_비교기관수':len(result.get('similar_schools',[])) if result else '',
                  '확장_학교수요_모형':result.get('enrollment',{}).get('model_status','해당 산출물 없음'),
                  '확장_지역전망_연결':result.get('statistical_region_2025',{}).get('region_name') or '해당 산출물 없음',
                  '확장_공원경로_상태':routes.get(sid,{}).get('status','해당 산출물 없음'),
                  '확장_후보격자수':len(result.get('candidates',[])) if result else '',
                  '학원_환경_연결':academy.get(sid,{}).get('coverage','미확보'),
                  '연결_공시행수':len(disclosures), '연결_공시항목수':len(linked_items),
                  '연결_공시항목코드':'|'.join(linked_items),
                  '연결_공시연도':'|'.join(map(str,sorted({r['year'] for r in disclosures}))),
                  '과학전람회_확인기록수':len(science.get(sid,[])),
                  '학생발명대회_확인기록수':len(invention.get(sid,[])),
                  '수능_학교점수':'미확보', '학업성취_학교수치':'미확보'}
        output['진로_연결_조사연도']='|'.join(str(r['year']) for r in progression.get(sid,[]))
        output['진로_최근_상태']=progression[sid][-1]['status'] if progression.get(sid) else '미확보 또는 해당 학교급 아님'
        for scope,label in [('straight_500m','직선권'),('walkshed_500m','보행권')]:
            output[f'확장_{label}_연령인구_상태'] = age.get(sid,{}).get(scope,{}).get('levels',{}).get(level,{}).get('status','해당 산출물 없음')
        for group in indicators[sid]:
            observations = group['observations']
            output[f"{group['item']}_최신공시_상태"] = observations[-1]['status'] if observations else 'no_records'
            output[f"{group['item']}_최신공시_연도"] = observations[-1]['publication_year'] if observations else ''
        rows.append(output)
    target = DATA/'school_data_coverage.csv'
    with target.open('w',encoding='utf-8-sig',newline='') as handle:
        writer = csv.DictWriter(handle,fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
    summary = []
    for level in ['유치원','초등학교','중학교','고등학교']:
        cohort = [r for r in rows if r['학교급']==level]
        summary.append({'school_level':level,'registry':len(cohort),
                        'app':sum(r['앱_분석']!='미편입' for r in cohort),
                        'disclosures_linked':sum(r['연결_공시행수']>0 for r in cohort),
                        'science_schools':sum(r['과학전람회_확인기록수']>0 for r in cohort),
                        'invention_schools':sum(r['학생발명대회_확인기록수']>0 for r in cohort)})
    manifest = {'schools':len(rows),'summary':summary,'app_status':dict(Counter(r['앱_분석'] for r in rows)),
                'not_in_app':[r['학교ID'] for r in rows if r['앱_분석']=='미편입'],
                'input_hashes':hashes,'csv_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
                'limitations':['확인기록 0은 수상 없음이 아니라 수집한 자료에 연결된 기록이 없다는 뜻.',
                               '공시행수·항목수는 수집 범위이며 교육 품질·실적 점수로 비교하지 않음.',
                               '기존 초등 별도 기준은 분석 부재를 뜻하지 않음. 확장 전용 열에 기존 초등 값을 전용하지 않음.',
                               '수능·학업성취 미확보는 공개자료 부존재의 증명이 아님. 전체 공개 웹의 전수 조사 완료를 주장하지 않음.']}
    (DATA/'school_data_coverage_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))


if __name__=='__main__':
    main()
