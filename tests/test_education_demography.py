import json
import unittest
from pathlib import Path

from scripts.education.build_regional_demography import band_sum, build

ROOT = Path(__file__).resolve().parents[1]


class DemographyTests(unittest.TestCase):
    def test_latest_district_totals_match_city_without_branch_office_duplicates(self):
        source = json.loads((ROOT/'data/education_sources/regional_age_observations.json').read_text(encoding='utf-8'))
        rows = [r for r in source['records'] if r['year'] == 2025]
        city = next(r for r in rows if r['region_code'] == '2800000000')
        districts = [r for r in rows if r['region_name'].endswith(('구','군'))]
        self.assertEqual(len(districts), 10)
        for age in range(21):
            self.assertEqual(sum(r['ages'][str(age)] for r in districts), city['ages'][str(age)])

    def test_cohort_ages_move_forward_without_inventing_births(self):
        source = {'source_url':'test', 'records':[{'region_code':'2800000000','region_name':'인천광역시','year':2025,
                                                 'ages':{str(age):100+age for age in range(21)}}]}
        result = build(source)
        kindergarten = result['인천광역시|유치원']
        self.assertEqual(kindergarten['history'][0]['residents'], 103+104+105)
        self.assertEqual(kindergarten['cohort_scenario'][-1], {'year':2028,'residents':100+101+102})
        self.assertEqual(len(kindergarten['cohort_scenario']), 3)
        self.assertEqual(band_sum({'3':4,'4':None,'5':7},3,5), None)

    def test_published_contexts_exclude_obsolete_names_and_branch_offices(self):
        data = json.loads((ROOT/'data_processed/education/regional_demography.json').read_text(encoding='utf-8'))
        self.assertEqual(len(data), 44)
        self.assertFalse(any('출장소' in key or key.startswith('남구|') for key in data))
        self.assertTrue(all(r['base_year'] == 2025 for r in data.values()))


if __name__ == '__main__':
    unittest.main()
