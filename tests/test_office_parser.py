import sys, unittest, io, zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'/'education'))
from parse_office_document import extract
from openpyxl import Workbook

class ParserTests(unittest.TestCase):
    def test_excel_formula_and_zero(self):
        book=Workbook();book.active.append(['학교명','횟수']);book.active.append(['인천학교',0]);book.active.append(['두학교','=1+2'])
        output=io.BytesIO();book.save(output)
        rows=extract('test.xlsx',output.getvalue())['tables'][0]['rows']
        self.assertEqual(rows[1][1],'0');self.assertEqual(rows[2][1],'=1+2')
    def test_word_and_hwpx(self):
        for ext,file in [('docx','word/document.xml'),('hwpx','Contents/section0.xml')]:
            output=io.BytesIO()
            with zipfile.ZipFile(output,'w') as z:z.writestr(file,'<root><tbl><tr><tc><p><t>학교명</t></p></tc><tc><p><t>값</t></p></tc></tr><tr><tc><p><t>인천학교</t></p></tc><tc><p><t>3</t></p></tc></tr></tbl></root>')
            result=extract('test.'+ext,output.getvalue());self.assertEqual(result['tables'][0]['rows'][1],['인천학교','3'])
    def test_hostile_xml(self):
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:z.writestr('word/document.xml','<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><x>&a;</x>')
        with self.assertRaises(Exception):extract('x.docx',output.getvalue())
    def test_bad_and_large(self):
        for name,data in [('x.doc',b'bad'),('x.hwp',b'bad'),('x.txt',b'a'*(15*1024*1024+1))]:
            with self.assertRaises(Exception):extract(name,data)
    def test_csv_korean(self):
        result=extract('x.csv','학교명,값\n인천학교,0'.encode('cp949'))
        self.assertEqual(result['tables'][0]['rows'][1],['인천학교','0'])

if __name__=='__main__':unittest.main()
