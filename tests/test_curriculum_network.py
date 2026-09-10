import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]


class CurriculumSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'data_processed/education/curriculum_network.json').read_text(encoding='utf-8'))

    def test_complete_advertisement_not_only_matched_subset(self):
        rows=self.data['courses']
        self.assertEqual(len(rows),364)
        self.assertEqual(sum(r['kind']=='거점형' for r in rows),313)
        self.assertEqual(sum(r['kind']=='온라인형' for r in rows),21)
        self.assertEqual(sum(r['kind']=='밴드형' for r in rows),30)
        self.assertEqual(sum(r['school_id'] is None for r in rows),10)

    def test_visually_checked_merged_cells(self):
        band={r['number']:r for r in self.data['courses'] if r['kind']=='밴드형'}
        self.assertEqual(band[1]['eligible_school_names'],['강화여고','덕신고','교동고','서도고'])
        self.assertEqual(band[4]['eligible_school_names'],band[1]['eligible_school_names'])
        self.assertEqual(band[12]['eligible_school_names'],['부평고등학교'])
        self.assertEqual(band[13]['eligible_school_names'],['인천영선고등학교'])
        self.assertEqual(band[14]['eligible_school_names'],['작전고등학교'])
        self.assertEqual(band[15]['eligible_school_names'],['작전고등학교'])
        self.assertIn('인하사대부고',band[30]['eligible_school_names'])

    def test_edges_unique_no_self_and_simulation_bounds(self):
        edges=self.data['edges'];keys=[(e['provider_id'],e['eligible_school_id']) for e in edges]
        self.assertEqual(len(keys),len(set(keys)))
        self.assertTrue(all(a!=b for a,b in keys))
        self.assertTrue(all(1<=n<=30 for e in edges for n in e['course_numbers']))
        for s in self.data['simulations']:
            self.assertEqual(s['mean_by_round'][0],23)
            self.assertEqual(s['mean_by_round'],sorted(s['mean_by_round']))
            self.assertLessEqual(s['mean_by_round'][-1],129)


if __name__=='__main__':unittest.main()
