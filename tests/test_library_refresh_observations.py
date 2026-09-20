"""Run the refresh in a temporary tree; no network or live-data writes."""
import csv
import importlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import geopandas as gpd
from shapely.geometry import box

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.education.refresh_libraries import rebuild


class LibraryRefreshObservations(unittest.TestCase):
    def test_refresh_uses_current_modules_and_clears_legacy_choices(self):
        gap = importlib.import_module('scripts.reading_module.apply_reading_gap_types')
        policy = importlib.import_module('scripts.policy_cards.build_policy_cards')
        original_root, original_data = gap.ROOT, policy.DATA
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root/'data_processed'
            edu = data/'education'
            edu.mkdir(parents=True)

            def csv_file(name, rows):
                with (data/name).open('w', encoding='utf-8', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
                    writer.writeheader()
                    writer.writerows(rows)

            csv_file('libraries.csv', [{'도서관명':'관측 도서관', '유형':'공공', '위도':37.5,
                                       '경도':126.7, '좌표출처':'원본'}])
            schools = [{'학교ID':sid, '학교명':sid, '위도':37.0, '경도':126.5}
                       for sid in ['s1', 's2']]
            csv_file('schools.csv', schools)
            csv_file('education/institutions.csv', schools)
            csv_file('school_priority_with_functional_park_layer.csv', [
                {'학교ID':s['학교ID'], '학교명':s['학교명'], 'is_separate_bundle_tag':'1'} for s in schools])
            csv_file('school_library_access.csv', [
                {'학교ID':s['학교ID'], 'iso_public_library_count':1, '인당장서수':'', '사서합계':'',
                 'external_shortage':'True', 'internal_shortage':'True', 'demand_high':'True',
                 'reading_gap_type':'direct_investment_first'} for s in schools])
            gpd.GeoDataFrame({'학교ID':['s1','s2']}, geometry=[box(126.4,36.9,126.6,37.1)]*2,
                             crs=4326).to_file(data/'school_isochrone_500m.geojson', driver='GeoJSON')
            # s2 has no extended geometry, but its stale recommendation must still clear.
            gpd.GeoDataFrame({'학교ID':['s1']}, geometry=[box(126.4,36.9,126.6,37.1)],
                             crs=4326).to_file(edu/'walkshed_500m.geojson', driver='GeoJSON')
            (edu/'library_refresh_coverage.json').write_text(json.dumps({
                'unresolved':[{'name':'좌표 미확보'}], 'limitation':'미확보는 부재가 아닙니다.'}), encoding='utf-8')
            (edu/'school_analysis.json').write_text(json.dumps([
                {'학교ID':s['학교ID'], 'case_type':4, 'reading_gap':{'internal_low':True},
                 'policy_scenarios':{'false':{'primary_action':'internal_investment'}}} for s in schools]), encoding='utf-8')

            # Distance/population engine is unrelated to the removed module API regression.
            def distance_outputs():
                for name in ['library_access_scenarios.json', 'library_access_preview.json']:
                    (edu/name).write_text('{"limitations":[]}', encoding='utf-8')

            module = importlib.import_module('scripts.education.analyze_library_access')
            with patch.multiple(module, ROOT=root, DATA=data, EDU=edu, SOURCE=root/'unused'), \
                 patch.object(module, 'main', side_effect=distance_outputs):
                rebuild(root)
            with (data/'school_library_access.csv').open(encoding='utf-8-sig') as f:
                rows = list(csv.DictReader(f))
            for row in rows:
                self.assertEqual(row['iso_public_library_count'], '0')
                self.assertEqual(row['reading_gap_type'], '추가 확인 필요')
                for key in ['external_shortage', 'internal_shortage', 'demand_high']:
                    self.assertEqual(row[key], '')
            cards = json.loads((data/'policy_action_cards.json').read_text(encoding='utf-8'))
            for card in cards['schools'].values():
                self.assertIsNone(card['base']['primary_action'])
                self.assertIsNone(card['primary_module'])
                self.assertTrue(card['separate_track'])
            analysis = json.loads((edu/'school_analysis.json').read_text(encoding='utf-8'))
            for school in analysis:
                self.assertEqual(school['policy_scenarios'], {})
                self.assertIsNone(school['reading_gap']['internal_low'])
            self.assertEqual(analysis[0]['context']['library']['coverage'], 'partial_geocoded_records')
            for name in ['library_access_scenarios.json', 'library_access_preview.json']:
                self.assertEqual(json.loads((edu/name).read_text(encoding='utf-8'))['missing_library_coordinates'], 1)
        self.assertEqual(gap.ROOT, original_root)
        self.assertEqual(policy.DATA, original_data)


if __name__ == '__main__':
    unittest.main()
