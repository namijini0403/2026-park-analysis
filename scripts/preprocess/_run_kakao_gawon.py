import requests, pandas as pd
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
root = Path(r'c:\2026_data_analysis_park')
# load env
api_key = None
for line in (root/'.env').read_text(encoding='utf-8', errors='ignore').splitlines():
    if line.startswith('KAKAO_REST_API_KEY='):
        api_key = line.split('=',1)[1].strip()
        break
    if line.startswith('KAKAO_REST_KEY=') and api_key is None:
        api_key = line.split('=',1)[1].strip()
if not api_key:
    raise SystemExit('KAKAO key not found')
schools = pd.read_csv(root/'data_processed'/'schools.csv', encoding='utf-8-sig')
row = schools[schools[schools.columns[1]] == '인천가원초등학교'].iloc[0]
lat = float(row[schools.columns[2]])
lon = float(row[schools.columns[3]])
print('SCHOOL')
print('학교명:', row[schools.columns[1]])
print('위도:', lat)
print('경도:', lon)
s = requests.Session()
s.trust_env = False
s.headers.update({'Authorization': f'KakaoAK {api_key}'})
url = 'https://dapi.kakao.com/v2/local/search/keyword.json'
for q in ['공원','어린이공원','놀이터']:
    print('\nQUERY:', q)
    params = {'query': q, 'x': lon, 'y': lat, 'radius': 500, 'size': 15}
    r = s.get(url, params=params, timeout=20)
    print('STATUS:', r.status_code)
    data = r.json()
    print('META:', data.get('meta'))
    docs = data.get('documents', [])
    print('COUNT:', len(docs))
    for d in docs:
        print({
            'place_name': d.get('place_name'),
            'x': d.get('x'),
            'y': d.get('y'),
            'address_name': d.get('address_name'),
            'category_name': d.get('category_name'),
        })
