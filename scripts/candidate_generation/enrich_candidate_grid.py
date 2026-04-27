import pandas as pd
import geopandas as gpd
import numpy as np
import json
from math import radians, cos, sqrt

BASE = "c:/2026_data_analysis_park/"

def parse_schools(val):
    if isinstance(val, (list, np.ndarray)):
        return list(val)
    if isinstance(val, str):
        try:
            return json.loads(val.replace("'",'"'))
        except:
            return [val] if val else []
    return []

def dist_m(lat1, lng1, lat2, lng2):
    dlat = (lat2 - lat1) * 111320
    dlng = (lng2 - lng1) * 111320 * cos(radians((lat1+lat2)/2))
    return sqrt(dlat**2 + dlng**2)

grid = gpd.read_file(BASE + "data/processed/candidate_grid_xgb_v2.geojson")
grid["linked_schools"] = grid["linked_schools"].apply(parse_schools)

parks = pd.read_csv(BASE + "data/processed/parks.csv", encoding="utf-8-sig")
parks = parks.dropna(subset=[parks.columns[3], parks.columns[4]])
p_lat, p_lng, p_area = parks.columns[3], parks.columns[4], parks.columns[5]

pg = pd.read_csv(BASE + "data/processed/geocoded_playground.csv", encoding="utf-8-sig")
pg = pg.dropna(subset=[pg.columns[3], pg.columns[4]])
pg_lat, pg_lng = pg.columns[3], pg.columns[4]

apt = pd.read_csv(BASE + "data/processed/large_apt_complexes_2025.csv", encoding="utf-8-sig")
apt = apt.dropna(subset=["위도","경도"])
apt_500 = apt[apt["세대수"] >= 500].copy()

schools_df = pd.read_csv(BASE + "data/processed/schools.csv", encoding="utf-8-sig")
school_name_col = schools_df.columns[1]
school_lat_col = schools_df.columns[2]
school_lng_col = schools_df.columns[3]

print(f"공원: {len(parks)}개, 놀이터: {len(pg)}개, 대단지아파트: {len(apt_500)}개")
print("격자별 피처 계산 중...")

def enrich_row(row):
    clat, clng = row["cy"], row["cx"]
    schools = row["linked_schools"]

    park_dists = [dist_m(clat, clng, float(r[p_lat]), float(r[p_lng])) for _, r in parks.iterrows()]
    nearest_park = round(min(park_dists)) if park_dists else 9999
    park_count_500 = sum(1 for d in park_dists if d <= 500)

    pg_dists = [dist_m(clat, clng, float(r[pg_lat]), float(r[pg_lng])) for _, r in pg.iterrows()]
    nearest_pg = round(min(pg_dists)) if pg_dists else 9999
    pg_count_500 = sum(1 for d in pg_dists if d <= 500)

    apt_dists = [dist_m(clat, clng, float(r["위도"]), float(r["경도"])) for _, r in apt_500.iterrows()]
    nearest_apt = round(min(apt_dists)) if apt_dists else 9999

    school_dists = []
    for s in schools:
        s_row = schools_df[schools_df[school_name_col] == s]
        if len(s_row) > 0:
            school_dists.append(dist_m(clat, clng, float(s_row.iloc[0][school_lat_col]), float(s_row.iloc[0][school_lng_col])))
    nearest_school = round(min(school_dists)) if school_dists else 9999

    return pd.Series({
        "nearest_park_dist": nearest_park,
        "park_count_500m": park_count_500,
        "nearest_pg_dist": nearest_pg,
        "pg_count_500m": pg_count_500,
        "nearest_apt_dist": nearest_apt,
        "nearest_school_dist": nearest_school,
    })

enriched = grid.apply(enrich_row, axis=1)
grid = pd.concat([grid, enriched], axis=1)

print("=== 샘플 ===")
print(grid[["grid_id","nearest_park_dist","nearest_pg_dist","nearest_apt_dist","nearest_school_dist"]].head(5))

def minmax(series):
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series([0.5] * len(series), index=series.index)
    return (series - mn) / (mx - mn)

# 수요 최소 컷: xgb_predicted_2029 >= 200명 이상만
grid_filtered = grid[grid["xgb_predicted_2029"] >= 200].copy()
print(f"수요 컷 후 격자 수: {len(grid_filtered)} (전체 {len(grid)}개 중)")

# 놀이터 거리 이상치 처리: 상위 5% 캡핑
pg_cap = grid_filtered["nearest_pg_dist"].quantile(0.95)
grid_filtered["nearest_pg_dist_capped"] = grid_filtered["nearest_pg_dist"].clip(upper=pg_cap)
print(f"놀이터 거리 캡: {pg_cap:.0f}m")

# 정규화
grid_filtered["score_demand"]  = minmax(grid_filtered["xgb_predicted_2029"])
grid_filtered["score_park"]    = minmax(grid_filtered["nearest_park_dist"])
grid_filtered["score_school"]  = 1 - minmax(grid_filtered["nearest_school_dist"])
grid_filtered["score_pg"]      = minmax(grid_filtered["nearest_pg_dist_capped"])

# AI 추천 점수
grid_filtered["ai_score"] = (
    grid_filtered["score_demand"] * 0.30 +
    grid_filtered["score_park"]   * 0.30 +
    grid_filtered["score_school"] * 0.30 +
    grid_filtered["score_pg"]     * 0.10
)
grid_filtered["ai_rank"] = grid_filtered["ai_score"].rank(ascending=False).astype(int)

print("\n=== AI 추천 상위 10 ===")
print(grid_filtered.nsmallest(10, "ai_rank")[
    ["grid_id","cx","cy","xgb_predicted_2029","nearest_park_dist",
     "nearest_school_dist","nearest_pg_dist","ai_score","ai_rank","land_feasibility_level"]
].to_string(index=False))

# 전체 격자에도 점수 반영 (컷 아래는 NaN)
grid["ai_score"] = grid_filtered["ai_score"]
grid["ai_rank"] = grid_filtered["ai_rank"]
grid["score_demand"] = grid_filtered["score_demand"]
grid["score_park"] = grid_filtered["score_park"]
grid["score_school"] = grid_filtered["score_school"]
grid["score_pg"] = grid_filtered["score_pg"]

grid.to_file(BASE + "data/processed/candidate_grid_enriched_v2.geojson", driver="GeoJSON")
grid[[c for c in grid.columns if c != "geometry"]].to_csv(
    BASE + "data/processed/candidate_grid_enriched_v2.csv", index=False, encoding="utf-8-sig"
)
print("\n최종 저장 완료")
