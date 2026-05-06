# 분석 스크립트 안내

이 폴더는 제출 패키지 재현용 분석 코드를 단계별로 정리한 곳입니다.

## 실행 전 공통 기준

- 기본 작업 루트는 프로젝트 루트입니다.
- 주요 입력 데이터는 `data/raw/`와 `data/processed/`에 있습니다.
- 주요 산출물은 `data/processed/`, `outputs/reports/`, `outputs/charts/`에 저장됩니다.
- 카카오 API가 필요한 지오코딩 스크립트는 실행 전에 환경변수 또는 별도 설정으로 키를 주입해야 합니다.

## 폴더별 역할

- `preprocess/`: 원천 데이터 정리, 학교·공원·놀이터·격자·좌표 데이터 생성
- `accessibility/`: 도보권, 최근접 공원, 직선권 비교, 보행부담 요소 분석
- `classification/`: Case 분류, 유사학교, 취약계층·학생가중 녹지 격차 분석
- `forecasting/`: 학생 수와 후보지 수혜 인구 예측 모델링
- `candidate_generation/`: 후보 격자 생성, 수요 예측, 학교부지 배제, 후보지 시뮬레이션 지표 생성
- `recommendation/`: 학교별 우선순위와 추천 결과 갱신
- `export/`: 시각화, 보고서, 제출 패키지 생성, 산출물 검증
- `config/`: 지역별 설정과 공통 상수

## 주요 재현 흐름

```text
preprocess
-> accessibility
-> classification
-> forecasting
-> candidate_generation
-> recommendation
-> export
```

모든 스크립트를 한 번에 실행하는 단일 오케스트레이터는 없습니다. 단계별 산출물을 확인하면서 필요한 스크립트를 선택 실행하는 구조입니다.

## 제출 패키지 생성

```bash
python scripts/export/build_submission_package.py
```

이 스크립트는 `.env`, `node_modules`, 캐시, 로그, 임시 파일, 내부 백업 파일을 제외하고 제출용 폴더를 생성합니다.

## 제외되는 일회성 러너

`preprocess/_run_kakao_*.py` 파일은 특정 시점의 카카오 지오코딩 재시도용 일회성 러너입니다. 제출 패키지 생성 시 자동 제외됩니다.
