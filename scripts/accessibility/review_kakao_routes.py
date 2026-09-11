"""Compare legacy corrections with official routing without erasing reviewed values."""
import argparse
import ast
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from scripts.accessibility.kakao_walk import KakaoWalkClient

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data_processed/education/route_review.json'


def review_status(reference, automatic):
    if automatic is None:
        return ['provider_route_unavailable']
    flags = []
    if abs(reference - automatic) > max(50, reference * .2):
        flags.append('distance_disagreement')
    if (reference <= 500) != (automatic <= 500):
        flags.append('500m_classification_disagreement')
    if 450 <= automatic <= 550:
        flags.append('near_500m_boundary')
    return flags


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--max-calls', type=int, default=0)
    args = parser.parse_args()
    tree = ast.parse((ROOT/'scripts/accessibility/update_manual_verified_nearest_parks.py').read_text(encoding='utf-8-sig'))
    updates = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == 'UPDATES' for t in n.targets))
    def csv_rows(name):
        return list(csv.DictReader((ROOT/'data_processed'/name).open(encoding='utf-8-sig')))
    schools = {r['학교명']: r for r in csv_rows('schools.csv')}
    parks = csv_rows('parks_with_function_class.csv')
    previous = json.loads(OUT.read_text(encoding='utf-8'))['schools'] if OUT.exists() else {}
    client = KakaoWalkClient(args.max_calls)
    rows = {}
    for name, (park_name, reference) in updates.items():
        school = schools.get(name)
        if not school:
            continue
        sid = school['학교ID']
        matches = [p for p in parks if p['공원명'] == park_name and p.get('경도') and p.get('위도')]
        row = {'school_id': sid, 'school_name': name, 'park_name': park_name,
               'reviewed_distance_m': reference, 'reviewed_source': 'legacy_manual_updates',
               'reviewed_date': None, 'review_method': 'original_evidence_not_attached',
               'review_status': 'needs_endpoint_verification',
               'adopted_distance_m': reference, 'adopted_basis': 'legacy_review_preserved'}
        if len(matches) == 1:
            park = matches[0]
            start = (float(school['경도']), float(school['위도']))
            end = (float(park['경도']), float(park['위도']))
            signature = hashlib.sha256(json.dumps([start, end, 'SHORTEST']).encode()).hexdigest()
            prior = previous.get(sid, {})
            route = prior.get('automatic', {}) if prior.get('request_hash') == signature else {}
            if route.get('status') != 'available':
                route = client.route(start, end)
            row.update(origin=list(start), destination=list(end), request_hash=signature, automatic=route)
            value = route.get('distance_m')
            row['difference_m'] = round(value-reference, 1) if value is not None else None
            row['flags'] = review_status(reference, value)
            # Agreement at representative points is not evidence that the entrance was verified.
            row['flags'].append('school_and_park_entrances_unverified')
        else:
            row.update(automatic={'status': 'park_identity_unresolved', 'distance_m': None},
                       flags=['park_identity_unresolved'], park_matches=len(matches))
        rows[sid] = row
        OUT.write_text(json.dumps({'schools': rows, 'generated_at': datetime.now(timezone.utc).isoformat(),
                                  'method': 'Kakao SHORTEST at school/park representative coordinates; legacy correction retained',
                                  'thresholds_provisional': {'absolute_difference_m': 50, 'relative_difference': .2, 'boundary_m': [450, 550]},
                                  'summary': dict(Counter(r['automatic']['status'] for r in rows.values()))},
                                 ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print(json.dumps({'schools': len(rows), 'calls': client.calls,
                      'statuses': dict(Counter(r['automatic']['status'] for r in rows.values()))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
