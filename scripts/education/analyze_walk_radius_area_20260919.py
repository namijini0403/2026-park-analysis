"""Reproducible 500 m network-footprint / circle comparison; no policy scores."""
import csv
import hashlib
import html
import json
import math
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/walk-radius-area-20260919'
OUT.mkdir(parents=True, exist_ok=True)
LEVELS = ['유치원', '초등학교', '중학교', '고등학교']
RADIUS = 500
CIRCLE = math.pi * RADIUS ** 2
FILES = ['data_processed/education/analysis_dataset.json',
         'data_processed/education/walkshed_500m.geojson',
         'data_processed/school_walkshed_500m_v3.geojson',
         'data_processed/schools.csv', 'data_processed/education/institutions.csv',
         'data_processed/school_buffer_500m.geojson',
         'data_processed/education/school_buffer_500m.geojson',
         'scripts/accessibility/build_walkshed_500m_v3.py']
def read(rel):
    return json.loads((ROOT / rel).read_text(encoding='utf-8'))
def sha(rel):
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
registry = read(FILES[0])['schools']
assert len({s['id'] for s in registry}) == len(registry)
project = Transformer.from_crs(4326, 5179, always_xy=True).transform
coordinates, registered = {}, {}
for rel in [FILES[4], FILES[3]]:
    with (ROOT / rel).open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            coordinates[row['학교ID']] = (float(row['경도']), float(row['위도']))
            if rel == FILES[4]:
                registered[row['학교ID']] = {'id':row['학교ID'],'name':row['학교명'],'level':row['학교급구분']}
walks, sources, properties = {}, {}, {}
for rel in FILES[1:3]:
    data = read(rel)
    crs = data.get('crs', {}).get('properties', {}).get('name', 'EPSG:4326')
    to_metric = Transformer.from_crs(crs, 5179, always_xy=True).transform
    for feature in data['features']:
        p = feature['properties']; sid = p['학교ID']
        assert sid not in walks, 'Duplicate walking geometry: ' + sid
        geom = transform(to_metric, shape(feature['geometry']))
        assert geom.is_valid and not geom.is_empty and geom.area > 0, sid
        walks[sid], sources[sid], properties[sid] = geom, rel, p
circles, stored_circles = {}, {}
for rel in FILES[5:7]:
    data = read(rel)
    crs = data.get('crs', {}).get('properties', {}).get('name', 'EPSG:4326')
    to_metric = Transformer.from_crs(crs, 5179, always_xy=True).transform
    for feature in data['features']:
        stored_circles[feature['properties']['학교ID']] = transform(to_metric, shape(feature['geometry']))
rows = []
for s in registry:
    sid = s['id']
    assert sid in walks and sid in coordinates and sid in stored_circles, sid
    center = transform(project, Point(*coordinates[sid]))
    # Fine polygon approximation only for spatial overlap and union, not the primary denominator.
    circle = center.buffer(RADIUS, quad_segs=256)
    circles[sid] = circle
    w = walks[sid]; area = w.area; p = properties[sid]
    outside = w.difference(circle).area
    rows.append(dict(id=sid, name=s['name'], level=s['level'], gu=s.get('gu'),
                     track='강화·옹진 별도' if s.get('gu') in ['강화군','옹진군'] else '그 외 지역',
                     walk_m2=area, circle_m2=CIRCLE, difference_m2=CIRCLE-area,
                     retained_pct=100*area/CIRCLE, reduction_pct=100*(CIRCLE-area)/CIRCLE,
                     stored_walk_m2=p['area_m2'], property_error_m2=area-p['area_m2'],
                     stored_circle_m2=stored_circles[sid].area,
                     circle_outside_walk_m2=circle.difference(w).area,
                     walk_outside_circle_m2=outside,
                     offset_m=p.get('offset_m'), method=p.get('method'), source=sources[sid]))
assert len(rows) == 917
assert {level:sum(r['level']==level for r in rows) for level in LEVELS} == dict(zip(LEVELS,[369,272,147,129]))
assert max(abs(r['property_error_m2']) for r in rows) <= .51
missing_schools = [s for sid,s in registered.items() if sid not in walks]
assert len(registered)==920 and len(missing_schools)==3
assert {r['level'] for r in rows} == set(LEVELS)
assert all(0 < r['walk_m2'] < CIRCLE for r in rows)

