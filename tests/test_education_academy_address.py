import unittest
from scripts.education.build_academies import road_building_address


class AcademyAddressTest(unittest.TestCase):
    def test_removes_units_but_preserves_building_subnumber_and_district(self):
        cases={
            '인천광역시 중구 자연대로 40 301~302호 전부 (중산동)':'인천광역시 중구 자연대로 40',
            '인천광역시 남동구 서창남로 16-1 402-1호':'인천광역시 남동구 서창남로 16-1',
            '인천광역시 연수구 컨벤시아대로230번길 42 214-1호':'인천광역시 연수구 컨벤시아대로230번길 42',
        }
        for raw,expected in cases.items():self.assertEqual(road_building_address(raw),expected)

    def test_missing_building_number_or_plot_address_is_not_guessed(self):
        for raw in ['인천광역시 연수구 봉재산로44번길 203호 (동춘동)','인천광역시 남동구 구월동 199BL 1LT','서울특별시 강남구 가로 12']:
            self.assertIsNone(road_building_address(raw))


if __name__=='__main__':unittest.main()
