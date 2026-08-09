# SDD ledger — plan: docs/superpowers/plans/2026-08-09-p2-reading-module.md
Task 1: complete (commits 4287157..d0d9c91, review clean; 272 schools, 99.63% match, iso 0-count=213 schools)
Task 2: fix round 1/5 (1 addressed — internal_shortage marginal 114→123 in thresholds doc; commit ca0512e)
Task 2: complete (commits d0d9c91..ca0512e, review clean; types: direct_investment_first 114 / school_hub_mobile 138 / public_link 9 / maintain_monitor 10 / 추가확인필요 1)
Task 2: minor (deferred): 학교도서관진흥법 제12조 인용 정확성은 제출 문서 사용 전 human 확인 권장
Task 3: complete (commits ca0512e..c7da01e, review clean)
Task 3: minor (deferred): reading badge inline border-color has no border-style — cosmetic dead property
Task 4: implemented (commit 39fa42e) — review deferred, will be covered together with corrective Task 4.5 (numbers will change)
PLAN AMENDMENT (controller): inserted Task 4.5 — geocode 68 coordinate-missing libraries (65 of 118 public libraries lacked coords, dominating the gap; scout's '주로 작은도서관' claim was wrong). external_shortage=253 likely overstated; full pipeline re-run + doc/chunk number sync required.
Task 4: complete (commit 39fa42e, combined review clean)
Task 4.5: complete (commit f75f28b, review clean; geocoded 44/68, external_shortage 253→245, types 111/133/12/15/1)
Task 4.5: minor (deferred): 24 geocode failures (옹진/강화 중심) — Kakao REST 키 확보 시 보완 권장; detectTopic '열람좌석' 은 브리프의 '열람'보다 좁음 (recall 소폭 감소)
P2 controller visual pass: library toggle off(보라 테두리+무채색)/on(보라 배경) OK; reading section renders 외부/내부/뱃지/참고치 라벨/사서미배치 강조 OK; registry order isochrone,buffer,parks,library,redevelopment,candidate; app console errors only kakao-sdk(env)
Final review: fix wave f75f28b..fff2113 — 7/7 addressed (geocode honesty, reference_date note, badge contrast+border, gap_type_actions mapping+validator, merge name-guard, nearest type/coord-source columns+UI, sweeps incl. law citation 제12조 heading corrected to '전담부서의 설치 등'), re-review clean
P2 COMPLETE (4287157..fff2113). Carry-over to P3 plan: internal_shortage is 3-valued (True/False/'추가 확인 필요') — naive truthiness treats the string as True; gap_type_actions mapping in reading.yaml is the interface; 7-action enum in validate_module_contract.mjs. User-optional: Kakao REST 키로 잔여 24건 지오코딩 보완, 법령 인용 최종 human 확인
