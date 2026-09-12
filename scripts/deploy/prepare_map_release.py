"""Package the tested map UI using the existing production Docker layout.

Only allowlisted application files are copied; no runtime store or credentials.
Deploy this package with --no-gitignore because outputs/ is locally ignored.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
out = ROOT / 'outputs' / 'map-first-20260912'
out.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'update-center.html', 'office-documents.html']:
    shutil.copy2(ROOT / name, ROOT / 'vercel_public' / name)
shutil.copytree(ROOT / 'assets', ROOT / 'vercel_public/assets', dirs_exist_ok=True)
for name in ['api', 'assets', 'modules', 'vercel_public', 'refresh_seed', 'rag']:
    shutil.copytree(ROOT / name, out / name, dirs_exist_ok=True)
shutil.copytree(ROOT / 'outputs/robust_xai', out / 'outputs/robust_xai', dirs_exist_ok=True)
for name in ['update_center', 'education', 'reading_module', 'policy_cards', 'context']:
    shutil.copytree(ROOT / 'scripts' / name, out / 'scripts' / name,
                    dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
shutil.copy2(ROOT / 'scripts/validate_module_contract.mjs', out / 'scripts/validate_module_contract.mjs')
for name in ['server.js', 'package.json', 'package-lock.json', 'data_sources.yaml',
             'index.html', 'update-center.html', 'office-documents.html', 'requirements.txt']:
    shutil.copy2(ROOT / name, out / name)
(out / 'Dockerfile').write_text('''FROM node:22-bookworm-slim
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
''', encoding='utf-8')
(out / '.dockerignore').write_text('node_modules\n.env\n.env.*\n__pycache__\n', encoding='utf-8')
(out / 'railway.json').write_text(json.dumps({
    'build': {'builder': 'DOCKERFILE', 'dockerfilePath': 'Dockerfile'},
    'deploy': {'startCommand': 'node server.js', 'healthcheckPath': '/api/school-summary',
               'healthcheckTimeout': 120, 'restartPolicyType': 'ON_FAILURE'}
}), encoding='utf-8')
files = [p for p in out.rglob('*') if p.is_file()]
assert not any(p.name == '.env' or p.name.startswith('.env.') for p in files)
assert not (out / 'data/update_center').exists()
assert (out / 'rag/policy-guide.md').is_file()
print(json.dumps({'package': str(out), 'files': len(files), 'bytes': sum(p.stat().st_size for p in files)}))
