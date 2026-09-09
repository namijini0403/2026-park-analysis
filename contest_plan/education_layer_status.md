# 학교급·학원·공개 공시 확장 작업 기록

기준일: 2026-09-09. 브랜치: `feat/all-school-levels-academy-public-metrics`.

## 구현·검증된 범위

- 기존 초등 272교 분석을 유지하고 유치원 376원, 중학교 146교, 고등학교 129교의 분석을 추가했다. 지도 총 923개다. 별도 원장에는 최신 초등 276교를 포함한 927개가 있으며, 기존 분석에 없는 초등 4교는 아직 지도 분석에 편입하지 않았다.
- 추가 651개 모두 기존 v3 보행망의 500m 도달권을 계산했다. 원형 대체는 0개다. 공원 면적은 공개 면적의 원형 대체경계를 도달권으로 잘라 중첩을 제거한 추정값이다. 실제 경계 측량값이 아니다.
- 공원·놀이터·도서관·재개발·대단지·유흥·공사·학원 환경을 직선 500m와 보행 도달권으로 구분한다. 기존 초등 보정값과 신규 추정값의 학교급 간 직접 순위는 제공하지 않는다.
- 같은 학교급 내 학생수·증감·대단지·재개발 조건을 표준화한 KNN 비교는 642개에서 가능하다. 부족한 입력은 임의로 채우지 않는다.
- 공원 대표점까지 보행망 경로, 연결거리, 우회율을 제공한다. 출입구·횡단 신호·통행 허용을 확인한 안전 경로는 아니다. 651개 경로의 계산 최적화 전후 목적 공원·거리·상태가 모두 일치했다.
- 중·고교 등 연속 3년 이상 이력이 있는 기관에 추세+LightGBM 잔차 지원 예측을 제공한다. 최근 연도에서 혼합 비중을 선택했으므로 그 검증값은 독립 최종 성능이 아니다. 유치원 2년 이력은 추세만 제공한다.
- 기존 규칙을 재사용한 예산·부지·접근성 12개 시나리오와 내부 독서 공급, 250m 기존 후보지 풀에서 학교 주변 후보 비교를 제공한다. 정책 결정을 자동화하지 않는다.
- 학원·교습소 74,061개 교습과정 행을 이름·주소·종류 기준 6,839개 시설로 통합했다. 좌표 확보 6,743개, 미확보 96개다. 등록번호 부재로 동일시설 식별 한계가 있다. 교습과정에 근거해 학교급과 예체능을 별도 분류하며 초급·중급·고급을 학교급으로 해석하지 않는다.
- 학교알리미 공개 일괄 목록에서 32개 항목의 실제 응답을 확보했다. 요청 단위 실패·빈 응답은 원본 manifest에 보존한다. 학교별 실제 공시값과 공식 필드 설명을 지연 로딩한다.
- 공식 교육청 보도자료에서 확인한 수상 관측은 현재 3개 학교 기록이다. 전체 수상 이력이 아니며, 기록이 없다는 것을 수상 없음으로 해석하지 않는다.

## 아직 동일 깊이라고 할 수 없는 부분

1. 학업성취도 개별 공시 페이지는 실제 존재하지만 CAPTCHA가 있어 자동 수집하지 않았다. 일괄 공개 목록에는 해당 항목이 없다. 수능 학교별 표준화 성적·전체 대외 수상 이력은 확보한 자료에 없다. 미수집과 자료 부존재를 구분한다.
2. 유치원·중·고교의 연령별 250m 미래 수요는 아직 구축하지 않았다. 초등 인구를 전용하지 않으며 후보지의 `age_specific_beneficiaries`는 null이다. 신규 후보지 비교는 거리·공원 부족 지원 신호이며 기존 초등의 모든 후보 추천 모형과 동등하지 않다.
3. 유치원 장기 이력, 추가 초등 4교 분석, 기존 초등 AI 설명 화면과 신규 학교급의 완전한 통합은 후속 작업이다. 추가 학교급은 별도 분석 대화상자에서 확인한다.
4. 실제 브라우저 연결이 없어 시각·지도 조작 QA는 수행하지 못했다. DOM 통합 검사와 정적 배포 빌드까지 검증했다.

## 출처

- 학교 위치: https://www.data.go.kr/data/15021148/standard.do
- 유치원: https://e-childschoolinfo.moe.go.kr/openApi/openApiList.do (보유한 인천 2024·2025년 1차 공시 CSV)
- 학원·교습소: https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11841&nttSn=3381948 (2026-08-01 현황)
- 학교알리미 일괄 공시: https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l2.do
- 수상: `data/education_sources/award_observations.json`의 각 공식 원문 URL과 관측 범위 참조.

원자료의 기준 연도가 다르다. 모든 값을 2026년 동시 현황으로 간주하지 않는다. 원본·해시·요청 결과는 `data/education_sources/`, 분석은 `data_processed/education/`에 보존한다.

## 재현 및 확인

프로젝트 루트에서 기존 공간분석 Python 환경과 Node 20 이상을 사용한다. Python 주요 의존성은 pandas, numpy, geopandas, shapely, networkx, osmnx, scipy, scikit-learn, lightgbm, requests, openpyxl이다. 기존 보행망 캐시 `../_cache/incheon_walk_graph_v3.graphml`과 기존 `data_processed` 환경자료가 필요하다. 원자료 갱신 없이 캐시로 재계산할 수 있다.

```powershell
python scripts/education/build_school_registry.py
python scripts/education/build_academies.py
python scripts/accessibility/build_walkshed_500m_v3.py --graph ../_cache/incheon_walk_graph_v3.graphml --schools data_processed/education/new_school_coords.csv --out data_processed/education/walkshed_500m.geojson --report data_processed/education/walkshed_report.csv
python scripts/education/build_education_analysis.py
python scripts/education/build_school_routes.py
python -m unittest discover -s tests -p test_education_layers.py
node tests/test_education_ui.cjs
node scripts/check_inline_script.mjs
npm run validate:modules
npm run build:vercel
```

원자료 갱신: 학교 원장·학원 스크립트의 `--fetch`, 학교알리미는 `python scripts/education/fetch_disclosures.py`. 신규 주소 보정은 각각 `--geocode-missing`, `--geocode`이며 기존 Kakao 클라이언트 인증 설정이 필요하다. 실패·미확보 자료를 0으로 대체하지 않는다.

데모: 루트 `index.html`에서 학교급 선택 → 학교 검색/선택 → 공개자료·학교급 분석. 환경 레이어의 학원·교습소를 켜면 공원과 같은 주변 시설로 표시된다. 외부 배포는 수행하지 않았다.
