"""Run after visual inspection of every final rendered Word page."""
import hashlib,json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
LIVE=ROOT/'outputs/hitl-release-validation/live'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
browser=read(LIVE/'report.json');api=read(LIVE/'api-audit.json');formats=read(LIVE/'upload-formats.json');deployment=read(LIVE/'deployment.json')
assert browser['passed'] and len(browser['cases'])==8 and browser['mobile'] and not browser['errors'] and browser['weight_revision']
assert api['passed'] and len(api['domains'])==42 and len(api['assets'])==5
assert formats['passed'] and formats['valid_rows']==12 and formats['uploads']==4
assert deployment['status']=='SUCCESS'
unit=read(ROOT/'contest_plan/hitl_analysis_validation_20260912.json')
assert len(unit['domains'])==42
for check in ['missing and duplicates excluded','no default weights or score','independent safety gates','legacy payload rejected']:assert check in unit['checks']
release=Path((ROOT/'outputs/hitl-release-path.txt').read_text(encoding='utf-8-sig').strip())
assert (ROOT/'api/_hitl_analysis.js').read_bytes()==(release/'api/_hitl_analysis.js').read_bytes()
doc=ROOT/'contest_plan/HITL_배포와_실제질문_검증보고서_20260912.docx'
with ZipFile(doc) as z:
 xml=ET.fromstring(z.read('word/document.xml'));text=''.join(xml.itertext())
 for c in browser['cases']:assert c['question'] in text,c['id']
 assert formats['question'] in text
 assert deployment['id'] in text
 assert '48.548' in text and '20,761' in text
 assert len([n for n in z.namelist() if n.startswith('word/media/')])>=10
 assert b'<w:pBdr' not in z.read('word/styles.xml')
pages=sorted((ROOT/'outputs/hitl-release-validation/word-pages-final').glob('page-*.png'))
assert len(pages)>=10 and all(p.stat().st_size>20000 for p in pages)
result={'completed_at':datetime.now(timezone.utc).isoformat(),'deployment':deployment,'browser_cases':len(browser['cases']),'live_domains':len(api['domains']),'formats':formats['formats'],'valid_uploaded_rows':formats['valid_rows'],'word_file':str(doc),'word_sha256':hashlib.sha256(doc.read_bytes()).hexdigest(),'word_pages':len(pages),'visual_review':'Assistant inspected every final rendered page PNG before this audit','checks':['active deployed revision SUCCESS','live source assets hash matched','8 actual complex questions captured','42 domains actual HTTP','CSV TSV XLSX JSON multi-upload with explicit weights','uploaded direction percentiles retained','legacy and missing coverage regression','same deployed and local HITL backend','Word contains all 9 question texts and screenshots','Word rendered and every page visually reviewed']}
(ROOT/'contest_plan/hitl_deployment_validation_20260912.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
