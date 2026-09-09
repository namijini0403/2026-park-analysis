import copy
import json
import unittest
from pathlib import Path

from scripts.education.registry_corrections import apply_corrections

ROOT=Path(__file__).resolve().parents[1]


class RegistryCorrectionTests(unittest.TestCase):
    def setUp(self):
        self.corrections=json.loads((ROOT/'data/education_sources/school_registry_corrections.json').read_text(encoding='utf-8'))
        self.records=json.loads((ROOT/'data/education_sources/school_locations.json').read_text(encoding='utf-8'))['records']

    def test_current_official_school_fields_and_original_id_are_preserved(self):
        before=next(r for r in self.records if r['학교ID']=='B000030928')
        after=next(r for r in apply_corrections(self.records,self.corrections) if r['학교ID']=='B000030928')
        self.assertEqual(before['학교급구분'],'초등학교')
        self.assertEqual(after['학교급구분'],'중학교')
        self.assertEqual(after['학교명'],'인천검단가온중학교')
        self.assertIn('동화시로 122',after['소재지도로명주소'])
        self.assertIn('공식 좌표 차이',after['registry_correction'])

    def test_changed_source_or_far_location_requires_reverification(self):
        for key,value in [('학교명','다른학교'),('위도','38.0')]:
            changed=copy.deepcopy(self.records)
            next(r for r in changed if r['학교ID']=='B000030928')[key]=value
            with self.assertRaises(ValueError):apply_corrections(changed,self.corrections)
        corrections=copy.deepcopy(self.corrections)
        corrections[0]['replacement']['위도']=38.0
        with self.assertRaises(ValueError):apply_corrections(self.records,corrections)


if __name__=='__main__':unittest.main()
