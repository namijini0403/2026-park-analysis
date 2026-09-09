import unittest
from scripts.education.build_school_athletics import count, parse, resolve_school


class AthleticsTest(unittest.TestCase):
    def test_post_title_and_simple_suffix_match_only_one_school(self):
        registry=[{'학교ID':'one','학교명':'인천남고등학교'}, {'학교ID':'two','학교명':'인천성리초등학교'}]
        for title,sid in [('인천남고','one'),('인천성리초등학교(1분기)','two'),('2023학년도 인천남고등학교 보완','one')]:
            self.assertEqual(resolve_school(title,registry)[0]['학교ID'],sid)
        for title in ['인천남고등학교부설방송통신고등학교','인천남고등학교 및 인천성리초등학교','인천','남고','인인남고등학교']:
            self.assertIsNone(resolve_school(title,registry)[0])

    def test_counts_do_not_sum_ambiguous_groups(self):
        self.assertEqual(count('14명'),14)
        self.assertEqual(count('0'),0)
        self.assertEqual(count('1,200 명'),1200)
        self.assertIsNone(count('남 3명 여 4명'))
        self.assertIsNone(count('붙임 참조'))

    def test_post_preserves_raw_budget_and_date(self):
        html='<table><caption>선수인원</caption><tbody><tr><td><a class="nttInfoBtn" data-id="123">예시중학교</a></td><td>육상</td><td>8명</td><td>첨부파일 참조</td><td>2026.09.01.</td></tr></tbody></table>'
        row=parse(html)[0]
        self.assertEqual(row['athletes'],8)
        self.assertEqual(row['budget_raw'],'첨부파일 참조')
        self.assertEqual(row['posted_date'],'2026-09-01')
        self.assertNotIn('reporting_year',row)


if __name__=='__main__':unittest.main()
