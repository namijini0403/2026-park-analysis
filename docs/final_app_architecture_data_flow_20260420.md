# 인천 초등학교 야외활동환경 분석 앱

전체 앱 구조·데이터 흐름·모델 파이프라인 최종안 정리

작성 기준일: 2026-04-20

작성 기준: `CONTEXT.md` 및 현재 코드베이스의 최종 채택 버전. 시행착오성 중간 산출물은 제외하되, 최종안을 선별하기 위해 필요했던 비교 실험은 포함했다.

문서 목적: 프로젝트를 처음 보는 사람이 앱 구조, 데이터 흐름, 전처리, EDA, 모델, AI 추천 로직, 핵심 설계 철학을 한 번에 파악하고 재현·검수할 수 있도록 정리한다.

## 1. 프로젝트 요약

이 프로젝트는 인천광역시 초등학교 272개교를 대상으로 학교 주변에서 아이들이 실제로 걸어서 접근 가능한 공원·녹지·야외활동 공간이 충분한가를 분석하고, 부족 학교에 대해 후보지를 탐색·비교·추천하는 웹 기반 의사결정 지원 앱이다.

핵심은 단순한 직선거리 500m가 아니라 실제 보행 네트워크 500m, 도로 단절요소, 공원 유형, 녹지 면적, 미래 아동 수요를 함께 보는 것이다. 미추홀구는 데모 지역으로 상세 시각화를 제공하지만, 분석 기준은 인천 전체 학교에 동일하게 적용된다.

최종 운영 관점에서 학교별 현재 취약성, 2029/2031 학생 규모 전망, 후보지별 250m 잠재수요, 기존 시설과의 중복 여부, 도로 횡단 위험을 분리해 관리한다. 하나의 임의 종합점수로 모든 것을 결정하지 않고, 정책적 의미가 다른 지표를 구분해 보여주는 것이 최종 철학이다.

## 2. 최종 앱 구조

메인 진입점은 `index.html`이다. Kakao Map을 기반으로 학교, 공원, 실제 도보 500m 권역, 직선 500m 버퍼, 재개발, 대단지 아파트, 유치원, 후보지 레이어를 제어한다.

지도에서 학교 마커를 누르면 학교 상세 패널과 React iframe 리포트가 열리고, 후보지 마커를 누르면 후보지별 잠재수요와 인근 학교 학생 수를 확인할 수 있다.

React 앱의 엔트리는 `ui-preview/src/main.tsx`이며, `PreviewWorkspaceSafe.tsx`가 상세 리포트, 후보지 시뮬레이션, 통계 페이지를 전환한다.

- `SchoolDetailReportPagePreview.tsx`: 학교별 상세 리포트. 현재 접근성, 녹지, 학생 전망, 유사학교, 후보지 요약을 보여준다.
- `SimulationPage.tsx`: 후보지별 AI 추천순위, 수동 필터·가중치 조정, 후보지 카드 비교를 제공한다.
- `StatisticsPageSafe.tsx`: 인천 전체 및 구군 단위 통계를 안전한 정적 데이터로 보여준다.
- `schoolDataBridge.ts`: CSV/GeoJSON 원천 필드를 리포트와 시뮬레이션 UI가 쓰는 props로 변환한다.
- 최종 UI에서는 어린이집 데이터를 연결하지 않기로 했으므로 하단 필터 버튼 표기는 "유치원"으로 고정한다.

## 3. 주요 데이터 로딩 경로

