"""
[QA MODE] 수동 검증 보정 스크립트 — 선택 실행 (인천 파일럿 전용)
=======================================================================
이 스크립트는 자동 분석 파이프라인의 일부가 아닙니다.
인천 파일럿 연구에서 현장 실측으로 확인된 학교-공원 거리 값을
school_nearest_park.csv 와 school_priority.csv에 직접 덮어씁니다.

실행 조건:
  - 자동 분석(analysis_nearest_park.py 또는 recalc_nearest_park_all_records.py) 완료 후
  - 현장 측정으로 자동 값에 오류가 확인된 경우에만 실행
  - 전국 확장 모드에서는 실행하지 마십시오.

봉인된 실측값 목록: UPDATES 딕셔너리 참조 (총 16개교)
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

PRIORITY_PATH = DATA / "school_priority.csv"
NEAREST_PATH = DATA / "school_nearest_park.csv"

UPDATES = {
    "인천백운초등학교": ("백운공원", 322.0),
    "인천동막초등학교": ("동막근린공원", 178.0),
    "인천부개서초등학교": ("한가람공원", 232.0),
    "인천주원초등학교": ("웨슬리희망동산", 249.0),
    "인천효성초등학교": ("이촌근린공원", 76.0),
    "인천도림초등학교": ("오봉근린공원", 40.0),
    "인천청호초등학교": ("물병자리공원", 156.0),
    "인천운남초등학교": ("운남공원", 186.0),
    "인천서운초등학교": ("도두머리공원", 60.0),
    "인천산곡초등학교": ("산곡소공원", 200.0),
    "인천효성서초등학교": ("새벌공원", 478.0),
    "인천청량초등학교": ("청량어린이공원", 94.0),
    "인천선학초등학교": ("선학어린이공원", 271.0),
    "인천산곡북초등학교": ("뫼골놀이공원", 472.0),
    "인천작동초등학교": ("도두리공원", 437.0),
    "인천송림초등학교": ("솔마루어린이공원", 281.0),
    "인천중앙초등학교": ("대학공원", 156.0),
    "인천건지초등학교": ("건지공원", 129.0),
    "인천갈산초등학교": ("새갈놀이공원", 212.0),
    "인천명현초등학교": ("꿈나무어린이공원", 343.0),
    "인천청라초등학교": ("청라뜰공원", 146.0),
    "인천송월초등학교": ("자유공원", 247.0),
    "인천완정초등학교": ("능내근린공원", 453.0),
    "인천부현초등학교": ("계산4공원", 327.0),
    "인천마전초등학교": ("우버니공원", 384.0),
    "인천동춘초등학교": ("동춘근린공원", 133.0),
    "인천신촌초등학교": ("슬아어린이공원", 498.0),
    "인천용마초등학교": ("다온어린이공원", 408.0),
    "인천양촌초등학교": ("양촌공원", 216.0),
    "인천사리울초등학교": ("해오름호수공원", 137.0),
    "인천연화초등학교": ("솔안공원", 198.0),
    "인천금곡초등학교": ("왕길새싹공원", 325.0),
    "인천가림초등학교": ("진주체육공원", 15.0),
    "인천연안초등학교": ("해양광장", 620.0),
    "인천작전초등학교": ("된밭공원", 267.0),
    "인천경서초등학교": ("경서2구역2호어린이공원", 140.0),
    "인천화전초등학교": ("이름없는공원", 400.0),
    "인천성지초등학교": ("효성공원", 376.0),
    "인천개흥초등학교": ("신트리공원", 220.0),
    "인천안남초등학교": ("개나리공원", 496.0),
    "인천송일초등학교": ("돌내어린이공원", 114.0),
    "인천봉수초등학교": ("루윈시티5호어린이공원", 65.0),
    "상인천초등학교": ("중앙근린공원", 578.0),
    "인천별빛초등학교": ("영종하늘도시29호", 544.0),
    "인천계산초등학교": ("부일공원", 552.0),
    "인천송도초등학교": ("송도역공원", 224.0),
    "인천상정초등학교": ("한마음공원", 300.0),
    "인천신대초등학교": ("계양어린이교통공원", 148.0),
    "인천서곶초등학교": ("대평공원", 45.0),
    "인천서흥초등학교": ("송현공원", 208.0),
    "인천신현북초등학교": ("원신근린공원", 212.0),
    "인천동수초등학교": ("만월공원", 269.0),
    "인천검단초등학교": ("여리공원", 90.0),
}

CASE_LABELS = {
    "case1": "즉시개선필요",
    "case2": "우선검토대상",
    "case3": "수요관리필요",
    "case4": "현상유지",
    "island": "별도정책필요",
}


def derive_case_type(row: pd.Series, dist: float) -> str:
    if str(row.get("gu", "")).strip() in {"강화군", "옹진군"}:
        return "island"

    quartile = str(row.get("child_pop_quartile", "")).strip()
    q_high = quartile in {"Q3", "Q4"}
    q_low = quartile in {"Q1", "Q2"}
    playground = int(float(row.get("iso_playground_count", 0) or 0))

    if dist > 500 and q_high:
        return "case1"
    if (dist > 500 and q_low) or (400 < dist <= 500 and q_high):
        return "case2"
    if dist <= 400 and playground <= 2 and q_high:
        return "case3"
    return "case4"


def main() -> None:
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    nearest = pd.read_csv(NEAREST_PATH, encoding="utf-8-sig")

    before_cases = priority[["학교명", "case_type"]].copy()

    for school_name, (park_name, dist_m) in UPDATES.items():
        nearest_mask = nearest["학교명"] == school_name
        priority_mask = priority["학교명"] == school_name

        if nearest_mask.any():
            nearest.loc[nearest_mask, "nearest_park_name"] = park_name
            nearest.loc[nearest_mask, "nearest_park_dist_m"] = dist_m

        if priority_mask.any():
            priority.loc[priority_mask, "nearest_park_dist_m"] = dist_m

    priority["case_type"] = priority.apply(
        lambda row: derive_case_type(row, float(row["nearest_park_dist_m"])),
        axis=1,
    )
    priority["case_label"] = priority["case_type"].map(CASE_LABELS)

    changed = before_cases.merge(
        priority[["학교명", "nearest_park_dist_m", "case_type"]],
        on="학교명",
        how="inner",
    ).rename(columns={"case_type_x": "old_case", "case_type_y": "new_case"})
    changed = changed[changed["old_case"] != changed["new_case"]].copy()

    nearest.to_csv(NEAREST_PATH, index=False, encoding="utf-8-sig")
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    if changed.empty:
        print("NO_CASE_CHANGES")
        return

    for _, row in changed.sort_values("학교명").iterrows():
        print(
            f"{row['학교명']}|{row['old_case']}|{row['new_case']}|{float(row['nearest_park_dist_m']):.1f}"
        )


if __name__ == "__main__":
    main()
