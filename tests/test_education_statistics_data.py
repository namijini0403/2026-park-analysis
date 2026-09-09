import unittest
from scripts.education.build_school_statistics import summarize


def record(item, year, values, depth='0'):
    return dict(item=item, year=year, values=values, depth=depth, source_file='fixture.json', source_url='https://www.schoolinfo.go.kr')


class StatisticsDataTest(unittest.TestCase):
    def test_year_and_exemption(self):
        rows = [record('09', 2025, {'COL_S_SUM': 80, 'PBAN_EXCP_YN': 'N'}),
                record('09', 2026, {'COL_S_SUM': 0, 'TEACH_CNT': '', 'PBAN_EXCP_YN': 'N'})]
        self.assertEqual(summarize(rows, 2025)['students'], 80)
        self.assertEqual(summarize(rows, 2026)['students'], 0)
        self.assertIsNone(summarize(rows, 2026)['teachers'])
        self.assertIsNone(summarize(rows, 2024)['students'])
        rows[-1]['values']['PBAN_EXCP_YN'] = 'Y'
        self.assertIsNone(summarize(rows, 2026)['students'])

    def test_kindergarten_complete_components_only(self):
        values = {'만3세원아수': 3, '만4세원아수': 4, '만5세원아수': 5, '혼합원아수': 0, '특수원아수': 0,
                  '만3세학급수': 1, '만4세학급수': 1, '만5세학급수': 1, '혼합학급수': 0, '특수학급수': 0}
        rows = [record('KG05', 2026, values, '1')]
        self.assertEqual(summarize(rows, 2026)['students'], 12)
        self.assertEqual(summarize(rows, 2026)['class_size'], 4)
        values['특수원아수'] = None
        self.assertIsNone(summarize(rows, 2026)['students'])
        self.assertIsNone(summarize(rows, 2026)['class_size'])


if __name__ == '__main__':
    unittest.main()
