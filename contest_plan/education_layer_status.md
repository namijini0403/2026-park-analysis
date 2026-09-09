# 학교급·학원·공개 공시 확장 작업 기록

기준일: 2026-09-09. 브랜치: `feat/all-school-levels-academy-public-metrics`.

## 구현·검증된 범위

- 기존 초등 272교 분석을 유지하고 유치원 369원(2026년 1차 공시), 중학교 146교, 고등학교 129교의 분석을 추가했다. 지도 총 916개다. 별도 원장에는 최신 초등 276교를 포함한 920개가 있으며, 기존 분석에 없는 초등 4교는 아직 지도 분석에 편입하지 않았다.
- 추가 644개 모두 기존 v3 보행망의 500m 도달권을 계산했다. 원형 대체는 0개다. 공원 면적은 공개 면적의 원형 대체경계를 도달권으로 잘라 중첩을 제거한 추정값이다. 실제 경계 측량값이 아니다.
- 공원·놀이터·도서관·재개발·대단지·유흥·공사·학원 환경을 직선 500m와 보행 도달권으로 구분한다. 기존 초등 보정값과 신규 추정값의 학교급 간 직접 순위는 제공하지 않는다.
- 같은 학교급 내 학생수·증감·대단지·재개발 조건을 표준화한 KNN 비교는 637개에서 가능하다. 부족한 입력은 임의로 채우지 않는다.
- 공원 대표점까지 보행망 경로, 연결거리, 우회율을 제공한다. 출입구·횡단 신호·통행 허용을 확인한 안전 경로는 아니다. 최초 651개 기관 기준 계산 최적화 전후 목적 공원·거리·상태가 모두 일치했으며, 최신 644개 기관의 경로도 재계산했다.
- 중·고교 등 연속 3년 이상 이력이 있는 기관에 추세+LightGBM 잔차 지원 예측을 제공한다. 최근 연도에서 혼합 비중을 선택했으므로 그 검증값은 독립 최종 성능이 아니다. 유치원은 2016~2026년 일반 현황을 추가 확보했다. 최신 369원 중 323원에 10년 이상 이력, 361원에 학교별 지원 예측을 제공한다. 최근 연속 3개년 미만이면 학교별 예측을 만들지 않는다. 2026년 357개 검증 사례에서 보정 비중 선택 MAE는 추세 13.22명, 선택 모형 10.10명이었으며 독립 최종 평가가 아니다.
- 주민등록 1세별 원자료에서 구·군별 학교급 연령대(3~5, 6~11, 12~14, 15~17세) 관측 이력을 연결했다. 2014~2025년 자료를 사용하되 코드가 바뀐 미추홀구는 2018년부터 별도로 유지한다. 2025년 구·군 10개 합계가 인천 합계와 0~20세 각각 일치함을 검증했다. 출생·이동·사망을 넣지 않은 코호트 시나리오는 유치원 2028년, 다른 학교급 2030년까지이며 예측이나 후보지 수혜 인원이 아니다. 신설 구에는 기존 구 수치를 자동 전용하지 않는다.
- 구·군 10개 × 학교급 4개에 2026~2031년 연령 인구 지원 예측을 추가했다. 최근값 유지·최근 3개년 추세·Prophet·Prophet+XGBoost 잔차 보정을 비교했다. 모형 선택 목표연도는 2020~2022, 별도 검증 목표연도는 2023~2025이며 1·3년 선행을 검증했다. 복잡한 모형이 단순 모형 대비 선택 MAE를 5% 이상 개선하지 못하면 단순 모형을 선택한다. 현재 유치원·초등은 추세, 중·고등은 최근값 유지가 선택됐다. 구·군 합동 1년 선행 MAE는 각각 220.43·326.28·290.77·211.47명이며 후보지·개별 학교 오차로 해석하지 않는다. 4~6년 선행 성능은 미검증이다. 후보지에는 선택 학교 구·군의 예측연도/2024년 인구 비율을 적용하는 시나리오를 별도로 제공한다. 후보지 행정구역·미래 공간 분포를 검증한 예측은 아니다.
- 기존 규칙을 재사용한 예산·부지·접근성 12개 시나리오와 내부 독서 공급, 250m 기존 후보지 풀에서 학교 주변 후보 비교를 제공한다. 정책 결정을 자동화하지 않는다.
- 기존 초등 후보지 1,535개와 확장 학교급 탐색 격자 3,081개에 2024년 학교급별 연령대 배분 인구를 추가했다. 공개 1km 5세별 인구를 같은 연도 인천 1세별 비율로 분할하고, 100m 총인구 비중으로 배분한 후 기존 후보지 도형/주변 직선 500m와의 면적 교차비로 집계한다. 후보지 내부와 주변 인구는 별도이며 실제 이용자·신규 수혜 인원은 아니다. 기존 초등 후보지 1,535개에서 주변 500m 완전 추정은 유치원 1,430개·초등 1,432개·중등 1,486개·고등 1,504개이며 나머지는 결측으로 남긴다. 원자료가 있는 부분의 소계는 전체 추정과 별도로 보존한다. 공식 100m 도형 100개와 코드 기반 재구성 좌표를 대조한 최대 오차는 0m였다. 기존 초등 후보 도형은 그대로 사용하므로 정확히 250m 정사각형이라는 의미는 아니다. 확장 학교급 격자는 EPSG:5179에서 250m×250m로 새로 생성한다.
- 학원·교습소 74,061개 교습과정 행을 이름·주소·종류 기준 6,839개 시설로 통합했다. 좌표 확보 6,743개, 미확보 96개다. 등록번호 부재로 동일시설 식별 한계가 있다. 교습과정에 근거해 학교급과 예체능을 별도 분류하며 초급·중급·고급을 학교급으로 해석하지 않는다.
- 학교알리미 공개 일괄 목록에서 32개 항목의 실제 응답을 확보했다. 요청 단위 실패·빈 응답은 원본 manifest에 보존한다. 학교별 실제 공시값과 공식 필드 설명을 지연 로딩한다.
- 기존 AI 설명 API에 학교급별 서버 근거를 연결했다. 학교 ID(없으면 정확히 일치하는 유일한 이름)로 원장을 조회하며 클라이언트 수치·학교명·후보지 주장을 근거로 사용하지 않는다. 확장 학교급은 기존 초등 근거와 확정 Case 문구를 전용하지 않는다. 학원·공시·수상·수요·KNN·후보지·접근 마찰·주변 시설 질문에 해당 근거 최대 3개를 전달한다. 수상·후보 예시는 요청 길이를 제한하고 전체 결과는 보고서에서 제공한다. 보고서의 ‘분석 근거 설명’ 버튼으로 기존 패널에 연결된다. 실제 유료 모델 호출은 하지 않았으며 무키 폴백과 요청/응답 모의 검사로 근거 선택·클라이언트 변조 배제·기존 초등 기능을 검증했다.
- 공식 교육청 보도자료에서 확인한 수상 관측은 현재 3개 학교 기록이다. 전체 수상 이력이 아니며, 기록이 없다는 것을 수상 없음으로 해석하지 않는다.
- 국립중앙과학관 전국과학전람회 2023~2025년 출품작 검색 899개 게시물(요약집 포함)의 상세 조회를 완료했다. 웹 자료 35건에 2024년 공식 요약집 18건을 보완해 총 19개 학교·53개 학교-작품 실적을 연결했다. 2024년 웹 학교명 공란은 원문대로 보존하며 PDF 보완 기록을 별도 근거로 표시한다. PDF는 학생 수상자 명단과 작품 설명의 작품번호·학교명·등급이 일치하는 학생 소속만 사용한다. PDF 1개 예시 페이지를 렌더링해 표 구조를 확인했다. 웹 출품자의 학생/교원 구분은 추정하지 않는다. 전국 동명 학교는 지역 근거가 없으면 보류한다. 상세 수상 칸이 비어 있으면 같은 작품의 목록 수상 칸과 별도 URL을 근거로 사용한다. 보도자료와 중복 합산하지 않는다.

