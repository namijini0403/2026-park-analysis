"""Compare deployed public artifacts with the allowlisted release package."""
import concurrent.futures
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'outputs/education-auto-refresh-20260911/vercel_public'
BASE = 'https://education-living-area-preview-production.up.railway.app/'
PATHS = ['index.html', 'office-documents.html', 'assets/method-review.html',
         'assets/method-review-page.js', 'assets/education-layers.js',
         'data_processed/candidate_grid_final.geojson', 'ui-preview/dist/index.html']
PATHS += ['data_processed/education/' + name for name in [
    'route_review.json', 'candidate_demand_v2.json', 'enrollment_forecasts.json',
    'forecast_validation.json', 'grade_cohort_scenarios.json',
    'school_enrollment_forecast_v2.csv', 'school_analysis.json']]
PATHS += ['ui-preview/dist/' + path.removeprefix('./') for path in
          re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"',
                     (PUBLIC / 'ui-preview/dist/index.html').read_text(encoding='utf-8'))]

def check(name):
    expected = hashlib.sha256((PUBLIC / name).read_bytes()).hexdigest()
    try:
        with urllib.request.urlopen(BASE + name, timeout=45) as response:
            payload = response.read()
            actual = hashlib.sha256(payload).hexdigest()
            if name.endswith('/school_analysis.json'):
                forecasts = json.loads((PUBLIC / 'data_processed/education/enrollment_forecasts.json').read_text(encoding='utf-8'))
                rows = json.loads(payload)
                checked = [row for row in rows if row['학교ID'] in forecasts]
                valid = bool(checked) and all(row.get('enrollment') == forecasts[row['학교ID']] for row in checked)
                return dict(path=name, status=response.status, bytes=len(payload), sha256=actual,
                            matches_release=valid, verification='embedded enrollment equals release; persisted context retained',
                            checked_schools=len(checked))
            return dict(path=name, status=response.status, bytes=len(payload),
                        sha256=actual, matches_release=actual == expected)
    except Exception as exc:
        return dict(path=name, matches_release=False, error=str(exc))

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(check, PATHS))
    report = dict(deployment_id=sys.argv[1], files=rows,
                  passed=all(row['matches_release'] for row in rows))
    target = ROOT / 'contest_plan/method_update_live_validation_20260911.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    sys.exit(0 if report['passed'] else 1)
