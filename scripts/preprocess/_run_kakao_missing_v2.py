import time, math
from pathlib import Path
from difflib import SequenceMatcher
import pandas as pd
import requests

root = Path(r'c:\2026_data_analysis_park')
out_dir = root / 'output'
out_dir.mkdir(exist_ok=True)
missing_path = out_dir / 'kakao_missing_parks_v2.csv'
summary_path = out_dir / 'kakao_match_summary_v2.csv'

def load_env(path: Path):
    env = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env

env = load_env(root / '.env')
api_key = env.get('KAKAO_REST_API_KEY') or env.get('KAKAO_REST_KEY')
if not api_key:
    raise SystemExit('KAKAO REST key not found')

schools = pd.read_csv(root / 'data_processed' / 'schools.csv', encoding='utf-8-sig')
parks = pd.read_csv(root / 'data_processed' / 'parks.csv', encoding='utf-8-sig').copy()

sc_id, sc_name, sc_lat, sc_lon = schools.columns[0], schools.columns[1], schools.columns[2], schools.columns[3]
pk_name, pk_lat, pk_lon = parks.columns[1], parks.columns[3], parks.columns[4]
parks[pk_name] = parks[pk_name].astype(str)
parks[pk_lat] = pd.to_numeric(parks[pk_lat], errors='coerce')
parks[pk_lon] = pd.to_numeric(parks[pk_lon], errors='coerce')
parks = parks.dropna(subset=[pk_lat, pk_lon]).reset_index(drop=True)

session = requests.Session()
session.trust_env = False
session.headers.update({'Authorization': f'KakaoAK {api_key}'})
search_url = 'https://dapi.kakao.com/v2/local/search/keyword.json'
queries = ['공원', '어린이공원', '놀이터']
allowed_prefixes = [
    '여행 > 공원',
    '여행 > 공원 > 도시근린공원',
    '가정,생활 > 유아 > 놀이시설 > 놀이터',
    '가정,생활 > 유아 > 놀이시설',
]

# clean previous outputs so reruns are deterministic
if missing_path.exists():
    missing_path.unlink()
if summary_path.exists():
    summary_path.unlink()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))

def allowed_category(cat: str) -> bool:
    return any(cat.startswith(prefix) for prefix in allowed_prefixes)

all_result_rows = []
all_summary_rows = []

for idx, s in schools.iterrows():
    school_id = s[sc_id]
    school_name = s[sc_name]
    lat = float(s[sc_lat])
    lon = float(s[sc_lon])

    school_hits = []
    for q in queries:
        params = {'query': q, 'x': lon, 'y': lat, 'radius': 500, 'size': 15}
        r = session.get(search_url, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        for doc in data.get('documents', []):
            school_hits.append(doc)
        time.sleep(0.2)

    # dedupe per school by place name + coordinate
    dedup = {}
    for doc in school_hits:
        key = (doc.get('place_name', ''), doc.get('x', ''), doc.get('y', ''))
        dedup[key] = doc
    docs = list(dedup.values())

    filtered_docs = []
    for doc in docs:
        cat = str(doc.get('category_name', '')).strip()
        if allowed_category(cat):
            filtered_docs.append(doc)

    school_rows = []
    miss_count = 0
    for doc in filtered_docs:
        place_name = str(doc.get('place_name', '')).strip()
        x = float(doc.get('x'))
        y = float(doc.get('y'))
        address_name = str(doc.get('address_name', '')).strip()
        category_name = str(doc.get('category_name', '')).strip()

        match_status = '누락'
        exact = parks[parks[pk_name] == place_name]
        if len(exact):
            match_status = '일치'
        else:
            ratios = parks[pk_name].map(lambda n: SequenceMatcher(None, place_name, n).ratio())
            if len(ratios) and ratios.max() >= 0.7:
                match_status = '유사매칭'
            else:
                dists = parks.apply(lambda r: haversine(y, x, r[pk_lat], r[pk_lon]), axis=1)
                if len(dists) and dists.min() <= 50:
                    match_status = '유사매칭'
        if match_status == '누락':
            miss_count += 1
        school_rows.append({
            '학교명': school_name,
            '학교ID': school_id,
            'place_name': place_name,
            'x': x,
            'y': y,
            'address_name': address_name,
            'category_name': category_name,
            'match_status': match_status,
        })

    summary_row = {
        '학교명': school_name,
        '기존_park_count': len(parks),
        '카카오_검색수': len(filtered_docs),
        '누락_후보수': miss_count,
    }

    all_result_rows.extend(school_rows)
    all_summary_rows.append(summary_row)

    # incremental persistence after each school
    pd.DataFrame(all_result_rows).to_csv(missing_path, index=False, encoding='utf-8-sig')
    pd.DataFrame(all_summary_rows).to_csv(summary_path, index=False, encoding='utf-8-sig')

    if (idx + 1) % 50 == 0 or (idx + 1) == len(schools):
        print(f'processed {idx+1}/{len(schools)}')

res = pd.DataFrame(all_result_rows)
sumdf = pd.DataFrame(all_summary_rows)
print('DONE')
print('수집된 학교 수', sumdf['학교명'].nunique())
print('누락 후보 총 수', int((res['match_status'] == '누락').sum()))