- `schools`: `data_processed/school_priority.csv`
- `schoolCoords`: `data_processed/schools.csv`
- `studentTrend`: `data_processed/student_trend.csv`
- `nearestPark`: `data_processed/school_nearest_park.csv`
- `beneficiaryForecast`: `data_processed/school_enrollment_forecast_20260418_model1.csv`
- `similarSchools`: `data_processed/school_similar_schools_top5.csv`
- `candidateBarrierRoutes`: `data_processed/candidate_barrier_routes_by_school.json`
- `guSummary`: `data_processed/gu_summary.csv`
- `parks`: `data_processed/parks.csv`
- `isochrone`: `data_processed/isochrone_valhalla.geojson`
- `buffer`: `data_processed/school_buffer_500m.geojson`
- `redevelopment`: `data_processed/redevelopment_geocoded.csv`
- `largeApt`: `data_processed/large_apt_complexes_2025.csv`
- `candidateFeatures`: `data_processed/candidate_grid_final.geojson`

## 4. 전체 데이터 흐름

최종 데이터 흐름은 "원천 데이터 수집 → 표준화·좌표화 → 실제 보행권/시설 접근성 산출 → 실측 봉인값 적용 → case 분류 및 우선순위 산정 → 미래 수요 모델링 → 후보지 생성·검수 → 웹 앱 시각화·시뮬레이션" 순서로 정리된다.

- 원천 데이터는 초등학교, 학생 수 시계열, 공원·녹지·놀이터, 행정구역, 격자 인구, 재개발, 대단지 아파트, 유치원, OSM 도로망과 학교·대학 폴리곤을 포함한다.
- 표준화 단계에서는 CP949/UTF-8 인코딩, 학교명·주소·행정동·좌표계, 컬럼명, 결측·중복, WGS84 좌표를 정리한다.
- 공간 분석 단계에서는 실제 도보 500m 권역, 직선 500m 버퍼, 공원과 녹지 면적, 가장 가까운 공원 거리, 도로 횡단 단절요소를 산출한다.
- 앱 단계에서는 `index.html`이 지도 레이어를 구성하고 React iframe이 상세 리포트·시뮬레이션·통계를 제공한다.

## 5. EDA 핵심 발견

초기 EDA에서 직선거리 500m 안에 있어 보이는 공원·녹지가 실제 보행 네트워크로는 접근하기 어려운 경우가 반복적으로 확인됐다. 평균적으로 실제 보행 접근 가능 면적은 직선 버퍼 면적의 약 40.16% 수준으로 관측되어, 최종 분석 기준은 직선거리가 아니라 실제 도보 500m로 고정했다.

일부 학교는 행정구역이나 직선 반경상 공원이 많아 보이지만 실제 보행권으로 들어오는 공원은 매우 적었다. 이는 "근처에 공원이 많다"는 말이 정책적으로 충분하지 않으며, 아이들이 실제로 안전하게 걸어갈 수 있는지를 따로 검증해야 함을 보여준다.

놀이터, 완충녹지, 경관녹지, 연결녹지, 수변·하천 공간은 모두 아이들의 야외활동 가능성과 정책적 의미가 다르다. 최종 case 산정에서는 공공 공원 접근성을 중심으로 보되, 놀이터는 보조 지표로 분리했다.

## 6. 전처리 및 공간분석 파이프라인

공공데이터에서 흔한 CP949 파일을 UTF-8 흐름으로 통일하고, 학교명·주소·행정동·좌표·시설유형을 표준화한다.

실제 보행권은 OSM 도로망과 Valhalla 기반 isochrone으로 계산한다. 학교 좌표를 중심으로 "걸어서 500m 이내 도달 가능한 면"을 만들고, 그 안에 들어오는 공원 수, 공원 면적, 녹지 면적, 도로 단절 여부를 산출한다.

이 방식은 직선거리 중심 분석과 달리 강, 철도, 대로, 우회 경로, 횡단 필요성 등 실제 이동 조건을 반영할 수 있다.

단절요소는 단순한 거리 가중치가 아니라 후보지 필터와 설명 근거로 사용한다. 특히 AI 추천 기본값에서는 중간급 이상 도로 횡단을 가능하면 피하고, 후보지가 전혀 없을 때만 중간급 도로 횡단을 허용한다.

## 7. Case 분류 및 우선순위 체계