## 아직 동일 깊이라고 할 수 없는 부분

1. 학업성취도 개별 공시 페이지는 실제 존재하지만 CAPTCHA가 있어 자동 수집하지 않았다. 일괄 공개 목록에는 해당 항목이 없다. 수능 학교별 표준화 성적·전체 대외 수상 이력은 확보한 자료에 없다. 미수집과 자료 부존재를 구분한다.
2. 구·군 연령 예측과 후보지 지역비례 시나리오는 구축했지만, 후보지별 경계·개발·전입을 반영한 미래 공간 분포 모형은 아직 없다. 초등 미래 인구를 전용하지 않으며 실제 신규 수혜를 뜻하는 `age_specific_beneficiaries`는 null이다. 후보 비교는 거리·공원 부족·연령 추정인구의 직접 기여도, 파레토, 가중치 민감도를 제공한다. 학습된 초등 SHAP 모형을 전용하지 않는다. 확장 학교급 도달권을 반영한 격자로 후보 공백은 해소했지만, 탐색 격자와 실제 공급 가능한 토지를 구분해야 한다.
3. 추가 초등 4교 분석은 후속 작업이다. 유치원 과거 이력·최신 공시는 연결했지만 최신 원장에 없는 과거 기관은 현재 학교에 임의 매칭하지 않는다. 추가 학교급은 공통 분석 대화상자에서 확인하고, 기존 AI 설명 패널과 연결된다. AI 공시 설명에는 확인된 항목 목록을 제공하며 세부 원문 수치는 보고서에서 확인한다.
4. 실제 브라우저 연결이 없어 시각·지도 조작 QA는 수행하지 못했다. DOM 통합 검사와 정적 배포 빌드까지 검증했다.

