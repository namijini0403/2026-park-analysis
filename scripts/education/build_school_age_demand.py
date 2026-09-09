"""Allocate observed age population to school-centered circles and v3 walksheds."""
import argparse
import hashlib
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely import box

from scripts.education.build_candidate_age_demand import ROOT, SOURCE, build, load_1km, parent_code

DATA = ROOT/'data_processed/education'
CACHE = ROOT/'data/education_sources/school_age_allocation.json'
INPUTS = [SOURCE, DATA/'school_analysis.json', DATA/'walkshed_500m.geojson', ROOT/'data_processed/population_grid.csv']


def fingerprints():
    # Analysis values may change independently; only identities/locations affect these weights.
    schools = json.loads(INPUTS[1].read_text(encoding='utf-8'))
    coordinates = sorted((r['학교ID'], r['위도'], r['경도']) for r in schools)
    return {str(p.relative_to(ROOT)): hashlib.sha256(
        json.dumps(coordinates).encode() if p==INPUTS[1] else p.read_bytes()).hexdigest() for p in INPUTS}


def spatial_weights(cells, denominators, geometry):
    near = cells.iloc[cells.sindex.query(geometry, predicate='intersects')]
    weighted = near.total * near.geometry.intersection(geometry).area / 10000
    by_parent = weighted.groupby(near.parent).sum(min_count=1)
    return {'weights': {key: float(value/denominators[key]) for key,value in by_parent.items() if denominators[key]>0},
            'observed_total_population': float(weighted.sum()), 'observed_cells': len(near)}


def extract(raw_dir):
    pop = pd.read_csv(INPUTS[3], dtype={'격자코드': str})
    pop['parent'] = pop['격자코드'].map(parent_code)
    pop['total'] = pd.to_numeric(pop['총인구'], errors='coerce')
    if pop.total.isna().any() or (pop.total<0).any():
        raise ValueError('Invalid observed 100m total population')
    bounds = load_1km(raw_dir).set_index('GRID_CD').geometry.bounds
    x = pop.parent.map(bounds.minx) + pop['격자코드'].str[4].astype(int)*100
    y = pop.parent.map(bounds.miny) + pop['격자코드'].str[7].astype(int)*100
    if x.isna().any() or y.isna().any():
        raise ValueError('Missing official parent geometry')
    cells = gpd.GeoDataFrame(pop, geometry=box(x,y,x+100,y+100), crs=5179)
    denominators = pop.groupby('parent').total.sum(min_count=1)
    schools = pd.DataFrame(json.loads(INPUTS[1].read_text(encoding='utf-8')))
    points = gpd.GeoDataFrame(schools[['학교ID']], geometry=gpd.points_from_xy(schools['경도'], schools['위도']), crs=4326).to_crs(5179)
    walks = gpd.read_file(INPUTS[2]).to_crs(5179).set_index('학교ID')
    if set(walks.index)!=set(points['학교ID']) or walks.index.duplicated().any():
        raise ValueError('Walking geometry identities do not match school registry')
    weights = {}
    for row in points.itertuples(index=False):
        sid = row.학교ID
        weights[sid] = {scope: spatial_weights(cells, denominators, geometry) for scope,geometry in
                        [('straight_500m', row.geometry.buffer(500)), ('walkshed_500m', walks.loc[sid].geometry)]}
    source = {'school_weights': weights, 'input_hashes': fingerprints(),
              'geometry_sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in
                                   [raw_dir/f'_grid_border_grid_2025_grid_{prefix}_grid_{prefix}.zip' for prefix in ['나사','다사']]}}
    CACHE.write_text(json.dumps(source, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw-dir', type=Path)
    args = parser.parse_args()
    if args.raw_dir:
        extract(args.raw_dir)
    cache = json.loads(CACHE.read_text(encoding='utf-8'))
    if cache['input_hashes'] != fingerprints():
        raise ValueError('School population inputs changed; rebuild with --raw-dir')
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    source['candidate_weights'] = cache['school_weights']
    output = build(source)
    output['schools'] = output.pop('candidates')
    output['limitations'] = [
        '2024년 공개 연령 인구의 공간 배분 추정이며 학교 재학생·원아 수나 미래 수요가 아님.',
        '직선 500m와 v3 보행 도달권 도형을 별도 집계. 도달권 안 거주가 실제 통학·공원 이용·안전 접근을 뜻하지 않음.',
        '1km 5세별 인구를 인천 1세별 비율과 100m 총인구 비중으로 배분. 해당 소지역의 실제 연령구성과 다를 수 있음.',
        '학교별 권역이 겹치므로 합산하지 않음. 미관측 연령은 0으로 대체하지 않으며 알려진 소계와 전체 추정을 구분.']
    output['input_hashes'] = cache['input_hashes']
    (DATA/'school_age_demand.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print(f"School-centered age population: {len(output['schools'])} institutions, two geometries")


if __name__ == '__main__':
    main()
