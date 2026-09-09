"""Observed resident ages and explicit no-migration cohort scenarios, not enrollment forecasts."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'data/education_sources/regional_age_observations.json'
OUT = ROOT / 'data_processed/education/regional_demography.json'
BANDS = {'유치원': (3, 5), '초등학교': (6, 11), '중학교': (12, 14), '고등학교': (15, 17)}


def extract(raw_dir):
    records, sources = [], []
    for year in range(2014, 2026):
        path = raw_dir / f'{year}12_{year}12_연령별인구현황_연간.csv'
        frame = pd.read_csv(path, encoding='cp949', dtype=str)
        sources.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        for _, row in frame.iterrows():
            match = re.search(r'\((28\d{3}00000)\)', row.iloc[0])
            if not match:
                continue
            code = match[1]
            label = row.iloc[0].split('(')[0].strip().split()[-1]
            values = {}
            for age in range(21):
                column = f'{year}년_계_{age}세'
                value = row[column]
                values[str(age)] = int(value.replace(',', '')) if isinstance(value, str) and value.replace(',', '').isdigit() else None
            records.append({'year': year, 'region_code': code, 'region_name': label, 'ages': values})
    SOURCE.write_text(json.dumps({'source_url': 'https://jumin.mois.go.kr/ageStatMonth.do', 'reference_month': 12,
                                 'sources': sources, 'records': records}, ensure_ascii=False, indent=2), encoding='utf-8')


def band_sum(ages, start, end):
    values = [ages.get(str(age)) for age in range(start, end + 1)]
    return sum(values) if all(v is not None for v in values) else None


def build(source):
    output = {}
    for code in sorted({r['region_code'] for r in source['records']}):
        rows = sorted([r for r in source['records'] if r['region_code'] == code], key=lambda r: r['year'])
        latest = rows[-1]
        if latest['year'] != max(r['year'] for r in source['records']) or not latest['region_name'].endswith(('구', '군', '광역시')):
            continue
        for level, (start, end) in BANDS.items():
            output[f"{latest['region_name']}|{level}"] = {
                'region_code': code, 'region_name': latest['region_name'], 'age_band': [start, end],
                'history': [{'year': r['year'], 'residents': band_sum(r['ages'], start, end)} for r in rows],
                'cohort_scenario': [{'year': latest['year'] + step, 'residents': band_sum(latest['ages'], start-step, end-step)}
                                    for step in range(1, min(start, 5)+1)],
                'source_url': source['source_url'], 'base_year': latest['year'],
                'scope': '구·군 주민등록 해당 연령 인구. 학교 재학생·생활권 인구와 다름.',
                'scenario_assumption': '기준연도 코호트가 그대로 나이를 먹는 경우. 출생·사망·전입·전출 미반영. 예측값이 아닌 무이동 시나리오.',
                'boundary_note': '기준연도 행정구역별 비교. 2026년 신설·분할 구는 기존 구 수치를 자동 전용하지 않음.'}
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw-dir', type=Path, help='Optional original annual MOIS CSV directory; omit to reuse normalized source snapshot.')
    args = parser.parse_args()
    if args.raw_dir:
        extract(args.raw_dir)
    result = build(json.loads(SOURCE.read_text(encoding='utf-8')))
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Regional school-age contexts: {len(result)}')


if __name__ == '__main__':
    main()
