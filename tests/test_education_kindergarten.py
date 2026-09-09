import hashlib
import json
import unittest
from pathlib import Path

import pandas as pd
from scripts.education.build_education_analysis import recent_contiguous_history

ROOT=Path(__file__).resolve().parents[1]


class KindergartenTests(unittest.TestCase):
    def test_latest_registry_matches_public_2026_source(self):
        source=json.loads((ROOT/'data/education_sources/kindergarten/20261_05.json').read_text(encoding='utf-8'))
        records=[dict(zip(source['header'],row)) for row in source['body']]
        expected={'KLOCAL-'+hashlib.sha256((r['유치원명']+'|'+str(r['설립일'])).encode()).hexdigest()[:16] for r in records}
        registry=pd.read_csv(ROOT/'data_processed/education/institutions.csv')
        actual=registry[registry['학교급구분']=='유치원']
        self.assertEqual(set(actual['학교ID']),expected)
        self.assertEqual(len(actual),369)
        self.assertEqual(set(actual.coordinate_status),{'available'})

    def test_gaps_do_not_discard_recent_contiguous_observations(self):
        history={2016:100,2017:90,2020:80,2021:70,2022:60}
        self.assertEqual(recent_contiguous_history(history),{2020:80,2021:70,2022:60})
        self.assertEqual(recent_contiguous_history({}),{})

    def test_recent_disclosures_and_long_histories_are_visible(self):
        schools=json.loads((ROOT/'data_processed/education/school_analysis.json').read_text(encoding='utf-8'))
        kinder=[r for r in schools if r['학교급구분']=='유치원']
        self.assertGreater(sum(len(r['enrollment']['history'])>=10 for r in kinder),250)
        self.assertGreater(sum(bool(r['enrollment']['forecast']) for r in kinder),300)
        for school in kinder:
            rows=json.loads((ROOT/f"data_processed/education/disclosures/{school['학교ID']}.json").read_text(encoding='utf-8'))
            self.assertTrue(any(r['item']=='KG05' and r['year']==2026 for r in rows))
            self.assertTrue(any(r['item']=='KG041' and r['year']==2026 for r in rows))
            self.assertTrue(all('원장명' not in r['values'] and '대표자명' not in r['values'] for r in rows))


if __name__=='__main__':unittest.main()
