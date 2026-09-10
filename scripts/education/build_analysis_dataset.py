"""Join actual school observations for the question-driven analysis runner."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import theilslopes

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed'
EDU = DATA / 'education'


def trend(history):
    rows = sorted((int(r['year']), float(r['students'])) for r in history
                  if r.get('students') is not None and np.isfinite(r['students']) and r['students'] >= 0)
    if len({y for y, _ in rows}) != len(rows):
        raise ValueError('Repeated observation year')
    result = {'observations': [{'year': y, 'students': v} for y, v in rows],
              'observed_years': len(rows), 'latest_change': None, 'latest_change_pct': None,
              'sen_slope_students_per_year': None, 'trend_status': 'insufficient_years'}
    if len(rows) >= 2 and rows[-1][0] - rows[-2][0] == 1:
        change = rows[-1][1] - rows[-2][1]
        result.update(latest_change=change, latest_change_pct=change / rows[-2][1] * 100 if rows[-2][1] > 0 else None,
                      change_years=[rows[-2][0], rows[-1][0]])
    if len(rows) >= 3:
        result.update(sen_slope_students_per_year=float(theilslopes([v for _, v in rows], [y for y, _ in rows]).slope),
                      trend_status='descriptive_sen_slope')
    return result


def main():
    paths = [EDU/'institutions.csv', EDU/'shared_parks.json', EDU/'school_statistics.json',
             EDU/'school_analysis.json', EDU/'enrollment_forecasts.json', EDU/'academy_school_context.json',
             DATA/'school_priority_with_functional_park_layer.csv', DATA/'schools.csv',
             DATA/'school_library_access.csv', EDU/'candidate_age_demand.json']
    def read(p): return json.loads(p.read_text(encoding='utf-8'))
    registry = pd.read_csv(paths[0]).set_index('학교ID')
    active = read(paths[1])['schools']
    stats = read(paths[2]); extended = {r['학교ID']: r for r in read(paths[3])}
    enrollment = read(paths[4]); academy = read(paths[5])
    baseline = pd.read_csv(paths[6]).set_index('학교ID').to_dict('index')
    coordinates = pd.read_csv(paths[7]).set_index('학교ID').to_dict('index')
    libraries = pd.read_csv(paths[8]).set_index('학교ID').to_dict('index')
    def finite(v): return float(v) if v is not None and np.isfinite(float(v)) else None
    rows = []
    for school in active:
        sid = school['id']; ext = extended.get(sid); env = ext or baseline[sid]
        geo = registry.loc[sid].to_dict() if sid in registry.index else coordinates[sid]
        context = (ext or {}).get('context', {})
        observations = {str(year): {k: v for k, v in stats['schools'].get(sid, {}).get(str(year), {}).items() if k != 'sources'} for year in stats['years']}
        rows.append({'id': sid, 'name': school['name'], 'level': school['level'], 'gu': school['gu'],
                     'lat': finite(geo.get('위도')), 'lng': finite(geo.get('경도')),
                     'observations': observations,
                     'environment': {'parks': finite(env.get('iso_park_count')), 'green': finite(env.get('iso_green_ratio')),
                                     'academy': finite(academy.get(sid, {}).get('straight_500m_count')),
                                     'library': finite(context.get('library', {}).get('walkshed_count') if ext else libraries.get(sid, {}).get('iso_library_count')),
                                     'shared_park_area': school['shared_area_per_student']},
                     'enrollment_trend': trend(enrollment.get(sid, {}).get('history', [])),
                     'forecast': enrollment.get(sid, {}).get('forecast', []),
                     'forecast_status': enrollment.get(sid, {}).get('model_status', 'unavailable')})
    grid = read(paths[9])
    coverage = {}
    for level in ['유치원', '초등학교', '중학교', '고등학교']:
        group = [r for r in rows if r['level'] == level]
        coverage[level] = {'schools': len(group),
                           'observed_change': sum(r['enrollment_trend']['latest_change'] is not None for r in group),
                           'sen_trend': sum(r['enrollment_trend']['sen_slope_students_per_year'] is not None for r in group),
                           'forecast': sum(bool(r['forecast']) for r in group),
                           'candidate_grids': len(grid['candidates']),
                           'complete_grid_500m_demand': sum(r['straight_500m']['levels'][level]['estimated_residents'] is not None for r in grid['candidates'].values())}
    result = {'schema_version': 1, 'years': stats['years'], 'schools': rows, 'coverage': coverage,
              'source_hashes': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},
              'limitations': ['학교급을 구분해 분석한다. 환경은 현재 스냅샷이며 공시연도별 과거 환경이 아니다.',
                              'Sen 기울기는 확보된 모든 관측 연도 간 기울기의 중앙값이며 인과효과·미래 예측이 아니다. 연속한 마지막 두 연도만 전년 대비 증감으로 표시한다.',
                              '기관 재학생 증감과 2024년 격자 거주 연령 수요는 서로 다른 모집단이다. 예측은 기존 모형의 지원 신호이며 독립 검증 한계는 forecast_validation.json에 따른다.',
                              '지도 편입 917개 기관만 포함한다. 현재 군구 표기는 입력 스냅샷 기준이며 역사적 행정구역을 자동 추정하지 않는다.']}
    (EDU/'analysis_dataset.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print(json.dumps(coverage, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
