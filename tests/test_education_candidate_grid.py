import json
import unittest
from pathlib import Path

import geopandas as gpd
from shapely.geometry import box

from scripts.education.build_candidate_grid import build

ROOT=Path(__file__).resolve().parents[1]


class CandidateGridTests(unittest.TestCase):
    def test_exact_metric_cells_stable_ids_and_positive_intersection(self):
        walks=gpd.GeoDataFrame([{'학교ID':'B','geometry':box(1000,2000,1250,2250)},
                               {'학교ID':'A','geometry':box(1100,2100,1300,2300)}],crs=5179)
        result=build(walks)
        reversed_result=build(walks.iloc[::-1])
        self.assertEqual(result.to_json(),reversed_result.to_json())
        self.assertEqual(set(result.grid_id),{'E250_4_8','E250_4_9','E250_5_8','E250_5_9'})
        self.assertTrue((result.geometry.area==62500).all())
        self.assertEqual(result.set_index('grid_id').loc['E250_4_8','linked_school_ids'],['A','B'])

    def test_every_school_has_verified_grid_intersections(self):
        data=ROOT/'data_processed/education'
        cells=gpd.read_file(data/'candidate_grid.geojson').to_crs(5179)
        walks=gpd.read_file(data/'walkshed_500m.geojson').to_crs(5179).set_index('학교ID')
        linked=set()
        for row in cells.itertuples():
            self.assertAlmostEqual(row.geometry.area,62500,places=3)
            for sid in row.linked_school_ids:
                linked.add(sid)
                self.assertGreater(walks.loc[sid].geometry.intersection(row.geometry).area,.009)
        self.assertEqual(linked,set(walks.index))
        manifest=json.loads((data/'candidate_grid_manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['linked_schools'],len(walks))


if __name__=='__main__':unittest.main()
