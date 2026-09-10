"""Shared park supply and single-facility loss scenarios; no observed usage claim."""
from pathlib import Path
import hashlib
import json
import numpy as np
import pandas as pd
import geopandas as gpd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data_processed'
OUT = DATA / 'education'


def allocate(links, areas, demand):
    """Two-step equal-access supply ratio, missing linked demand poisons denominator."""
    links = np.asarray(links, dtype=bool)
    demand = np.asarray(demand, dtype=float)
    areas = np.asarray(areas, dtype=float)
    valid_demand = np.isfinite(demand) & (demand >= 0)
    known_total = links.T @ np.where(valid_demand, demand, 0)
    missing = links.T @ (~valid_demand).astype(int)
    valid = (missing == 0) & (known_total > 0) & np.isfinite(areas) & (areas >= 0)
    ratio = np.divide(areas, known_total, out=np.full(len(areas), np.nan), where=valid)
    contribution = np.where(links, ratio[None, :], 0.)
    total = contribution.sum(axis=1)
    max_contribution = np.max(contribution, axis=1) if len(areas) else np.zeros(len(demand))
    loss = np.divide(max_contribution, total, out=np.full(len(demand), np.nan), where=total > 0)
    return total, loss, contribution, known_total, missing


def main():
    paths = [DATA/'school_walkshed_500m_v3.geojson', OUT/'walkshed_500m.geojson',
             DATA/'parks_with_function_class.csv', OUT/'institutions.csv', OUT/'school_statistics.json']
    walks = gpd.GeoDataFrame(pd.concat([gpd.read_file(p).to_crs(5179) for p in paths[:2]], ignore_index=True), crs=5179)
    assert not walks['학교ID'].duplicated().any()
    registry = pd.read_csv(paths[3]).set_index('학교ID')
    walks = walks.sort_values('학교ID').reset_index(drop=True)
    ids = walks['학교ID'].tolist()
    levels = registry.loc[ids, '학교급구분'].to_numpy()
    stats = json.loads(paths[4].read_text(encoding='utf-8'))['schools']
    demand = np.array([stats.get(s, {}).get('2026', {}).get('students', np.nan) for s in ids], dtype=float)
    parks = pd.read_csv(paths[2])
    parks = parks[parks['시설유형'] != '놀이터'].copy()
    excluded = parks[parks[['위도','경도']].isna().any(axis=1)]
    parks = parks.dropna(subset=['위도','경도']).reset_index(drop=True)
    raw_count = len(parks)
    canonical = []
    identity_issues = []
    for (name, lat, lon), group in parks.groupby(['공원명','위도','경도'], sort=True):
        row = group.iloc[0].copy()
        row['park_id'] = 'park_' + hashlib.sha256(f'{name}|{lat}|{lon}'.encode()).hexdigest()[:16]
        if group['공원면적'].nunique(dropna=False) > 1:
            row['공원면적'] = np.nan
            identity_issues.append(dict(id=row['park_id'], name=name, reason='conflicting_area_same_name_coordinate'))
        canonical.append(row)
    parks = pd.DataFrame(canonical).reset_index(drop=True)
    ambiguous = parks.duplicated(['위도','경도'], keep=False)
    for _, row in parks[ambiguous].iterrows():
        identity_issues.append(dict(id=row['park_id'],name=row['공원명'],reason='different_names_same_coordinate'))
    parks.loc[ambiguous,'공원면적'] = np.nan
    points = gpd.GeoSeries(gpd.points_from_xy(parks['경도'], parks['위도']), crs=4326).to_crs(5179)
    links = np.stack([points.covered_by(geometry).to_numpy() for geometry in walks.geometry])
    areas = pd.to_numeric(parks['공원면적'], errors='coerce').to_numpy()
    total, loss, contributions, park_demand, missing = allocate(links, areas, demand)
    own = np.divide(np.where(links,areas[None,:],0).sum(axis=1), demand, out=np.full(len(ids), np.nan), where=demand > 0)
    same_level = np.full(len(ids), np.nan)
    for level in set(levels):
        selected = levels == level
        same_level[selected] = allocate(links[selected], areas, demand[selected])[0]
    rows = []
    for i, sid in enumerate(ids):
        linked = np.flatnonzero(links[i])
        competitors = np.any(links[:, linked], axis=1) if len(linked) else np.zeros(len(ids), dtype=bool)
        competitors[i] = False
        critical = int(np.argmax(contributions[i])) if np.isfinite(total[i]) and total[i] > 0 else None
        rows.append(dict(id=sid, name=registry.loc[sid,'학교명'], level=levels[i], gu=registry.loc[sid,'gu'],
                         students_2026=demand[i], park_count=len(linked), sharing_school_count=int(competitors.sum()),
                         full_area_per_own_student=own[i], shared_area_per_student=total[i],
                         same_level_shared_area_per_student=same_level[i],
                         largest_park_loss_share=loss[i],
                         largest_contribution_park=None if critical is None else str(parks.iloc[critical]['park_id']),
                         park_ids=[str(parks.iloc[j]['park_id']) for j in linked]))
    park_rows=[]
    for j, p in parks.iterrows():
        affected = links[:,j]
        park_rows.append(dict(id=str(p['park_id']),source_management_id=str(p['관리번호']),name=p['공원명'], area_m2=areas[j],
                              linked_schools=int(affected.sum()), linked_levels=sorted(set(levels[affected])),
                              known_linked_students=park_demand[j], missing_demand_schools=int(missing[j]),
                              school_ids=[ids[i] for i in np.flatnonzero(affected)]))
    def clean(value):
        if isinstance(value,dict): return {k:clean(v) for k,v in value.items()}
        if isinstance(value,list): return [clean(v) for v in value]
        if isinstance(value,np.generic): return clean(value.item())
        if isinstance(value,float) and not np.isfinite(value): return None
        return value
    result=clean(dict(method='equal-access two-step floating catchment allocation; park-point inclusion in 500m walksheds',
                      student_year=2026, schools=rows, parks=park_rows,
                      identity_issues=identity_issues, raw_park_rows=raw_count, collapsed_duplicate_rows=raw_count-len(parks),
                      excluded_coordinate_park_ids=excluded['관리번호'].astype(str).tolist(),
                      limitations=['Park representative point is not a verified entrance.',
                                   'Whole published park area is a supply proxy, not usable area or measured capacity.',
                                   'Students and kindergarten children are institutional enrollment, not simultaneous park users.',
                                   'Residents outside these schools and other users are not included.',
                                   'Missing linked enrollment makes that park allocation unknown; no zero imputation.',
                                   'Largest-park removal keeps remaining allocations fixed; no rerouting or demand redistribution.',
                                   'Different school ages need not use a park simultaneously; same-level allocation is an alternative scenario.'],
                      source_hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}))
    (OUT/'shared_parks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    valid=[r for r in rows if np.isfinite(r['shared_area_per_student']) and r['park_count']>0]
    print(json.dumps(clean(dict(schools=len(rows),parks=len(park_rows),with_park=sum(r['park_count']>0 for r in rows),
                          valid_allocation_with_park=len(valid),
                          missing_demand=int(np.isnan(demand).sum()),
                          shared_parks=sum(p['linked_schools']>1 for p in park_rows),
                          cross_level_parks=sum(len(p['linked_levels'])>1 for p in park_rows),
                          single_park_schools=sum(r['park_count']==1 for r in rows),
                          multi_park_loss_over_half=sum(r['park_count']>=2 and r['largest_park_loss_share']>.5 for r in valid))),ensure_ascii=False))


if __name__ == '__main__': main()
