import json
import unittest
from scripts.education.build_sports_awards import parse, resolve_school, ALIASES


class SportsAwardsTest(unittest.TestCase):
    def fixture(self, city='인천'):
        cells={'종별':'남자18세이하부','세부종목':'단체전','메달':'금','시도':city,'선수명':'개인이름제외','소속':'예시고등학교','일자':'2025.10.20'}
        row='<tr>'+''.join(f'<td data-label="{k}">{v}</td>' for k,v in cells.items())+'</tr>'
        return '<h5>인천 [ 검도 ]</h5><table class="res-tbl-wrap">'+row+row+'</table>'

    def test_team_rows_group_without_personal_fields(self):
        rows=parse(self.fixture(),2025)
        self.assertEqual(len(rows),1)
        self.assertEqual(len(rows[0]['source_rows']),2)
        self.assertEqual(rows[0]['category'],'검도')
        self.assertNotIn('개인이름제외',json.dumps(rows,ensure_ascii=False))
        self.assertNotIn('medal_count',rows[0])

    def test_wrong_region_year_or_empty_fails(self):
        with self.assertRaises(ValueError): parse(self.fixture('서울'),2025)
        with self.assertRaises(ValueError): parse(self.fixture(),2024)
        with self.assertRaises(ValueError): parse('<html></html>',2025)

    def test_whitespace_match_is_unique_and_does_not_strip_institution_suffix(self):
        registry=[{'학교ID':'one','학교명':'인천대건고등학교'}]
        row={'school_name':'인천 대건고등학교','category':'스쿼시','discipline':'개인전'}
        self.assertEqual(resolve_school(row,registry,[])[0]['학교ID'],'one')
        self.assertIsNone(resolve_school(row,registry+registry,[])[0])
        row['school_name']='인천대건고등학교부설방송통신고등학교'
        self.assertIsNone(resolve_school(row,registry,[])[0])

    def test_archery_alias_requires_exact_school_and_discipline(self):
        aliases=json.loads(ALIASES.read_text(encoding='utf-8'))
        registry=[{'학교ID':'B000012271','학교명':'부개고등학교'}]
        row={'school_name':'부개고등학교(컴)','category':'양궁','discipline':'혼성단체전(컴파운드)'}
        self.assertEqual(resolve_school(row,registry,aliases)[0]['학교ID'],'B000012271')
        row['discipline']='리커브'
        self.assertIsNone(resolve_school(row,registry,aliases)[0])


if __name__=='__main__': unittest.main()
