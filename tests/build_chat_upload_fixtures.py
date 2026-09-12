import io,json,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root.parent/'outputs/collection_upload_20260912/fixtures';out.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(out.parent/'fixture_tools'));sys.path.insert(0,str(root/'scripts/education'))
from parse_chat_attachment import parse
from reportlab.pdfgen.canvas import Canvas
import xlwt
rows=[['학교명','조사값','연도'],['인천석암초등학교',10,2026],['인천신흥초등학교',20,2026],['인천갈월초등학교',30,2026]]
for ext,sep in [('csv',','),('tsv','\t')]: (out/('표.'+ext)).write_text('\n'.join(sep.join(map(str,r)) for r in rows),encoding='utf-8')
(out/'표.json').write_text(json.dumps([dict(zip(rows[0],r)) for r in rows[1:]],ensure_ascii=False),encoding='utf-8')
(out/'표.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','properties':dict(zip(rows[0],r)),'geometry':{'type':'Point','coordinates':[126.6,37.4]}} for r in rows[1:]]},ensure_ascii=False),encoding='utf-8')
for ext in ['txt','md']:(out/('현장.'+ext)).write_text('도서관은 오후 5시까지 개방합니다.\n안전 경로와 대기 학생 수는 아직 확인하지 못했습니다.',encoding='utf-8')
book=xlwt.Workbook();sheet=book.add_sheet('조사표')
for i,row in enumerate(rows):
 for j,v in enumerate(row):sheet.write(i,j,v)
book.save(str(out/'표.xls'))
from openpyxl import Workbook
book=Workbook();book.active.title='조사표'
for row in rows:book.active.append(row)
book.save(out/'표.xlsx')
for ext,file in [('docx','word/document.xml'),('hwpx','Contents/section0.xml')]:
 with zipfile.ZipFile(out/('표.'+ext),'w') as z:
  z.writestr(file,'<root><p><t>도서관은 오후 5시까지 개방합니다. 안전 경로는 아직 미확인입니다.</t></p><tbl>'+''.join('<tr>'+''.join('<tc><p><t>'+str(v)+'</t></p></tc>' for v in row)+'</tr>' for row in rows)+'</tbl></root>')
c=Canvas(str(out/'현장.pdf'));c.drawString(50,780,'Library opens until 5 pm. Route safety unverified.');c.showPage();c.drawString(50,780,'Budget review requires verified eligibility and route.');c.save()
c=Canvas(str(out/'이미지없음.pdf'));c.showPage();c.save()
checks=[]
for file in [out/'표.xls',out/'표.docx',out/'표.hwpx',out/'현장.pdf',root/'data/context_sources/raw/ice_autonomous_school_2026_designation.hwp']:
 d=parse(file.name,file.read_bytes());assert d['tables'] or d['parts'];checks.append({'format':file.suffix,'tables':len(d['tables']),'parts':len(d['parts'])})
try:parse('empty.pdf',(out/'이미지없음.pdf').read_bytes());raise AssertionError('empty PDF accepted')
except ValueError as e:assert 'OCR' in str(e)
(out.parent/'parser-validation.json').write_text(json.dumps({'passed':True,'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS real XLS/HWP, DOCX/HWPX tables, PDF pages, blank PDF rejection')