강화군, 옹진군, 분교, 분교장은 일반 도시부 학교와 동일한 비교군으로 섞지 않고 별도 정책 묶음으로 분리한다.

- `case1`: 가장 가까운 공원이 500m 이상이고 실제 도보권 내 공원이 없는 학교. 즉시 개선 검토군이다.
- `case2`: 공원은 접근 가능하지만 도보권 내 녹지 수준이 낮은 학교. 우선 검토군이다.
- `case3`: 공원 접근 가능성과 녹지 수준이 중간인 학교. 모니터링군이다.
- `case4`: 공원 접근 가능성과 녹지 수준이 상대적으로 양호한 학교. 유지·관리군이다.

2026-04-18 최종 보정에서는 `case1`은 하드 조건으로 유지하고, `case2~case4`는 공원이 하나 이상 있거나 최근접 공원이 500m 미만인 학교를 비교군으로 두어 녹지 수준에 따라 나눈다.

우선순위는 case 안에서 대상을 정렬하기 위한 보조 장치다. case 자체가 정책 분류이고, priority rank는 같은 case 안에서 어느 학교를 먼저 볼지 돕는 순위다.

`case_type`, `case_label`, `priority_score`, `priority_rank`, `is_low_access_tag`, `is_case_conflict_tag`, `is_separate_bundle_tag`는 예측 모델의 입력이 아니라 결과 또는 설명 값이다.

## 8. 실측 봉인값과 검수 체계

자동 공간분석은 도로망 누락, 공원 경계 누락, 시설 유형 오분류, 학교 출입구 위치 차이 때문에 일부 학교에서 오류가 날 수 있다. 따라서 최종 데이터에는 현장·지도 검수로 확인한 실측 봉인값을 우선 적용한다.

- 봉인값 저장 파일: `output/sealed_nearest_park_dist.json`
- 적용 산출물: `data_processed/school_priority.csv`, `data_processed/school_nearest_park.csv`
- 원칙: 봉인값은 자동 계산보다 우선하며, 두 파일의 거리·공원명·case가 서로 일관되어야 한다.

대표 검수 사례로 인천새봄초는 동춘1구역근린공원이 약 50m 앞에 있고 도로 단절도 없어서 녹지 0% 또는 공원 없음으로 처리되면 오류다. 인천만석초, 인천경원초, 인천석남초, 인천신석초 등도 유사하게 수동 확인값이 반영된다.

## 9. 학교별 2029/2031 학생 규모 전망

학교별 학생 규모 전망은 학교 상세 리포트와 통계 페이지에서 해당 학교의 미래 학생 수 또는 수혜 규모 맥락을 보여주기 위한 모델이다. 후보지별 250m 잠재수요와는 목적이 다르므로 별도 모델·별도 컬럼으로 관리한다.

- 최종 파일: `data_processed/school_enrollment_forecast_20260418_model1.csv`
- 모델 버전: `school_enrollment_model1_walk_forward_recursive_20260418`
- 최종 채택 모델: `weighted_trend_plus_lgbm_residual`

최종 모델을 고르기 위해 두 가지 접근을 비교했다. Model 1은 학교별 가중 선형 추세에 LightGBM residual correction을 더한 방식이고, Model 2는 ElasticNet 시계열 feature와 구 단위 Prophet 보정을 결합한 방식이다.

- 1년 walk-forward: Model 2가 R² 0.9733, MAE 33.64로 Model 1의 R² 0.9651, MAE 37.28보다 약간 좋았다.
- 2년 recursive: Model 1이 R² 0.9426, MAE 48.17로 Model 2의 R² 0.9223, MAE 60.10보다 좋았다.
- 3년 recursive: Model 1이 R² 0.9214, MAE 61.50으로 Model 2의 R² 0.8529, MAE 82.19보다 안정적이었다.
- 2~3년 평균: Model 1은 R² 0.9320, MAE 54.84이고 Model 2는 R² 0.8876, MAE 71.14였다.

