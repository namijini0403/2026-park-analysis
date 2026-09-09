"""Normalize official academy course rows to facilities and geocode public addresses."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.context.kakao_client import KakaoLocalClient, coord_valid

SOURCE = "https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11841&nttSn=3381948"
SOURCE_DATE = "2026-08-01"


def classify_courses(text):
    levels = [label for label, pattern in [("elementary", r"초등|초[1-6](?![\d급])|초[\s·,/]*중"),
              ("middle", r"중등|중학|중[1-3](?![\d급])|초[\s·,/]*중|중[\s·,/]*고"),
              ("high", r"고등|고교|고[1-3](?![\d급])|중[\s·,/]*고"), ("kindergarten", r"유아|유치|미취학")]
              if re.search(pattern, text)]
    arts = bool(re.search(r"음악|미술|무용|예능|예체능|체육|피아노|발레|댄스|태권도|검도", text))
    if "elementary" in levels and any(x in levels for x in ("middle", "high")):
        category = "integrated"
    elif "middle" in levels and "high" in levels:
        category = "secondary"
    elif len(levels) == 1:
        category = levels[0]
    else:
        category = "unknown" if not levels else "mixed"
    return levels, category, arts


def normalize(path):
    frames = []
    sheets = pd.read_excel(path, sheet_name=None)
    for sheet, df in sheets.items():
        df.columns = df.columns.str.strip()
        name = "교습소명" if "교습소명" in df else "학원명"
        address = "교습소주소" if "교습소주소" in df else "학원주소"
        if name not in df or address not in df:
            raise ValueError(f"Unknown sheet structure: {sheet}")
        for r in df.fillna("").to_dict("records"):
            if not str(r[name]).strip() or not str(r[address]).strip():
                continue
            frames.append({"name": str(r[name]).strip(), "address": re.sub(r"\s+", " ", str(r[address])).strip(),
                           "facility_type": "교습소" if name == "교습소명" else "학원",
                           "course": " / ".join(str(r.get(k, "")) for k in ("분야구분", "교습계열", "교습과정", "교습과목(반)")),
                           "sheet": sheet})
    df = pd.DataFrame(frames)
    facilities = []
    for (name, address, kind), group in df.groupby(["name", "address", "facility_type"], sort=True):
        courses = sorted(set(group.course))
        levels, category, arts = classify_courses(" | ".join(courses))
        facilities.append({"facility_id": "ACA-" + hashlib.sha256(f"{kind}|{name}|{address}".encode()).hexdigest()[:16],
                           "name": name, "address": address, "facility_type": kind,
                           "course_evidence": courses, "target_levels": levels, "target_category": category,
                           "arts_sports": arts, "course_row_count": len(group), "source_sheets": sorted(set(group.sheet)),
                           "lat": None, "lng": None, "coordinate_status": "not_geocoded",
                           "source_url": SOURCE, "reference_date": SOURCE_DATE})
    return facilities, len(frames)


def road_building_address(address):
    match=re.match(r'^(인천(?:광역시)?\s+.+?(?:대로|로|길)\s+\d+(?:-\d+)?)(?=\s|,|\(|$)',address)
    return match[1].strip() if match else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geocode", action="store_true")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    raw = ROOT / "data/education_sources/academies_20260801.xlsx"
    if args.fetch:
        response = requests.get("https://www.ice.go.kr/comm/nttFileDownload.do?fileKey=fcdf42df81f44832c60de85eb28c38ca",timeout=60)
        response.raise_for_status()
        if not response.content.startswith(b"PK"):
            raise ValueError("Expected official XLSX download")
        raw.parent.mkdir(parents=True,exist_ok=True)
        raw.write_bytes(response.content)
    out = ROOT / "data_processed/education"
    out.mkdir(parents=True, exist_ok=True)
    facilities, count = normalize(raw)
    client = KakaoLocalClient(cache_path=ROOT / "data/education_sources/academy_geocode_cache.json", offline=not args.geocode)
    for i, f in enumerate(facilities):
        if args.limit and i >= args.limit:
            break
        query = re.split(r"\s*,|\(", f["address"])[0].strip()
        # Keep 2026 district names as published; never silently rewrite district identities.
        try:
            docs = client.search_address(query).get("documents", [])
            if len(docs) == 1:
                d = docs[0]
                lat, lng = float(d["y"]), float(d["x"])
                if coord_valid(lat, lng) and d.get("address_name", "").startswith("인천"):
                    f.update(lat=lat, lng=lng, coordinate_status="address_geocoded",
                             geocode_query=query, matched_address=d.get("address_name"), coordinate_source="Kakao Local address")
            fallback=road_building_address(f['address'])
            if f['lat'] is None and fallback and fallback!=query:
                fallback_docs=client.search_address(fallback).get('documents',[])
                if len(fallback_docs)==1:
                    d=fallback_docs[0]
                    matched=(d.get('road_address') or {}).get('address_name','')
                    canonical=road_building_address(matched)
                    lat,lng=float(d['y']),float(d['x'])
                    if canonical and canonical.rsplit(' ',2)[-2:]==fallback.rsplit(' ',2)[-2:] and coord_valid(lat,lng):
                        f.update(lat=lat,lng=lng,coordinate_status='road_building_geocoded',geocode_query=fallback,
                                 matched_address=matched,coordinate_source='Kakao Local address',
                                 coordinate_note='공개 주소의 도로명·건물번호 일치. 호수·층수는 좌표 조회에서만 제외; 건물 대표좌표이며 출입구 아님.')
            if f["lat"] is None:
                f["coordinate_status"] = "unresolved"
        except Exception as exc:
            f["coordinate_status"] = "geocode_failed"
            f["coordinate_error"] = type(exc).__name__
        if (i + 1) % 100 == 0:
            client.save()
            (out / "academies.json").write_text(json.dumps(facilities, ensure_ascii=False), encoding="utf-8")
            print(f"Geocoded {i+1}/{len(facilities)}", flush=True)
    client.save()
    (out / "academies.json").write_text(json.dumps(facilities, ensure_ascii=False), encoding="utf-8")
    manifest = {"source_url": SOURCE, "reference_date": SOURCE_DATE, "source_sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
                "source_course_rows": count, "facilities": len(facilities),
                "coordinate_status": pd.Series([f["coordinate_status"] for f in facilities]).value_counts().to_dict(),
                "target_categories": pd.Series([f["target_category"] for f in facilities]).value_counts().to_dict(),
                "notes": ["명칭+주소+시설종류로 과목별 중복행 통합. 등록번호가 없어 동일시설 판별에 한계 있음.",
                          "초급·중급·고급은 학년이 아님. 학교급 명시 없는 과정은 대상 미확인.",
                          "예체능 여부와 대상 학교급은 별도 축. 유료 민간시설 관측은 공공공원 공급을 대체하지 않음."]}
    (out / "academies_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
