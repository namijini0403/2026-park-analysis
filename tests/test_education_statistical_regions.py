import json
import unittest

from scripts.education.build_statistical_regions import DATA, resolve


class StatisticalRegionsTest(unittest.TestCase):
    def setUp(self):
        self.row = {'학교명': '예시유치원', '학교급구분': '유치원', 'gu': '제물포구',
                    '소재지도로명주소': '인천광역시 제물포구 예시로 10 (예시동)', '위도': 37.5, '경도': 126.6}
        self.old = {'유치원명': '예시유치원', '주소': '인천광역시 동구 예시로 10', '위도': 37.5, '경도': 126.6}

    def test_old_address_links_without_overwriting_display_district(self):
        self.assertEqual(resolve(self.row, [self.old])['region_name'], '동구')
        self.assertEqual(self.row['gu'], '제물포구')

    def test_same_name_elsewhere_and_ambiguous_matches_are_held(self):
        for records in [[dict(self.old, 주소='인천광역시 중구 다른로 20')],
                        [dict(self.old, 위도=37.9)], [self.old, self.old], []]:
            self.assertIsNone(resolve(self.row, records)['region_name'])

    def test_new_district_in_retroactively_updated_history_is_not_old_boundary(self):
        self.assertIsNone(resolve(self.row, [dict(self.old, 주소='인천광역시 제물포구 예시로 10')])['region_name'])

    def test_built_links_and_forecasts(self):
        rows = json.loads((DATA/'school_analysis.json').read_text(encoding='utf-8'))
        forecasts = json.loads((DATA/'regional_age_forecasts.json').read_text(encoding='utf-8'))
        linked = [r for r in rows if r['statistical_region_2025']['region_name']]
        restored = [r for r in linked if r['statistical_region_2025']['region_name'] != r['gu']]
        self.assertEqual(len(restored), 113)
        self.assertEqual(len(linked), 640)
        for row in linked:
            self.assertIn(f"{row['statistical_region_2025']['region_name']}|{row['학교급구분']}", forecasts)


if __name__ == '__main__':
    unittest.main()
