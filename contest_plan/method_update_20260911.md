# 도보·격자 수요·학생수 갱신

## 실제 반영

- 공식 카카오 도보 API 클라이언트 추가: `scripts/accessibility/kakao_walk.py`. 기존 외부 REST 키 사용, 최단거리 옵션, 호출 상한·간격·타임아웃, 인증/쿼터 실패 시 중단, 실패를 거리 0으로 바꾸지 않는다.
- 기존 53개 거리 보정 사례의 카카오 비교표: `education/route_review.json`. 공원 원자료와 이름이 정확히 일치하는 24개는 API 경로 확보. 29개는 공원 식별 보류. 확보분에서 거리 차이 검토 15개, 500m 판정 차이 9개. 학교 중심·공원 대표점이므로 검수값을 대체하거나 검증 완료 처리하지 않는다.
- 전체 4,618개 후보의 원천 총량 기반 연령 인구 배분: `education/candidate_demand_v2.json`. 후보 목록과 무관한 기존 100m 배분 가중치를 사용. 미관측은 null, 후보 내부와 직선 500m 구분.
- 기존 초등 후보 1,535개의 `candidate_grid_final.geojson`도 새 배분값으로 교체. 이전 값은 `outputs/method_update_20260911/candidate_grid_before_v2.geojson`에 보존. 이전 수요모델 SHAP·안정성 값은 제거하고 화면에서 옛 보정결과 재결합을 막았다.
- 미래 격자 인구는 **도시 전체 성장 시나리오**다. 2024년 인천 해당 연령인구 대비 10개 지역 선택모형의 예측 합계 비율을 균일 적용한다. 특정 후보의 미래 지역별 분포를 검증한 예측은 아니다. 기존 필드 `pred_beneficiary_*`는 내부 인구 호환 필드, 새 `potential_demand_*`는 직선 500m 시나리오이며 `walkshed_beneficiary_*`는 제거했다.
- 학교 재학생 모델: `enrollment_model_v2.py`. 각 원점까지의 자료로만 잔차 모형·가중치를 선택하고 1/3/5년 선행 별도 평가. 복잡한 보정은 추세보다 선택오차 5% 이상 개선 시 채택. 확장 프로필의 embedded enrollment와 기존 초등 CSV 경로도 갱신.
- 학년 진급 시나리오 551개교: `education/grade_cohort_scenarios.json`. 2025·2026 학년별 학생수 관측, 학년별 진급비율·최신 입학인원 유지·기타학생 유지 가정. 짧은 이력으로 독립 장기 모형 교체를 주장하지 않고 기존 모델과 병렬 표시.
- 앱의 “인구 산출·도보 검수” 버튼과 외부 후보 상세에서 신규 검토 화면 연결. `assets/method-review.html`을 직접 열어도 격자·경로·학생수 세 분야를 확인 가능. 기존 후보 비교 화면의 거주인구 범위와 누락 처리도 수정.

## 독립 평가 결과

목표연도 2026, 예측 원점은 선행기간에 따라 다르다. 각 행의 selection_max_year/training_max_year가 원점 이하인지 검증한다. 독립 평가란 해당 예측의 학습·선택에 목표값을 쓰지 않았다는 뜻이며 동일 학교의 과거는 포함한다.

| 학교급 | 1년 MAE / 표본 | 3년 MAE / 표본 | 5년 MAE / 표본 |
|---|---|---|---|
| 초등 | 28.05명 / 267 | 99.83명 / 263 | 이력 부족 / 0 |
| 중등 | 40.02명 / 143 | 86.76명 / 139 | 이력 부족 / 0 |
| 고등 | 33.98명 / 127 | 86.77명 / 126 | 이력 부족 / 0 |
| 유치원 | 10.03명 / 357 | 18.51명 / 348 | 24.52명 / 332 |

3년 초·중·고는 원점 당시 잔차학습·선택 이력이 부족해 추세와 같다. 짧은 학년자료를 학급수로 대신하거나 5년 오차를 1년 오차로 복사하지 않았다. 2029/2031 결과에 확정 수요·장기 검증 완료 표현을 쓰지 않는다.

## 카카오 및 대안 조사 (2026-09-11)

이전 “카카오 도보 API 없음” 판단은 최신 문서 기준으로 정정했다. 공식 `GET https://dapi.kakao.com/v2/routing/walk`는 거리·시간·구간 좌표를 제공하며 기존 키의 실제 호출도 성공했다. 지도 Web SDK의 링크 열기와 별도 기능이다.