2029/2031은 단기 1년 예측이 아니라 중기 recursive 예측에 가깝다. 따라서 최종 채택 기준은 1년 성능보다 2~3년 안정성이고, 이에 따라 Model 1을 최종 사용한다.

## 10. 후보지 250m 잠재수요 모델

후보지 잠재수요는 "이 후보지를 설치했을 때 실제로 걸어서 접근할 수 있는 250m 주변 아동 수요가 어느 정도인가"를 표현한다. 이는 학교 전체 학생 수 전망과 다르며, 기존의 인접예상아동수 또는 학교 단위 예측값을 그대로 쓰면 후보지별 차이를 잘못 보여줄 수 있다.

최종 앱에서 후보지 카드와 첫 화면 후보지 팝업의 잠재수요인원은 `walkshed_beneficiary_2029/2031`을 우선 사용한다. `pred_beneficiary_2029/2031`은 인접·거주 아동 기반 값으로 보조 또는 fallback에 해당한다.

최종 후보지 수요 모델은 구 단위 시간 추세와 격자 단위 공간 분배를 결합한다.

- 구 단위 시간축: 구별 아동 총량 또는 성장률을 예측한다.
- 혼합 총량: 2029는 cohort 0.8 + Prophet 0.2, 2031은 cohort 0.7 + Prophet 0.3 비율로 최종 총량을 만든다.
- 1km→250m 공간 분배: 250m 인구 비중을 기본 share로 두고, LightGBMRegressor 얕은 트리로 share correction을 수행한다.
- 정규화: 1km 격자 안에서 보정 share의 합이 1이 되도록 정규화해 총량이 새지 않게 한다.
- 후보지 결합: `candidate_grid_final.geojson`에 `pred_beneficiary_2029/2031`, `walkshed_beneficiary_2029/2031`, `candidate_child_current`, `demand_model_version`을 저장한다.

공간 분배 보정에는 `pop_250m`, `child_ratio_1km`, `nearest_park_dist`, `nearest_school_dist`, `nearest_pg_dist`, `nearest_apt_dist`, `large_apt_count_500m`, 좌표, 구 정보를 사용한다. 재개발 정보는 수요 모델의 직접 feature로 넣지 않고 경고·참고 레이어로만 둔다.

Prophet backtest는 50개 검증행 기준 MAE 1041.08, RMSE 1792.24, R² 0.9935, MAPE 3.25% 수준으로 정리됐다.

이전의 후보지 XGBoost식 예측은 학교 단위 또는 인접예상아동수 성격이 섞여 후보지별 250m walkshed 잠재수요를 직접 표현하기 어렵다는 문제가 있었다. 최종안에서는 학교 단위 전망과 후보지 단위 잠재수요를 분리하고, 앱 표시도 `walkshed_beneficiary` 값을 우선하도록 수정했다.

## 11. 후보지 생성·검수·제외 파이프라인

후보지는 정확한 토지 매입 좌표가 아니라 정책 검토용 250m 격자 블록이다. 즉 "이 주변 블록을 우선 검토해보자"는 제안이며, 실제 설치 여부는 현장답사, 토지소유, 도시계획, 안전성 검토가 필요하다.

- 외부 후보지: 250m 격자 기반 후보지.
- 학교 내부 후보지: `SCHOOL_INT`로 표현되는 학교 내부 개선 또는 복합화 옵션.
- 후보지 연결: `linked_schools` 또는 `school_id` 기반으로 학교 선택 시 관련 후보지만 표시한다.
- 주요 속성: 기존 공원 거리, 학교 거리, 놀이터 거리, 대단지 아파트 거리, 단절요소, 사고다발 여부, 재개발 경고, 2029/2031 잠재수요.

최신 최종안에서는 학교·대학 부지를 후보지로 잘못 제안하지 않도록 OSM 학교·대학 폴리곤과 공식 기관 좌표 fallback을 사용해 후보지를 제외한다.

