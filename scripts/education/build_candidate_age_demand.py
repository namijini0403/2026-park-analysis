"""Source-conserving school-age allocation; no elementary demand reused for other ages."""
import argparse
import hashlib
import io
import json
import tempfile
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely import box

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'data/education_sources/candidate_age_allocation.json'
OUT=ROOT/'data_processed/education/candidate_age_demand.json'
BANDS={'유치원':(3,5),'초등학교':(6,11),'중학교':(12,14),'고등학교':(15,17)}


def parent_code(code):
    return code[:4]+code[5:7]


def load_1km(raw_dir):
    frames=[]
    for prefix in ['나사','다사']:
        path=raw_dir/f'_grid_border_grid_2025_grid_{prefix}_grid_{prefix}.zip'
        with tempfile.TemporaryDirectory() as temp, zipfile.ZipFile(path) as archive:
            for member in archive.infolist():
                name=member.filename
                try:
                    name=name.encode('cp437').decode('cp949')
                except (UnicodeError,LookupError):
                    pass
                if '1K' in name.upper():
                    (Path(temp)/('grid'+Path(name).suffix)).write_bytes(archive.read(member))
            frame=gpd.read_file(Path(temp)/'grid.shp').to_crs(5179)
            frames.append(frame[['GRID_CD','geometry']])
    return gpd.GeoDataFrame(pd.concat(frames,ignore_index=True),crs=5179)


def extract(raw_dir):
    pop=pd.read_csv(ROOT/'data_processed/population_grid.csv',dtype={'격자코드':str})
    pop['parent']=pop['격자코드'].map(parent_code)
    pop['total']=pd.to_numeric(pop['총인구'],errors='coerce')
    if pop.total.isna().any() or (pop.total<0).any():
        raise ValueError('100m allocation weights require observed nonnegative population')
    denominators=pop.groupby('parent')['total'].sum(min_count=1)
    grid=load_1km(raw_dir).set_index('GRID_CD')
    bounds=grid.geometry.bounds
    # Official grid code = two-letter tile + three-digit easting + three-digit northing.
    bounds=pop['parent'].map(bounds['minx']).to_frame('x').assign(y=pop['parent'].map(bounds['miny']))
    if bounds.isna().any().any():
        raise ValueError('100m population code without official 1km geometry')
    x=bounds.x+pop['격자코드'].str[4].astype(int)*100
    y=bounds.y+pop['격자코드'].str[7].astype(int)*100
    cells=gpd.GeoDataFrame(pop,geometry=box(x,y,x+100,y+100),crs=5179)
    candidates=gpd.read_file(ROOT/'data_processed/candidate_grid_final.geojson').to_crs(5179)
    weights={}
    for index,row in candidates.iterrows():
        scopes={}
        for scope,geometry in [('footprint',row.geometry),('straight_500m',row.geometry.centroid.buffer(500))]:
            near=cells.iloc[cells.sindex.query(geometry,predicate='intersects')].copy()
            area=near.geometry.intersection(geometry).area/10000
            weighted=near.total*area
            by_parent=weighted.groupby(near.parent).sum(min_count=1)
            scopes[scope]={'weights':{key:float(value/denominators[key]) for key,value in by_parent.items() if denominators[key]>0},
                           'observed_total_population':float(weighted.sum()),'observed_cells':len(near)}
        weights[row.grid_id]=scopes
        if (index+1)%400==0:print(f'Candidate weights {index+1}/{len(candidates)}',flush=True)
    source_zip=raw_dir/'_census_reqdoc_1775457003738.zip'
    frames=[]
    with zipfile.ZipFile(source_zip) as archive:
        for prefix in ['나사','다사']:
            data=pd.read_csv(io.BytesIO(archive.read(f'2024년_인구_{prefix}_1K.csv')),encoding='cp949',header=None,names=['year','grid','item','value'])
            frames.append(data[data.grid.isin(set(pop.parent)) & data.item.isin([f'in_age_{n:03}' for n in range(1,5)])])
    raw=pd.concat(frames)
    if raw.duplicated(['grid','item']).any():
        raise ValueError('Duplicate census grid/age observations')
    raw['value']=pd.to_numeric(raw.value,errors='coerce')
    census={key:{r.item:float(r.value) if pd.notna(r.value) else None for r in group.itertuples()} for key,group in raw.groupby('grid')}
    demographics=json.loads((ROOT/'data/education_sources/regional_age_observations.json').read_text(encoding='utf-8'))
    city=next(r['ages'] for r in demographics['records'] if r['year']==2024 and r['region_code']=='2800000000')
    source={'year':2024,'census_age_groups':census,'city_single_ages':city,'candidate_weights':weights,
            'sources':[{'file':source_zip.name,'sha256':hashlib.sha256(source_zip.read_bytes()).hexdigest()},
                       {'file':'population_grid.csv','sha256':hashlib.sha256((ROOT/'data_processed/population_grid.csv').read_bytes()).hexdigest()}],
            'method':'1km 5세별 공개 인구를 인천 2024년 1세별 비율로 나눔. 100m 총인구 비중으로 1km 총량을 보존해 배분한 뒤 면적 교차비로 집계.'}
    for path in [ROOT/'data_processed/candidate_grid_final.geojson',ROOT/'data/education_sources/regional_age_observations.json',
                 *[raw_dir/f'_grid_border_grid_2025_grid_{prefix}_grid_{prefix}.zip' for prefix in ['나사','다사']]]:
        source['sources'].append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    SOURCE.write_text(json.dumps(source,ensure_ascii=False,separators=(',',':')),encoding='utf-8')


