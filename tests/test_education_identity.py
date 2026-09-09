import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd
from scripts.education.build_education_analysis import verified_schoolinfo_aliases

ROOT=Path(__file__).resolve().parents[1]


class SchoolIdentityTests(unittest.TestCase):
    def test_prefix_name_requires_independent_address_and_location(self):
        registry=pd.DataFrame([{'학교ID':'B1','학교명':'인천재능중학교','학교급구분':'중학교',
                               '소재지도로명주소':'인천광역시 동구 재능로 178','위도':37.475,'경도':126.65}])
        source={'SCHUL_CODE':'S1','SCHUL_NM':'재능중학교','SCHUL_RDNMA':'인천광역시 제물포구 재능로 178','LTTUD':37.475,'LGTUD':126.65}
        manifest=[{'item':'0','year':2026,'rows':1,'file':'basic.json','school_level_code':'03'}]
        with tempfile.TemporaryDirectory() as folder,patch('scripts.education.build_education_analysis.RAW',Path(folder)):
            def resolve():
                (Path(folder)/'basic.json').write_text(json.dumps({'list':[source]},ensure_ascii=False),encoding='utf-8')
                return verified_schoolinfo_aliases(registry,manifest)
            self.assertEqual(resolve()['S1']['school_id'],'B1')
            source['SCHUL_RDNMA']='인천광역시 제물포구 재능로 179'
            self.assertEqual(resolve(),{})
            source['SCHUL_RDNMA']='인천광역시 제물포구 재능로 178'
            source['LTTUD']=37.48
            self.assertEqual(resolve(),{})
            source['LTTUD']=37.475
            registry=pd.concat([registry,registry.assign(학교ID='B2')],ignore_index=True)
            self.assertEqual(resolve(),{})

    def test_verified_schools_have_restored_public_disclosures(self):
        data=ROOT/'data_processed/education'
        aliases=json.loads((data/'schoolinfo_verified_aliases.json').read_text(encoding='utf-8'))
        self.assertEqual({v['school_id'] for v in aliases.values()},{'B000011421','B000008769'})
        for ident,alias in aliases.items():
            rows=json.loads((data/'disclosures'/f"{alias['school_id']}.json").read_text(encoding='utf-8'))
            self.assertGreater(len(rows),40)
            self.assertTrue(any(r['item']=='90' for r in rows))
            self.assertTrue(all(r['values']['SCHUL_CODE']==ident for r in rows))


if __name__=='__main__':unittest.main()
