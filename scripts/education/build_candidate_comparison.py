"""Explainable multiobjective comparison over every existing candidate within 1.5km.

Weights express preferences, not learned policy labels. No elementary demand or
land feasibility classifications are transferred to another school level.
"""
import hashlib
import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed'
EDU = DATA / 'education'
FEATURES = ('proximity', 'park_gap', 'age_demand')
DEFAULT_WEIGHTS = np.array([.4, .3, .3])


def compare(candidates):
    """Mutate candidates with transparent scores and deterministic sensitivity."""
    demand = [c['estimated_age_residents'] for c in candidates if c['estimated_age_residents'] is not None]
    maximum = max(demand, default=0)
    for c in candidates:
        age = c['estimated_age_residents']
        values = [max(0, 1-c['straight_distance_m']/1500),
                  min(1, c['nearest_park_straight_m']/1000),
                  None if age is None else float(np.log1p(age)/np.log1p(maximum)) if maximum else 0.]
        c['rank_features'] = dict(zip(FEATURES, values))
        c['default_contributions'] = dict(zip(FEATURES, [None if v is None else float(v*w) for v,w in zip(values, DEFAULT_WEIGHTS)]))
        c['default_score'] = None if age is None else sum(c['default_contributions'].values())
        c.update(pareto_efficient=None, top5_weight_share=None, best_weight_rank=None, worst_weight_rank=None)
    complete = sorted([c for c in candidates if c['default_score'] is not None], key=lambda c:c['grid_id'])
    if complete:
        x = np.array([list(c['rank_features'].values()) for c in complete])
        # Same preference grid for every school: 66 triples in 10 percentage-point steps.
        weights = np.array([[a/10, b/10, (10-a-b)/10] for a in range(11) for b in range(11-a)])
        scores = x @ weights.T
        # Competition ranks preserve ties; tied fifth places all count as top five.
        ranks = np.empty(scores.shape, dtype=int)
        for j in range(scores.shape[1]):
            ranks[:,j] = np.searchsorted(np.sort(-scores[:,j]), -scores[:,j], side='left') + 1
        for i,c in enumerate(complete):
            dominated = np.all(x >= x[i], axis=1) & np.any(x > x[i], axis=1)
            c.update(pareto_efficient=not bool(dominated.any()),
                     top5_weight_share=float(np.mean(ranks[i] <= 5)),
                     best_weight_rank=int(ranks[i].min()), worst_weight_rank=int(ranks[i].max()))
    candidates.sort(key=lambda c:(c['default_score'] is None, -(c['default_score'] or 0), c['grid_id']))
    return {'candidate_count':len(candidates), 'complete_comparison_count':len(complete),
            'missing_age_count':len(candidates)-len(complete), 'weight_scenarios':66,
            'default_weights':dict(zip(FEATURES, DEFAULT_WEIGHTS.tolist())),
            'demand_normalizer_log1p_max':maximum,
            'scope':'기존 후보지 전체 중 학교 중심에서 직선 1.5km. 신규 부지 발굴·토지 적합성 검증 아님.',
            'explanation':'거리=1-거리/1500, 공원부족=min(최근접 공원거리/1000,1), 연령수요=log1p(추정인구)/log1p(학교 주변 후보 최대인구). 점수는 가중 기여도의 합.',
            'sensitivity':'세 지표가 확보된 후보끼리 10% 간격 가중치 66조합을 비교. 공동 순위 포함 상위5 진입 비율이며 선정 확률·모형 정확도 아님.'}


def enrich(rows):
    grid = gpd.read_file(DATA/'candidate_grid_final.geojson').to_crs(5179)
    grid.geometry = grid.geometry.centroid
    park_rows = pd.read_csv(DATA/'parks_with_function_class.csv')
    park_rows = park_rows[park_rows['시설유형'] != '놀이터'].dropna(subset=['경도','위도'])
    parks = gpd.GeoDataFrame(park_rows,geometry=gpd.points_from_xy(park_rows['경도'],park_rows['위도']),crs=4326).to_crs(5179)
    demand = json.loads((EDU/'candidate_age_demand.json').read_text(encoding='utf-8'))['candidates']
    # Reuse geometry-only park distances across schools; ignore inherited elementary scores.
    park_distance = {i:float(parks.geometry.distance(r.geometry).min()) for i,r in grid.iterrows()}
    wgs = grid.to_crs(4326)
    for row in rows:
        origin = gpd.GeoSeries([Point(row['경도'], row['위도'])],crs=4326).to_crs(5179).iloc[0]
        distances = grid.geometry.distance(origin)
        candidates = []
        for i in distances[distances <= 1500].index:
            ident = str(grid.loc[i,'grid_id'])
            age = demand.get(ident,{}).get('straight_500m',{}).get('levels',{}).get(row['학교급구분'],{}).get('estimated_residents')
            candidates.append({'grid_id':ident, 'lat':float(wgs.loc[i].geometry.y), 'lng':float(wgs.loc[i].geometry.x),
                               'straight_distance_m':round(float(distances[i]),2), 'nearest_park_straight_m':round(park_distance[i],2),
                               'estimated_age_residents':age, 'age_specific_beneficiaries':None, 'land_feasibility_level':None,
                               'selection_basis':'기존 후보지 중 직선 1.5km 전체; 학교급 연령 수요·공원 부족·거리 비교'})
        row['candidate_comparison'] = compare(candidates)
        row['candidates'] = candidates
    return rows


def main():
    path = EDU/'school_analysis.json'
    rows = enrich(json.loads(path.read_text(encoding='utf-8')))
    path.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    sources = [DATA/'candidate_grid_final.geojson', DATA/'parks_with_function_class.csv', EDU/'candidate_age_demand.json', EDU/'institutions.csv']
    manifest = {'schools':len(rows), 'candidate_pairs':sum(len(r['candidates']) for r in rows),
                'schools_without_candidates':sum(not r['candidates'] for r in rows),
                'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}}
    (EDU/'candidate_comparison_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False))


if __name__ == '__main__':
    main()
