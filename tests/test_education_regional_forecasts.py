import copy
import json
import unittest
from pathlib import Path

import numpy as np
from scripts.education.build_regional_age_forecasts import fit_residual

ROOT=Path(__file__).resolve().parents[1]


class RegionalForecastTests(unittest.TestCase):
    def test_future_targets_cannot_change_a_past_origin_model(self):
        samples=[{'level':'middle','target':2020+i//30,'actual':100+i,'prophet':100,
                  'features':[1,100+i,2,100,100+i,0]} for i in range(90)]
        modified=copy.deepcopy(samples)
        for sample in modified:
            if sample['target']>2020:sample['actual']=1000000
        a,b=fit_residual(samples,'middle',2020),fit_residual(modified,'middle',2020)
        query=np.array([[1,120,2,100,120,0]])
        np.testing.assert_array_equal(a.predict(query),b.predict(query))
        self.assertEqual(a.training_count_,30)
        self.assertEqual(a.training_max_target_,2020)

    def test_holdout_provenance_and_reported_error_match_predictions(self):
        data=json.loads((ROOT/'data_processed/education/regional_age_forecast_validation.json').read_text(encoding='utf-8'))
        for row in data['rows']:
            self.assertIn(row['target'],[2023,2024,2025])
            self.assertEqual(row['target']-row['origin'],row['horizon'])
            if row['xgb_training_max_target'] is not None:
                self.assertLessEqual(row['xgb_training_max_target'],row['origin'])
        for summary in data['summary']:
            rows=[r for r in data['rows'] if r['key'].endswith('|'+summary['school_level']) and r['horizon']==summary['horizon']]
            self.assertEqual(summary['n'],len(rows))
            self.assertAlmostEqual(summary['selected_mae'],np.mean([abs(r['selected_prediction']-r['actual']) for r in rows]))

    def test_all_current_districts_have_nonnegative_forecasts(self):
        data=json.loads((ROOT/'data_processed/education/regional_age_forecasts.json').read_text(encoding='utf-8'))
        self.assertEqual(len(data),40)
        for result in data.values():
            self.assertEqual([r['year'] for r in result['forecast']],list(range(2026,2032)))
            self.assertTrue(all(r['residents']>=0 for r in result['forecast']))


if __name__=='__main__':unittest.main()
