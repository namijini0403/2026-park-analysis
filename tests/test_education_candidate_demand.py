import json
import unittest
from pathlib import Path

from scripts.education.build_candidate_age_demand import estimate_band,build,parent_code

ROOT=Path(__file__).resolve().parents[1]


class CandidateAgeTests(unittest.TestCase):
    def test_age_splitting_conserves_all_source_groups(self):
        groups={f'in_age_{i:03}':i*10 for i in range(1,5)}
        ages={str(i):i+1 for i in range(20)}
        self.assertAlmostEqual(sum(estimate_band(groups,ages,i,i) for i in range(20)),100)
        self.assertIsNone(estimate_band({},ages,3,5))
        self.assertEqual(parent_code('다사403632'),'다사4063')

    def test_missing_parent_cannot_be_reported_as_complete(self):
        source={'year':2024,'method':'fixture','city_single_ages':{str(i):10 for i in range(20)},
                'census_age_groups':{'A':{f'in_age_{i:03}':100 for i in range(1,5)}},
                'candidate_weights':{'C':{'footprint':{'weights':{'A':.25,'missing':.1},'observed_total_population':100}}}}
        result=build(source)['candidates']['C']['footprint']['levels']['유치원']
        self.assertIsNone(result['estimated_residents'])
        self.assertEqual(result['known_subtotal'],15)
        self.assertEqual(result['missing_parent_grids'],1)

    def test_candidate_footprint_is_contained_in_500m_population_support(self):
        source=json.loads((ROOT/'data/education_sources/candidate_age_allocation.json').read_text(encoding='utf-8'))
        data=json.loads((ROOT/'data_processed/education/candidate_age_demand.json').read_text(encoding='utf-8'))
        candidates=json.loads((ROOT/'data_processed/candidate_grid_final.geojson').read_text(encoding='utf-8'))
        self.assertEqual(set(data['candidates']),{r['properties']['grid_id'] for r in candidates['features']})
        for ident,scopes in source['candidate_weights'].items():
            outer=scopes['straight_500m']['weights']
            for parent,weight in scopes['footprint']['weights'].items():
                self.assertLessEqual(weight,outer.get(parent,0)+1e-9)
            for scope in scopes.values():
                self.assertTrue(all(0<=w<=1+1e-9 for w in scope['weights'].values()))
            for level,inner in data['candidates'][ident]['footprint']['levels'].items():
                outer=data['candidates'][ident]['straight_500m']['levels'][level]
                if inner['estimated_residents'] is not None and outer['estimated_residents'] is not None:
                    self.assertLessEqual(inner['estimated_residents'],outer['estimated_residents']+.01)


if __name__=='__main__':unittest.main()
