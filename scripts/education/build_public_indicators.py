"""Public school activity/support indicators, separate from academic attainment.

Source definitions: cached official Schoolinfo opendata.js, items 55/56/59/90.
Do not combine categories into a school quality score or infer suppressed values.
"""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import pandas as pd

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'data_processed/education'
SPECS={
    '55':('장학금·학비 지원',[
        ('SCHO_NMPR_FGR','장학금 수혜 인원','명'),('SCHO_AMT','장학금 금액','원'),
        ('SCE_RDCTN_NMPR_FGR','학비 지원 인원','명'),('SCE_RDCTN_AMT','학비 지원 금액','원')]),
    '56':('동아리 활동',[
        ('CREAT_EXPER_ACT_CCCLU_FGR','창의적 체험활동 동아리 수','개'),
        ('CREAT_EXPER_ACT_STDNT_FGR','창의적 체험활동 동아리 참여','명'),
        ('STDNT_SLCTL_CCCLU_FGR','학생 자율 동아리 수','개'),('STDNT_SLCTL_FGR','학생 자율 동아리 참여','명')]),
    '59':('방과후학교',[
        ('ASL_CURR_PGM_FGR','교과 프로그램 수','개'),('ASL_SPABL_APTD_PGM_FGR','특기적성 프로그램 수','개'),
        ('ASL_CURR_REG_STDNT_FGR','교과 수강 학생','명'),('ASL_SPABL_APTD_REG_STDNT_FGR','특기적성 수강 학생','명'),
        ('ASL_PTPT_STDNT_FGR','방과후학교 참여 학생','명')])}
GRADE_FIELDS=['ONGRD_STDNT_FGR','TWGRD_STDNT_FGR','THGRD_STDNT_FGR','FOGRD_STDNT_FGR','FIGRD_STDNT_FGR']


def number(value):
    try:
        result=float(str(value).replace(',','').strip())
        return result if math.isfinite(result) and result>=0 else None
    except (ValueError,TypeError):
        return None


def provenance(rows,year):
    return {'publication_year':year,'source_files':sorted({r['source_file'] for r in rows}),
            'source_url':rows[0]['source_url']}


def paps(rows,year):
    result={**provenance(rows,year),'status':'available','metrics':[],
            'scope':'공개 학년·성별 평가행 합계. 미평가 학생을 포함한 전교생 비율이 아님.'}
    keys=[(r['values'].get('GRADE'),r['values'].get('SXDS_CODE')) for r in rows]
    if len(set(keys))!=len(keys):
        result['status']='duplicate_strata'
        return result
    if any(r['values'].get('PBAN_EXCP_YN')!='N' for r in rows):
        result['status']='exempt_or_unconfirmed'
        return result
    totals=[0.]*5
    for row in rows:
        values=row['values']
        if values.get('SXDS_CODE') not in ['남자','여자'] or not values.get('GRADE'):
            result['status']='unknown_strata'
            return result
        counts=[number(values.get(k)) for k in GRADE_FIELDS]
        denominator=number(values.get('RATE_SUM'))
        if any(v is None for v in counts) or denominator is None:
            result['status']='missing_observations'
            return result
        if abs(sum(counts)-denominator)>.001:
            result['status']='inconsistent_counts'
            return result
        totals=[a+b for a,b in zip(totals,counts)]
    total=sum(totals)
    result['strata_count']=len(rows)
    result['metrics']=[{'field':'RATE_SUM','label':'공개 평가행 인원 합계','value':total,'unit':'명'}]
    for i,count in enumerate(totals):
        result['metrics'].append({'field':GRADE_FIELDS[i],'label':f'{i+1}등급 인원','value':count,'unit':'명'})
    result['metrics'].append({'field':'derived_grade45_pct','label':'4·5등급 비율(공개 평가행 기준)',
                              'value':(totals[3]+totals[4])/total*100 if total>0 else None,'unit':'%',
                              'formula':'100*(FOGRD_STDNT_FGR 합+FIGRD_STDNT_FGR 합)/RATE_SUM 합'})
    if total==0:result['status']='no_assessed_students'
    return result


def summarize(rows):
    groups=[]
    for item in [*SPECS,'90']:
        selected=[r for r in rows if r['item']==item]
        observations=[]
        for year in sorted({r['year'] for r in selected}):
            cohort=[r for r in selected if r['year']==year]
            if item=='90':
                observations.append(paps(cohort,year))
                continue
            status='available' if len(cohort)==1 else 'duplicate_records'
            if any(r['values'].get('PBAN_EXCP_YN')!='N' for r in cohort):status='exempt_or_unconfirmed'
            metrics=[]
            if status=='available':
                metrics=[{'field':field,'label':label,'value':number(cohort[0]['values'].get(field)),'unit':unit}
                         for field,label,unit in SPECS[item][1]]
                if any(m['value'] is None for m in metrics):status='partial_observations'
            observations.append({**provenance(cohort,year),'status':status,'metrics':metrics})
        groups.append({'item':item,'title':'학생 체력평가(PAPS)' if item=='90' else SPECS[item][0],
                       'status':'observed' if observations else 'no_records','observations':observations})
    return groups


def main():
    registry=pd.read_csv(DATA/'institutions.csv')
    schools={};sources={};coverage=Counter()
    for sid in registry['학교ID']:
        path=DATA/'disclosures'/f'{sid}.json'
        rows=json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
        schools[sid]=summarize(rows)
        if path.exists():sources[sid]=hashlib.sha256(path.read_bytes()).hexdigest()
        for group in schools[sid]:
            if group['observations']:coverage[f"{group['item']}:{group['observations'][-1]['status']}"]+=1
    output={'schools':schools,'limitations':[
        '장학·활동·체력 지표이며 수능·학업성취 점수나 학교 종합 순위가 아님.',
        '공시연도는 실제 평가·활동 기간과 다를 수 있음. 서로 다른 참여 인원을 합산하거나 재학생 수로 임의 나누지 않음.',
        '유치원 등 연결 공시가 없는 기관은 미확보. 기록 없음은 실적 0이 아님.',
        '체력 등급의 원인이나 야외 환경의 인과 효과를 이 자료만으로 판단하지 않음.']}
    (DATA/'school_public_indicators.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    manifest={'schools':len(schools),'latest_observation_status':dict(coverage),'source_disclosure_hashes':sources,
              'field_definitions_sha256':hashlib.sha256((ROOT/'data/education_sources/disclosures/official_field_definitions.js').read_bytes()).hexdigest()}
    (DATA/'public_indicators_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'schools':len(schools),'coverage':dict(coverage)},ensure_ascii=False))


if __name__=='__main__':main()
