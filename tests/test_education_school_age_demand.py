import json
import unittest

import geopandas as gpd
import pandas as pd
from shapely.geometry import box

from scripts.education.build_school_age_demand import CACHE, DATA, fingerprints, spatial_weights


class SchoolAgeDemandTest(unittest.TestCase):
    def test_partial_cell_and_parent_total_conservation(self):
        cells = gpd.GeoDataFrame({'parent':['a','a'], 'total':[100.,300.]},
                                geometry=[box(0,0,100,100),box(100,0,200,100)], crs=5179)
        denominators = pd.Series({'a':400.})
        partial = spatial_weights(cells,denominators,box(0,0,50,100))
        self.assertAlmostEqual(partial['weights']['a'], .125)
        self.assertAlmostEqual(partial['observed_total_population'],50.)
        whole = spatial_weights(cells,denominators,box(0,0,200,100))
        self.assertAlmostEqual(whole['weights']['a'],1.)

    def test_school_centered_outputs_cover_both_geometries_with_current_inputs(self):
        cache = json.loads(CACHE.read_text(encoding='utf-8'))
        self.assertEqual(cache['input_hashes'], fingerprints())
        schools = json.loads((DATA/'school_analysis.json').read_text(encoding='utf-8'))
        output = json.loads((DATA/'school_age_demand.json').read_text(encoding='utf-8'))
        self.assertEqual(set(output['schools']), {r['학교ID'] for r in schools})
        self.assertEqual(output['base_year'],2024)
        for row in schools:
            scopes = output['schools'][row['학교ID']]
            self.assertEqual(set(scopes), {'straight_500m','walkshed_500m'})
            for scope,data in scopes.items():
                age = data['levels'][row['학교급구분']]
                if age['missing_parent_grids']:
                    self.assertIsNone(age['estimated_residents'])
                if age['estimated_residents'] is not None:
                    self.assertGreaterEqual(age['estimated_residents'],0)
                    self.assertEqual(age['estimated_residents'],age['known_subtotal'])
                for weight in cache['school_weights'][row['학교ID']][scope]['weights'].values():
                    self.assertGreaterEqual(weight,0)
                    self.assertLessEqual(weight,1.00000001)


if __name__=='__main__':
    unittest.main()
