import unittest

from scripts.education.enrollment_model_v2 import fill_limited_history_scenario


class SupportEnrollmentScenarioTests(unittest.TestCase):
    def test_short_history_carries_observation_without_inventing_growth(self):
        result = {'history': [{'year': 2025, 'students': 200}, {'year': 2026, 'students': 600}], 'forecast': []}
        fill_limited_history_scenario(result)
        self.assertEqual(result['model_status'], 'limited_history_constant_scenario')
        self.assertEqual([r['students'] for r in result['forecast']], [600]*5)
        self.assertEqual(result['forecast'][-1], {'year': 2031, 'students': 600, 'horizon': 5})

    def test_missing_observation_remains_missing_and_existing_forecast_unchanged(self):
        empty = {'history': [], 'forecast': []}
        self.assertEqual(fill_limited_history_scenario(empty), empty)
        existing = {'history': [{'year': 2026, 'students': 100}], 'forecast': [{'year': 2029, 'students': 80}]}
        fill_limited_history_scenario(existing)
        self.assertEqual(existing['forecast'][0]['students'], 80)
        self.assertNotIn('scenario_method', existing)


if __name__ == '__main__':
    unittest.main()
