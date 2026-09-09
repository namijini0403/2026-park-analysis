"""Link current schools to historical population regions using public addresses.

Keep displayed administrative districts unchanged. Never treat a split district's
parent total as the new district's own population.
"""
import hashlib
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed/education'
SOURCE = ROOT / 'data/education_sources/유치원 일반 현황_20251_인천광역시.csv'
REGIONS = {'중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'}
NOTE = '2025년 행정구역 기준 지역 전체 통계입니다. 개편 후 구의 인구나 학교 학생 수가 아닙니다.'


def address_parts(value):
    parts = str(value or '').split('(')[0].split()
    return (parts[1], ' '.join(parts[2:])) if len(parts) >= 3 and parts[0] == '인천광역시' else (None, None)


def distance(row, old):
    try:
        lat, lon, oldlat, oldlon = map(float, (row['위도'], row['경도'], old['위도'], old['경도']))
    except (KeyError, TypeError, ValueError):
        return math.inf
    p, q = map(math.radians, (lat, oldlat))
    h = math.sin((q-p)/2)**2 + math.cos(p)*math.cos(q)*math.sin(math.radians(oldlon-lon)/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h))) if math.isfinite(h) else math.inf


def resolve(row, historical):
    if row.get('gu') in REGIONS:
        return {'region_name': row['gu'], 'basis': 'registry_historical_district', 'note': NOTE}
    _, street = address_parts(row.get('소재지도로명주소'))
    matches = [r for r in historical if r.get('유치원명') == row['학교명']
               and address_parts(r.get('주소'))[0] in REGIONS
               and street and address_parts(r.get('주소'))[1] == street
               and distance(row, r) <= 200] if row.get('학교급구분') == '유치원' else []
    if len(matches) != 1:
        return {'region_name': None, 'basis': 'unverified', 'note': NOTE}
    old = matches[0]
    return {'region_name': address_parts(old['주소'])[0], 'basis': 'same_name_street_coordinates_2025_disclosure',
            'historical_address': old['주소'], 'distance_m': round(distance(row, old), 2),
            'source_file': str(SOURCE.relative_to(ROOT)), 'source_year': 2025, 'note': NOTE}


def attach(rows):
    with SOURCE.open(encoding='utf-8-sig', newline='') as source:
        historical = list(csv.DictReader(source))
    for row in rows:
        row['statistical_region_2025'] = resolve(row, historical)
    return rows


def main():
    path = DATA / 'school_analysis.json'
    rows = attach(json.loads(path.read_text(encoding='utf-8')))
    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    linked = sum(r['statistical_region_2025']['region_name'] is not None for r in rows)
    manifest = {'institutions': len(rows), 'linked': linked, 'unresolved': len(rows)-linked,
                'historical_source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'rule': 'Existing historical gu or same kindergarten name, identical road address after gu, coordinates within 200m; exactly one match.',
                'note': NOTE}
    (DATA / 'statistical_regions_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(manifest)


if __name__ == '__main__':
    main()
