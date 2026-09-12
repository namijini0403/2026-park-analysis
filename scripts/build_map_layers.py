"""Rebuild compact, source-traceable map layers. No policy scores or access claims."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data_processed'
OUT = DATA / 'map_layers'
OUT.mkdir(exist_ok=True)
sources = {}
layers = []


def read(file):
    p = DATA / file
    sources[file] = hashlib.sha256(p.read_bytes()).hexdigest()
    return list(csv.DictReader(p.open(encoding='utf-8-sig'))) if file.endswith('.csv') else json.loads(p.read_text(encoding='utf-8-sig'))


def number(v):
    try:
        return float(v) if v not in (None, '') else None
    except (ValueError, TypeError):
        return None


def item(name, lat, lng, facts, url=None, **extra):
    return dict(name=name, lat=number(lat), lng=number(lng), facts=[str(x) for x in facts if x not in (None, '')], source_url=url, **extra)


PUBLIC_SOURCES = {"parks": ["https://www.data.go.kr/data/15012890/standard.do", "전국도시공원정보표준데이터 · 공공데이터포털"], "playgrounds": ["https://www.openstreetmap.org/copyright", "OpenStreetMap 놀이터 지물 · 기여자 라이선스"], "libraries": ["https://www.data.go.kr/data/15013109/standard.do", "전국도서관표준데이터 · 공공데이터포털"], "youth": ["https://www.ice.go.kr/ice/ad/func/spnt/spntList.do?mi=10916", "인천광역시교육청 초등돌봄·방과후 시설 안내"], "care": ["https://www.ice.go.kr/ice/ad/func/spnt/spntList.do?mi=10916", "인천광역시교육청 초등돌봄·방과후 시설 안내"], "sports": ["https://www.ice.go.kr/ice/ad/func/spnt/spntList.do?mi=10916", "인천광역시교육청 공공 체육시설 안내"], "academies": ["https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11841&nttSn=3381948", "인천광역시교육청 학원·교습소 등록 현황"], "clusters": ["https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11841&nttSn=3381948", "인천광역시교육청 학원·교습소 등록 현황"], "apartments": ["https://www.data.go.kr/data/15048743/fileData.do", "인천광역시_공동주택내 체육시설 정보제공 · 공공데이터포털"], "redevelopment": ["https://www.data.go.kr/data/15055212/fileData.do", "인천광역시_도시 및 주거환경 정비사업 추진현황 · 공공데이터포털"], "construction": ["https://www.data.go.kr/data/15029299/fileData.do", "착공 신고 현황(연수·미추홀·계양구) · 공공데이터포털"], "accidents": ["https://www.data.go.kr/data/15029185/standard.do", "교통사고다발지역표준데이터 · 공공데이터포털"]}


def emit(id, label, group, color, rows, note):
    valid = [r for r in rows if r['lat'] is not None and r['lng'] is not None and 33 < r['lat'] < 39 and 124 < r['lng'] < 132]
    for i, r in enumerate(valid):
        r.setdefault('id', f'{id}-{i}')
    (OUT / f'{id}.json').write_text(json.dumps(valid, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    url, title = PUBLIC_SOURCES[id]
    layers.append(dict(id=id, label=label, group=group, color=color, count=len(valid), missing_coordinates=len(rows)-len(valid), note=note, source_url=url, source_title=title, **({'source_url_extra': 'https://www.data.go.kr/data/15072776/fileData.do'} if id == 'redevelopment' else {})))


emit('parks', '공원', 'nature', '#278154', [item(r['공원명'], r['위도'], r['경도'], [r.get('공원구분'), '면적 '+r.get('공원면적', '')+'㎡', r.get('gu')]) for r in read('parks.csv')], '보유 공원 위치 자료입니다. 전체 녹지·산림 지도가 아니며 출입구와 이용 조건은 별도 확인합니다. 원천: 전국도시공원정보표준데이터(기준일은 원문 확인).')
emit('playgrounds', '놀이터', 'nature', '#84922d', [item(r['시설명'], r['위도'], r['경도'], [r.get('주소'), r.get('시설유형')]) for r in read('geocoded_playground.csv')], '보유 놀이터 위치 자료 · 주소 기반 좌표가 포함됩니다. 개방 여부·기준일 별도 확인.')
emit('libraries', '도서관', 'learning', '#416eaf', [item(r['도서관명'], r['위도'], r['경도'], [r.get('유형'), '자료 기준 '+r.get('기준일', '미확보'), '평일 '+r.get('평일운영', '미확보'), '휴관 '+r.get('휴관일', '미확보')]) for r in read('libraries.csv')], '공공·작은도서관 보유 자료. 운영 시간과 이용 자격은 방문 전에 확인합니다.')
services = read('student_services/facilities.json')['facilities']
for id, label, group, color, predicate in [
    ('youth', '청소년 방과후시설', 'learning', '#97619e', lambda r: r.get('subtype') == '청소년방과후아카데미'),
    ('care', '아동 돌봄·복지', 'learning', '#bb688c', lambda r: r['kind'] == 'welfare' and r.get('subtype') != '청소년방과후아카데미'),
    ('sports', '공공 야외체육', 'nature', '#35948c', lambda r: r['kind'] == 'sports')]:
    emit(id, label, group, color, [item(r['name'], r.get('latitude'), r.get('longitude'), [r.get('subtype'), r.get('address'), r.get('eligibility_note'), '기준일 '+str(r.get('evidence_date') or '미확보')], r.get('source_url'), id=r['id']) for r in services if predicate(r)], '보유 목록만 표시합니다. 청소년 시설은 방과후아카데미이며 청소년 복지시설 전수 목록이 아닙니다. 대상·정원·개방 조건 별도 확인.' if id == 'youth' else '보유 기관 목록이며 전체 공급이나 즉시 이용 가능성을 뜻하지 않습니다. 대상·정원·운영 조건을 확인하세요.')
academies = read('education/academies_map.json')
emit('academies', '학원·교습소', 'learning', '#387f9c', [item(r['name'], r['lat'], r['lng'], [r['facility_type'], r['address'], '자료 기준 '+r['reference_date']], r['source_url'], id=r['facility_id']) for r in academies], '공개 등록 위치입니다. 교육 품질·참여율·실제 통학 접근성을 뜻하지 않습니다.')
clusters = read('education/academy_clusters.json')
scenario = next(s for s in clusters['scenarios'] if s['radius_m'] == 300 and s['minimum_facilities'] == 10)
emit('clusters', '학원가 · 밀집 구역', 'learning', '#6c69af', [item('학원 밀집 구역 · '+str(r['facilities'])+'곳', r['lat'], r['lng'], ['등록 시설 '+str(r['facilities'])+'곳 · 좌표 지점 '+str(r['unique_coordinate_sites'])+'곳', '탐색 조건: 연결 300m · 최소 10곳', '자료 기준 '+clusters['reference_date']], clusters.get('data_source') if isinstance(clusters.get('data_source'), str) else None, id=r['id'], geometry=r['geometry'], members=r['members']) for r in scenario['clusters']], '300m·10곳은 탐색 조건이며 공인 학원가 기준이 아닙니다. 경계는 시설 주변 100m 범위의 합집합입니다. 구역을 누르면 소속 학원을 확인합니다.')
emit('apartments', '대단지 아파트', 'housing', '#a0783d', [item(r['단지명'], r['위도'], r['경도'], [r['세대수']+'세대', r['도로명주소'], '2025년 자료']) for r in read('large_apt_complexes_2025.csv') if (number(r['세대수']) or 0) >= 500], '500세대 이상 보유 단지의 대표 위치 · 2025년 자료. 실제 단지 경계나 향후 학생 수가 아닙니다.')
emit('redevelopment', '재개발·재건축', 'housing', '#b37b59', [item(r['구역명'], r['위도'], r['경도'], [r['사업유형'], r['진행단계'], r['위치'], '출처 '+r['출처']]) for r in read('redevelopment_geocoded.csv')], '정비사업 대표 위치입니다. 진행 단계는 보유 자료 기준이며 현재 착공·준공·입주를 뜻하지 않습니다. 기준일 미확보.')
construction = read('context/facilities_construction.geojson')['features']
emit('construction', '공사 · 착공 행정기록', 'housing', '#b56438', [item(f['properties']['name'], (f.get('geometry') or {}).get('coordinates', [None, None])[1], (f.get('geometry') or {}).get('coordinates', [None, None])[0], [f['properties'].get('address'), '착공 '+str(f['properties'].get('start_date') or '미확보'), '자료 기준 '+str(f['properties'].get('source_as_of') or '미확보'), '현재 공사 중 여부 미확인'], f['properties'].get('source_url')) for f in construction], '계양구·미추홀구·연수구 일부 자료. 착공 행정기록이며 현재 공사 중·통학로 위험을 확정하지 않습니다.')
accidents = read('context/accidents_incheon.json')
emit('accidents', '사고다발구역', 'safety', '#b4494e', accidents['rows'], accidents['note'])
(OUT / 'manifest.json').write_text(json.dumps(dict(schema_version=1, layers=layers, source_hashes=sources), ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({l['id']: l['count'] for l in layers}))
