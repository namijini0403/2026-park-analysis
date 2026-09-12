"""Fetch the portal's public download API; keep Incheon, newest observed year.
Polygon CRS is not declared in the download. Preserve official lat/lng points;
do not guess a CRS or fabricate area boundaries.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data_processed/context/accidents_incheon.json'
base = 'https://www.data.go.kr'
source = base + '/data/15029185/standard.do'
s = requests.Session()
h = s.get(base+'/download/columList.json', params={'pk':'15029185','ext':'JSON'}, timeout=30)
h.raise_for_status()
header = h.json()
rows = []
hashes = []
for page in range(1, (int(header['totalCount']) + 9999)//10000 + 1):
    r = s.get(base+'/download/standard.json', params=dict(publicDataPk='15029185', colNmList=header['tableVO']['colNmList'], totalCount=header['totalCount'], svcTableNm=header['tableVO']['svcTableNm'], perPage=10000, page=page), timeout=60)
    r.raise_for_status()
    hashes.append(hashlib.sha256(r.content).hexdigest())
    rows.extend(r.json())
assert len(rows) == int(header['totalCount']), 'Incomplete download'
local = [r for r in rows if '인천' in r['CTPRVN_SIGNGU_NM']]
year = max(int(r['ACDNT_YEAR']) for r in local)
latest = [r for r in local if int(r['ACDNT_YEAR']) == year]
# Management numbers identify a publication batch, not a unique location.
def identity(r):
    return '-'.join(r[k] for k in ['ACDNT_AREA_MANAGE_NO', 'ACDNT_YEAR', 'ACDNT_TYPE_SE', 'LC_CODE'])
assert latest and len({identity(r) for r in latest}) == len(latest)
result = [dict(id=identity(r), name=r['ACDNT_AREA_LC_NM'], lat=float(r['LATITUDE']), lng=float(r['LONGITUDE']), facts=[str(year)+'년 · '+r['ACDNT_TYPE_SE'], '사고 '+r['OCCRRNC_CO']+'건 · 사상자 '+r['CASLT_CO']+'명', '자료 기준 '+r['REFERENCE_DATE'], '공식 중심 좌표 · 구역 경계 미표시'], source_url=source) for r in latest]
assert all(37 < r['lat'] < 38.5 and 124 < r['lng'] < 127 for r in result)
OUT.write_text(json.dumps(dict(rows=result, note=f'{year}년 인천 사고다발지역의 공식 중심 위치입니다. 현재 위험도나 개별 학교의 안전 판정이 아닙니다. 표시 밖도 안전하다는 뜻은 아닙니다. 원자료 경계의 좌표계 미명시로 면 대신 중심점을 표시합니다.', source_url=source, retrieved_at=datetime.now(timezone.utc).isoformat(), nationwide_rows=len(rows), incheon_all_year_rows=len(local), year=year, download_sha256=hashes, original_records=latest), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Fetched {len(rows)} records; Incheon {year}: {len(result)} sites')