- OSM `amenity=school` 폴리곤은 10m buffer를 둔 제외 구역으로 사용한다.
- OSM `amenity=university/college` 폴리곤은 15m buffer를 둔 제외 구역으로 사용한다.
- OSM 폴리곤이 없을 때는 공식 학교·대학 point 좌표와 반경 규칙을 fallback으로 쓴다.
- 제외 로그는 `data_processed/school_exclusion_log.csv`에 남긴다.

관련 스크립트와 설정은 `analysis/exclude_school_sites.py`, `analysis/school_exclusion_config.json`, `data_processed/osm_school_polygons_incheon.geojson`이다.

## 12. 시뮬레이션 AI 추천 로직

`SimulationPage.tsx`의 AI 추천 기본값은 안전하고 보수적인 정책 기준이다. 사용자가 별도 조정하지 않으면 도시 필터와 학교 연결 후보를 기준으로, 중간급 이상 도로를 건너지 않는 후보를 우선 찾는다.

- 1차 필터: `primary road crossing = 0`, `secondary road crossing = 0`인 후보만 남긴다.
- fallback: 1차 필터 후 후보가 없으면 `primary road crossing = 0` 조건만 유지하고 secondary crossing은 허용한다.
- `tertiary road`, 사고다발, 재개발, 대단지 조건은 기본 제외가 아니라 수동 조정 가능한 참고 조건이다.

AI 추천 순위는 학교까지 거리 가까운 순 70%, 잠재수혜학생수 20%, 기존 시설과의 거리 10%로 계산한다.

- `school_distance 70%`: `nearest_school_dist`를 역정규화해 가까울수록 높은 점수.
- `potential demand 20%`: `walkshed_potential_2029` 또는 `walkshed_beneficiary_2029` 기반 잠재수요.
- `facility gap 10%`: `nearest_park_dist`가 멀수록 기존 시설 공백이 크다고 보고 높은 점수.

첫 화면 후보지 마커 팝업도 시뮬레이션 후보지 카드와 같은 잠재수요 값을 표시하도록 정리했다. `getCandidatePotentialDemand(properties, year)`는 `walkshed_beneficiary_2029/2031`을 최우선으로 사용하고, 없을 때만 `walkshed_potential`, `potential_demand`, `pred_beneficiary`, `xgb_predicted`, `forecast` 순서로 fallback한다.

## 13. 유사학교 추천과 통계 페이지

유사학교 추천은 학교별 상황을 비교 설명하기 위한 보조 기능이다. StandardScaler와 NearestNeighbors 기반 KNN으로 공원 접근성, 학생 추세, 녹지, 생활권 특성이 비슷한 학교를 찾아 상세 리포트에 제공한다.

- 최종 파일: `data_processed/school_similar_schools_top5.csv`
- 역할: "이 학교가 왜 이 case인가"를 이해하는 비교 프레임이며, 후보지 순위나 case 분류를 직접 대체하지 않는다.

통계 페이지는 앱 안정성을 위해 React 소스에 정적 preview data로 반영된다. `analysis/generate_statistics_preview_data_safe.py`가 `school_priority_case_system_20260411.csv`, `school_enrollment_forecast_20260418_model1.csv`, `student_trend.csv` 등을 읽어 `ui-preview/src/statisticsPreviewDataSafe.ts`를 생성한다.

## 14. AI 활용 지점

- LightGBM: 학교별 학생 전망의 residual correction과 250m 공간분배 share correction에 사용한다.
- Prophet: 구 단위 아동 총량 또는 성장률 전망에 사용한다.
- XGBoost: 초기 후보지/수요 예측 실험과 일부 비교 검증에 사용했으나, 최종 후보지 표시 수요의 1순위 원천은 `walkshed_beneficiary`다.
- SHAP: 공간분배 보정 모델의 설명 가능성 점검에 사용한다. 다만 SHAP을 "아이 수의 원인"으로 해석하지 않고, 모델이 어떤 feature를 참조했는지 설명하는 용도로 제한한다.
- KNN: 유사학교 추천에 사용한다.
- LLM: 전처리 스크립트 작성, 검증 로직 점검, UI 구현, 오류 추적, 문서화, 추천 로직 설명에 활용된다.

