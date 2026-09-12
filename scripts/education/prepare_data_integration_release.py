"""Refresh only changed web artifacts and create a clean allowlisted deployment.
The existing React build is unchanged by this release and is reused.
"""
import json, shutil, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
public=ROOT/'vercel_public'
for name in ['index.html','update-center.html','office-documents.html']:
    shutil.copy2(ROOT/name,public/name)
for name in ['school-zones.js','office-documents.js','data-refresh.js']:
    shutil.copy2(ROOT/'assets'/name,public/'assets'/name)
shutil.copy2(ROOT/'data_processed/education/school_zones.geojson',public/'data_processed/education/school_zones.geojson')
out=ROOT/'outputs/education-auto-refresh-20260911'
out.mkdir(exist_ok=True)
for name in ['api','assets','modules','vercel_public','refresh_seed']:
    shutil.copytree(ROOT/name,out/name,dirs_exist_ok=True)
shutil.copytree(ROOT/'outputs/robust_xai',out/'outputs/robust_xai',dirs_exist_ok=True)
for name in ['update_center','education','reading_module','policy_cards']:
    shutil.copytree(ROOT/'scripts'/name,out/'scripts'/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
for name in ['validate_module_contract.mjs']:
    shutil.copy2(ROOT/'scripts'/name,out/'scripts'/name)
for name in ['server.js','package.json','package-lock.json','data_sources.yaml','index.html','update-center.html','office-documents.html','requirements.txt']:
    shutil.copy2(ROOT/name,out/name)
(out/'Dockerfile').write_text('''FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH"
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN ln -s vercel_public/data_processed data_processed
ENV NODE_ENV=production
CMD ["node", "server.js"]
''',encoding='utf-8')
(out/'.dockerignore').write_text('node_modules\n.env\n__pycache__\n',encoding='utf-8')
(out/'railway.json').write_text(json.dumps({'build':{'builder':'DOCKERFILE','dockerfilePath':'Dockerfile'},'deploy':{'startCommand':'node server.js','healthcheckPath':'/office-documents.html','healthcheckTimeout':120,'restartPolicyType':'ON_FAILURE'}}),encoding='utf-8')
subprocess.run(['node','-e',"require('./api/analysis.js');require('./api/ai-explainer-v2.js');require('./api/update-center.js');console.log('Deployment server modules load successfully')"],cwd=out,check=True)
print(json.dumps({'package':str(out),'files':sum(p.is_file() for p in out.rglob('*'))}))
