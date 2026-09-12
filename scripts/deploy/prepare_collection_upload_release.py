"""Overlay this task's allowlist onto the last verified production release."""
from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).resolve().parents[2];work=root.parent/'outputs/collection_upload_20260912';release=work/'release'
files=['index.html','server.js','requirements.txt','api/chat.js','api/chat-upload.js','api/_collection_plan.js','api/_document_evidence.js','api/_source_provenance.js','scripts/education/parse_chat_attachment.py','assets/chat-upload.js','assets/attachment-reader.js','assets/attachment-support.css','assets/collection-assistant.js','assets/chat-workspace.js','assets/simple-app.js','assets/hitl-analysis.js']
if not release.exists():shutil.copytree(root.parent/'outputs/policy_guide_20260912/release',release)
manifest={}
for f in files:
 p=root/f;dest=release/f;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 if f=='index.html' or f.startswith('assets/'):
  public=release/'vercel_public'/f;public.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,public)
 manifest[f]=hashlib.sha256(p.read_bytes()).hexdigest()
(work/'release-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Prepared isolated release:',len(files),'allowlisted files')