앱 안의 AI 추천은 자연어적 "추천"처럼 보이지만 실제로는 명시된 필터와 가중치를 가진 재현 가능한 시뮬레이션이다. 이 점이 최종 설계의 중요한 안전장치다.

## 15. 핵심 철학과 구현 방법

프로젝트 전체의 핵심 철학은 임의의 단일 종합점수로 정책 결정을 숨기지 않는 것이다. case는 현재 취약성, 미래 수요는 별도 전망, 후보지 추천은 사용자가 조정 가능한 시나리오로 분리한다.

정책적으로 중요한 것은 "지도상 가까움"이 아니라 "아이들이 실제로 걸어서 갈 수 있음"이다. 그래서 최종안은 직선거리 500m를 판단 기준으로 삼지 않고, 실제 도보 500m isochrone과 단절요소를 중심으로 설계했다.

큰 도로를 건너야 하는 후보지를 단순히 점수 몇 점 감점하는 방식은 안전 문제를 과소평가할 수 있다. 최종 추천 로직은 primary/secondary road crossing을 먼저 필터로 처리하고, 후보가 없을 때만 secondary를 허용한다.

놀이터는 중요한 야외활동 자원이지만 공공 공원·녹지와 동일하게 취급하면 case 분류가 왜곡된다. 최종안은 공원 접근성과 놀이터 보완성을 분리해 표시하고, 놀이터는 보조 판단에 사용한다.

모델은 미래 수요와 공간분포를 추정하지만, 후보지를 자동 확정하지 않는다. 후보지는 검토 블록이며, 최종 설치 결정에는 현장답사, 토지 소유, 예산, 주민 수용성, 안전시설, 도시계획 검토가 필요하다.

## 16. 품질검증 및 운영 체크리스트

- 봉인값 적용 후 `school_priority.csv`와 `school_nearest_park.csv`의 최근접 공원명·거리·case가 일치하는지 확인한다.
- 인천새봄초처럼 공원 바로 앞 학교가 녹지 0% 또는 공원 없음으로 표시되지 않는지 회귀검증한다.
- 후보지 팝업과 시뮬레이션 카드의 2029/2031 잠재수요가 같은 원천(`walkshed_beneficiary`)을 사용하는지 확인한다.
- `candidate_grid_final.geojson`에서 학교·대학 부지 제외 로그가 반영됐는지 확인한다.
- AI 추천 기본값에서 primary/secondary crossing 후보가 먼저 제외되고, 후보가 없을 때만 secondary가 허용되는지 확인한다.
- 유치원 버튼 표기가 UI 전반에서 일관적인지 확인한다.
- 모델 산출 파일의 version 필드를 남겨 어떤 수요 모델을 썼는지 추적 가능하게 유지한다.
- 재개발 정보는 모델 feature가 아니라 warning layer로 남아 있는지 확인한다.

## 17. 한계와 보고서 표현 원칙

이 앱은 정책 의사결정 지원 도구이며, 최종 설치 위치를 법적으로 확정하는 도구가 아니다. 공간 데이터의 경계, OSM 도로망, 공원 출입구, 보행 안전시설, 예정 개발사업은 실제 현장과 차이가 날 수 있다.

- 후보지는 250m 검토 격자이므로 "정확한 설치 좌표"라고 표현하지 않는다.
- 잠재수요는 추정치이므로 "예상 수혜 아동 규모" 또는 "잠재수요"로 표현하고 확정 인원처럼 쓰지 않는다.
- AI 추천은 기본 정책 시나리오 결과이며, 사용자 조정과 현장 검토를 전제로 한다.
- 직선거리 500m는 비교 설명용이며, 최종 취약성 판단의 핵심 근거는 실제 도보 500m다.