def estimate_band(groups,ages,start,end):
    total=0
    for group in sorted({age//5 for age in range(start,end+1)}):
        value=groups.get(f'in_age_{group+1:03}')
        counts=[ages.get(str(age)) for age in range(group*5,group*5+5)]
        if value is None or any(v is None for v in counts) or sum(counts)<=0:
            return None
        fraction=sum(ages[str(age)] for age in range(max(start,group*5),min(end,group*5+4)+1))/sum(counts)
        total+=value*fraction
    return total


def build(source):
    estimates={grid:{level:estimate_band(groups,source['city_single_ages'],*band) for level,band in BANDS.items()} for grid,groups in source['census_age_groups'].items()}
    output={}
    for ident,scopes in source['candidate_weights'].items():
        output[ident]={}
        for scope,values in scopes.items():
            levels={}
            for level in BANDS:
                terms=[(weight,estimates.get(grid,{}).get(level)) for grid,weight in values['weights'].items() if weight>0]
                complete=bool(terms) and all(value is not None for _,value in terms)
                subtotal=sum(weight*value for weight,value in terms if value is not None)
                levels[level]={'estimated_residents':round(subtotal,2) if complete else None,
                               'known_subtotal':round(subtotal,2) if terms else None,
                               'status':'estimated' if complete else 'missing_age_observations',
                               'missing_parent_grids':sum(value is None for _,value in terms)}
            output[ident][scope]={'levels':levels,'observed_total_population':values['observed_total_population']}
    return {'base_year':source['year'],'method':source['method'],'candidates':output,
            'limitations':['실제 250m 연령 관측값이 아닌 배분 추정. 주민등록 연령구성과 격자 인구의 모집단 차이, 공개값 처리·반올림 오차가 있음.',
                           '500m는 직선권이며 보행 접근·실제 이용·신규 수혜를 뜻하지 않음. 후보지 간 권역 중복으로 인원을 합산하지 않음.',
                           '미관측 연령 격자를 0으로 대체하지 않음. 알려진 소계는 전체 추정과 분리. 미래 예측은 이 파일에 포함하지 않음.']}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--raw-dir',type=Path)
    args=parser.parse_args()
    if args.raw_dir:extract(args.raw_dir)
    result=build(json.loads(SOURCE.read_text(encoding='utf-8')))
    OUT.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"School-age candidate estimates: {len(result['candidates'])}")


if __name__=='__main__':main()
