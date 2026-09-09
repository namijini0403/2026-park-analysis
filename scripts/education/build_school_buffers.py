"""Export extended-school straight buffers in the analysis CRS (EPSG:5179)."""
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, mapping
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[2]


def main():
    folder = ROOT / 'data_processed' / 'education'
    schools = json.loads((folder / 'school_analysis.json').read_text(encoding='utf-8'))
    project = Transformer.from_crs(4326, 5179, always_xy=True).transform
    unproject = Transformer.from_crs(5179, 4326, always_xy=True).transform
    features = []
    for school in schools:
        center = transform(project, Point(school['경도'], school['위도']))
        boundary = center.buffer(500)
        features.append({'type': 'Feature', 'properties': {
            key: school[key] for key in ('학교ID', '학교명', '학교급구분', 'gu')
        } | {'radius_m': 500, 'metric_crs': 'EPSG:5179'},
            'geometry': mapping(transform(unproject, boundary))})
    (folder / 'school_buffer_500m.geojson').write_text(json.dumps({
        'type': 'FeatureCollection', 'features': features
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Exported {len(features)} school-centered 500m buffers')


if __name__ == '__main__':
    main()