## 출처

- 학교 위치: https://www.data.go.kr/data/15021148/standard.do
- 유치원: https://e-childschoolinfo.moe.go.kr/openData.do (2016~2026년 1차 일반 현황, 2025년 2차·2026년 1차 공개 항목). 2013~2015년 1차 일반 현황 요청은 빈 응답이며 0개 유치원으로 해석하지 않는다.
- 학원·교습소: https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11841&nttSn=3381948 (2026-08-01 현황)
- 학교알리미 일괄 공시: https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l2.do
- 수상: `data/education_sources/award_observations.json`의 각 공식 원문 URL과 관측 범위 참조.

원자료의 기준 연도가 다르다. 모든 값을 2026년 동시 현황으로 간주하지 않는다. 원본·해시·요청 결과는 `data/education_sources/`, 분석은 `data_processed/education/`에 보존한다.

## 재현 및 확인

프로젝트 루트에서 기존 공간분석 Python 환경과 Node 20 이상을 사용한다. Python 주요 의존성은 pandas, numpy, geopandas, shapely, networkx, osmnx, scipy, scikit-learn, lightgbm, requests, openpyxl이다. 기존 보행망 캐시 `../_cache/incheon_walk_graph_v3.graphml`과 기존 `data_processed` 환경자료가 필요하다. 원자료 갱신 없이 캐시로 재계산할 수 있다.

```powershell
python scripts/education/build_school_registry.py
python scripts/education/build_academies.py
python scripts/education/build_regional_demography.py
python -m scripts.education.build_regional_age_forecasts
python scripts/education/build_science_awards.py
python scripts/accessibility/build_walkshed_500m_v3.py --graph ../_cache/incheon_walk_graph_v3.graphml --schools data_processed/education/new_school_coords.csv --out data_processed/education/walkshed_500m.geojson --report data_processed/education/walkshed_report.csv
python scripts/education/build_candidate_grid.py
python scripts/education/build_candidate_age_demand.py
python scripts/education/build_education_analysis.py
python scripts/education/build_school_routes.py
python scripts/education/build_candidate_comparison.py
python scripts/education/build_ai_school_evidence.py
python -m unittest discover -s tests -p test_education_layers.py
python -m unittest discover -s tests -p test_education_demography.py
python -m unittest discover -s tests -p test_education_awards.py
python -m unittest discover -s tests -p test_education_candidate_demand.py
python -m unittest discover -s tests -p test_education_candidate_comparison.py
python -m unittest discover -s tests -p test_education_candidate_grid.py
python -m unittest discover -s tests -p test_education_regional_forecasts.py
python -m unittest discover -s tests -p test_education_kindergarten.py
node tests/test_education_ui.cjs
node tests/test_education_ai.cjs
node scripts/tests/test_context_ai_ops20260906.cjs
node scripts/check_inline_script.mjs
npm run validate:modules
npm run build:vercel
```

원자료 갱신: 학교 원장·학원 스크립트의 `--fetch`, 학교알리미는 `python scripts/education/fetch_disclosures.py`. 신규 주소 보정은 각각 `--geocode-missing`, `--geocode`이며 기존 Kakao 클라이언트 인증 설정이 필요하다. 실패·미확보 자료를 0으로 대체하지 않는다.

연령별 후보지 인구: 기본 실행은 `data/education_sources/candidate_age_allocation.json`의 정규화 원자료와 공간 배분 가중치를 재사용한다. 공간 계산까지 다시 수행하려면 `python scripts/education/build_candidate_age_demand.py --raw-dir C:/2026_data_analysis_park/data/raw`. 필요한 원본 ZIP·후보지·총인구·연령 인구 입력의 파일명과 SHA-256을 스냅샷에 보존한다. 2024년 인구와 2025년 격자 경계 파일을 사용하며 기준연도·배분 가정·관측 결측을 출력에 명시한다.

지역 연령 예측에는 Prophet과 XGBoost가 필요하다. `regional_age_forecast_validation.json`에 패키지 버전·검증 행별 실제값/모형값·학습 목표연도 최댓값·원자료 해시를 보존한다. Prophet은 원점 이전 이력과 모형 설정으로 캐시하며 패키지 버전이 달라지면 재계산한다. XGBoost는 각 원점 이하 목표연도만 학습하며 난수 시드는 42이다.

AI 근거는 다른 교육 산출물을 갱신한 뒤 `build_ai_school_evidence.py`로 다시 생성한다. `data_processed/context/education_school_evidence.json`은 기존 Vercel 함수 `includeFiles` 범위에 포함되며 서버 근거 조회용이다. 기존 컨텍스트 검사의 고정 날짜는 현재 원자료 요약의 `data_as_of`와 대조하도록 수정했다.

