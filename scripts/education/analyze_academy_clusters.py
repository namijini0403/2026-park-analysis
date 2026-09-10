"""Observed academy concentration; exploratory boundaries, not official academy districts."""
from collections import Counter
import hashlib
import json

import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely.geometry import Point, mapping
from shapely.ops import transform, unary_union
from sklearn.cluster import DBSCAN

from scripts.education.build_candidate_age_demand import ROOT

EDU = ROOT/'data_processed/education'


def cluster_labels(coords, radius, minimum):
    if len(coords) == 0:
        return np.array([], dtype=int)
    return DBSCAN(eps=radius, min_samples=minimum, algorithm='kd_tree').fit_predict(coords)


def main():
    source = EDU/'academies_map.json'
    schools_path = EDU/'analysis_dataset.json'
    raw = json.loads(source.read_text(encoding='utf-8'))
    rows = sorted([r for r in raw if r.get('lat') is not None and r.get('lng') is not None], key=lambda r:r['facility_id'])
    assert len({r['facility_id'] for r in rows}) == len(rows)
    project = Transformer.from_crs(4326, 5179, always_xy=True)
    unproject = Transformer.from_crs(5179, 4326, always_xy=True)
    xy = np.column_stack(project.transform([r['lng'] for r in rows], [r['lat'] for r in rows]))
    assert np.isfinite(xy).all()
    scenarios = []
    for radius in [200, 300, 500]:
        for minimum in [5, 10]:
            labels = cluster_labels(xy, radius, minimum)
            clusters = []
            for label in sorted(set(labels)-{-1}):
                ix = np.flatnonzero(labels == label)
                members = [rows[i] for i in ix]
                ids = [r['facility_id'] for r in members]
                unique_sites = np.unique(xy[ix], axis=0)
                # Union of fixed 100m point buffers: visible observed footprint, not a statutory boundary.
                footprint = unary_union([Point(point).buffer(100, quad_segs=8) for point in unique_sites])
                center = footprint.centroid
                lon, lat = unproject.transform(center.x, center.y)
                clusters.append({'id': 'AC-'+hashlib.sha256('|'.join(ids).encode()).hexdigest()[:12],
                                 'facilities': len(ids), 'unique_coordinate_sites': len(unique_sites),
                                 'members': ids, 'target_categories': dict(Counter(r['target_category'] for r in members)),
                                 'arts_sports': sum(bool(r['arts_sports']) for r in members),
                                 'footprint_km2': round(footprint.area/1e6, 5),
                                 'facilities_per_footprint_km2': round(len(ids)/(footprint.area/1e6), 2),
                                 'max_distance_from_centroid_m': round(float(np.linalg.norm(xy[ix]-[center.x, center.y], axis=1).max()), 1),
                                 'lng': lon, 'lat': lat, 'geometry': mapping(transform(unproject.transform, footprint)),
                                 'example_addresses': list(dict.fromkeys(r['address'] for r in members))[:3]})
            clusters.sort(key=lambda c:(-c['facilities'], c['id']))
            scenarios.append({'radius_m': radius, 'minimum_facilities': minimum, 'cluster_count': len(clusters),
                              'clustered_facilities': int((labels >= 0).sum()), 'unclustered_facilities': int((labels < 0).sum()),
                              'clusters': clusters})
            print('Academy', radius, minimum, len(clusters), flush=True)
    schools = json.loads(schools_path.read_text(encoding='utf-8'))['schools']
    tree = cKDTree(xy)
    result_schools = []
    default = next(s for s in scenarios if s['radius_m']==300 and s['minimum_facilities']==10)
    membership = {sid:c['id'] for c in default['clusters'] for sid in c['members']}
    for school in schools:
        point = project.transform(school['lng'], school['lat'])
        indices = tree.query_ball_point(point, 500)
        counts = Counter(membership[rows[i]['facility_id']] for i in indices if rows[i]['facility_id'] in membership)
        result_schools.append({'id': school['id'], 'count_500m': len(indices), 'facilities_per_km2_500m': round(len(indices)/(np.pi*.5**2), 3),
                               'nearby_default_clusters': dict(counts),
                               'target_categories_500m': dict(Counter(rows[i]['target_category'] for i in indices)),
                               'arts_sports_500m': sum(bool(rows[i]['arts_sports']) for i in indices)})
    result = {'schema_version': 1, 'reference_date': '2026-08-01', 'raw_facilities': len(raw), 'geocoded_facilities': len(rows),
              'default_parameters': {'radius_m': 300, 'minimum_facilities': 10}, 'scenarios': scenarios, 'schools': result_schools,
              'source_hashes': {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [source, schools_path]},
              'method_source': 'https://www.cs.sfu.ca/~ester/papers/kdd_96.pdf',
              'data_source': raw[0]['source_url'],
              'limitations': ['DBSCAN은 학술적으로 제시된 밀도 기반 군집 기법이다. 학원가를 규정하는 공인 반경·최소 개수는 확보하지 못했다. 200·300·500m와 최소 5·10개는 탐색 매개변수이며 여섯 조건을 함께 공개한다.',
                              '법정 학원가·교육 품질·사교육 참여율·학업 효과가 아닌 공개 학원·교습소 등록 위치의 밀집 구역이다. 좌표 미확보 시설은 제외하며 미밀집은 학원 없음이 아니다.',
                              '같은 건물의 여러 등록 시설도 각각 센다. 동일 좌표 지점 수를 함께 제공하며 건물 수라고 단정하지 않는다. 대상 미확인은 특정 학교급으로 재분류하지 않는다.',
                              '경계는 구성 시설 주변 100m 원의 합집합이며 실제 상권 경계가 아니다. 군집 연결은 연쇄될 수 있어 전체 구역의 지름은 연결 반경보다 클 수 있다.',
                              '학교별 밀도는 학교 중심 직선 500m의 시설 수를 원면적 0.7854㎢로 나눈 값이다. 바다·인접 시 경계·도로 장벽·지가·학생 수·시설 규모를 보정하지 않았다.']}
    (EDU/'academy_clusters.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


if __name__ == '__main__':
    main()
