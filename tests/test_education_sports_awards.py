import json
import unittest
from scripts.education.build_sports_awards import parse


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


if __name__=='__main__': unittest.main()
