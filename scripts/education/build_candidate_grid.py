"""250m survey cells intersecting observed walksheds of all extended school levels.

Cells are analysis units, not verified available parcels. Metric coordinates and
coordinate-derived IDs make the grid independent of school ordering or extent.
"""
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'data_processed/education'
STEP = 250


def build(walks):
    walks = walks.to_crs(5179)
    cells = {}
    for row in walks.itertuples():
        geometry = row.geometry
        minx,miny,maxx,maxy = geometry.bounds
        for x in range(math.floor(minx/STEP),math.floor(maxx/STEP)+1):
            for y in range(math.floor(miny/STEP),math.floor(maxy/STEP)+1):
                cell = box(x*STEP,y*STEP,(x+1)*STEP,(y+1)*STEP)
                if geometry.intersection(cell).area <= .01:
                    continue
                ident = f'E250_{x}_{y}'
                record = cells.setdefault(ident,{'grid_id':ident,'geometry':cell,'linked_school_ids':[]})
                record['linked_school_ids'].append(row.학교ID)
    for record in cells.values():
        record['linked_school_ids'] = sorted(set(record['linked_school_ids']))
        record['survey_basis'] = '학교급 확장 기관의 500m 보행 도달권과 면적 교차'
        record['area_m2'] = STEP**2
        record['land_feasibility_level'] = None
    return gpd.GeoDataFrame([cells[k] for k in sorted(cells)],crs=5179)


def main():
    source = DATA/'walkshed_500m.geojson'
    walks = gpd.read_file(source)
    cells = build(walks)
    (DATA/'candidate_grid.geojson').write_text(cells.to_crs(4326).to_json(drop_id=True,ensure_ascii=False),encoding='utf-8')
    linked = {sid for ids in cells.linked_school_ids for sid in ids}
    manifest = {'grid_count':len(cells),'linked_schools':len(linked),'walkshed_schools':len(walks),
                'grid_crs':'EPSG:5179','step_m':STEP,'id_basis':'E250_floor(easting/250)_floor(northing/250)',
                'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                'scope':'유치원·중·고등학교 전체 도달권의 250m 탐색 단위. Case 4도 정책 시나리오 비교를 위해 포함.',
                'limitations':'필지 경계·수면·소유·규제·개발가능성 검증 전 탐색 격자. 격자 전체가 보행 가능하거나 공급 가능한 부지라는 의미가 아님.'}
    (DATA/'candidate_grid_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False))


if __name__=='__main__':
    main()