def summarize(label, subset):
    vals = np.array([r['walk_m2'] for r in subset]); n = len(vals)
    return dict(group=label, n=n, circle_each_m2=CIRCLE,
                walk_mean_m2=float(vals.mean()), difference_mean_m2=CIRCLE-float(vals.mean()),
                retained_pct=100*float(vals.mean())/CIRCLE, reduction_pct=100*(1-float(vals.mean())/CIRCLE),
                walk_median_m2=float(np.median(vals)), walk_p25_m2=float(np.quantile(vals,.25)),
                walk_p75_m2=float(np.quantile(vals,.75)), walk_min_m2=float(vals.min()), walk_max_m2=float(vals.max()),
                walk_sum_m2=float(vals.sum()), circle_sum_m2=n*CIRCLE, difference_sum_m2=n*CIRCLE-float(vals.sum()),
                stored_walk_sum_m2=sum(r['stored_walk_m2'] for r in subset))
summaries = [summarize(level,[r for r in rows if r['level']==level]) for level in LEVELS] + [summarize('전체', rows)]
for s in summaries:
    s['missing'] = sum(s['group']=='전체' or r['level']==s['group'] for r in missing_schools)
    s['registered_n'] = s['n']+s['missing']
tracks = [summarize(level+' · '+track,[r for r in rows if (level=='전체' or r['level']==level) and r['track']==track])
          for level in LEVELS+['전체'] for track in ['그 외 지역','강화·옹진 별도']]
unions = []
for level in LEVELS+['전체']:
    ids = [r['id'] for r in rows if level=='전체' or r['level']==level]
    w, c = unary_union([walks[i] for i in ids]), unary_union([circles[i] for i in ids])
    unions.append(dict(group=level,n=len(ids),walk_union_m2=w.area,circle_union_m2=c.area,
                       difference_m2=c.area-w.area,reduction_pct=100*(1-w.area/c.area),
                       circle_without_walk_m2=c.difference(w).area,walk_outside_circle_m2=w.difference(c).area))
assert math.isclose(sum(x['walk_sum_m2'] for x in summaries[:-1]),summaries[-1]['walk_sum_m2'],abs_tol=1e-6)
result = dict(created_at=datetime.now(timezone.utc).isoformat(),metric_crs='EPSG:5179',radius_m=RADIUS,
              circle_definition='pi * 500^2; overlap/union use 1024-sided circle approximation',
              union_circle_approximation_error_pct=100*(1-circles[rows[0]['id']].area/CIRCLE),
              sources={f:sha(f) for f in FILES},summary=summaries,regional_comparison=tracks,union=unions,missing_schools=missing_schools,
              validation=dict(count=len(rows),registered_count=len(registered),missing_walkshed_count=len(missing_schools),invalid_geometry=0,
                  max_abs_property_error_m2=max(abs(r['property_error_m2']) for r in rows),
                  walk_outside_500m_count=sum(r['walk_outside_circle_m2']>1 for r in rows),
                  walk_outside_500m_sum_m2=sum(r['walk_outside_circle_m2'] for r in rows),
                  offset_over_150m_count=sum((r['offset_m'] or 0)>150 for r in rows),
                  offset_max_m=max(r['offset_m'] for r in rows),
                  stored_circle_mean_m2=float(np.mean([r['stored_circle_m2'] for r in rows]))),schools=rows)
