"""Precompute library distance scenarios and marginal age-population coverage."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely import intersects_xy

from scripts.education.build_candidate_age_demand import ROOT, SOURCE, BANDS, load_1km, parent_code, estimate_band

DATA = ROOT/'data_processed'
EDU = DATA/'education'
RADII = [500, 1000, 1500, 2000, 2500]


def summarize_demand(demand, indices):
    subset = demand[indices]
    missing = (~np.isfinite(subset)).sum(axis=0)
    known = np.nansum(subset, axis=0)
    return [round(float(v), 2) if m == 0 else None for v, m in zip(known, missing)], missing.tolist()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw-dir', type=Path, default=Path('C:/2026_data_analysis_park/data/raw'))
    args = parser.parse_args()
    sources = [SOURCE, DATA/'population_grid.csv', DATA/'libraries.csv', EDU/'analysis_dataset.json',
               ROOT/'data/context_sources/raw/incheon_osm_boundary.geojson']
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    pop = pd.read_csv(sources[1], dtype={'격자코드': str})
    pop['parent'] = pop['격자코드'].map(parent_code)
    pop['total'] = pd.to_numeric(pop['총인구'], errors='coerce')
    assert pop.total.notna().all() and (pop.total >= 0).all()
    bounds = load_1km(args.raw_dir).set_index('GRID_CD').geometry.bounds
    x = pop.parent.map(bounds.minx) + pop['격자코드'].str[4].astype(int)*100 + 50
    y = pop.parent.map(bounds.miny) + pop['격자코드'].str[7].astype(int)*100 + 50
    assert x.notna().all() and y.notna().all()
    coords = np.column_stack([x, y])
    denominators = pop.groupby('parent').total.sum()
    estimates = {key: [estimate_band(groups, source['city_single_ages'], *band) for band in BANDS.values()]
                 for key, groups in source['census_age_groups'].items()}
    demand = np.array([estimates.get(p, [None]*4) for p in pop.parent], dtype=float)
    weights = np.divide(pop.total.to_numpy(), pop.parent.map(denominators).to_numpy(), out=np.zeros(len(pop)), where=pop.parent.map(denominators).to_numpy()>0)
    demand *= weights[:, None]
    # Zero-population cells do not contribute invented unknown age counts.
    demand[pop.total.to_numpy()==0] = 0
    boundary = gpd.read_file(sources[4]).to_crs(5179).geometry.union_all()
    in_city = intersects_xy(boundary, coords[:, 0], coords[:, 1])
    positive = pop.total.to_numpy() > 0
    input_cells = len(coords)
    # Preserve original full-parent denominators above before clipping the output region.
    coords, demand, positive = coords[in_city], demand[in_city], positive[in_city]
    population_tree = cKDTree(coords)
    libraries = pd.read_csv(sources[2])
    valid = libraries[['위도', '경도']].notna().all(axis=1)
    libs = libraries[valid].drop_duplicates(['도서관명', '위도', '경도']).reset_index(drop=True)
    project = Transformer.from_crs(4326, 5179, always_xy=True)
    unproject = Transformer.from_crs(5179, 4326, always_xy=True)
    libcoords = np.column_stack(project.transform(libs['경도'].to_numpy(), libs['위도'].to_numpy()))
    groups = {'public_children': libs['유형'].isin(['공공', '어린이']).to_numpy(), 'including_small': np.ones(len(libs), dtype=bool)}
    trees = {key: cKDTree(libcoords[mask]) for key, mask in groups.items()}
    nearest = {key: tree.query(coords)[0] for key, tree in trees.items()}
    # Independent from park candidates: every inhabited 250m cell is a screening location.
    candidate_xy = np.unique(np.floor(coords[positive]/250)*250+125, axis=0)
    candidate_xy = candidate_xy[intersects_xy(boundary, candidate_xy[:, 0], candidate_xy[:, 1])]
    lons, lats = unproject.transform(candidate_xy[:, 0], candidate_xy[:, 1])
    candidates = [{'id': f'LIB_{int(cx-125)}_{int(cy-125)}', 'lng': round(float(lon), 7), 'lat': round(float(lat), 7)}
                  for (cx, cy), lon, lat in zip(candidate_xy, lons, lats)]
    school_data = json.loads(sources[3].read_text(encoding='utf-8'))['schools']
    schoolcoords = np.column_stack(project.transform([s['lng'] for s in school_data], [s['lat'] for s in school_data]))
    schools = []
    for i, s in enumerate(school_data):
        near_cells = np.array(population_tree.query_ball_point(schoolcoords[i], 500), dtype=int)
        school_demand, school_missing = summarize_demand(demand, near_cells)
        if len(near_cells) == 0:
            school_demand = [None]*4
        schools.append({'id': s['id'], 'name': s['name'], 'level': s['level'], 'nearest_m': {
            key: round(float(tree.query(schoolcoords[i])[0]), 1) for key, tree in trees.items()},
            'age_population_500m': school_demand, 'missing_age_cells_500m': school_missing,
            'observed_population_cells_500m': len(near_cells),
            'counts_by_radius': {key: [len(tree.query_ball_point(schoolcoords[i], radius)) for radius in RADII] for key, tree in trees.items()}})
    scenarios = []
    for radius in RADII:
        neighborhoods = population_tree.query_ball_point(candidate_xy, radius)
        for key in trees:
            unserved = nearest[key] > radius
            records = []
            for neighbors in neighborhoods:
                ix = np.array(neighbors, dtype=int)
                new_ix = ix[unserved[ix]]
                total, missing = summarize_demand(demand, ix)
                new, new_missing = summarize_demand(demand, new_ix)
                records.append(total+new+missing+new_missing)
            rankings = {}
            for level_index, level in enumerate(BANDS):
                available = [i for i, record in enumerate(records) if record[4+level_index] is not None and record[4+level_index] > 0]
                available.sort(key=lambda i: (-records[i][4+level_index], candidates[i]['id']))
                rankings[level] = available[:100]
            total, missing = summarize_demand(demand, np.flatnonzero(unserved))
            scenarios.append({'radius_m': radius, 'supply': key, 'city_uncovered_age_population': total,
                              'city_missing_age_cells': missing, 'candidate_values': records, 'top_candidate_indices': rankings})
            print(f'Library {radius}m {key}: {len(candidates)} candidates', flush=True)
    for prefix in ['나사', '다사']:
        sources.append(args.raw_dir/f'_grid_border_grid_2025_grid_{prefix}_grid_{prefix}.zip')
    result = {'schema_version': 1, 'base_year': source['year'], 'levels': list(BANDS), 'radii_m': RADII,
              'candidate_columns': [f'{metric}:{level}' for metric in ['total_age_population', 'new_age_population', 'missing_cells', 'new_missing_cells'] for level in BANDS],
              'library_counts': {key: int(mask.sum()) for key, mask in groups.items()}, 'missing_library_coordinates': int((~valid).sum()),
              'candidates': candidates, 'schools': schools, 'scenarios': scenarios,
              'population_scope': {'input_cells': input_cells, 'incheon_centroid_cells': len(coords), 'boundary_source': 'https://www.openstreetmap.org/relation/2297419', 'attribution': '© OpenStreetMap contributors, ODbL'},
              'sources': [{'title': '2024 공공도서관 건립·운영 매뉴얼, 인쇄 38쪽',
                           'url': 'https://www.gne.go.kr/component/file/ND_fileDownload.do?q_fileSn=181529718&q_fileId=e51702fc-8a23-405b-a7f0-94d56a7cceef'}],
              'source_hashes': {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
              'limitations': ['거리 시나리오는 직선거리이며 실제 보행시간·대중교통시간·교육적 영향반경이 아니다. 매뉴얼은 도시 1·2km, 농어촌 1.5·2.5km를 제시한다. 500m는 기존 앱과의 비교 조건이다.',
                              '공공·어린이 도서관을 기본 공급으로 하고 작은도서관 포함은 별도 시나리오다. 장서·좌석·운영시간·아동 이용 가능 여부의 동등성을 가정하지 않는다.',
                              '100m 격자 중심점 포함 방식이다. 경계에서 약 70.7m의 위치 근사 여지가 있으며 1km 공개 연령을 총인구 비중으로 배분한 추정이다. 기존 후보지의 면적 교차 방식과 수치가 다를 수 있다.',
                              '신규 도달 인구는 현재 동일 반경 도서관이 없는 중심점의 추정 거주인구다. 신규 이용자·순편익이 아니며 후보 간 중복되어 합산할 수 없다.',
                              '기존 보행망 구축 시 확보한 OpenStreetMap 인천 경계 안의 양의 인구가 있는 250m 격자를 후보로 삼는다. 공식 행정경계·최신 해안선을 보장하지 않는다. 건립 가능 토지·소유·규제·수면·사업비는 미확인이다. 인천 밖 도서관은 입력에 없어 경계 지역 공급을 과소평가할 수 있다.',
                              '연령 결측은 전체 수요 미산출로 유지하며, 신규 도달 영역에 결측이 없을 때만 신규 수요를 계산한다. 공개 인구에 없는 지역을 무인 지역으로 단정하지 않는다.']}
    (EDU/'library_access_scenarios.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    preview = {k: v for k, v in result.items() if k not in ['candidates', 'scenarios']}
    preview['candidate_count'] = len(candidates)
    preview['scenarios'] = [{k: v for k, v in scenario.items() if k not in ['candidate_values', 'top_candidate_indices']} | {
        'top_candidates': {level: [candidates[i] | {'values': scenario['candidate_values'][i]} for i in indices]
                           for level, indices in scenario['top_candidate_indices'].items()}}
                           for scenario in scenarios]
    (EDU/'library_access_preview.json').write_text(json.dumps(preview, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print('Library scenarios written', len(candidates), flush=True)


if __name__ == '__main__':
    main()