## 18. 최종 주요 파일 목록

- `index.html`: 메인 Kakao Map 앱, 레이어 로딩, 후보지 팝업, 학교 선택, iframe 연결
- `ui-preview/src/PreviewWorkspaceSafe.tsx`: React 분석 앱의 화면 전환과 localStorage 연결
- `ui-preview/src/SimulationPage.tsx`: 후보지 시뮬레이션, AI 추천 필터·가중치, 카드 UI
- `ui-preview/src/schoolDataBridge.ts`: 학교·후보지 원천 데이터를 React props로 변환
- `ui-preview/src/SchoolDetailReportPagePreview.tsx`: 학교 상세 리포트
- `ui-preview/src/StatisticsPageSafe.tsx`: 통계 페이지
- `analysis/generate_statistics_preview_data_safe.py`: 통계 preview data 생성
- `analysis/exclude_school_sites.py`: 학교·대학 부지 후보지 제외
- `analysis/school_exclusion_config.json`: 후보지 제외 설정
- `data_processed/school_priority.csv`: 최종 학교 case/우선순위 데이터
- `data_processed/school_nearest_park.csv`: 최종 최근접 공원 및 접근성 데이터
- `data_processed/school_enrollment_forecast_20260418_model1.csv`: 학교별 2029/2031 학생 전망
- `data_processed/candidate_grid_final.geojson`: 최종 후보지 GeoJSON
- `data_processed/candidate_barrier_routes_by_school.json`: 후보지-학교 경로 단절요소
- `data_processed/school_similar_schools_top5.csv`: 유사학교 추천 데이터
- `output/sealed_nearest_park_dist.json`: 실측 봉인값
- `data_processed/isochrone_valhalla.geojson`: 실제 도보 500m 권역
- `data_processed/school_buffer_500m.geojson`: 직선 500m 비교 버퍼
- `data_processed/osm_school_polygons_incheon.geojson`: OSM 학교·대학 폴리곤 캐시
- `data_processed/school_exclusion_log.csv`: 후보지 제외 로그

## 19. 용어 정리

- `case`: 학교의 현재 공원·녹지 접근 취약성 분류.
- `priority rank`: 같은 case 안에서의 검토 순서.
- `isochrone`: 실제 보행 네트워크 기준 500m 도달 가능 권역.
- `buffer`: 학교 중심 직선거리 500m 원형 비교 권역.
- `pred_beneficiary`: 후보지 주변 인접·거주 아동 기반 추정값.
- `walkshed_beneficiary`: 후보지에서 실제 도보권 기준으로 추정한 잠재수혜 인원. 최종 후보지 UI의 1순위 표시값.
- `facility gap`: 기존 공원과의 거리. 너무 가까운 중복 설치를 피하기 위한 후보지 비교 요소.
- `separate bundle`: 강화군·옹진군·분교·분교장처럼 일반 도시부 비교군과 분리해 보는 정책 묶음.

## 20. 결론

최종 앱은 인천 초등학교 야외활동환경을 현재 취약성, 미래 수요, 실제 보행 가능성, 도로 단절, 후보지 중복성으로 나눠 검토하는 구조다.

가장 중요한 설계 선택은 직선거리 500m와 임의 종합점수 중심 접근을 버리고, 실제 도보권·실측 봉인값·명시적 필터와 조정 가능한 추천 시나리오로 전환한 점이다.

이 앱의 결과는 자동 결론이 아니라 검수 가능한 정책 대화의 출발점이다. 어떤 학교가 취약한지, 왜 취약한지, 어느 후보지가 더 안전하고 수요가 있는지, 어떤 가정에서 순위가 달라지는지를 사용자가 직접 확인할 수 있게 하는 것이 최종 채택안의 핵심이다.
