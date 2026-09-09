"""Refresh academy-only spatial counts without rerunning forecasts or candidates."""
import json
import geopandas as gpd
import pandas as pd
from scripts.education.build_education_analysis import OUT, build_academy_context, save


def main():
    registry=pd.read_csv(OUT/'institutions.csv')
    walk=gpd.read_file(OUT/'walkshed_500m.geojson').to_crs(5179).set_index('학교ID')
    _,_,contexts=build_academy_context(registry,walk)
    rows=json.loads((OUT/'school_analysis.json').read_text(encoding='utf-8'))
    for row in rows:
        row['context']['academy']={**contexts[row['학교ID']], 'coverage':'observed_geocoded_records'}
    save('school_analysis.json',rows)
    print('Academy context refreshed:',len(contexts),'registry schools;',len(rows),'extended analysis rows')


if __name__=='__main__':main()
