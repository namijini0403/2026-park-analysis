"""Compact server-side evidence for school-level explanations; no client facts trusted."""
import json
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'data_processed/education'


def read(name):return json.loads((DATA/name).read_text(encoding='utf-8'))


def main():
    analysis={r['학교ID']:r for r in read('school_analysis.json')}
    academy=read('academy_school_context.json')
    routes=read('school_routes.json')
    awards=read('science_awards.json')
    invention=read('invention_awards.json')
    regional=read('regional_age_forecasts.json')
    demand=read('candidate_age_demand.json')['candidates']
    indicators=read('school_public_indicators.json')['schools']
    frame=pd.read_csv(DATA/'institutions.csv').astype(object)
    rows=frame.where(pd.notna(frame),None).to_dict('records')
    frame=pd.read_csv(ROOT/'data_processed/schools.csv').astype(object)
    baseline=frame.where(pd.notna(frame),None).to_dict('records')
    known={r['학교ID'] for r in rows}
    rows += [dict(r,학교급구분='초등학교') for r in baseline if r['학교ID'] not in known]
    output={}
    for institution in rows:
        sid=institution['학교ID']
        row=analysis.get(sid,{})
        route={k:v for k,v in routes.get(sid,{}).items() if k!='route_coordinates'}
        disclosures=read(f'disclosures/{sid}.json') if (DATA/f'disclosures/{sid}.json').exists() else []
        titles=sorted({f"{r['year']}년 {r['title']}" for r in disclosures})
        candidates=[{**c,'age_demand':demand.get(c['grid_id'],{}).get('straight_500m',{}).get('levels',{}).get(institution['학교급구분'])} for c in row.get('candidates',[])]
        output[sid]={'school_id':sid,'school_name':institution['학교명'],'school_level':institution['학교급구분'],
                     'extended':bool(row),'district_name':row.get('gu',institution.get('gu')),
                     'case_type':row.get('case_type'),'case_label':row.get('case_label'),
                     'park_count':row.get('iso_park_count'),'green_ratio':row.get('iso_green_ratio'),
                     'current_students':row.get('current_students'),'enrollment':row.get('enrollment',{}),
                     'context':row.get('context',{}),'academy':{k:v for k,v in academy.get(sid,{}).items() if k!='facility_ids'},
                     'route':route,'reading_gap':row.get('reading_gap',{}),'similar_schools':row.get('similar_schools',[]),
                     'knn_basis':row.get('knn_basis'),'candidates':candidates[:5],
                     'candidate_comparison':row.get('candidate_comparison'),'designations':row.get('designations',[]),
                     'regional':regional.get(f"{row.get('gu',institution.get('gu'))}|{institution['학교급구분']}"),
                     'awards':row.get('awards',[])+awards['schools'].get(sid,[])+invention['schools'].get(sid,[]),
                     'award_coverage':awards['coverage']+' '+invention['coverage'],
                     'public_indicators':[{**g,'observations':g['observations'][-1:]} for g in indicators.get(sid,[])],
                     'disclosure_titles':titles,'limitations':row.get('limitations',[])}
        # Facility IDs are large and unnecessary for answering aggregate questions.
        if 'academy' in output[sid]['context']:
            output[sid]['context']['academy'].pop('facility_ids',None)
    target=ROOT/'data_processed/context/education_school_evidence.json'
    target.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    print(f'Server school evidence: {len(output)} schools; {target.stat().st_size} bytes')


if __name__=='__main__':main()
