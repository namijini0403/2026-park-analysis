"""Build a source-backed multi-level registry without replacing elementary baselines."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
SCHOOL_URL = "https://www.data.go.kr/data/15021148/standard.do"
KINDER_URL = "https://e-childschoolinfo.moe.go.kr/"


def read_csv(path):
    for encoding in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Unsupported encoding: {path}")


def fetch_locations(out):
    session = requests.Session()
    header = session.get("https://www.data.go.kr/download/columList.json",
                         params={"pk": 15021148, "ext": "JSON"}, timeout=40)
    header.raise_for_status()
    h = header.json()
    records = []
    for page in range(1, (h["totalCount"] + 9999) // 10000 + 1):
        params = {k: h["tableVO"][k] for k in ("colNmList", "svcTableNm")}
        params.update(totalCount=h["totalCount"], perPage=10000, page=page, publicDataPk=15021148)
        response = session.get("https://www.data.go.kr/download/standard.json", params=params, timeout=60)
        response.raise_for_status()
        records.extend(response.json())
    if len(records) != h["totalCount"]:
        raise ValueError("Location download incomplete")
    mapping = {x["columCode"]: x["columNm"] for x in h["columList"]}
    records = [{mapping.get(k, k): v for k, v in r.items()} for r in records]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"records": records}, ensure_ascii=False), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, default=ROOT / "data/education_sources")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--geocode-missing", action="store_true")
    parser.add_argument("--out", type=Path, default=ROOT / "data_processed/education")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    location_path = ROOT / "data/education_sources/school_locations.json"
    if args.fetch:
        fetch_locations(location_path)
    if not location_path.exists():
        location_path = args.raw_dir / "전국초중등학교위치표준데이터.json"
    records = json.loads(location_path.read_text(encoding="utf-8"))["records"]
    corrections_path = ROOT / 'data/education_sources/school_registry_corrections.json'
    if corrections_path.exists():
        from scripts.education.registry_corrections import apply_corrections
        records = apply_corrections(records, json.loads(corrections_path.read_text(encoding='utf-8')))
    rows = []
    for r in records:
        if r.get("시도교육청명") != "인천광역시교육청" or r.get("운영상태") != "운영":
            continue
        if r.get("학교급구분") not in ("초등학교", "중학교", "고등학교"):
            continue
        rows.append({**{k: r.get(k) for k in ("학교ID", "학교명", "위도", "경도", "소재지도로명주소", "학교급구분", "설립형태", "데이터기준일자")},
                     "source_url": SCHOOL_URL, "id_method": "official_school_id",
                     "registry_correction":r.get('registry_correction')})
    sources = [location_path]
    if corrections_path.exists():sources.append(corrections_path)
    trends = []
    kindergarten_files = {}
    for directory in [args.raw_dir,args.raw_dir / 'kindergarten']:
        for path in directory.glob('유치원 일반 현황_*1_인천광역시.csv'):
            year=int(path.name.split('_')[1][:4])
            try:
                frame=read_csv(path)
            except pd.errors.EmptyDataError:
                continue
            if not frame.empty:
                kindergarten_files[year]=(path,frame)
    latest_kindergarten_year=max(kindergarten_files)
    for year,(path,frame) in sorted(kindergarten_files.items()):
        sources.append(path)
        for r in frame.fillna("").to_dict("records"):
            # No official ID in the supplied disclosure; label the deterministic local ID.
            sid = "KLOCAL-" + hashlib.sha256((r["유치원명"] + "|" + str(r["설립일"])).encode()).hexdigest()[:16]
            age_cols = ("만3세원아수", "만4세원아수", "만5세원아수", "혼합원아수")
            counts = [pd.to_numeric(r.get(k), errors="coerce") for k in age_cols]
            total = sum(counts) if all(pd.notna(x) for x in counts) else None
            trends.append({"학교ID": sid, "학교명": r["유치원명"], "year": year, "students": total,
                           "special_class_students": pd.to_numeric(r.get("특수원아수"), errors="coerce"),
                           "source_url": KINDER_URL, "reference_period": f"{year}년 1차 공시"})
            if year == latest_kindergarten_year:
                rows.append({"학교ID": sid, "학교명": r["유치원명"], "위도": r["위도"], "경도": r["경도"],
                             "소재지도로명주소": r["주소"], "학교급구분": "유치원", "설립형태": r["설립유형"],
                             "데이터기준일자": f"{year}년 1차 공시", "source_url": KINDER_URL,
                             "education_support_name":r.get('교육지원청명'),
                             "id_method": "local_name_establishment_date", "current_students": total,
                             "capacity": pd.to_numeric(r["인가총정원수"], errors="coerce")})
    df = pd.DataFrame(rows)
    if df["학교ID"].duplicated().any():
        raise ValueError("Duplicate institution IDs; resolve identities before analysis")
    for col in ("위도", "경도"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["coordinate_status"] = df.apply(lambda r: "available" if 36 <= r["위도"] <= 39 and 124 <= r["경도"] <= 128 else "missing_or_invalid", axis=1)
    df["coordinate_source"] = "official_disclosure"
    from scripts.context.kakao_client import KakaoLocalClient, coord_valid
    client = KakaoLocalClient(cache_path=ROOT / "data/education_sources/school_geocode_cache.json", offline=not args.geocode_missing)
    for idx, row in df[df.coordinate_status != "available"].iterrows():
        docs = client.search_address(row["소재지도로명주소"]).get("documents", [])
        if len(docs) == 1 and docs[0].get("address_name", "").startswith("인천"):
            lat, lng = float(docs[0]["y"]), float(docs[0]["x"])
            if coord_valid(lat, lng):
                df.loc[idx, ["위도", "경도", "coordinate_status", "coordinate_source"]] = [lat, lng, "available", "Kakao address geocode; invalid original coordinates replaced"]
    client.save()
    df["gu"] = df["소재지도로명주소"].str.extract(r"인천광역시\s+(\S+)")
    df.sort_values(["학교급구분", "학교ID"]).to_csv(args.out / "institutions.csv", index=False, encoding="utf-8-sig")
    df[(df["학교급구분"] != "초등학교") & (df.coordinate_status == "available")].to_csv(args.out / "new_school_coords.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(trends).to_csv(args.out / "kindergarten_enrollment.csv", index=False, encoding="utf-8-sig")
    manifest = {"counts": df["학교급구분"].value_counts().to_dict(), "coordinate_status": df.coordinate_status.value_counts().to_dict(),
                "sources": [{"file": p.name, "path": os.path.relpath(p, ROOT), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in sources],
                "notes": ["원자료의 기준시점이 서로 다름. 현재 운영 여부를 2026년 현황으로 일괄 해석하지 않음.",
                          "유치원 특수학급 원아수는 별도 보존. 일반 연령별 원아수와 중복 여부 미확인으로 합산하지 않음."]}
    (args.out / "registry_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
