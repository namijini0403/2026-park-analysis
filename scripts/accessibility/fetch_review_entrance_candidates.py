"""Fetch OSM gate/entrance candidates for pilot schools; never mark them verified."""
import json
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from scripts.accessibility.build_hybrid_walk_review import DATA, dump


def main():
    path = DATA/'hybrid_walk_review.json'
    result = json.loads(path.read_text(encoding='utf-8'))
    queries = []
    for row in result['schools'].values():
        if not row['pilot']:
            continue
        for point in (row['origin'], row['destination']):
            if point:
                lon, lat = point
                queries.extend([f'node(around:200,{lat},{lon})["entrance"];',
                                f'node(around:200,{lat},{lon})["barrier"~"^(gate|lift_gate|swing_gate)$"];'])
    query = '[out:json][timeout:45];(' + ''.join(queries) + ');out body;'
    request = Request('https://overpass-api.de/api/interpreter', data=urlencode({'data': query}).encode(),
                      headers={'User-Agent': 'EducationWalkingReview/1.0'})
    try:
        with urlopen(request, timeout=60) as response:
            body = json.load(response)
        from math import cos, radians, hypot
        nodes = body.get('elements', [])
        for row in result['schools'].values():
            candidates = {}
            for kind, point in [('school', row['origin']), ('park', row['destination'])]:
                candidates[kind] = []
                if point and row['pilot']:
                    for n in nodes:
                        distance = hypot((n['lon']-point[0])*111320*cos(radians(point[1])), (n['lat']-point[1])*111320)
                        if distance <= 200:
                            candidates[kind].append({'osm_id': n['id'], 'coordinates': [n['lon'], n['lat']],
                                                     'tags': n.get('tags', {}), 'distance_from_representative_m': round(distance, 1),
                                                     'source_url': f'https://www.openstreetmap.org/node/{n["id"]}',
                                                     'status': 'candidate_identity_and_opening_unverified'})
            row['entrance_candidates'] = candidates
        result['entrance_candidate_fetch'] = {'status': 'available', 'nodes': len(nodes),
            'queried_at': datetime.now(timezone.utc).isoformat(),
            'note': '200m 이내 OSM 태그 후보. 다른 시설의 문일 수 있으며 소속·개방·현장 확인을 대신하지 않음.'}
    except Exception as error:
        result['entrance_candidate_fetch'] = {'status': 'unavailable', 'error_type': type(error).__name__,
                                              'note': '조회 실패는 출입구 없음이 아님'}
    dump(DATA/'hybrid_entrance_candidates.json', {
        'schools': {sid: row.get('entrance_candidates', {}) for sid, row in result['schools'].items() if row['pilot']},
        'fetch': result['entrance_candidate_fetch']})
    print(json.dumps(result['entrance_candidate_fetch'], ensure_ascii=False))


if __name__ == '__main__':
    main()
