import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ScienceAwardTests(unittest.TestCase):
    def test_every_linked_result_has_matching_official_school_and_prize(self):
        cache = ROOT/'data/education_sources/science_awards'
        data = json.loads((ROOT/'data_processed/education/science_awards.json').read_text(encoding='utf-8'))
        self.assertGreater(len(data['schools']), 0)
        for school_id, records in data['schools'].items():
            urls = [r['source_url'] for r in records]
            self.assertEqual(len(urls), len(set(urls)), school_id)
            for record in records:
                ident = record['source_url'].split('nttSn=')[1]
                source = json.loads((cache/f'{ident}.json').read_text(encoding='utf-8'))
                self.assertIn(record['school_name'], source['fields']['학교'])
                if source['fields']['수상']:
                    self.assertEqual(record['result'], source['fields']['수상'])
                else:
                    self.assertIn('moveBbsNttList.do?',record['result_source_url'])
                self.assertEqual(record['result'], source['listed_result'])
                self.assertNotIn('지도논문', source['title'])
                self.assertEqual(set(source['fields']), {'학교','대회명','수상'})

    def test_listing_counts_and_failures_are_accounted_for(self):
        manifest = json.loads((ROOT/'data/education_sources/science_awards/manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['listed_count'],len(manifest['entries'])+len(manifest['failures']))
        self.assertEqual(len(manifest['entries']),len(set(manifest['entries'])))
        self.assertEqual(manifest['years'],[2023,2024,2025])


if __name__ == '__main__':
    unittest.main()
