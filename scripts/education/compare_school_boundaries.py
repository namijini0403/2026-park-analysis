"""Compare supplied polygons in metres. No buffers or inferred entrance routes."""
import hashlib
import json
import sys
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union


def measures(zone, walk):
    if not zone.is_valid or not walk.is_valid or zone.is_empty or walk.is_empty:
        raise ValueError('유효한 경계 도형 미확보')
    a, b = zone.area, walk.area
    if a <= 0 or b <= 0:
        raise ValueError('면적이 0인 도형')
    intersection = zone.intersection(walk).area
    union = a + b - intersection
    return dict(zone_m2=a, walk_m2=b, intersection_m2=intersection,
                mismatch=100 * (1 - intersection / union),
                zone_outside=100 * (1 - intersection / a),
                walk_outside=100 * (1 - intersection / b))


def run(payload):
    root = Path(__file__).resolve().parents[2]
    sources, collections = [], []
    for rel in ['data_processed/education/school_zones.geojson', 'data_processed/education/walkshed_500m.geojson', 'data_processed/school_walkshed_500m_v3.geojson']:
        raw = (root / rel).read_bytes()
        collections.append(json.loads(raw))
        sources.append(dict(path=rel, sha256=hashlib.sha256(raw).hexdigest()))
    projection = Transformer.from_crs('EPSG:4326', 'EPSG:5179', always_xy=True).transform
    zones, walks = {}, {}
    for f in collections[0]['features']:
        for school in f['properties'].get('schools', []):
            zones.setdefault(school['id'], []).append(f)
    for f in collections[1]['features'] + collections[2]['features']:
        walks.setdefault(f['properties'].get('학교ID'), []).append(f)
    rows = []
    for school in payload['schools']:
        z, w = zones.get(school['id'], []), walks.get(school['id'], [])
        row = dict(id=school['id'], zone_count=len(z), walk_count=len(w))
        try:
            if not z:
                raise ValueError('학교 ID에 연결된 공식 학구도 미확보')
            if len(w) != 1:
                raise ValueError('보행 500m 도달권 미확보' if not w else '보행 도달권 중복 기록')
            zshapes = [transform(projection, shape(f['geometry'])) for f in z]
            if any(not s.is_valid for s in zshapes):
                raise ValueError('공식 학구도 도형 오류')
            row.update(measures(unary_union(zshapes), transform(projection, shape(w[0]['geometry']))))
            row.update(status='computed', zone_dates=sorted(set(f['properties'].get('reference_date', '') for f in z)),
                       walk_method=w[0]['properties'].get('method', '미확인'))
        except (ValueError, TypeError, KeyError) as exc:
            row.update(status='deferred', reason=str(exc))
        rows.append(row)
    return dict(rows=rows, sources=sources, crs='EPSG:5179')


if __name__ == '__main__':
    print(json.dumps(run(json.load(sys.stdin)), ensure_ascii=False))
