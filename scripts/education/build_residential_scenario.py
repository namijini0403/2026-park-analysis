"""Residential permeability sensitivity; never overwrite observed walksheds."""
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import GeometryCollection
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed'
EDU = DATA / 'education'
NOTE = 'OSM 주거 구역에서 내부 통행이 가능하다는 가정입니다. 출입 허용·보행로·500m 이동거리·안전은 미확인입니다. 현재 도달권·Case·후보 순위를 변경하지 않습니다. 주거 구역은 아파트에 한정되지 않으며 공원 경계는 공개 면적의 원형 대체값입니다.'


def added_zone(walk, circle, residential):
    gap = circle.difference(walk)
    pieces = []
    for polygon in residential:
        if polygon.area < 250 or not polygon.intersects(walk.buffer(15)):
            continue
        piece = polygon.intersection(gap)
        if piece.area >= 500:
            pieces.append(piece)
    return unary_union(pieces) if pieces else GeometryCollection()


def main():
    paths = [EDU/'walkshed_500m.geojson', EDU/'new_school_coords.csv', DATA/'incheon_residential_osm.geojson', DATA/'parks_with_function_class.csv']
    walks = gpd.read_file(paths[0]).to_crs(5179).set_index('학교ID')
    frame = pd.read_csv(paths[1])
    schools = gpd.GeoDataFrame(frame, geometry=gpd.points_from_xy(frame['경도'], frame['위도']), crs=4326).to_crs(5179)
    residential = gpd.read_file(paths[2]).to_crs(5179)
    residential.geometry = residential.geometry.make_valid()
    residential = residential[residential.geometry.notna() & ~residential.geometry.is_empty]
    parks = pd.read_csv(paths[3])
    parks = parks[(parks['시설유형'] != '놀이터') & parks['위도'].notna() & parks['경도'].notna()]
    park_shapes = gpd.GeoSeries(gpd.points_from_xy(parks['경도'], parks['위도']), crs=4326).to_crs(5179)
    radii = pd.to_numeric(parks['공원면적'], errors='coerce').fillna(0).map(lambda a:max(10, math.sqrt(a/math.pi))).to_numpy()
    park_union = unary_union(park_shapes.buffer(radii))
    if set(schools['학교ID']) != set(walks.index):
        raise ValueError('Scenario school identities mismatch')
    output = {}
    for row in schools.itertuples(index=False):
        walk = walks.loc[row.학교ID].geometry
        circle = row.geometry.buffer(500)
        nearby = residential.geometry.iloc[residential.sindex.query(circle, predicate='intersects')]
        added = added_zone(walk, circle, nearby)
        adjusted = walk.union(added)
        def metrics(zone):
            green = zone.intersection(park_union).area
            return {'area_m2':round(zone.area, 2), 'park_proxy_area_m2':round(green, 2), 'park_proxy_ratio_pct':round(100*green/zone.area, 3) if zone.area else None}
        output[row.학교ID] = {'baseline':metrics(walk), 'scenario':metrics(adjusted), 'added_area_m2':round(added.area, 2), 'status':'scenario_added' if added.area else 'no_added_area_under_assumption'}
    result = {'schools':output, 'limitations':NOTE, 'parameters':{'connection_buffer_m':15, 'minimum_residential_area_m2':250, 'minimum_added_piece_m2':500, 'straight_circle_m':500}, 'input_hashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
    (EDU/'residential_scenario.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    print('Residential scenario:',len(output),'schools;',sum(r['added_area_m2']>0 for r in output.values()),'with added area')


if __name__ == '__main__':
    main()
