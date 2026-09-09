"""Rolling-origin school-age forecasts with pre-holdout model selection."""
import hashlib
import json
import logging
from importlib.metadata import version
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from prophet import Prophet
from xgboost import XGBRegressor

from scripts.education.build_regional_demography import BANDS,band_sum

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data_processed/education'
CACHE=ROOT/'data/education_sources/regional_prophet_cache.json'
FAMILIES=['persistence','trend','prophet','prophet_xgb']
for name in ['cmdstanpy','prophet']:
    logging.getLogger(name).setLevel(logging.ERROR)


def fit_residual(samples,level,cutoff):
    training=[s for s in samples if s['level']==level and s['actual'] is not None and s['target']<=cutoff]
    if len(training)<25:
        return None
    model=XGBRegressor(n_estimators=60,max_depth=2,learning_rate=.04,min_child_weight=5,
                       reg_lambda=10,subsample=1,colsample_bytree=1,random_state=42,n_jobs=1)
    model.fit(np.array([s['features'] for s in training]),np.array([s['actual']-s['prophet'] for s in training]))
    model.training_max_target_=max(s['target'] for s in training)
    model.training_count_=len(training)
    return model


def build():
    contexts=json.loads((OUT/'regional_demography.json').read_text(encoding='utf-8'))
    contexts={key:value for key,value in contexts.items() if not value['region_name'].endswith('광역시')}
    observations=json.loads((ROOT/'data/education_sources/regional_age_observations.json').read_text(encoding='utf-8'))['records']
    ages={(r['region_code'],r['year']):r['ages'] for r in observations}
    cache=json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
    runtime={name:version(name) for name in ['prophet','xgboost','numpy','pandas']}
    if cache.get('_runtime',runtime)!=runtime:
        cache={}
    cache['_runtime']=runtime
    samples=[]
    for key,context in contexts.items():
        level=key.split('|')[1]
        history={r['year']:r['residents'] for r in context['history'] if r['residents'] is not None}
        for origin in sorted(history):
            past={year:value for year,value in history.items() if year<=origin}
            if len(past)<5 or max(past)-min(past)+1!=len(past):
                continue
            frame=pd.DataFrame({'ds':[pd.Timestamp(f'{year}-12-31') for year in past],'y':list(past.values())})
            signature=hashlib.sha256(json.dumps(['linear-no-seasonality-cps005-ncp3-v1',list(past.items())]).encode()).hexdigest()
            if signature not in cache:
                model=Prophet(yearly_seasonality=False,weekly_seasonality=False,daily_seasonality=False,n_changepoints=3,changepoint_prior_scale=.05)
                model.fit(frame)
                future=pd.DataFrame({'ds':[pd.Timestamp(f'{origin+h}-12-31') for h in range(1,7)]})
                cache[signature]=[max(0,float(v)) for v in model.predict(future).yhat]
            values=list(past.values())
            slope=(values[-1]-values[-3])/2
            for horizon in range(1,7):
                start,end=BANDS[level]
                cohort=band_sum(ages[(context['region_code'],origin)],start-horizon,end-horizon) if start>=horizon else None
                base=cache[signature][horizon-1]
                samples.append({'key':key,'level':level,'origin':origin,'target':origin+horizon,'horizon':horizon,
                                'actual':history.get(origin+horizon),'persistence':values[-1],'trend':max(0,values[-1]+horizon*slope),
                                'prophet':base,'features':[horizon,values[-1],slope,base,cohort if cohort is not None else -1,int(cohort is None)]})
        print(f'Prepared {key}',flush=True)
        CACHE.write_text(json.dumps(cache,separators=(',',':')),encoding='utf-8')

    @lru_cache(None)
    def residual_model(level,cutoff):
        return fit_residual(samples,level,cutoff)

    def predictions(sample):
        model=residual_model(sample['level'],sample['origin'])
        residual=float(model.predict(np.array([sample['features']]))[0]) if model is not None else 0
        return {**{family:sample[family] for family in FAMILIES[:-1]},'prophet_xgb':max(0,sample['prophet']+residual)}

    selected,validation={},[]
    for level in BANDS:
        tuning=[s for s in samples if s['level']==level and s['actual'] is not None and 2020<=s['target']<=2022 and s['horizon'] in [1,3]]
        errors={family:[] for family in FAMILIES}
        for sample in tuning:
            for family,value in predictions(sample).items():
                errors[family].append(abs(value-sample['actual']))
        scores={family:float(np.mean(error)) for family,error in errors.items()}
        simple=min(FAMILIES[:2],key=lambda family:scores[family])
        best=min(FAMILIES,key=lambda family:scores[family])
        chosen=best if scores[best]<scores[simple]*.95 else simple
        selected[level]={'family':chosen,'tuning_mae':scores,'tuning_n':len(tuning),'selection_rule':'2020~2022년 목표, 1·3년 전 원점 검증. 복잡한 모형은 최선 단순 모형보다 MAE 5% 이상 개선 시만 채택.'}
        for sample in samples:
            if sample['level']==level and sample['actual'] is not None and 2023<=sample['target']<=2025 and sample['horizon'] in [1,3]:
                values=predictions(sample)
                fitted=residual_model(level,sample['origin'])
                validation.append({key:sample[key] for key in ['key','origin','target','horizon','actual']}|
                                  {'selected_family':chosen,'selected_prediction':values[chosen],
                                   'xgb_training_max_target':fitted.training_max_target_ if fitted is not None else None,
                                   'xgb_training_count':fitted.training_count_ if fitted is not None else 0,**values})
    results={}
    for key,context in contexts.items():
        level=key.split('|')[1]
        future=[s for s in samples if s['key']==key and s['origin']==2025]
        results[key]={'base_year':2025,'region_code':context['region_code'],'region_name':context['region_name'],
                      'school_level':level,'selected_model':selected[level],
                      'forecast':[{'year':s['target'],'residents':round(predictions(s)[selected[level]['family']],1)} for s in future],
                      'scope':'2025년 행정구역을 고정한 해당 연령 거주 인구 지원 예측. 재학생 수·실제 이용자 예측 아님.',
                      'limitations':'검증은 1·3년 선행으로 수행. 4~6년 선행 성능은 별도 검증되지 않음. 출생·주거개발·정책·행정구역 변경에 따라 달라질 수 있음.'}
    summary=[]
    for level in BANDS:
        for horizon in [1,3]:
            rows=[r for r in validation if r['key'].endswith('|'+level) and r['horizon']==horizon]
            summary.append({'school_level':level,'horizon':horizon,'n':len(rows),
                            'selected_mae':float(np.mean([abs(r['selected_prediction']-r['actual']) for r in rows])),
                            'persistence_mae':float(np.mean([abs(r['persistence']-r['actual']) for r in rows]))})
    (OUT/'regional_age_forecasts.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'regional_age_forecast_validation.json').write_text(json.dumps({'selection':selected,'summary':summary,'rows':validation,'runtime':runtime,
        'independence':'모형 선택 목표연도 ≤2022. 별도 검증 목표연도 2023~2025. 각 예측의 XGBoost 학습 목표연도 ≤예측 원점. Prophet 입력도 원점 이하.',
        'source_sha256':hashlib.sha256((ROOT/'data/education_sources/regional_age_observations.json').read_bytes()).hexdigest()},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Regional forecasts complete:',len(results),flush=True)


if __name__=='__main__':build()
