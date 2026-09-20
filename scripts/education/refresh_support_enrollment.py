"""Fill missing short-history scenarios without retraining or changing valid forecasts."""
import csv
import hashlib
import html
import json
from collections import Counter
from pathlib import Path

from scripts.education.enrollment_model_v2 import fill_limited_history_scenario

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/support-enrollment-20260919'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    directory = ROOT / 'vercel_public/data_processed/education'
    forecasts = read(directory / 'enrollment_forecasts.json')
    validation = read(directory / 'forecast_validation.json')
    source_hash = hashlib.sha256((directory / 'forecast_validation.json').read_bytes()).hexdigest()
    for result in forecasts.values():
        fill_limited_history_scenario(result)
    analysis = read(directory / 'analysis_dataset.json')
    for school in analysis['schools']:
        result = forecasts.get(school['id'], {})
        school.update(forecast=result.get('forecast', []), forecast_status=result.get('model_status', 'unavailable'),
                      forecast_origin_year=max((r['year'] for r in result.get('history', [])), default=None),
                      forecast_model_version=result.get('model_version'), forecast_limitations=result.get('limitations'))
    for level, coverage in analysis['coverage'].items():
        coverage['forecast'] = sum(bool(s['forecast']) for s in analysis['schools'] if s['level'] == level)
    for directory in [ROOT / 'data_processed/education', ROOT / 'vercel_public/data_processed/education']:
        write(directory / 'enrollment_forecasts.json', forecasts)
        write(directory / 'analysis_dataset.json', analysis)
        bundles = read(directory / 'school_analysis.json')
        for row in bundles:
            if row['학교ID'] in forecasts:
                row['enrollment'] = forecasts[row['학교ID']]
        write(directory / 'school_analysis.json', bundles)
        for filename in ['enrollment_forecasts.json', 'school_analysis.json']:
            analysis['source_hashes'].pop('data_processed\\education\\' + filename, None)
            analysis['source_hashes']['data_processed/education/' + filename] = hashlib.sha256((directory / filename).read_bytes()).hexdigest()
        write(directory / 'analysis_dataset.json', analysis)
        path = directory / 'school_enrollment_forecast_v2.csv'
        if path.exists():
            with path.open(encoding='utf-8-sig', newline='') as stream:
                reader = csv.DictReader(stream); fields = reader.fieldnames; rows = list(reader)
            for row in rows:
                result = forecasts.get(row['학교ID'], {}); future = {r['year']: r['students'] for r in result.get('forecast', [])}
                for year in [2029, 2031]:
                    for prefix in ['forecast', 'predicted']:
                        row[f'{prefix}_{year}'] = future.get(year, '')
                row['selected_model'] = result.get('model_status', 'unavailable')
                row['validation_scheme'] = 'unvalidated_short_history_scenario' if result.get('scenario_method') else 'origin_safe_heldout_target'
            with path.open('w', encoding='utf-8-sig', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    summaries = []
    for level, group in validation.items():
        for summary in group['summary']:
            rows = [r for r in group['rows'] if r['horizon'] == summary['horizon']]
            assert all((r.get('training_max_year') or 0) <= r['origin'] and (r.get('selection_max_year') or 0) <= r['origin'] for r in rows)
            summaries.append(dict(level=level, **summary, naive_mae=sum(abs(r['actual']-r['last_observed']) for r in rows)/len(rows) if rows else None))
    coverage = {level: dict(Counter(s['forecast_status'] for s in analysis['schools'] if s['level'] == level)) for level in analysis['coverage']}
    report = {'as_of_year': 2026, 'target_years': [2029, 2031], 'coverage': coverage,
              'registry_status_counts': dict(Counter(r['model_status'] for r in forecasts.values())),
              'validation': summaries, 'validation_source_sha256': source_hash,
              'fallback_schools': [{'id': s['id'], 'name': s['name'], 'level': s['level'], 'origin': s['forecast_origin_year'], 'forecast': s['forecast']} for s in analysis['schools'] if s['forecast_status'] == 'limited_history_constant_scenario'],
              'stale_origins': [{'id': s['id'], 'name': s['name'], 'origin': s['forecast_origin_year']} for s in analysis['schools'] if s['forecast_origin_year'] != 2026]}
    write(OUT / 'analysis.json', report)
    def number(value): return '미검증' if value is None else f'{value:.4f}'
    lines = ['# 학교 지원: 재학생 수와 3년·5년 뒤 학생 수', '',
             '기준 시점은 2026년, 대상 연도는 2029년·2031년입니다. 기존 902개 추세 모형 결과는 유지했습니다. 앱의 나머지 15개 기관은 관측 이력이 짧아 최근 학생 수를 그대로 유지하는 참고 시나리오를 추가했습니다. 등록 기관 전체는 추세 모형 902개, 단기 이력 시나리오 18개이며 앱 지도 범위는 917개입니다.', '',
             '## 로직과 선택 이유', '',
             '- 기존 모형: origin_safe_residual_v2. 학교급별 연속 관측 3년 이상에 최근 연도 가중 선형 추세(가중치 1~2)를 적용하고, 과거 학생 수·증감·평균·추세 특징으로 LightGBM 잔차를 보정합니다.',
             '- 각 예측 원점 이하의 자료만 사용합니다. 마지막 가용 연도를 내부 검증으로 두고 잔차 가중치 0, 0.25, 0.5, 1 중 MAE가 기본 추세보다 5% 이상 낮을 때만 보정을 적용합니다. 선택 뒤 원점까지 재학습합니다.',
             '- 다년 예측은 재귀 방식입니다. 매년 감소는 직전 값의 65% 이상, 증가는 max(직전 값의 125%, 직전 값+80, 30) 이하로 제한하고 0 미만을 막습니다. 이 제한은 모형 가정이며 예측구간이 아닙니다.',
             '- 결측 보완: 연속 관측 3년 미만이면 최신 관측값을 대상 연도까지 일정하게 유지합니다. 신설 학교의 증원을 추측하지 않습니다. 관측값 자체가 없으면 생성하지 않습니다. 별도 상태 limited_history_constant_scenario로 표시하며 기존 모형 성능에 합산하지 않습니다.',
             '- 기존 모형을 교체하지 않았습니다. 아래 최근값 유지 비교는 진단용 외부 검증 결과이며 같은 평가자료로 재선택하면 낙관 편향이 생깁니다. 더 복잡한 모형이나 단순 모형으로 전면 교체할 독립 다년 검증 근거가 부족합니다.', '',
             '## 검증값', '',
             'MAE는 평균 절대오차(명), WAPE는 절대오차 합/실제 학생 수 합입니다. 동일한 2026년 실제값을 1·3·5년 앞선 원점에서 예측합니다. 학교마다 한 개의 최종연도 검증이며 여러 시점에 걸친 독립 성능 보장은 아닙니다.', '',
             '|학교급|기간|표본 n|기존 모형 MAE|가중 추세 MAE|최근값 유지 MAE|WAPE %|', '|---|---:|---:|---:|---:|---:|---:|']
    for row in summaries:
        lines.append(f"|{row['level']}|{row['horizon']}년|{row['n']}|{number(row['mae'])}|{number(row['baseline_mae'])}|{number(row['naive_mae'])}|{number(row['wape']*100 if row['wape'] is not None else None)}|")
    lines += ['', '## 해석 한계', '', '5년 검증은 학교급별 표본 수를 반드시 확인해야 합니다. n=0이면 5년 정확도를 검증하지 못한 것입니다. 3년 검증에서 잔차 보정 학습 자료가 부족한 원점에는 가중 추세가 사용됩니다. 현재 902개 모두의 잔차 보정 모형이 장기에도 우수하다는 의미는 아닙니다. 짧은 이력 보완 15개는 신설·관측 공백 등의 기관으로 기존 안정 학교 검증 성능을 그대로 적용할 수 없습니다.', '',
              '2025년이 마지막 관측인 인천삼목초등학교장봉분교장(B000003000)은 2029·2031년 값이 관측 기준 4·6년 뒤입니다. 앱의 3·5년 표기는 2026년 현재 시점 기준이며 실제 관측 기준 기간과 구분해야 합니다. 학교 통폐합, 학구 변화, 입주, 전입·전출을 직접 모델링하지 않으며 학교 지원 우선순위를 자동 결정하지 않습니다.', '',
              '## 출처와 재현', '',
              '- 관측·예측: data_processed/education/enrollment_forecasts.json',
              '- 기존 검증 원자료: data_processed/education/forecast_validation.json (SHA-256: '+source_hash+')',
              '- 생성 로직: scripts/education/enrollment_model_v2.py',
              '- 보완 및 보고서 재현: python -m scripts.education.refresh_support_enrollment',
              '- 시계열 검증 원칙: https://otexts.com/fpp3/tscv.html',
              '- 최근값 유지 기준모형: https://otexts.com/fpp3/simple-methods.html']
    lines.insert(lines.index('## 해석 한계') + 2, '최근값 유지와 비교하면 3년 오차는 유치원·중학교·고등학교에서 기존 모형이 더 큽니다. 초등학교는 기존 모형이 더 작습니다. 따라서 기존 모형을 최적 모형이라고 부르지 않으며 유·중·고 장기 수치는 특히 보수적으로 해석해야 합니다.')
    markdown = '\n'.join(lines)
    (OUT / 'analysis_report.md').write_text(markdown, encoding='utf-8')
    paragraphs = []
    table = False
    for line in lines:
        if line.startswith('|'):
            if line.startswith('|---'): continue
            if not table: paragraphs.append('<div class="scroll"><table>'); table = True
            paragraphs.append('<tr>'+''.join('<td>'+html.escape(cell)+'</td>' for cell in line.strip('|').split('|'))+'</tr>'); continue
        if table: paragraphs.append('</table></div>'); table = False
        if line.startswith('# '): paragraphs.append('<h1>'+html.escape(line[2:])+'</h1>')
        elif line.startswith('## '): paragraphs.append('<h2>'+html.escape(line[3:])+'</h2>')
        elif line: paragraphs.append('<p>'+html.escape(line)+'</p>')
    if table: paragraphs.append('</table></div>')
    document = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>학교 학생 수 예측 · 로직과 검증</title><style>body{font-family:system-ui,sans-serif;background:#eef3f5;color:#153443;margin:0;padding:24px}main{max-width:1060px;margin:auto;background:white;padding:clamp(18px,4vw,46px);border-radius:18px}h1{font-size:clamp(24px,4vw,36px)}p{line-height:1.8;overflow-wrap:anywhere}h2{margin-top:36px}.scroll{overflow:auto}table{border-collapse:collapse;white-space:nowrap;width:100%}td{border-bottom:1px solid #ccd7dc;padding:12px;text-align:right}tr:first-child{background:#e0f3ee;font-weight:bold}a{color:#086d62}</style><main><a href="/">반경 너머 앱</a> · <a href="analysis.json">정확한 값 JSON</a> · <a href="analysis_report.md">보고서 다운로드</a>'+''.join(paragraphs)+'</main></html>'
    (OUT / 'index.html').write_text(document, encoding='utf-8')
    print(json.dumps({'coverage': coverage, 'report': str(OUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
