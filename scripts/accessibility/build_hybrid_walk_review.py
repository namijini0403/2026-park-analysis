"""Bounded Kakao sampling + exact-edge OSM walksheds + evidence-gated entrances.

No result replaces the legacy policy distance. Run from repository root.
"""
import argparse
import csv
import hashlib
import json
import math
from datetime import date, datetime, timezone
from pathlib import Path

from scripts.accessibility.kakao_walk import KakaoWalkClient

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed/education'
REGISTER = ROOT / 'data_quality/walk_entrance_reviews.json'


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temp.replace(path)


def verified_endpoint(record):
    """A nearby map point alone cannot become a verified entrance."""
    if not isinstance(record, dict) or record.get('status') != 'verified':
        return False
    try:
        lon, lat = record['coordinates']
        checked = date.fromisoformat(record['checked_on'])
        return (all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in (lon, lat))
                and 124 <= lon <= 132 and 33 <= lat <= 39
                and checked <= date.today() and (date.today()-checked).days <= 365
                and record.get('pedestrian_access') == 'open'
                and record.get('entity_identity_confirmed') is True
                and record.get('evidence_kind') in ('official', 'field', 'streetview')
                and bool(str(record.get('evidence', '')).strip())
                and bool(str(record.get('reviewer', '')).strip()))
    except (KeyError, ValueError, TypeError):
        return False


def priority(row):
    flags = row.get('flags', [])
    return (0 if '500m_classification_disagreement' in flags else
            1 if 'near_500m_boundary' in flags else
            2 if 'distance_disagreement' in flags else 3, row['school_id'])


def request_hash(start, end):
    return hashlib.sha256(json.dumps([list(start), list(end), 'SHORTEST']).encode()).hexdigest()


