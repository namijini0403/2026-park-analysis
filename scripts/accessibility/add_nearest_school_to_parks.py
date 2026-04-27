# -*- coding: utf-8 -*-
from pathlib import Path

import pandas as pd
from geopy.distance import geodesic


ROOT = Path(r"c:\2026_data_analysis_park")
PARKS_PATH = ROOT / "data/processed" / "parks.csv"
SCHOOLS_PATH = ROOT / "data/processed" / "schools.csv"
OUT_PATH = ROOT / "data/processed" / "parks_with_nearest_school.csv"


def main() -> None:
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")

    school_points = []
    for _, row in schools.iterrows():
        school_points.append(
            {
                "학교명": row["학교명"],
                "coords": (row["위도"], row["경도"]),
            }
        )

    nearest_names = []
    nearest_dists = []

    for _, park in parks.iterrows():
        park_coords = (park["위도"], park["경도"])
        nearest_school = None
        nearest_dist_m = None

        for school in school_points:
            dist_m = geodesic(park_coords, school["coords"]).meters
            if nearest_dist_m is None or dist_m < nearest_dist_m:
                nearest_school = school["학교명"]
                nearest_dist_m = dist_m

        nearest_names.append(nearest_school)
        nearest_dists.append(round(nearest_dist_m, 2) if nearest_dist_m is not None else None)

    parks["nearest_school"] = nearest_names
    parks["nearest_school_dist_m"] = nearest_dists
    parks.to_csv(OUT_PATH, index=False, encoding="utf-8-sig")

    print(f"저장 완료: {OUT_PATH}")
    print(f"행수: {len(parks)}")
    print(parks[['공원명', 'nearest_school', 'nearest_school_dist_m']].head(10).to_string(index=False))


if __name__ == "__main__":
    main()
