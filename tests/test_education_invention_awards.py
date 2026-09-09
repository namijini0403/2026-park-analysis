import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


class InventionAwardTests(unittest.TestCase):
    def test_official_attribution_and_event_separation(self):
        cache=ROOT/'data/education_sources/invention_awards'
        data=json.loads((ROOT/'data_processed/education/invention_awards.json').read_text(encoding='utf-8'))
        nationwide=json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']
        self.assertGreater(len(data['schools']),0)
        for sid,records in data['schools'].items():
            self.assertEqual(len(records),len({r['source_url'] for r in records}))
            for record in records:
                self.assertIn('/bbs/424/',record['source_url'])
                self.assertIn('발명품',record['event'])
                self.assertNotIn('지도논문',record['work_title'])
                source=json.loads((cache/(record['source_url'].split('nttSn=')[1]+'.json')).read_text(encoding='utf-8'))
                self.assertIn(record['school_name'],source['fields']['학교'])
                self.assertEqual(record['result'],source['fields']['수상'] or source['listed_result'])
                self.assertEqual(set(source['fields']),{'학교','대회명','수상'})
                matches={r['학교ID'] for r in nationwide if r['학교명']==record['school_name']}
                self.assertTrue(len(matches)==1 or '인천' in source['fields']['학교'])

    def test_complete_page_counts_and_no_silent_download_loss(self):
        cache=ROOT/'data/education_sources/invention_awards'
        manifest=json.loads((cache/'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['years'],[2023,2024,2025])
        self.assertEqual(manifest['failures'],[])
        self.assertEqual(manifest['listed_count'],len(set(manifest['entries'])))
        for year in manifest['years']:
            pages=[json.loads(p.read_text(encoding='utf-8')) for p in cache.glob(f'list_{year}_*.json')]
            first=json.loads((cache/f'list_{year}_1.json').read_text(encoding='utf-8'))
            self.assertEqual(sum(map(len,pages)),first[0]['ordinal'])


if __name__=='__main__':unittest.main()