def compare(osm, kakao):
    if osm is None or kakao is None:
        return 'unavailable'
    return '500m_disagreement' if (osm <= 500) != (kakao <= 500) else '500m_agreement'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--graph', type=Path, default=ROOT.parent/'_cache/incheon_walk_graph_v3.graphml')
    parser.add_argument('--pilot-schools', type=int, default=9)
    parser.add_argument('--samples-per-school', type=int, default=2)
    parser.add_argument('--max-calls', type=int, default=0, help='0 reuses cache only')
    parser.add_argument('--reviews', type=Path, default=REGISTER)
    args = parser.parse_args()
    if min(args.pilot_schools, args.samples_per_school, args.max_calls) < 0:
        parser.error('Budgets must be nonnegative')
    import networkx as nx
    import osmnx as ox
    from pyproj import Transformer
    from shapely.geometry import Point, mapping
    from shapely.ops import transform
    from shapely.strtree import STRtree
    from scripts.accessibility import build_walkshed_500m_v3 as v3

    source = json.loads((DATA/'route_review.json').read_text(encoding='utf-8'))
    reviews = json.loads(args.reviews.read_text(encoding='utf-8')) if args.reviews.exists() else {'schools': {}}
    previous_path = DATA/'hybrid_walk_review.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {}
    cache = dict(previous.get('route_cache', {}))
    for row in source['schools'].values():
        if row.get('automatic', {}).get('status') == 'available' and row.get('request_hash'):
            cache[row['request_hash']] = row['automatic']
    schools = {r['학교ID']: r for r in csv.DictReader((ROOT/'data_processed/schools.csv').open(encoding='utf-8-sig'))}
    rows = sorted(source['schools'].values(), key=priority)
    pilot = {r['school_id'] for r in rows[:args.pilot_schools]}
    forward = Transformer.from_crs(4326, 5179, always_xy=True).transform
    backward = Transformer.from_crs(5179, 4326, always_xy=True).transform
    print('Loading one shared OSM graph', flush=True)
    graph = ox.convert.to_undirected(ox.project_graph(ox.load_graphml(args.graph), to_crs=5179))
    # Keep small components: isolated school paths are a review signal, not silently discarded.
    for u, v, k, edge in graph.edges(keys=True, data=True):
        edge['length'] = v3.edge_linestring(graph, u, v, edge).length
    edges = ox.graph_to_gdfs(graph, nodes=False)
    edge_tree = STRtree(list(edges.geometry))
    edge_ids = list(edges.index)
    v3.BUFFER_M, v3.HOLE_FILL_M2, v3.SIMPLIFY_M = 10., 0., 0.
    client = KakaoWalkClient(args.max_calls)
    output, polygons = {}, []

    def route(start, end):
        signature = request_hash(start, end)
        if signature not in cache:
            result = client.route(start, end)
            if result.get('status') == 'available':
                result['queried_at'] = datetime.now(timezone.utc).isoformat()
                cache[signature] = result
            return signature, result
        return signature, cache[signature]

    for row in rows:
        sid = row['school_id']
        register = reviews.get('schools', {}).get(sid, {})
        confirmed = {kind: verified_endpoint(register.get(kind)) for kind in ('school', 'park')}
        school = schools[sid]
        origin = register['school']['coordinates'] if confirmed['school'] else [float(school['경도']), float(school['위도'])]
        destination = register['park']['coordinates'] if confirmed['park'] else row.get('destination')
        pt = Point(*forward(*origin))
        targets = []
        if destination:
            targets.append(('park', Point(*forward(*destination)), destination))
        if sid in pilot:
            for radius in (200, 400):
                for j in range(8):
                    p = Point(pt.x+radius*math.cos(j*math.pi/4), pt.y+radius*math.sin(j*math.pi/4))
                    targets.append((f'sample-{radius}-{j}', p, list(backward(p.x, p.y))))
        points = [pt] + [t[1] for t in targets]
        # Reuse one spatial index; OSMnx nearest_edges rebuilds it for every call.
        nearest = [edge_ids[int(i)] for i in edge_tree.nearest(points)]

        def snap(point, edge):
            u, v, k = edge
            line = v3.edge_linestring(graph, u, v, graph.get_edge_data(u, v, k))
            position = line.project(point)
            return u, v, line, position, point.distance(line)

        u, v, line, pos, offset = snap(pt, nearest[0])
        origin_valid = offset <= 50
        distances = {}
        if origin_valid:
            graph.add_node('__hybrid_origin__')
            graph.add_edge('__hybrid_origin__', u, length=offset+pos)
            graph.add_edge('__hybrid_origin__', v, length=offset+line.length-pos)
            try:
                distances = nx.single_source_dijkstra_path_length(graph, '__hybrid_origin__', cutoff=15000, weight='length')
            finally:
                graph.remove_node('__hybrid_origin__')
            polygon, stats = v3.build_walkshed(graph, edges, pt, nearest[0])
            if stats['method'] != 'circle_fallback':
                polygons.append({'type': 'Feature', 'properties': {'school_id': sid, **stats},
                                 'geometry': mapping(transform(backward, polygon))})
        else:
            stats = {'method': 'origin_snap_exceeds_50m', 'offset_m': round(offset, 1)}
        comparisons = []
        for i, (kind, target, ll) in enumerate(targets):
            tu, tv, tl, tp, to = snap(target, nearest[i+1])
            cost = min(distances.get(tu, math.inf)+tp+to, distances.get(tv, math.inf)+tl.length-tp+to)
            if tuple(nearest[i+1]) == tuple(nearest[0]) and origin_valid:
                cost = min(cost, offset+abs(pos-tp)+to)
            distance = round(cost, 1) if origin_valid and to <= 50 and math.isfinite(cost) and cost <= 15000 else None
            comparisons.append({'kind': kind, 'coordinates': list(ll), 'osm_distance_m': distance,
                                'destination_snap_m': round(to, 1), 'kakao_distance_m': None,
                                'status': 'not_queried', 'comparison': 'unavailable'})
        # Park comparisons reuse prior queries; changed verified endpoints consume the same budget.
        chosen = [r for r in comparisons if r['kind'] == 'park']
        chosen += sorted((r for r in comparisons if r['kind'] != 'park' and r['osm_distance_m'] is not None),
                         key=lambda r: (abs(r['osm_distance_m']-500), r['kind']))[:args.samples_per_school]
        for item in chosen:
            signature, response = route(origin, item['coordinates'])
            item.update(request_hash=signature, status=response['status'], kakao_distance_m=response.get('distance_m'),
                        comparison=compare(item['osm_distance_m'], response.get('distance_m')))
        output[sid] = {'school_id': sid, 'school_name': row['school_name'], 'park_name': row['park_name'],
                       'priority': priority(row)[0], 'pilot': sid in pilot,
                       'legacy_distance_m': row['reviewed_distance_m'], 'adopted_basis': 'legacy_review_preserved',
                       'origin': list(origin), 'destination': destination, 'osm': stats,
                       'entrances_verified': confirmed,
                       'review_status': 'route_review_required' if all(confirmed.values()) else 'entrance_evidence_required',
                       'endpoints': {kind: register.get(kind, {'status': 'pending'}) for kind in confirmed},
                       'comparisons': comparisons,
                       'flags': row['flags'] + ([] if origin_valid else ['origin_snap_exceeds_50m'])}
        # Checkpoint paid query successes so an interrupted batch resumes without duplicate calls.
        dump(previous_path, {'schools': {**previous.get('schools', {}), **output}, 'route_cache': cache})
        print(f'{len(output)}/{len(rows)} {sid}: {stats["method"]}, API calls={client.calls}', flush=True)
    result = {'version': 'hybrid_walk_v1', 'generated_at': datetime.now(timezone.utc).isoformat(),
              'graph_sha256': hashlib.sha256(args.graph.read_bytes()).hexdigest(),
              'policy': {'distance_m': 500, 'max_snap_m': 50, 'display_buffer_m': 10,
                         'hole_fill_m2': 0, 'auto_replace_manual': False,
                         'limitations': 'OSM 선형 도달구간의 10m 시각화 버퍼이며 필지 접근·안전·개방을 보증하지 않음. 카카오는 조회한 표본점만 판정. 양끝 직선 연결은 통행 가능성이 미검증됨.'},
              'summary': {'schools': len(output), 'pilot_schools': len(pilot), 'api_calls_this_run': client.calls,
                          'walkshed_features': len(polygons),
                          'verified_endpoint_pairs': sum(all(r['entrances_verified'].values()) for r in output.values()),
                          'sample_queries_available': sum(c['kind'] != 'park' and c['status'] == 'available' for r in output.values() for c in r['comparisons'])},
              'schools': output, 'route_cache': cache}
    dump(previous_path, result)
    dump(DATA/'hybrid_walkshed_500m.geojson', {'type': 'FeatureCollection', 'features': polygons})
    print(json.dumps(result['summary']), flush=True)


if __name__ == '__main__':
    main()
