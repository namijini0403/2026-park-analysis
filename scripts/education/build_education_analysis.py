"""Shared school-level environment analysis, public disclosures and support models.

New outputs are isolated from the reviewed elementary baseline. Missing observations
are null; coordinate fallback circles never become walking-access observations.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from shapely.geometry import Point
from shapely.ops import unary_union
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.forecasting.compare_school_enrollment_models import (
    make_history_features, weighted_slope, weighted_next_prediction, stabilize_future_prediction,
)
from scripts.policy_cards.build_policy_cards import park_base_action, build_scenarios

DATA = ROOT / "data_processed"
OUT = DATA / "education"
RAW = ROOT / "data/education_sources/disclosures"
LEVELS = {"02": "초등학교", "03": "중학교", "04": "고등학교"}


def clean(value):
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, np.generic):
        return clean(value.item())
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def save(name, obj):
    (OUT / name).write_text(json.dumps(clean(obj), ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")


def institution_key(name, level):
    return re.sub(r"\s+", "", str(name)), level


def disclosures(registry):
    manifest = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
    definitions = (RAW / "official_field_definitions.js").read_text(encoding="utf-8")
    labels = {}
    matches = list(re.finditer(r'case\s+"([^"]+)"\s*:', definitions))
    for i, match in enumerate(matches):
        body = definitions[match.end():matches[i+1].start() if i+1 < len(matches) else len(definitions)]
        labels[match.group(1)] = {col: label for label, col in re.findall(r'label\s*:\s*"([^"]*)"\s*,\s*column\s*:\s*"([^"]+)"', body)}
    save("disclosure_labels.json", labels)
    keys = defaultdict(list)
    for r in registry.to_dict("records"):
        keys[institution_key(r["학교명"], r["학교급구분"])].append(r["학교ID"])
    linked, enrollment, unmatched = defaultdict(list), defaultdict(dict), []
    for m in manifest:
        if not m.get("rows"):
            continue
        rows = json.loads((RAW / m["file"]).read_text(encoding="utf-8"))["list"]
        for r in rows:
            ids = keys[institution_key(r.get("SCHUL_NM"), LEVELS.get(m["school_level_code"]))]
            if len(ids) != 1:
                unmatched.append({"name": r.get("SCHUL_NM"), "level": m["school_level_code"], "file": m["file"]})
                continue
            sid = ids[0]
            linked[sid].append({"item": m["item"], "title": m["title"], "year": m["year"],
                                "depth": m["depth"], "source_file": m["file"], "source_url": m["source_url"], "values": r})
            if m["item"] == "62" and r.get("PBAN_EXCP_YN") == "N":
                v = str(r.get("COL_FGR_SUM", ""))
                if re.fullmatch(r"[\d,]+(?:\([\d,]+\))?", v):
                    # Parenthetical special-class count is already part of total.
                    n = int(v.split("(")[0].replace(",", ""))
                    enrollment[sid][m["year"]] = enrollment[sid].get(m["year"], 0) + n
    kindergarten_path=ROOT/'data/education_sources/kindergarten'
    kindergarten_unmatched=[]
    if (kindergarten_path/'manifest.json').exists():
        kindergarten_manifest=json.loads((kindergarten_path/'manifest.json').read_text(encoding='utf-8'))
        registry_rows=registry[registry['학교급구분']=='유치원'].to_dict('records')
        for item in kindergarten_manifest['records']:
            if item['status']!='available' or not item['rows']:
                continue
            source=json.loads((kindergarten_path/item['file']).read_text(encoding='utf-8'))
            for values in source['body']:
                record=dict(zip(source['header'],values))
                matches=[r for r in registry_rows if r['학교명']==record.get('유치원명') and r['설립형태']==record.get('설립유형')
                         and (not record.get('교육지원청명') or r.get('education_support_name')==record.get('교육지원청명'))]
                if len(matches)>1 and record.get('주소'):
                    address=re.sub(r'\s+','',record['주소'])
                    matches=[r for r in matches if re.sub(r'\s+','',str(r['소재지도로명주소']))==address]
                if len(matches)!=1:
                    kindergarten_unmatched.append({'file':item['file'],'name':record.get('유치원명'),'match_count':len(matches)})
                    continue
                linked[matches[0]['학교ID']].append({'item':'KG'+item['item'],'title':f"유치원 {item['title']} ({item['timing']%10}차)",
                    'year':item['timing']//10,'depth':str(item['timing']%10),'source_file':item['file'],'source_url':source['source_url'],'values':record})
    save('kindergarten_disclosure_coverage.json',{'unmatched':kindergarten_unmatched})
    kinder = pd.read_csv(OUT / "kindergarten_enrollment.csv")
    for r in kinder.to_dict("records"):
        if pd.notna(r["students"]):
            enrollment[r["학교ID"]][int(r["year"])] = int(r["students"])
    (OUT / "disclosures").mkdir(exist_ok=True)
    for sid in set(registry["학교ID"]) | set(pd.read_csv(DATA / "schools.csv")["학교ID"]):
        save(f"disclosures/{sid}.json", linked.get(sid, []))
    save("disclosure_coverage.json", {"sources": manifest, "matched_institutions": len(linked),
                                     "unmatched": list({(x['name'], x['level'], x['file']): x for x in unmatched}.values())})
    return linked, enrollment


def points(filename, lat="위도", lng="경도"):
    df = pd.read_csv(DATA / filename)
    df[lat] = pd.to_numeric(df[lat], errors="coerce")
    df[lng] = pd.to_numeric(df[lng], errors="coerce")
    df = df[df[lat].between(36, 39) & df[lng].between(124, 128)].copy()
    return gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df[lng], df[lat]), crs=4326).to_crs(5179)


def recent_contiguous_history(history):
    if not history:
        return {}
    year=max(history)
    result={}
    while year in history:
        result[year]=history[year]
        year-=1
    return dict(sorted(result.items()))


def forecast(enrollment, registry):
    result, validation = {}, {}
    for level, group in registry.groupby("학교급구분"):
        raw_histories = {sid: dict(sorted(enrollment.get(sid, {}).items())) for sid in group["학교ID"]}
        histories = {sid:recent_contiguous_history(hist) for sid,hist in raw_histories.items()}
        training = []
        for sid, hist in histories.items():
            years = list(hist)
            for i in range(3, len(years)):
                prefix = years[:i]
                if prefix != list(range(prefix[0], years[i])):
                    continue
                values = [hist[y] for y in prefix]
                features = make_history_features(values)
                training.append({**features, "year": years[i], "target": hist[years[i]] - weighted_next_prediction(values),
                                 "actual": hist[years[i]], "baseline": max(0, weighted_next_prediction(values))})
        frame = pd.DataFrame(training)
        model = None
        feature_cols = []
        weight = 0.0
        if len(frame) >= 60 and frame.year.nunique() >= 2:
            feature_cols = [c for c in frame if c not in {"year", "target", "actual", "baseline"}]
            holdout = frame.year.max()
            train, test = frame[frame.year < holdout], frame[frame.year == holdout]
            model = LGBMRegressor(n_estimators=100, max_depth=3, num_leaves=7, min_child_samples=15,
                                 learning_rate=0.04, random_state=42, n_jobs=2, verbosity=-1)
            model.fit(train[feature_cols], train.target)
            residual = model.predict(test[feature_cols])
            errors = {w: float(np.mean(np.abs(test.actual - np.maximum(0, test.baseline + w * residual)))) for w in [0.0, 0.25, 0.5, 1.0]}
            weight = min(errors, key=errors.get)
            validation[level] = {"validation_year": int(holdout), "n": len(test), "baseline_mae": errors[0.0],
                                 "selected_mae": errors[weight], "residual_weight": weight,
                                 "note": "시간순 검증으로 보정 가중치 선택. 독립 최종 평가가 아니며 장기 예측 성능으로 해석하지 않음."}
            model.fit(frame[feature_cols], frame.target)
        else:
            validation[level] = {"status": "insufficient_history_for_ml"}
        for sid, hist in histories.items():
            years = list(hist)
            base = {"history": [{"year": y, "students": n} for y,n in raw_histories[sid].items()],
                    "model_history_years":years,"forecast": [], "model_status": "insufficient_history"}
            if len(years) >= 3 and years == list(range(years[0], years[-1] + 1)):
                values = [hist[y] for y in years]
                base["model_status"] = "weighted_trend_lightgbm" if model is not None and weight > 0 else "weighted_trend"
                base["student_slope"] = weighted_slope(values)
                for year in range(years[-1] + 1, 2032):
                    value = weighted_next_prediction(values)
                    if model is not None and weight:
                        f = pd.DataFrame([make_history_features(values)])[feature_cols]
                        value += weight * model.predict(f)[0]
                    value = stabilize_future_prediction(values[-1], max(0, value))
                    values.append(value)
                    base["forecast"].append({"year": year, "students": round(value), "horizon": year - years[-1]})
            elif len(years) >= 2:
                base["student_slope"] = (hist[years[-1]] - hist[years[0]]) / (years[-1] - years[0])
            result[sid] = base
    save("forecast_validation.json", validation)
    return result


def main():
    registry = pd.read_csv(OUT / "institutions.csv").replace({np.nan: None})
    linked, enrollment = disclosures(registry)
    forecasts = forecast(enrollment, registry)
    save("enrollment_forecasts.json", forecasts)
    walk = gpd.read_file(OUT / "walkshed_500m.geojson").to_crs(5179).set_index("학교ID")
    walk_report = pd.read_csv(OUT / "walkshed_report.csv").set_index("학교ID")
    parks = points("parks_with_function_class.csv")
    official = parks[parks["시설유형"] != "놀이터"].copy()
    radii = np.maximum(10, np.sqrt(pd.to_numeric(official["공원면적"], errors="coerce").fillna(0) / np.pi))
    proxies = official.copy()
    proxies.geometry = proxies.geometry.buffer(radii)
    layers = {"library": points("libraries.csv"), "playground": parks[parks["시설유형"] == "놀이터"],
              "large_apartment": points("large_apt_complexes_2025.csv"), "redevelopment": points("redevelopment_geocoded.csv")}
    for name in ("nightlife", "construction"):
        layers[name] = gpd.read_file(DATA / f"context/facilities_{name}.geojson").to_crs(5179)
    academies = json.loads((OUT / "academies.json").read_text(encoding="utf-8"))
    save("academies_map.json", [{k: a[k] for k in ("facility_id","name","address","facility_type","lat","lng","target_category","arts_sports","reference_date","source_url")} | {"course_evidence": a["course_evidence"][:4]} for a in academies])
    af = pd.DataFrame([a for a in academies if a.get("lat") is not None])
    layers["academy"] = gpd.GeoDataFrame(af, geometry=gpd.points_from_xy(af.lng, af.lat), crs=4326).to_crs(5179)
    academy_context = {}
    baseline_coords = pd.read_csv(DATA / "schools.csv").set_index("학교ID")
    baseline_walk = gpd.read_file(DATA / "school_walkshed_500m_v3.geojson").to_crs(5179).set_index("학교ID")
    academy_layer = layers["academy"]
    for inst in registry.to_dict("records"):
        sid = inst["학교ID"]
        coords = baseline_coords.loc[sid] if sid in baseline_coords.index else inst
        origin = gpd.GeoSeries([Point(coords["경도"],coords["위도"])], crs=4326).to_crs(5179).iloc[0]
        near = academy_layer.iloc[academy_layer.sindex.query(origin.buffer(500), predicate="intersects")]
        zone = baseline_walk.loc[sid].geometry if sid in baseline_walk.index else walk.loc[sid].geometry if sid in walk.index else None
        academy_context[sid] = {"straight_500m_count":len(near), "walkshed_count":len(academy_layer.sindex.query(zone,predicate="intersects")) if zone is not None else None,
                                "facility_ids":near.facility_id.tolist(),"target_categories":near.target_category.value_counts().to_dict(),
                                "arts_sports_count":int(near.arts_sports.sum()),"source_total":len(academies),"geocoded_total":len(academy_layer),
                                "coverage":"geocoded_observations_only"}
    save("academy_school_context.json",academy_context)
    candidate = gpd.read_file(DATA / "candidate_grid_final.geojson").to_crs(5179)
    candidate.geometry = candidate.geometry.centroid
    designations = json.loads((DATA / "context/school_designations.json").read_text(encoding="utf-8"))["records"]
    awards = json.loads((ROOT / "data/education_sources/award_observations.json").read_text(encoding="utf-8"))
    result = []
    for institution in registry.to_dict("records"):
        if institution["학교급구분"] == "초등학교":
            continue
        sid = institution["학교ID"]
        row = {**institution, "analysis_version": "education_v1", "enrollment": forecasts.get(sid, {}),
               "awards": [a for a in awards["records"] if institution_key(a["school_name"],a["school_level"])==institution_key(institution["학교명"],institution["학교급구분"])],
               "award_coverage": awards["coverage"],
               "disclosure_count": len(linked.get(sid, [])), "context": {}, "candidates": [], "similar_schools": [],
               "designations": [d for d in designations if institution_key(d.get("school_name"), d.get("school_level")) == institution_key(institution["학교명"], institution["학교급구분"])],
               "limitations": ["학교 중심점과 보행망을 연결한 도달권. 실제 출입구·통행허용 현장 확인 필요.",
                               "공원면적은 중심점과 공개면적 기반 원형 대체경계의 교차면적 추정. 실제 녹피율이 아님.",
                               "연령별 250m 미래수요를 초등학생 수치로 대체하지 않음. 후보지별 중고생·유아 수혜 추정은 미산출."]}
        if sid not in walk.index or walk_report.loc[sid, "method"] != "exact_edge_trim_v3":
            row["analysis_status"] = "coordinates_or_walk_network_unavailable"
            result.append(row)
            continue
        zone = walk.loc[sid].geometry
        origin = gpd.GeoSeries([Point(institution["경도"], institution["위도"])], crs=4326).to_crs(5179).iloc[0]
        buffer = origin.buffer(500)
        ix = proxies.sindex.query(zone, predicate="intersects")
        accessible = proxies.iloc[ix]
        union = unary_union(accessible.geometry.tolist()) if len(accessible) else None
        area = zone.intersection(union).area if union is not None else 0
        green = 100 * area / zone.area
        case = 1 if len(accessible) == 0 else 2 if green < 1 else 3 if green < 5 else 4
        row.update(analysis_status="available", iso_park_count=len(accessible), iso_park_area=round(area, 2),
                   iso_green_ratio=round(green, 3), display_green_ratio=round(green, 3), isochrone_area_m2=round(zone.area),
                   buf_park_count=len(proxies.sindex.query(buffer, predicate="intersects")), case_type=case,
                   case_label={1:"공원 접근 취약", 2:"공원면적 부족", 3:"공원면적 보통", 4:"공원면적 양호"}[case],
                   priority_score=5-case, walk_origin_offset_m=walk_report.loc[sid, "offset_m"],
                   accessible_park_names=accessible["공원명"].tolist(),
                   iso_official_park_count=len(accessible),
                   iso_functional_park_count=int(accessible.park_function_class.isin(["mid_activity_park", "neighborhood_park_scale"]).sum()),
                   iso_neighborhood_scale_park_count=int((accessible.park_function_class=="neighborhood_park_scale").sum()))
        row.update(no_official_park_flag=int(len(accessible)==0), no_functional_park_flag=int(row["iso_functional_park_count"]==0),
                   no_neighborhood_scale_park_flag=int(row["iso_neighborhood_scale_park_count"]==0),
                   only_micro_park_flag=int(len(accessible)>0 and row["iso_functional_park_count"]==0))
        distances = official.geometry.distance(origin)
        nearest = official.loc[distances.idxmin()]
        row.update(nearest_park_straight_m=round(distances.min()), nearest_park_name=nearest["공원명"],
                   access_ratio=len(accessible)/max(1,row["buf_park_count"]))
        for name, layer in layers.items():
            near = layer.iloc[layer.sindex.query(buffer, predicate="intersects")]
            reach = layer.iloc[layer.sindex.query(zone, predicate="intersects")]
            item = {"straight_500m_count": len(near), "walkshed_count": len(reach), "coverage": "observed_geocoded_records"}
            if name == "academy":
                item.update(facility_ids=near.facility_id.tolist(), target_categories=near.target_category.value_counts().to_dict(),
                            arts_sports_count=int(near.arts_sports.sum()), geocoded_total=len(layer), source_total=len(academies))
            if name == "large_apartment":
                item["households_straight_500m"] = float(pd.to_numeric(near["세대수"], errors="coerce").sum())
            if name == "construction":
                item["coverage"] = "partial_administrative_records_not_current_construction_status"
            row["context"][name] = item
        row["iso_playground_count"] = row["context"]["playground"]["walkshed_count"]
        library = {}
        for depth in ("10","20","30"):
            records = [r for r in linked.get(sid,[]) if r["item"]=="58" and r["depth"]==depth and r["values"].get("PBAN_EXCP_YN")=="N"]
            if records:
                latest = max(records,key=lambda r:r["year"])
                library[depth] = {"year":latest["year"], "values":latest["values"]}
        row["internal_library"] = library
        history = row["enrollment"].get("history", [])
        row["current_students"] = history[-1]["students"] if history else institution.get("current_students")
        row["student_slope"] = row["enrollment"].get("student_slope")
        # Existing candidate eligibility is shared, but elementary demand/scores are not.
        cd = candidate.geometry.distance(origin)
        local = candidate[cd <= 1500].copy()
        local["distance_m"] = cd[cd <= 1500]
        for idx, c in local.sort_values("distance_m").head(12).iterrows():
            pt = gpd.GeoSeries([c.geometry], crs=5179).to_crs(4326).iloc[0]
            row["candidates"].append({"grid_id": c.get("grid_id", str(idx)), "lat": pt.y, "lng": pt.x,
                                      "straight_distance_m": round(c.distance_m), "selection_basis": "기존 250m 후보지 중 학교 인접 후보, 거리순",
                                      "nearest_park_straight_m": round(float(official.geometry.distance(c.geometry).min())),
                                      "age_specific_beneficiaries": None, "land_feasibility_level": c.get("land_feasibility_level")})
        result.append(row)
    for level in sorted({r["학교급구분"] for r in result}):
        cohort = [r for r in result if r["학교급구분"] == level and r["analysis_status"] == "available"]
        ratios = [r["internal_library"].get("10",{}).get("values",{}).get("RATIO") for r in cohort]
        ratios = [float(v) for v in ratios if v is not None and pd.notna(pd.to_numeric(v,errors="coerce"))]
        median = float(np.median(ratios)) if ratios else None
        for r in cohort:
            ratio = r["internal_library"].get("10",{}).get("values",{}).get("RATIO")
            low = ratio is not None and median is not None and float(ratio)<median
            external = r["context"]["library"]["walkshed_count"]>0
            r["reading_gap"] = {"books_per_student":ratio,"same_level_median":median,"internal_low":low if ratio is not None else None,
                                "external_observed":external,"status":"available" if ratio is not None else "internal_supply_unavailable"}
            r["policy_scenarios"] = {}
            for barrier in (False,True):
                action = park_base_action(r["case_type"],barrier)
                if low and not external and r["case_type"]>=3:
                    action = "internal_investment"
                elif low and external and r["case_type"]>=3:
                    action = "institution_link"
                r["policy_scenarios"][str(barrier).lower()] = build_scenarios(action,barrier)
        complete = [r for r in cohort if r.get("current_students") is not None and r.get("student_slope") is not None]
        if len(complete) < 2:
            continue
        features = np.array([[r["current_students"], r["student_slope"], r["context"]["large_apartment"]["straight_500m_count"],
                              r["context"]["redevelopment"]["straight_500m_count"]] for r in complete])
        scaled = StandardScaler().fit_transform(features)
        distances, indices = NearestNeighbors(n_neighbors=min(5,len(complete))).fit(scaled).kneighbors(scaled)
        for i, r in enumerate(complete):
            r["similar_schools"] = [{"school_id": complete[j]["학교ID"], "school_name": complete[j]["학교명"],
                                      "distance": round(float(d), 4), "green_ratio": complete[j]["iso_green_ratio"],
                                      "park_count": complete[j]["iso_park_count"]} for d,j in zip(distances[i],indices[i]) if j != i][:4]
            r["knn_basis"] = "동일 학교급; 학생수·추세·대단지수·재개발수 표준화, k=4. 환경 격차는 결과 비교에 사용."
    save("school_analysis.json", result)
    save("analysis_manifest.json", {"institutions": len(result), "analyzed": sum(r["analysis_status"]=="available" for r in result),
                                    "knn_covered": sum(bool(r["similar_schools"]) for r in result), "source_registry": "registry_manifest.json",
                                    "school_levels": dict(pd.Series([r["학교급구분"] for r in result]).value_counts()),
                                    "parameters": {"walk_distance_m":500,"straight_buffer_m":500,"candidate_radius_m":1500,"knn_k":4,
                                                   "green_thresholds_pct":[1,5],"park_geometry":"published_area_circle_proxy_clipped_union"}})
    print(f"Analyzed {len(result)} institutions", flush=True)


if __name__ == "__main__":
    main()
