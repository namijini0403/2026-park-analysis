"""
Region-specific configuration for Incheon pilot study.

Usage (auto analysis / national expansion mode):
  from scripts.config.region_config import CITY_NAME, DEMO_DISTRICT

Usage (QA mode — Incheon pilot overrides):
  Apply MANUAL_BARRIER_OVERRIDES from app/src/config/manualQAOverrides.ts
  Run update_manual_verified_nearest_parks.py as an optional QA step.

To adapt for another city, replace the constants below and supply
the equivalent raw data under data/raw/.
"""

# ── 행정 구역 ─────────────────────────────────────────────
CITY_NAME = "인천광역시"
CITY_SHORT = "인천"
CITY_EDUCATION_OFFICE = "인천광역시교육청"
DEMO_DISTRICT = "미추홀구"          # pilot/demo analysis district

# ── 도시 평균 (전체 활성 학교 기준, 2026-04-18 산출, N=240) ─
CITY_AVG = {
    "nearest_park_dist": 378.886,   # meters
    "green_ratio": 8.068,           # percent
    "playground_count": 0.383,
    "student_trend_pct": -8.470,    # percent change
}

# ── 공간 필터 경계 (EPSG:4326) ────────────────────────────
INCHEON_BBOX = {
    "min_lon": 126.3,
    "max_lon": 126.9,
    "min_lat": 37.3,
    "max_lat": 37.7,
}
