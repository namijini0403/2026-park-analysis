# pipeline/layers/library/ — 도서관 레이어 (온보딩 예정, W1-W2)

이 디렉터리는 아직 착수되지 않은 도서관 레이어의 자리다. 현재 리포지토리에는 도서관 관련 데이터·스크립트가 존재하지 않는다.

## 온보딩 계약 요약

공원 레이어(`pipeline/layers/park/`)가 확립한 6단계 골격(전처리→접근성→예측→분류→후보지→export)을 그대로 따르되, 각 단계는 `pipeline/core/`가 제공하는 공통 함수(좌표 정제, EPSG:5179 변환, isochrone, 공간 조인, 품질검사)를 재사용하고, 레이어 고유 로직(도서관 반경 기준, 장서/좌석 수요 예측 모델, 도서관 후보지 분류 규칙 등)만 `pipeline/layers/library/` 내부에 구현한다. 새 레이어는 `pipeline/registry/data_registry.yaml`에 자신의 산출물을 동일한 스키마(`file`/`operating`/`sealed`/`generators`/`app_ref`)로 등록해야 업데이트 센터가 의존성 그래프에 포함시킬 수 있다. 착수 시점(W1)에 이 문서를 구체적인 단계별 스크립트 맵으로 갱신한다.
