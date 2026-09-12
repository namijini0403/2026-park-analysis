"""Use native Word conversion with the packaged render_docx PNG pipeline on Windows.

The selected Windows artifact runtime has no bundled LibreOffice. A fresh hidden
Word instance renders only this generated document; no user's LibreOffice session
or installation is used. Poppler and Python come from the artifact runtime.
"""
import importlib.util,os,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
RUNTIME=Path('C:/Users/Mijin/.cache/codex-runtimes/codex-primary-runtime/dependencies')
SKILL=Path('C:/Users/Mijin/.codex/plugins/cache/openai-primary-runtime/documents/26.904.11930/skills/documents')
poppler=next((RUNTIME/'native/poppler').rglob('pdfinfo.exe')).parent
os.environ['PATH']=str(poppler)+os.pathsep+os.environ.get('PATH','')
spec=importlib.util.spec_from_file_location('document_renderer',SKILL/'render_docx.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def convert(doc_path,user_profile,convert_tmp_dir,stem,verbose):
 pdf=Path(convert_tmp_dir)/(stem+'.pdf')
 proc=subprocess.run(['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(HERE/'render_hitl_word.ps1'),'-DocPath',doc_path,'-PdfPath',str(pdf)],capture_output=True,timeout=600)
 return (str(pdf) if proc.returncode==0 and pdf.exists() else '',proc.stdout.decode('utf-8','replace')+'\n'+proc.stderr.decode('utf-8','replace'))
module.convert_to_pdf=convert
module.main()
