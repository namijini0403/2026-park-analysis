"""Reproducible method update using existing observations; no invented local demand."""
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import pandas as pd

from scripts.education.build_candidate_age_demand import build as allocate, BANDS
from scripts.education.enrollment_model_v2 import build as forecast

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'data_processed/education'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(name, value):
    (DATA/name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def finalize_views():
    """Compatibility fields carry explicit scope; archived outputs are never overwritten."""
    allocation = read(DATA/'candidate_demand_v2.json')['candidates']
    path = ROOT/'data_processed/candidate_grid_final.geojson'
    backup = ROOT/'outputs/method_update_20260911/candidate_grid_before_v2.geojson'
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        backup.write_bytes(path.read_bytes())
    grid = read(backup)
    for feature in grid['features']:
        p = feature['properties']; c = allocation[p['grid_id']]
        inside, outer = (c[scope]['levels']['초등학교'] for scope in ['footprint', 'straight_500m'])
        for key in list(p):
            if any(token in key for token in ['shap', 'robust', 'stability', 'rank_std', 'mean_rank', 'positive_drivers', 'negative_drivers']) or key.startswith('walkshed_'):
                p.pop(key)
        p.pop('predicted_beneficiaries_used', None)
        p.pop('pareto_candidate', None)
        p.pop('recommendation_type', None)
        p.update(demand_model_version='source_allocation_v2_20260911', demand_scope='straight_500m',
                 demand_status=outer['status'], candidate_child_current=inside['estimated_residents'],
                 resident_children_current=inside['estimated_residents'], straight_500m_children_current=outer['estimated_residents'],
                 demand_label='직선 500m 거주 아동 시나리오',
                 demand_note='2024년 6~11세 배분 추정에 인천 전체 연령인구 성장률 적용. 보행권·실제 이용자·신규 수혜가 아님. 후보끼리 합산하지 않음.')
        for year in ['2029', '2031']:
            for key in ['pred_beneficiary_', 'xgb_predicted_', 'forecast_']:
                p[key+year] = inside['city_growth_scenario'].get(year)
            p['potential_demand_'+year] = outer['city_growth_scenario'].get(year)
        score = .6*p['potential_demand_2029']+.4*p['potential_demand_2031'] if p['potential_demand_2029'] is not None and p['potential_demand_2031'] is not None else None
        p['priority_score_mixed'] = p['priority_score'] = score
        p['candidate_rank_mixed'] = p['candidate_rank'] = None
    ranked = sorted((f['properties'] for f in grid['features'] if f['properties']['priority_score'] is not None), key=lambda p:(-p['priority_score'],p['grid_id']))
    for rank, p in enumerate(ranked, 1):
        p['candidate_rank_mixed'] = p['candidate_rank'] = rank
    path.write_text(json.dumps(grid, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    pd.DataFrame([f['properties'] for f in grid['features']]).to_csv(ROOT/'data_processed/candidate_grid_final.csv', index=False, encoding='utf-8-sig')
    forecasts = read(DATA/'enrollment_forecasts.json')
    baseline = list(csv.DictReader((ROOT/'data_processed/schools.csv').open(encoding='utf-8-sig')))
    fields = ['학교ID','학교명','current_students_2025','forecast_2029','forecast_2031','predicted_2029','predicted_2031','selected_model','model_version','validation_scheme']
    with (DATA/'school_enrollment_forecast_v2.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader()
        for school in baseline:
            item=forecasts.get(school['학교ID'],{});future={r['year']:r['students'] for r in item.get('forecast',[])}
            writer.writerow({'학교ID':school['학교ID'],'학교명':school['학교명'],
                             'current_students_2025':next((r['students'] for r in item.get('history',[]) if r['year']==2025),None),
                             **{f'{prefix}_{y}':future.get(y) for y in [2029,2031] for prefix in ['forecast','predicted']},
                             'selected_model':item.get('model_status','insufficient_history'), 'model_version':'origin_safe_residual_v2',
                             'validation_scheme':'origin_safe_heldout_target'})
    print('Updated baseline candidate data and enrollment CSV', flush=True)


def demand(source, regional):
    result = allocate(source)
    # A single explicit city-wide scenario. No candidate/school district proxy.
    factors = {}
    for level, (start, end) in BANDS.items():
        base = sum(source['city_single_ages'][str(age)] for age in range(start, end+1))
        regions = [r for r in regional.values() if r['school_level'] == level]
        factors[level] = {str(y): sum(next(f['residents'] for f in r['forecast'] if f['year'] == y) for r in regions)/base
                          for y in range(2026, 2032)} if base > 0 and len(regions) == 10 else {}
    for candidate in result['candidates'].values():
        for scope in candidate.values():
            for level, values in scope['levels'].items():
                n = values['estimated_residents']
                values['city_growth_scenario'] = {year: round(n*factor, 2) if n is not None else None
                                                  for year, factor in factors[level].items()}
    result.update(version='source_allocation_v2_20260911', scenario_factors=factors,
                  scenario_basis='2024년 인천 단일연령 거주인구 대비 10개 지역의 선택모형 예측 합계 비율을 모든 격자에 동일 적용. 지역별 개발·이동 미반영.',
                  scope_note='내부/직선500m 거주인구 추정. 보행 접근·신규 수혜 인구가 아님. 후보 목록이 달라도 같은 권역 값은 불변.')
    return result


def grade_snapshot(records, year, n_grades):
    rows = [r for r in records if r['item'] == '09' and r['year'] == year and r['values'].get('PBAN_EXCP_YN') == 'N']
    if len(rows) != 1:
        return None
    v = rows[0]['values']
    values = [v.get(f'COL_S{i}') for i in range(1, n_grades+1)]
    total = v.get('COL_S_SUM')
    if any(not isinstance(x, (int, float)) or not math.isfinite(x) or x < 0 for x in values+[total]):
        return None
    remainder = total-sum(values)
    if remainder < 0:
        return None
    return dict(grades=values, total=total, other_students=remainder, source_file=rows[0]['source_file'])


def cohort_scenario(snapshots, base_year, target=2031):
    current = snapshots[base_year]
    grades = list(current['grades'])
    previous = snapshots.get(base_year-1)
    ratios = [1.]*(len(grades)-1)
    if previous:
        ratios = [min(1.2, max(.8, grades[i+1]/previous['grades'][i])) if previous['grades'][i] > 0 else 1.
                  for i in range(len(grades)-1)]
    # With only two years and no verified catchment intake, hold first-year intake constant.
    intake = grades[0]
    rows = []
    for year in range(base_year+1, target+1):
        grades = [intake]+[grades[i]*ratios[i] for i in range(len(grades)-1)]
        rows.append({'year': year, 'students': round(sum(grades)+current['other_students']),
                     'grade_students': [round(n, 1) for n in grades]})
    return {'base_year': base_year, 'forecast': rows, 'progression_ratios': ratios,
            'intake_assumption': '최신 1학년 입학생수 유지; 학구별 취학예정 인구 미결합',
            'other_students_assumption': '총계에서 일반 학년 합을 뺀 나머지는 고정 유지',
            'status': 'scenario_not_selected_model',
            'limitations': '최근 1회 진급 관측은 순이동·집계변화도 포함. 계수 0.8~1.2 제한은 운영 가정. 장기 성능 미검증.'}


def main():
    source_path = ROOT/'data/education_sources/candidate_age_allocation.json'
    old = read(DATA/'enrollment_forecasts.json')
    registry = pd.read_csv(DATA/'institutions.csv')
    # Immutable backup is also a reproducible input independent of later output changes.
    archive = DATA/'enrollment_forecasts_before_v2.json'
    if not archive.exists():
        archive.write_bytes((DATA/'enrollment_forecasts.json').read_bytes())
    histories = {sid: {r['year']: r['students'] for r in v['history']} for sid, v in old.items()}
    forecasts, validation = forecast(histories, registry)
    cohort = {}; backtests = []
    for row in registry.to_dict('records'):
        level = row['학교급구분']; sid = row['학교ID']
        if level == '유치원':
            continue
        path = DATA/'disclosures'/f'{sid}.json'
        if not path.exists():
            continue
        records = read(path)
        snapshots = {year: snapshot for year in sorted({r['year'] for r in records if r['item'] == '09'})
                     if (snapshot := grade_snapshot(records, year, 6 if level == '초등학교' else 3))}
        if not snapshots:
            continue
        latest = max(snapshots)
        scenario = cohort_scenario(snapshots, latest)
        scenario.update(school_name=row['학교명'], school_level=level, observed_years=list(snapshots), snapshots=snapshots)
        if latest-1 in snapshots:
            past = {y: v for y, v in snapshots.items() if y < latest}
            pred = cohort_scenario(past, latest-1, latest)['forecast'][0]['students']
            scenario['one_year_check'] = {'origin': latest-1, 'target': latest, 'prediction': pred,
                                           'actual': snapshots[latest]['total'],
                                           'absolute_error': abs(pred-snapshots[latest]['total']),
                                           'note': '원점 자료만 사용한 입학인원 유지·진급계수1 기준. 최종 진급계수 모형의 장기 검증이 아님.'}
            backtests.append({'school_level': level, **scenario['one_year_check']})
        cohort[sid] = scenario
    write('grade_cohort_scenarios.json', {'schools': cohort, 'coverage': len(cohort), 'checks': backtests})
    write('enrollment_forecasts.json', forecasts)
    write('forecast_validation.json', validation)
    # Existing extended profile consumes embedded enrollment rather than the standalone file.
    analysis = read(DATA/'school_analysis.json')
    for row in analysis:
        if row['학교ID'] in forecasts:
            row['enrollment'] = forecasts[row['학교ID']]
            row['student_slope'] = forecasts[row['학교ID']].get('student_slope')
    write('school_analysis.json', analysis)
    allocation = demand(read(source_path), read(DATA/'regional_age_forecasts.json'))
    allocation['input_sha256'] = hashlib.sha256(source_path.read_bytes()).hexdigest()
    write('candidate_demand_v2.json', allocation)
    summary = {'candidate_count': len(allocation['candidates']), 'cohort_schools': len(cohort),
               'enrollment_status': dict(Counter(r['model_status'] for r in forecasts.values())),
               'forecast_validation': {k: v['summary'] for k, v in validation.items()},
               'grade_history_years': sorted({y for r in cohort.values() for y in r['observed_years']}),
               'candidate_source_sha256': allocation['input_sha256']}
    write('method_update_manifest.json', summary)
    finalize_views()
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