(OUT/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')

font = Path('C:/Windows/Fonts/malgun.ttf')
font_manager.fontManager.addfont(str(font))
plt.rcParams.update({'font.family':font_manager.FontProperties(fname=font).get_name(),'axes.unicode_minus':False,
                     'font.size':11,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
colors = ['#138477','#2d6baf','#7556a8','#c58028','#223d48']
fig, ax = plt.subplots(figsize=(13.5,7.6),facecolor='#fafbf8')
ax.set_facecolor('#fafbf8')
y = np.arange(5); means=np.array([s['walk_mean_m2']/1e6 for s in summaries])
ax.barh(y, [CIRCLE/1e6]*5,color='#e2e6e1',height=.52,label='직선 반경 500m 원')
ax.barh(y, means,color=colors,height=.52,label='보행망 500m 도달권')
for i,s in enumerate(summaries):
    ax.text(means[i]+.009,i,f"{s['walk_mean_m2']/1e6:.4f} km²  /  {s['retained_pct']:.2f}%",va='center',fontsize=11,fontweight='bold',color=colors[i])
    ax.text(.92,i,f"{s['reduction_pct']:.2f}% 작음",va='center',fontsize=12,fontweight='bold',color=colors[i])
ax.set_yticks(y,[f"{s['group']}  {s['n']:,}곳" for s in summaries]);ax.invert_yaxis()
ax.set_xlim(0,1.1);ax.set_xticks(np.arange(0,.81,.1));ax.set_xlabel('학교·유치원 1곳당 평균 면적 (km²)')
ax.grid(axis='x',color='#dfe5df',alpha=.6);ax.set_axisbelow(True)
ax.axvline(CIRCLE/1e6,color='#939d98',linestyle='--',linewidth=1)
ax.text(CIRCLE/1e6,-.6,'직선 반경 500m = 0.785398 km²',ha='center',fontsize=10,color='#526258')
fig.suptitle('보행망 도달권은 직선 반경보다 얼마나 좁은가',x=.14,y=.98,ha='left',fontsize=22,fontweight='bold')
fig.text(.14,.90,'인천 유·초·중·고 917곳 · 학교별 도달권을 동일한 투영좌표계(EPSG:5179)로 재계산',fontsize=11,color='#536057')
fig.text(.125,.035,'등록부 920곳 중 도달권 확보 917곳(초등 3곳 미확보 제외). 전체는 학교별 평균이며 합집합과 다릅니다.\n보행망 모델의 면적 비교입니다. 실제 출입구·안전한 통행을 검증한 면적이 아닙니다.',fontsize=10,color='#536057')
fig.subplots_adjust(left=.14,right=.99,bottom=.16,top=.79)
for ext in ['png','svg']:fig.savefig(OUT/f'area_comparison.{ext}',dpi=200,bbox_inches='tight')
plt.close(fig)

fig, axs=plt.subplots(1,2,figsize=(14,6.7),facecolor='#fafbf8',gridspec_kw={'width_ratios':[1.15,1]})
for a in axs:a.set_facecolor('#fafbf8')
for i,level in enumerate(LEVELS):
    v=np.array([r['retained_pct'] for r in rows if r['level']==level])
    axs[0].boxplot([v],positions=[i],vert=False,widths=.5,patch_artist=True,
                   boxprops=dict(facecolor=colors[i],alpha=.35),medianprops=dict(color=colors[i],linewidth=2),
                   flierprops=dict(marker='o',markersize=3,markerfacecolor=colors[i],markeredgecolor='none'))
axs[0].set_yticks(range(4),LEVELS);axs[0].invert_yaxis();axs[0].set_xlim(0,100)
axs[0].set_xlabel('직선 원 대비 도달권 면적 비율 (%)');axs[0].set_title('학교급 안에서도 차이가 큽니다',loc='left',fontsize=15,pad=18)
axs[0].grid(axis='x',alpha=.2)
for j,track in enumerate(['그 외 지역','강화·옹진 별도']):
    values=[next(s for s in tracks if s['group']==l+' · '+track)['retained_pct'] for l in LEVELS]
    bars=axs[1].bar(np.arange(4)+(j-.5)*.34,values,width=.32,color=['#148578','#bc8b4d'][j],label=track)
    axs[1].bar_label(bars,fmt='%.1f%%',fontsize=9,padding=3)
axs[1].set_xticks(range(4),LEVELS);axs[1].set_ylim(0,75);axs[1].set_ylabel('직선 원 대비 평균 면적 비율 (%)')
axs[1].set_title('강화·옹진은 따로 살펴봅니다',loc='left',fontsize=15,pad=18);axs[1].legend(frameon=False,loc='upper right');axs[1].grid(axis='y',alpha=.2)
fig.suptitle('평균 뒤에 있는 분포와 지역 차이',x=.08,ha='left',fontsize=21,fontweight='bold')
fig.text(.08,.03,'상자: 25~75백분위 · 선: 중앙값 · 점: 1.5×IQR 밖 관측. 작은 도달권을 시설 부족·안전 취약으로 단정하지 않습니다.\n강화·옹진 구분은 행정구역 기준으로, 모든 학교가 지리적 섬에 위치한다는 의미는 아닙니다.',fontsize=10,color='#536057')
fig.subplots_adjust(left=.08,right=.98,bottom=.22,top=.82,wspace=.28)
for ext in ['png','svg']:fig.savefig(OUT/f'distribution_region.{ext}',dpi=200,bbox_inches='tight')
plt.close(fig)

def md_table(headers, data):
    return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+['| '+' | '.join(map(str,row))+' |' for row in data])
main_rows=[[s['group'],s['n'],f"{s['walk_mean_m2']:,.2f}",f"{s['difference_mean_m2']:,.2f}",f"{s['retained_pct']:.4f}",f"{s['reduction_pct']:.4f}"] for s in summaries]
sum_rows=[[s['group'],f"{s['circle_sum_m2']/1e6:.6f}",f"{s['walk_sum_m2']/1e6:.6f}",f"{s['difference_sum_m2']/1e6:.6f}"] for s in summaries]
union_rows=[[s['group'],f"{s['circle_union_m2']/1e6:.6f}",f"{s['walk_union_m2']/1e6:.6f}",f"{s['difference_m2']/1e6:.6f}",f"{s['reduction_pct']:.4f}"] for s in unions]
regional_rows=[[s['group'],s['n'],f"{s['walk_mean_m2']:,.2f}",f"{s['retained_pct']:.4f}",f"{s['reduction_pct']:.4f}"] for s in tracks]
overall=summaries[-1];v=result['validation']
text=f'''# 인천 학교급별 보행망 500m 도달권과 직선 반경 500m 면적 비교

분석일: 2026-09-19. 보유 등록부 920곳 중 도달권이 확보된 유·초·중·고 917곳을 분석했습니다. 인천윤슬초등학교·인천검단호수초등학교·인천달빛초등학교 3곳은 도달권 미확보로 제외하며 0으로 처리하지 않았습니다. 초등학교는 등록 275곳 중 272곳입니다. 보유 등록부가 인천 전체 현존 기관의 완전한 공식 목록임을 보증하지 않습니다.

전체 1곳당 도달권 평균은 **{overall['walk_mean_m2']:,.2f}㎡**입니다. 반경 500m 원의 **{overall['retained_pct']:.4f}%**이고, 평균 **{overall['difference_mean_m2']:,.2f}㎡ ({overall['reduction_pct']:.4f}%) 작습니다**.

## 학교급별 1곳당 평균

정확한 이론상 원 면적은 π × 500² = **{CIRCLE:,.9f}㎡**입니다. 아래 비율은 같은 분모를 사용합니다.

{md_table(['학교급','기관 수','도달권 평균(㎡)','평균 면적 차이(㎡)','원 대비 비율(%)','원 대비 감소율(%)'],main_rows)}

![학교급별 평균 면적](area_comparison.png)

## 학교별 면적 합계

학교마다 면적을 더한 값입니다. 학교 사이에 겹치는 공간은 여러 번 집계되므로 실제 도시의 토지 면적과 다릅니다. 전체 평균은 학교 수로 가중한 평균이며 학교급 평균 4개의 단순평균이 아닙니다.

{md_table(['학교급','원 면적 합계(km²)','도달권 합계(km²)','합계 차이(km²)'],sum_rows)}

## 겹침을 제거한 합집합 면적

같은 학교급의 겹치는 공간을 한 번만 계산했습니다. 전체 행은 학교급 간 겹침도 제거하므로 네 학교급 합계와 다릅니다. 합집합의 원은 1,024각형으로 근사했으며 개별 원의 이론 면적 대비 오차는 {result['union_circle_approximation_error_pct']:.6f}%입니다. 이 표는 네트워크 면과 반경 원의 총 크기 차이이며, 특정 토지의 접근 불가 판정이 아닙니다.

{md_table(['학교급','원 합집합(km²)','도달권 합집합(km²)','면적 차이(km²)','원 대비 감소율(%)'],union_rows)}

## 지역을 분리한 비교

{md_table(['학교급·지역','기관 수','도달권 평균(㎡)','원 대비 비율(%)','원 대비 감소율(%)'],regional_rows)}

![분포와 지역 차이](distribution_region.png)

## 해석과 계산 한계

- 보행망 도달권은 `exact_edge_trim_v3` 모델입니다. 500m 안에서 도달하는 도로 부분을 자르고 주변 35m를 면으로 확장한 뒤, 20,000㎡ 이하 구멍을 채우고 2m 단순화 및 535m 범위 절단을 적용합니다. 면 전체가 실제 통행 가능한 토지는 아닙니다.
- 학교 대표 좌표에서 보행망까지 연결하는 방식입니다. 실제 출입구, 사유지 통행권, 횡단 안전, 공사·운영시간은 검증하지 않았습니다. 연결거리 150m 초과가 {v['offset_over_150m_count']}곳, 최대 {v['offset_max_m']:,.1f}m로 해당 사례는 별도 확인이 필요합니다.
- 면 확장 때문에 500m 원 바깥 부분이 1㎡를 넘는 도달권이 {v['walk_outside_500m_count']}곳입니다. 학교별 원 밖 면적 합계는 {v['walk_outside_500m_sum_m2']:,.2f}㎡입니다. 따라서 ‘원 면적−도달권 면적’은 순수 미도달 면적과 같지 않습니다. 교집합·원 밖 면적은 기관별 JSON에 함께 저장했습니다.
- 면적은 EPSG:5179 평면좌표계로 다시 계산했습니다. 저장된 정수 면적과 최대 차이는 {v['max_abs_property_error_m2']:.6f}㎡입니다. 표시 소수점은 계산 정밀도이며 현장 측정 정확도를 뜻하지 않습니다.
- 기존 지도 원 도형의 평균 면적은 {v['stored_circle_mean_m2']:,.2f}㎡로 이론적 원과 다각형 근사 차이가 있습니다. 핵심 비교는 학교마다 동일한 이론상 원 면적을 사용합니다.
- 기존 지도 원 도형을 분모로 계산하면 전체 도달권 비율은 {100*overall['walk_mean_m2']/v['stored_circle_mean_m2']:.4f}%, 감소율은 {100*(1-overall['walk_mean_m2']/v['stored_circle_mean_m2']):.4f}%입니다. 핵심 표와의 차이는 원을 정64각형으로 표현한 근사 차이입니다.
- 강화·옹진은 별도 표를 제공합니다. 작은 도달권은 보행망 연결·지형·모델의 결과이며 공원 부족, 교육여건 열위 또는 투자 우선순위를 확정하지 않습니다.
- 원자료 해시, 반올림 전 수치, 학교별 면적·차이·비율·지역·연결거리·출처는 `analysis.json`에 보존했습니다.

## 사용 자료

''' + '\n'.join('- '+f for f in FILES)
(OUT/'analysis_report.md').write_text(text,encoding='utf-8')

def ht(headers,data):
    return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+html.escape(str(h))+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+html.escape(str(c))+'</td>' for c in row)+'</tr>' for row in data)+'</tbody></table></div>'
