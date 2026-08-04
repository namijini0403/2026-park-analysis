/**
 * regionConfig.ts
 *
 * 인천 실증 모드 (Incheon Pilot Mode)
 * ------------------------------------
 * 이 파일은 현재 인천광역시 실증 분석에 특화된 고정값을 담습니다.
 * 전국 확장 모드로 전환할 때는 이 파일의 상수만 교체하거나,
 * 백엔드 API / generate_statistics_preview_data_safe.py 출력 JSON에서
 * 동적으로 주입받는 방식으로 대체하십시오.
 *
 * 전국 확장 모드 (National Expansion Mode)
 * -----------------------------------------
 * CITY_AVG 값은 대상 도시의 school_priority.csv 전수 통계로 자동 산출됩니다.
 * 앱 실행 시 _cityAvg 컬럼이 주입되면 아래 fallback 상수는 사용되지 않습니다.
 * fallback은 데이터 누락 시 화면이 깨지지 않도록 방어용으로만 존재합니다.
 *
 * 하드코딩 근거:
 *   2026-04-18, OSMnx v2 + 공원 합집합 교차 면적 수정 반영 (active schools N=240)
 *   재산출 시 scripts/export/generate_statistics_preview_data_safe.py 결과를 반영할 것.
 */

// ── 대상 도시 표기 ────────────────────────────────────────────────────────────
export const CITY_NAME = "인천광역시";
export const CITY_SHORT_NAME = "인천시";
export const DEMO_DISTRICT_NAME = "미추홀구"; // 발표 시연 기준 구

// ── 도시 평균값 (Fallback) ────────────────────────────────────────────────────
// 우선순위: _cityAvg 컬럼 > 아래 상수 (fallback)
export const CITY_AVG = {
  nearestParkDist: 378.886,   // 최근접 공원 도보거리 평균 (m)
  greenRatio: 8.068,          // 도보 생활권 녹지 비율 평균 (%)
  playgroundCount: 0.383,     // 도보 생활권 놀이터 수 평균 (개)
  studentTrendPct: -8.470,    // 학생수 증감률 평균 (%)
} as const;
