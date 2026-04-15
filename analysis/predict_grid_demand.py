import pickle
import pandas as pd
import geopandas as gpd
import json
import numpy as np

BASE = "c:/2026_data_analysis_park/"

with open(BASE + "output/model2_xgboost_2029_v3.pkl", "rb") as f:
    model_2029 = pickle.load(f)
with open(BASE + "output/model2_xgboost_2031_v3.pkl", "rb") as f:
    model_2031 = pickle.load(f)

grid = gpd.read_file(BASE + "data_processed/candidate_grid_final_v3.geojson")

def parse_schools(val):
    if isinstance(val, (list, np.ndarray)):
        return list(val)
    if isinstance(val, str):
        val = val.strip()
        try:
            return json.loads(val.replace("'", '"'))
        except:
            return [val] if val else []
    return []

grid["linked_schools"] = grid["linked_schools"].apply(parse_schools)

priority = pd.read_csv(BASE + "data_processed/school_priority_case_system_20260411.csv")
prophet = pd.read_csv(BASE + "data_processed/gu_cohort_change_prophet.csv")

# priority에 gu_avg_grid_total_pop 있는지 확인
print("priority 컬럼 중 pop 관련:")
print([c for c in priority.columns if 'pop' in c.lower() or 'grid' in c.lower()])

p_dict = priority.set_index("학교명")[
    ["gu","redev_완료수","redev_진행중수","redev_예정수",
     "nearest_park_dist_m","iso_park_area","buf_park_area",
     "iso_child_total"]
].to_dict("index")

prophet_dict = prophet.set_index("gu_name")[
    ["cohort_change_2029","cohort_change_2031"]
].to_dict("index")

GU_LIST = ["계양구","남동구","동구","미추홀구","부평구","서구","연수구","옹진군","중구"]

def build_features(row, year):
    schools = row["linked_schools"]
    gu = p_dict[schools[0]]["gu"] if schools and schools[0] in p_dict else "미추홀구"

    def avg(col):
        vals = [p_dict[s][col] for s in schools if s in p_dict]
        return round(np.mean(vals), 3) if vals else 0.0

    # gu_avg_grid_total_pop: 연결 학교 iso_child_total 평균으로 근사
    gu_avg_pop = avg("iso_child_total")

    prophet_val = prophet_dict.get(gu, {})
    cohort = prophet_val.get(f"cohort_change_{year}", 1.0)

    feat = {
        "gu_avg_grid_total_pop": gu_avg_pop,
        "redev_완료수": avg("redev_완료수"),
        "redev_진행중수": avg("redev_진행중수"),
        "redev_예정수": avg("redev_예정수"),
        "nearest_park_dist_m": avg("nearest_park_dist_m"),
        "iso_park_area": avg("iso_park_area"),
        "buf_park_area": avg("buf_park_area"),
        "is_new_school": 0,
        "위도": row["cy"],
        "경도": row["cx"],
        f"cohort_change_{year}_prophet": cohort,
    }
    for g in GU_LIST:
        feat[f"gu_{g}"] = 1 if gu == g else 0

    return feat

rows_2029 = [build_features(row, "2029") for _, row in grid.iterrows()]
rows_2031 = [build_features(row, "2031") for _, row in grid.iterrows()]

df_2029 = pd.DataFrame(rows_2029)[model_2029.get_booster().feature_names]
df_2031 = pd.DataFrame(rows_2031)[model_2031.get_booster().feature_names]

grid["xgb_predicted_2029"] = np.round(model_2029.predict(df_2029)).astype(int)
grid["xgb_predicted_2031"] = np.round(model_2031.predict(df_2031)).astype(int)

print("\n=== XGBoost 격자별 예측 결과 샘플 ===")
print(grid[["grid_id","cx","cy","xgb_predicted_2029","xgb_predicted_2031","land_feasibility_level"]].head(10))
print(f"\n예측값 범위 2029: {grid['xgb_predicted_2029'].min()} ~ {grid['xgb_predicted_2029'].max()}")
print(f"예측값 범위 2031: {grid['xgb_predicted_2031'].min()} ~ {grid['xgb_predicted_2031'].max()}")
print(f"평균 2029: {grid['xgb_predicted_2029'].mean():.1f}")
print(f"평균 2031: {grid['xgb_predicted_2031'].mean():.1f}")

# 저장
grid.to_file(BASE + "data_processed/candidate_grid_xgb.geojson", driver="GeoJSON")
grid[[c for c in grid.columns if c != "geometry"]].to_csv(
    BASE + "data_processed/candidate_grid_xgb.csv", index=False, encoding="utf-8-sig"
)
print("\n저장 완료: candidate_grid_xgb.geojson / candidate_grid_xgb.csv")
