"""Small, year-specific public-disclosure table for exploratory correlations."""
import hashlib
import json
import csv
from pathlib import Path

from scripts.education.build_public_indicators import number

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed/education'


def summarize(rows, year):
    def latest(item):
        selected = [r for r in rows if r['item'] == item and r['year'] == year]
        depth = max((int(r.get('depth') or 0) for r in selected), default=0)
        selected = [r for r in selected if int(r.get('depth') or 0) == depth]
        return selected[0] if len(selected) == 1 else None

    def value(row, key):
        if not row or row['values'].get('PBAN_EXCP_YN', 'N') != 'N':
            return None
        return number(row['values'].get(key))

    student, teacher, kg, kgteacher = map(latest, ['09', '22', 'KG05', 'KG06'])
    result = {'students': value(student, 'COL_S_SUM'), 'classes': value(student, 'COL_C_SUM'),
              'teachers': value(student, 'TEACH_CNT'), 'staff': value(teacher, 'COL_S'),
              'class_size': value(student, 'COL_SUM')}
    if kg:
        children = [value(kg, k) for k in ['만3세원아수', '만4세원아수', '만5세원아수', '혼합원아수', '특수원아수']]
        classes = [value(kg, k) for k in ['만3세학급수', '만4세학급수', '만5세학급수', '혼합학급수', '특수학급수']]
        result['students'] = sum(children) if all(v is not None for v in children) else None
        result['classes'] = sum(classes) if all(v is not None for v in classes) else None
        result['class_size'] = result['students'] / result['classes'] if result['students'] is not None and result['classes'] else None
        # Kindergarten's general teachers are a distinct disclosed category.
        result['kg_teachers'] = value(kgteacher, '일반 교사수')
    result['sources'] = [{'item': r['item'], 'year': r['year'], 'depth': r['depth'],
                          'file': r['source_file'], 'url': r['source_url']}
                         for r in [student, teacher, kg, kgteacher] if r]
    return result


def main():
    indicators = json.loads((DATA / 'school_public_indicators.json').read_text(encoding='utf-8'))['schools']
    schools, hashes = {}, {}
    years = sorted({r['year'] for file in (DATA/'disclosures').glob('*.json') for r in json.loads(file.read_text(encoding='utf-8')) if r.get('year',0)>=2025})
    with (DATA / 'institutions.csv').open(encoding='utf-8-sig', newline='') as source:
        registry_ids = {r['학교ID'] for r in csv.DictReader(source)}
    for file in sorted((DATA / 'disclosures').glob('*.json')):
        if file.stem not in registry_ids:
            continue
        rows = json.loads(file.read_text(encoding='utf-8'))
        schools[file.stem] = {}
        hashes[file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
        for year in years:
            result = summarize(rows, year)
            result.update(paps=None, afterschool=None, clubs=None)
            for group in indicators.get(file.stem, []):
                for obs in group['observations']:
                    if obs['publication_year'] != year or obs['status'] not in ['available', 'partial_observations']:
                        continue
                    fields = {m['field']: m['value'] for m in obs['metrics']}
                    for key, field in [('paps', 'derived_grade45_pct'), ('afterschool', 'ASL_PTPT_STDNT_FGR'), ('clubs', 'STDNT_SLCTL_FGR')]:
                        if field in fields:
                            result[key] = fields[field]
                    result['sources'].append({'item': group['item'], 'year': year, 'files': obs['source_files'], 'url': obs['source_url']})
            schools[file.stem][str(year)] = result
    payload = {'years': years, 'schools': schools,
               'source_hashes': hashes, 'indicator_hash': hashlib.sha256((DATA / 'school_public_indicators.json').read_bytes()).hexdigest()}
    (DATA / 'school_statistics.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print(f'Statistics table: {len(schools)} institutions, 2025/2026 observations')


if __name__ == '__main__':
    main()