과학전람회 갱신: `python scripts/education/build_science_awards.py --fetch --years 2023 2024 2025`. 목록·상세 스냅샷을 재사용하며 최초 수집은 네트워크가 필요하다. 기존 연도 캐시를 자동 덮어쓰지 않는다. 학교명·대회·수상·작품 제목과 응답 해시를 보존하고 학생/교사 개인 이름은 추출하지 않는다. 공식 DB: https://www.science.go.kr/mps/1079/bbs/423/moveBbsNttList.do

2024 PDF 보완 재현: `python scripts/education/build_science_awards_pdf.py --fetch` 후 `python scripts/education/build_science_awards.py`. PyMuPDF가 필요하다. 107MB 원본 PDF는 Git에서 제외하고 공식 다운로드 URL·SHA-256·페이지 번호와 추출된 비개인 실적을 `data/education_sources/science_awards_2024_pdf.json`에 보존한다. 원본이 없어도 정규화 스냅샷으로 학교별 결과를 다시 생성할 수 있다. 원문 게시물: https://www.science.go.kr/mps/1079/bbs/423/moveBbsNttDetail.do?nttSn=48701

데모: 루트 `index.html`에서 학교급 선택 → 학교 검색/선택 → 공개자료·학교급 분석. 환경 레이어의 학원·교습소를 켜면 공원과 같은 주변 시설로 표시된다. 외부 배포는 수행하지 않았다.

유치원 공시 갱신: `python scripts/education/fetch_kindergarten_disclosures.py` 후 원장·도달권·교육 분석·경로·AI 근거 순서로 재생성한다. 다운로드는 공개 폼의 실제 시도/공시차수/항목 파라미터를 사용하며 기존 스냅샷을 재사용한다. 원장·대표자 개인 이름은 정규화 원자료에서 제외한다. 최신 일반 현황의 기관을 기준으로 하고 과거 공시는 이름·설립유형·교육지원청(동명 시 주소)으로 정확히 연결한다. 재원 이력은 이름·설립일 기반 로컬 ID가 동일한 자료만 사용한다. 과거 미매칭 642행은 별도 coverage 파일에 남기며 폐원으로 단정하지 않는다. 예측은 과거 공백 이전 구간을 버리고 최신 연속 구간을 사용하되 보고서에는 전체 관측 이력을 보존한다.

후보지 비교 보완: 644개 기관에 대해 확장 학교급 탐색 격자 3,081개 중 중심점이 직선 1.5km 안에 있는 44,250개 학교-후보 쌍을 전부 연결한다. 가까운 12개 선제 절삭을 제거했다. 기본 가중치는 거리 40%·공원 부족 30%·학교급 연령 수요 30%이며 점수의 세 기여도를 그대로 보여준다. 수요는 학교별 후보 최대값으로 log1p 정규화하므로 다른 학교의 점수와 직접 비교하지 않는다. 세 지표가 완전한 후보끼리 파레토와 10% 간격 66개 가중치 조합을 계산한다. 상위5 진입 비율은 공동 순위를 포함하며 통계적 선정 확률이 아니다. 수요 결측은 0으로 대체하지 않으며 수요 가중치 0일 때만 사용자 점수 비교를 허용한다. 상속된 초등 부지 적합성 값은 확장 학교급에서 null로 처리한다. AI에는 기본 가중치 상위 5개와 전체 비교 범위를 전달해 요청 길이를 제한한다. 갱신 순서는 연령 수요 → 후보 비교 → AI 근거이며 교육 분석 전체 실행에도 후보 비교가 포함된다.

확장 격자 재현: `build_candidate_grid.py`는 모든 확장 학교급 도달권과 양의 면적으로 겹치는 EPSG:5179 기반 250m 정사각형을 생성한다. 좌표에서 ID를 결정하고 학교 ID를 정렬하므로 입력 순서에 영향을 받지 않는다. 격자 3,081개·644기관 연결을 검증했으며 학교급별 후보 공백은 0이다. 공급 가능 토지·수면·필지·소유·규제는 검증하지 않은 탐색 단위다. 도달권이 바뀌면 격자 → `build_candidate_age_demand.py --raw-dir C:/2026_data_analysis_park/data/raw` → 후보 비교 → AI 근거 순서로 갱신한다. 기본 연령 스크립트는 캐시를 재사용하므로 격자가 바뀌었을 때 원자료로 배분 가중치를 다시 만들어야 한다. 후보 비교는 도달권/격자 원본 해시 불일치 시 중단한다. 학교 보고서에서 격자를 선택하면 지도에 경계와 중심 위치가 표시되며, 학교급 변경 시 해당 표시를 해제한다. 지도 API 동작은 모의 객체로 검증했으며 실제 브라우저 QA는 여전히 미수행이다.
