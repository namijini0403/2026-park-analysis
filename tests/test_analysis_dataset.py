import unittest

import numpy as np

from scripts.education.build_analysis_dataset import trend
from scripts.education.analyze_library_access import summarize_demand


class AnalysisFoundationsTests(unittest.TestCase):
    def test_nonconsecutive_years_are_not_year_over_year(self):
        result = trend([{'year': 2022, 'students': 10}, {'year': 2024, 'students': 20}])
        self.assertIsNone(result['latest_change'])
        self.assertIsNone(result['sen_slope_students_per_year'])

    def test_zero_base_has_count_change_but_no_percent(self):
        result = trend([{'year': 2025, 'students': 0}, {'year': 2026, 'students': 10}])
        self.assertEqual(result['latest_change'], 10)
        self.assertIsNone(result['latest_change_pct'])

    def test_sen_slope_uses_year_gaps(self):
        result = trend([{'year': 2020, 'students': 10}, {'year': 2022, 'students': 14}, {'year': 2026, 'students': 22}])
        self.assertEqual(result['sen_slope_students_per_year'], 2)

    def test_missing_population_does_not_become_zero(self):
        data = np.array([[3., np.nan], [4., 5.]])
        total, missing = summarize_demand(data, np.array([0, 1]))
        self.assertEqual(total, [7., None])
        self.assertEqual(missing, [0, 1])
        self.assertEqual(summarize_demand(data, np.array([1]))[0], [4., 5.])
        self.assertEqual(summarize_demand(data, np.array([], dtype=int))[0], [0., 0.])


if __name__ == '__main__':
    unittest.main()
