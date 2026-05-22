# 06 Limitations

### [chunk: 06_limitations#public-data]
tags: 공공데이터, 한계, 최신성, 누락

본 분석은 공개 가능한 공공데이터와 지도 기반 데이터를 사용하므로 최신 현장 상황, 임시 폐쇄, 공사, 실제 통학 동선, 주민 이용 행태를 완전히 반영하지 못할 수 있다.

### [chunk: 06_limitations#walking-network]
tags: Valhalla, OSM, 보행네트워크, 아파트단지

도보 등시권과 경로는 Valhalla와 OSM 기반 보행 네트워크를 사용한다. OSM에 아파트 단지 내부 보행로, 사잇길, 출입구 정보가 누락되어 있으면 실제 보행 가능성과 차이가 날 수 있다.

### [chunk: 06_limitations#sealed-values]
tags: 봉인값, 수동검증, 재현성, 자동계산

수동 검증으로 봉인한 값은 재현성과 발표 안정성을 위해 유지한다. 자동 재계산 결과와 다를 수 있지만, 봉인값은 검수된 운영 기준으로 해석한다.

### [chunk: 06_limitations#field-review]
tags: 현장검토, 안전, 토지이용, 설치가능성

후보지 추천은 설치 가능성을 확정하지 않는다. 실제 설치 여부는 토지 소유, 지장물, 안전, 민원, 예산, 유지관리 책임, 현장 보행환경을 정책 담당자가 확인해야 한다.

### [chunk: 06_limitations#llm]
tags: LLM, RAG, 근거문서, 답변제한

LLM 해설은 제공된 근거 문서와 선택된 context pack 안에서만 의미가 있다. 근거 문서에 없는 법적 판단, 예산 산정, 실제 공사 가능성, 최신 행정 결정은 답변할 수 없다.
