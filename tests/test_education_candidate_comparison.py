import json
import unittest
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point

from scripts.education.build_candidate_comparison import compare

ROOT = Path(__file__).resolve().parents[1]


def candidate(ident, distance, gap, age):
    return dict(grid_id=ident, straight_distance_m=distance, nearest_park_straight_m=gap,
                estimated_age_residents=age)


class CandidateComparisonTests(unittest.TestCase):
    def test_dominance_ties_and_missing_are_distinct(self):
        rows = [candidate('A',100,900,100),candidate('B',100,900,100),
                candidate('C',200,800,80),candidate('D',0,1000,None)]
        result = compare(rows)
        by_id = {r['grid_id']:r for r in rows}
        self.assertEqual(result['complete_comparison_count'],3)
        self.assertEqual(result['missing_age_count'],1)
        for ident in ['A','B']:
            self.assertTrue(by_id[ident]['pareto_efficient'])
            self.assertEqual(by_id[ident]['best_weight_rank'],1)
            self.assertEqual(by_id[ident]['worst_weight_rank'],1)
        self.assertFalse(by_id['C']['pareto_efficient'])
        self.assertIsNone(by_id['D']['default_score'])
        self.assertIsNone(by_id['D']['top5_weight_share'])
        self.assertEqual(rows[-1]['grid_id'],'D')

    def test_weight_changes_expose_tradeoff_and_scores_reconcile(self):
        rows = [candidate('near',0,0,0),candidate('demand',1500,1000,100)]
        compare(rows)
        for row in rows:
            self.assertTrue(row['pareto_efficient'])
            self.assertEqual(row['best_weight_rank'],1)
            self.assertEqual(row['worst_weight_rank'],2)
            self.assertAlmostEqual(row['default_score'],sum(row['default_contributions'].values()))
        self.assertEqual(rows[0]['grid_id'],'demand')
        self.assertEqual(compare([])['candidate_count'],0)

    def test_saved_candidates_are_not_truncated_or_elementary_scores(self):
        rows = json.loads((ROOT/'data_processed/education/school_analysis.json').read_text(encoding='utf-8'))
        self.assertGreater(max(len(r['candidates']) for r in rows),12)
        grid = gpd.read_file(ROOT/'data_processed/candidate_grid_final.geojson').to_crs(5179)
        centers = grid.geometry.centroid
        for level in ['유치원','중학교','고등학교']:
            school = next(r for r in rows if r['학교급구분']==level and len(r['candidates'])>12)
            origin = gpd.GeoSeries([Point(school['경도'],school['위도'])],crs=4326).to_crs(5179).iloc[0]
            expected = set(grid.loc[centers.distance(origin)<=1500,'grid_id'])
            self.assertEqual({c['grid_id'] for c in school['candidates']},expected)
        for row in rows:
            self.assertEqual(row['candidate_comparison']['candidate_count'],len(row['candidates']))
            for c in row['candidates']:
                self.assertLessEqual(c['straight_distance_m'],1500)
                self.assertIsNone(c['land_feasibility_level'])
                self.assertIsNone(c['age_specific_beneficiaries'])
                if c['default_score'] is not None:
                    self.assertAlmostEqual(c['default_score'],sum(c['default_contributions'].values()))
                    self.assertTrue(0 <= c['top5_weight_share'] <= 1)
                else:
                    self.assertIsNone(c['estimated_age_residents'])


if __name__ == '__main__':
    unittest.main()