- 공식 설명: https://developers.kakao.com/docs/ko/kakaomap/common
- 공식 규격: https://developers.kakao.com/docs/ko/kakaomap/rest-api#도보-경로-조회
- TMAP 보행 경로: https://www.tmapmobility.com/service/corporate/api
- TMAP 보행 출입구 좌표 공지: https://tmapapi.tmapmobility.com/popup_update2_2025_05_2.html

선택안은 **카카오 점간 도보 경로 + OSM 일괄 도달권 + 출입구 확인**이다. 국내 경로 데이터의 독립 대조가 가능해졌지만 이번 대표점 비교만으로 카카오가 현장 진실값이라고 결론내리지 않는다. TMAP은 두 번째 대조원으로 가능하나 이번에는 키 발급·가입·호출을 하지 않았다.

카카오 공식 문서에서 한 번에 500m 등거리권 폴리곤을 주는 기능은 확인되지 않았다. 학교에서 주변 100m 격자·공원 출입구까지 최단거리를 조회해 500m 이하 **표본점** 접근 여부를 구할 수 있다. 이를 원이나 볼록껍질로 묶어 정확한 도달권이라 부르면 안 된다. 호출량이 커지므로 문제 학교·시설 접근성부터 사용하는 것이 효율적이다. 어린이 이동시간을 원하면 거리와 별도로 속도·신호대기를 가정해야 하며 API 일반 도보 시간을 그대로 어린이 시간으로 단정하지 않는다.

## 남은 데이터 제약

- 학교·공원 출입구와 실제 개방 상태는 여전히 미확인. 기존 보정은 유지하며 카카오 비교표로 검수 우선순위를 좁힌다.
- 공원명 식별 보류 사례에는 임의의 비슷한 공원을 붙이지 않는다.
- 학구도는 확보됐지만 취학예정 인구와 실제 입학 전환율의 검증된 결합이 없어 입학인원 유지 시나리오를 사용한다.
- 신규 주택 입주 시점·순증 세대·전입 아동 관측을 아직 직접 학습하지 않는다. 현재 시나리오는 이 효과를 정밀 예측한 결과가 아니다.

## 재현

프로젝트 루트 `park-railway-deploy`에서 실행:

```powershell
python -m scripts.accessibility.review_kakao_routes --max-calls 53
python -m scripts.education.build_method_update
python -m unittest tests.test_method_update tests.test_education_candidate_demand tests.test_education_layers tests.test_education_regional_forecasts
node tests/test_method_review_ui.cjs
npm run build:ui-preview
node scripts/check_inline_script.mjs
```

카카오 재실행은 같은 요청 해시의 성공값을 재사용한다. 재검수 시점이 달라져 새 조회가 필요하면 기존 리뷰 파일을 보존한 뒤 별도 갱신해야 한다. 원본 키는 파일/로그/공개 산출물에 저장하지 않는다.

## 배포 및 확인

- 기존 Railway 서비스에 배포 완료: `cede4f9f-7d6b-4c72-8ca8-371d791ef5d2`, 상태 `SUCCESS` 확인.
- 검토 화면: https://education-living-area-preview-production.up.railway.app/assets/method-review.html
- Python 관련 23개 검사, 교육 화면 검사 6종, 신규 검토 화면 검사, React 빌드 및 인라인 스크립트 구문 검사 통과. 화면 동작 검사는 JSDOM 기반이며 실제 브라우저 시각 검사는 수행하지 않았다.
- 공개 정적 파일의 HTTP 200 및 배포 패키지와 SHA-256 일치를 확인한다. 학교 통합자료는 영속 저장된 context를 유지하므로 전체 파일 해시 대신 학교별 embedded enrollment와 새 예측 파일의 일치를 검사한다. 결과를 `method_update_live_validation_20260911.json`에 기록한다. 재검증: `python scripts/education/verify_method_release.py cede4f9f-7d6b-4c72-8ca8-371d791ef5d2`.
- 첫 배포는 상위 `.gitignore`가 `vercel_public`을 제외하여 시작 실패했다. 필요한 파일만 복사한 1,216개 파일의 별도 패키지에서 `railway up . --path-as-root --no-gitignore`로 수정 배포했다. 이 옵션을 원본 저장소 전체에 적용하지 않는다.
- 공개 앱에는 사전 산출한 카카오 비교표가 반영됐으며 방문 시마다 API를 호출하는 기능은 아니다.

- 기동 복원 뒤 `merge_enrollment_release.cjs`가 학교 통합자료의 학생수 예측만 새 배포본과 연결한다. 다른 context와 더 최신 관측 이력은 보존하며 해당 조건을 검사했다.
