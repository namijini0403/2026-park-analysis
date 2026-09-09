import json
import math
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.education.build_academies import classify_courses


class EducationDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / 'data_processed/education'
        cls.schools = json.loads((cls.path/'school_analysis.json').read_text(encoding='utf-8'))
        cls.academies = json.loads((cls.path/'academies.json').read_text(encoding='utf-8'))

    def test_course_difficulty_is_not_school_level(self):
        self.assertEqual(classify_courses('피아노 초급 중급 고급')[0], [])
        self.assertTrue(classify_courses('피아노 초급 중급 고급')[2])

    def test_targets_and_arts_are_independent(self):
        levels, group, arts = classify_courses('초등미술 중등미술 고등미술')
        self.assertEqual(levels, ['elementary','middle','high'])
        self.assertEqual(group, 'integrated')
        self.assertTrue(arts)
        self.assertEqual(classify_courses('초중고 수학')[0],['elementary','middle','high'])
        self.assertEqual(classify_courses('피아노 초1급 중2급 고3급')[0],[])

    def test_non_elementary_coverage(self):
        self.assertEqual(pd.Series([s['학교급구분'] for s in self.schools]).value_counts().to_dict(),
                         {'유치원':376,'중학교':146,'고등학교':129})
        self.assertEqual(len({s['학교ID'] for s in self.schools}),651)
        self.assertTrue(all(s['analysis_status']=='available' for s in self.schools))

    def test_no_circular_fallback_claimed_as_walkshed(self):
        report=pd.read_csv(self.path/'walkshed_report.csv')
        self.assertEqual(set(report.method),{'exact_edge_trim_v3'})
        self.assertEqual(len(report),651)
        self.assertTrue((report.v3_area_m2>0).all())

    def test_suppressed_data_not_zero_predictions(self):
        for s in self.schools:
            forecast=s['enrollment']
            if len(forecast['history'])<3:
                self.assertEqual(forecast['forecast'],[])
            for candidate in s['candidates']:
                self.assertIsNone(candidate['age_specific_beneficiaries'])

    def test_knn_is_same_level_and_excludes_self(self):
        by_id={s['학교ID']:s for s in self.schools}
        for school in self.schools:
            peers=school['similar_schools']
            self.assertLessEqual(len(peers),4)
            self.assertEqual(len({p['school_id'] for p in peers}),len(peers))
            for peer in peers:
                self.assertNotEqual(peer['school_id'],school['학교ID'])
                self.assertEqual(by_id[peer['school_id']]['학교급구분'],school['학교급구분'])

    def test_geocoding_missingness_and_facility_dedup(self):
        self.assertEqual(len(self.academies),6839)
        self.assertEqual(len({a['facility_id'] for a in self.academies}),6839)
        self.assertEqual(sum(a['course_row_count'] for a in self.academies),74061)
        self.assertEqual(sum(a['lat'] is not None for a in self.academies),6743)
        self.assertTrue(all(a['lng'] is None for a in self.academies if a['lat'] is None))
        self.assertTrue(all('설립자-성명' not in a and '교습자-성명' not in a for a in self.academies))

    def test_independent_straight_distance_counts(self):
        valid=[a for a in self.academies if a['lat'] is not None]
        lats=np.radians([a['lat'] for a in valid]);lngs=np.radians([a['lng'] for a in valid])
        for s in self.schools[::25]:
            lat,lng=math.radians(s['위도']),math.radians(s['경도'])
            d=2*6371000*np.arcsin(np.sqrt(np.sin((lats-lat)/2)**2+np.cos(lat)*np.cos(lats)*np.sin((lngs-lng)/2)**2))
            count=s['context']['academy']['straight_500m_count']
            # Geodesic sphere vs EPSG:5179 has a small distance difference.
            self.assertGreaterEqual(count,int((d<=497).sum()))
            self.assertLessEqual(count,int((d<=503).sum()))

    def test_policy_scenarios_and_green_bounds(self):
        for school in self.schools:
            self.assertTrue(0<=school['iso_green_ratio']<=100)
            for barrier,scenarios in school['policy_scenarios'].items():
                self.assertEqual(len(scenarios),12)
                for key,action in scenarios.items():
                    budget,site,access=key.split('|')
                    if site=='unavailable': self.assertNotEqual(action,'external_supply_new')
                    if access=='infeasible': self.assertNotEqual(action,'access_route_improvement')

    def test_all_existing_elementary_schools_have_academy_and_disclosure_paths(self):
        baseline=pd.read_csv(ROOT/'data_processed/schools.csv')
        context=json.loads((self.path/'academy_school_context.json').read_text(encoding='utf-8'))
        for sid in baseline['학교ID']:
            self.assertIn(sid,context)
            self.assertTrue((self.path/f'disclosures/{sid}.json').exists())


if __name__ == '__main__':
    unittest.main()
