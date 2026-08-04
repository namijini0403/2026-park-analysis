import geopandas as gpd
import pandas as pd
import json
import numpy as np
import os

BASE = "c:/2026_data_analysis_park/"

grid = gpd.read_file(BASE + "data/processed/candidate_grid_raw_v3.geojson")
forecast = pd.read_csv(BASE + "data/processed/beneficiary_forecast.csv")
priority = pd.read_csv(BASE + "data/processed/school_priority_case_system_20260411.csv")

# linked_schools가 문자열로 저장됐을 수 있으니 파싱
def parse_schools(val):
    if isinstance(val, (list, np.ndarray)):
        return list(val)
    if isinstance(val, str):
        val = val.strip()
        if val.startswith('['):
            try:
                return json.loads(val.replace("'", '"'))
            except:
                pass
        return [val] if val else []
    return []

grid["linked_schools"] = grid["linked_schools"].apply(parse_schools)

# 학교별 forecast 딕셔너리
f_dict = forecast.set_index("학교명")[["forecast_2029","forecast_2031"]].to_dict("index")
p_dict = priority.set_index("학교명")[["case_type","iso_green_ratio","iso_playground_count","nearest_park_dist_m"]].to_dict("index")

def agg_forecast(schools):
    v29 = sum(f_dict[s]["forecast_2029"] for s in schools if s in f_dict)
    v31 = sum(f_dict[s]["forecast_2031"] for s in schools if s in f_dict)
    return round(v29), round(v31)

def worst_case(schools):
    cases = [p_dict[s]["case_type"] for s in schools if s in p_dict]
    return min(cases) if cases else None

def avg_metric(schools, col):
    vals = [p_dict[s][col] for s in schools if s in p_dict and p_dict[s][col] is not None]
    return round(sum(vals)/len(vals), 3) if vals else None

grid["forecast_2029"] = grid["linked_schools"].apply(lambda s: agg_forecast(s)[0])
grid["forecast_2031"] = grid["linked_schools"].apply(lambda s: agg_forecast(s)[1])
grid["worst_case_type"] = grid["linked_schools"].apply(worst_case)
grid["avg_green_ratio"] = grid["linked_schools"].apply(lambda s: avg_metric(s, "iso_green_ratio"))
grid["avg_playground_count"] = grid["linked_schools"].apply(lambda s: avg_metric(s, "iso_playground_count"))
grid["avg_park_dist_m"] = grid["linked_schools"].apply(lambda s: avg_metric(s, "nearest_park_dist_m"))

# land_feasibility_level 임시 규칙 기반
def feasibility(row):
    if row["worst_case_type"] == 1.0:
        return "high"
    elif row["worst_case_type"] == 2.0 and (row["forecast_2029"] or 0) >= 100:
        return "medium"
    else:
        return "low"

grid["land_feasibility_level"] = grid.apply(feasibility, axis=1)

# 우선순위 점수: 잠재수요 + 취약도 가중
grid["priority_score"] = (
    grid["forecast_2029"] * 0.6 +
    grid["forecast_2031"] * 0.4
) * grid["worst_case_type"].apply(lambda c: 1.5 if c == 1.0 else 1.0)

grid = grid.sort_values("priority_score", ascending=False).reset_index(drop=True)
grid["candidate_rank"] = range(1, len(grid)+1)

print(f"총 후보지: {len(grid)}")
print(f"\nfeasibility 분포:\n{grid['land_feasibility_level'].value_counts()}")
print(f"\n상위 10개:\n{grid[['grid_id','cx','cy','forecast_2029','forecast_2031','worst_case_type','land_feasibility_level','priority_score','candidate_rank']].head(10)}")

# 저장
out_cols = ["grid_id","cx","cy","linked_schools","linked_school_count",
            "forecast_2029","forecast_2031","worst_case_type",
            "avg_green_ratio","avg_playground_count","avg_park_dist_m",
            "land_feasibility_level","priority_score","candidate_rank","geometry"]
out_path = BASE + "data/processed/candidate_grid_final_v5.geojson"
grid[out_cols].to_file(out_path, driver="GeoJSON")
print(f"\n저장 완료: candidate_grid_final_v4.geojson")

# CSV도 같이 저장 (지도 앱 연동용)
csv_cols = ["grid_id","cx","cy","linked_school_count",
            "forecast_2029","forecast_2031","worst_case_type",
            "avg_green_ratio","avg_playground_count","avg_park_dist_m",
            "land_feasibility_level","priority_score","candidate_rank"]
grid[csv_cols].to_csv(BASE + "data/processed/candidate_grid_final_v2.csv", index=False, encoding="utf-8-sig")
print("저장 완료: candidate_grid_final_v2.csv")
