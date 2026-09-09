import json
import unittest
import xml.etree.ElementTree as ET

from scripts.education.build_invention_awards_2026 import OUT,table_rows


class FinalInventionResultsTest(unittest.TestCase):
    def test_rowspan_does_not_shift_school_into_grade_column(self):
        table=ET.fromstring('''<hp:tbl xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" rowCnt="2" colCnt="3">
        <hp:tr><hp:tc><hp:cellAddr rowAddr="0" colAddr="0"/><hp:cellSpan rowSpan="2" colSpan="1"/><hp:t>중학교(2명)</hp:t></hp:tc>
        <hp:tc><hp:cellAddr rowAddr="0" colAddr="1"/><hp:cellSpan rowSpan="1" colSpan="1"/><hp:t>2001</hp:t></hp:tc>
        <hp:tc><hp:cellAddr rowAddr="0" colAddr="2"/><hp:cellSpan rowSpan="1" colSpan="1"/><hp:t>첫학교</hp:t></hp:tc></hp:tr>
        <hp:tr><hp:tc><hp:cellAddr rowAddr="1" colAddr="1"/><hp:cellSpan rowSpan="1" colSpan="1"/><hp:t>2002</hp:t></hp:tc>
        <hp:tc><hp:cellAddr rowAddr="1" colAddr="2"/><hp:cellSpan rowSpan="1" colSpan="1"/><hp:t>둘째학교</hp:t></hp:tc></hp:tr></hp:tbl>''')
        self.assertEqual(table_rows(table)[1],['중학교(2명)','2002','둘째학교'])

    def test_final_student_and_school_awards_stay_separate(self):
        result=json.loads(OUT.read_text(encoding='utf-8'))
        self.assertEqual(result['student_works_checked'],299)
        self.assertEqual(len(result['ambiguous']),2)
        self.assertEqual(sum(r['award_scope']=='student_work' for r in result['records']),18)
        self.assertEqual(sum(r['award_scope']=='school_group' for r in result['records']),1)
        for row in result['records']:
            self.assertNotIn('student_name',row)
            self.assertNotIn('성명',row)
            self.assertNotIn('teacher_name',row)


if __name__=='__main__':unittest.main()