document='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>인천 학교급별 500m 면적 비교</title><meta name="description" content="인천 유치원·초등학교·중학교·고등학교 917곳의 보행망 500m 도달권과 직선 반경 500m 면적 비교"><meta property="og:title" content="인천 학교급별 500m 면적 비교"><meta property="og:description" content="917곳의 보행망 도달권과 직선 반경을 학교급별 평균·합계·합집합으로 비교합니다."><meta property="og:type" content="website"><meta property="og:image" content="https://education-living-area-preview-production.up.railway.app/reports/walk-radius-area-20260919/area_comparison.png"><style>body{font-family:Malgun Gothic,sans-serif;background:#fafbf8;color:#183a35;max-width:1180px;margin:40px auto;padding:0 24px;line-height:1.8}nav{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:24px}nav a{display:inline-block;border:1px solid #b8cec3;border-radius:999px;padding:7px 14px;text-decoration:none}h1{font-size:32px;line-height:1.3}h2{margin-top:44px}img{width:100%;height:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:14px}th,td{border-bottom:1px solid #d8e0da;padding:12px;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{background:#e9f0e9}tbody tr:last-child{font-weight:700}.scroll{overflow:auto}small{color:#526258}summary{cursor:pointer;font-weight:700}a{color:#126c63}@media(max-width:600px){body{margin:24px auto;padding:0 14px}h1{font-size:27px}nav{align-items:flex-start;flex-direction:column}}</style></head><body><nav><strong>반경 너머 · 분석 자료</strong><a href="/">운영 앱으로 돌아가기</a></nav>'''
document+=f'<h1>인천 유·초·중·고의 500m 면적 차이</h1><p>917곳 · EPSG:5179 재계산 · 2026-09-19</p><p>학교당 보행망 도달권은 직선 원의 <strong>{overall["retained_pct"]:.4f}%</strong>입니다. 평균 <strong>{overall["reduction_pct"]:.4f}%</strong> 작습니다.</p><img src="area_comparison.png" alt="학교급별 평균 도달권과 직선 반경 면적 비교">'
document+='<p>보유 등록부 920곳 중 917곳의 분석입니다. 초등학교 3곳(인천윤슬초·인천검단호수초·인천달빛초)은 도달권 미확보로 제외했으며 0으로 처리하지 않았습니다.</p>'
document+='<h2>학교급별 평균 · 정확한 계산값</h2><p>원 면적: '+f'{CIRCLE:,.9f}㎡'+'. 감소율=(원−도달권)÷원×100.</p>'+ht(['학교급','기관 수','도달권 평균(㎡)','평균 차이(㎡)','원 대비(%)','감소율(%)'],main_rows)
document+='<h2>학교별 면적을 더한 합계</h2><p>학교 사이에 겹치는 면적을 중복 집계한 값입니다.</p>'+ht(['학교급','원 합계(km²)','도달권 합계(km²)','차이(km²)'],sum_rows)
document+='<h2>겹침을 제거한 합집합</h2><p>전체 행은 학교급 간 겹침까지 제거합니다. 원은 1,024각형 근사입니다.</p>'+ht(['학교급','원 합집합(km²)','도달권 합집합(km²)','차이(km²)','감소율(%)'],union_rows)
document+='<img src="distribution_region.png" alt="기관별 분포와 강화 옹진 별도 비교"><h2>지역 분리 결과</h2>'+ht(['학교급·지역','기관 수','도달권 평균(㎡)','원 대비(%)','감소율(%)'],regional_rows)
document+='<h2>해석 범위</h2><p>보행망을 면으로 확장한 모델이며 실제 출입구·안전한 통행을 확인한 면적이 아닙니다. 면적 차이는 시설 부족이나 지원 순위가 아닙니다. 원 밖으로 확장된 부분이 있어 면적 차이와 순수 미도달 면적은 다릅니다.</p><p><a href="analysis_report.md">계산 방법·한계·출처 전문</a> · <a href="analysis.json" download>반올림 전 수치 및 학교별 자료(JSON)</a></p>'
document+='<details><summary>917곳의 개별 면적 보기</summary>'+ht(['학교명','학교급','군·구','도달권(㎡)','원과 차이(㎡)','원 대비(%)','연결거리(m)'],[[r['name'],r['level'],r['gu'],f"{r['walk_m2']:,.2f}",f"{r['difference_m2']:,.2f}",f"{r['retained_pct']:.4f}",r['offset_m']] for r in rows])+'</details></body></html>'
(OUT/'analysis_report.html').write_text(document,encoding='utf-8')
with zipfile.ZipFile(OUT/'500m_area_analysis.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for filename in ['analysis_report.html', 'analysis_report.md', 'analysis.json',
                     'area_comparison.png', 'area_comparison.svg',
                     'distribution_region.png', 'distribution_region.svg']:
        bundle.write(OUT/filename, filename)
print(json.dumps({'summary':summaries,'union':unions,'validation':v},ensure_ascii=False,indent=2))
