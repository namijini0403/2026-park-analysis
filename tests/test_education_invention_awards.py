import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from scripts.education.build_invention_awards_pdf import extract

ROOT=Path(__file__).resolve().parents[1]


class InventionAwardTests(unittest.TestCase):
    def test_official_attribution_and_event_separation(self):
        cache=ROOT/'data/education_sources/invention_awards'
        data=json.loads((ROOT/'data_processed/education/invention_awards.json').read_text(encoding='utf-8'))
        nationwide=json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']
        self.assertGreater(len(data['schools']),0)
        for sid,records in data['schools'].items():
            self.assertEqual(len(records),len({(r['source_url'],r.get('work_number'),r.get('award_scope')) for r in records}))
            for record in records:
                if record['year']==2026:
                    latest=json.loads((ROOT/'data/education_sources/invention_awards_2026_results.json').read_text(encoding='utf-8'))
                    self.assertIn(record,latest['records'])
                    self.assertIn('/bbs/208/',record['source_url'])
                    self.assertIn(record['award_scope'],['student_work','school_group'])
                    if record['award_scope']=='student_work':
                        self.assertIsNone(record['work_title'])
                        self.assertLessEqual(record['source_table'],6)
                    else:self.assertEqual(record['source_table'],10)
                    continue
                self.assertIn('/bbs/424/',record['source_url'])
                self.assertIn('발명품',record['event'])
                self.assertNotIn('지도논문',record['work_title'])
                if 'work_number' in record:
                    pdf=json.loads((ROOT/'data/education_sources/invention_awards_2024_pdf.json').read_text(encoding='utf-8'))
                    self.assertIn(record,pdf['records'])
                    self.assertTrue(15<=record['roster_page']<=23)
                    self.assertGreater(record['summary_page'],record['roster_page'])
                    self.assertEqual({r['학교ID'] for r in nationwide if r['학교명']==record['school_name']},{sid})
                    continue
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

    def test_pdf_uses_student_roster_and_unique_works(self):
        pdf=json.loads((ROOT/'data/education_sources/invention_awards_2024_pdf.json').read_text(encoding='utf-8'))
        self.assertEqual(pdf['student_roster_works'],299)
        self.assertEqual(len(pdf['records']),17)
        self.assertEqual(len({(r['school_id'],r['work_number']) for r in pdf['records']}),17)
        self.assertTrue(all(r['reason']=='national school-name ambiguity' for r in pdf['unresolved']))
        self.assertTrue(all(r['participant_scope']=='학생 출품작' for r in pdf['records']))

    def test_pdf_parser_does_not_use_teacher_school_or_disagreeing_prize(self):
        texts=['']*26
        texts[14]='ㅇ 장 려 상\n'+'\n'.join(f'{n}\n학생학교' for n in range(1000,1299))
        texts[23]='ㅇ 특상\n1000\n교사학교'  # Teacher award roster lies outside student page range.
        texts[25]='작품명 안전한 도구 출품부문 초 출품번호 1000 구분 소속 장려상 출품자 이름 학생학교 1학년 지도교원 이름 교사학교 교사'
        registry=[{'학교ID':'A','학교명':'학생학교','학교급구분':'초등학교'},{'학교ID':'B','학교명':'교사학교','학교급구분':'초등학교'}]
        ids={'학생학교':{'A'},'교사학교':{'B'}}
        def document():return [SimpleNamespace(get_text=lambda text=text:text) for text in texts]
        output=extract(document(),registry,ids)
        self.assertEqual([r['school_id'] for r in output['records']],['A'])
        self.assertEqual(output['records'][0]['result'],'장려상')
        texts[25]=texts[25].replace('장려상','특상')
        output=extract(document(),registry,ids)
        self.assertEqual(output['records'],[])
        self.assertEqual(output['unresolved'][0]['reason'],'roster/summary mismatch')


if __name__=='__main__':unittest.main()
