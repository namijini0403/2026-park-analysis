# SDD ledger — plan: docs/superpowers/plans/2026-08-09-p3-policy-cards.md
Task 1: complete (commits 4814027..a02ea49, review clean; base dist esn60/ii81/ms83/mm45/il3, stability {1/3:141, 1.0:131}, separate 30, data_gap 1; amendment: 도서지역=is_separate_bundle_tag 30교)
Task 2: fix round 1/5 (3 addressed — threshold wording, stability subset framing, verbatim quote; commit b7aaa94)
Task 2: complete (commits a02ea49..b7aaa94, review clean)
Task 3: complete (commits b7aaa94..ac26e50, review clean)
Task 4: fix round 1/5 (2 addressed — bare 시나리오 narrowed to compound terms, domain pattern tightened; commit 54909d1)
Task 4: complete (commits ac26e50..54909d1, review clean)
Task 4: minor (deferred): '정책 시나리오 트랙' 문구는 pre-existing metrics 라우팅 공백으로 glossary 착지; bare 추천 term pre-existing domain-gate leak (downstream 차단됨)
Task 5: complete (no commit, gates 6/6)
Controller visual pass: card renders with scenario toggles(제약 selected state visible), 우선 검토안 badge, 조건부 대안, 별도트랙 badge, 근거 3, 안정성 100% — base→제약 전환 시 외부 신규 공급→권역 공동활용·거점화 + '조건 변경으로 권고 전환됨' 확인. app errors kakao-sdk(env)만
Final review: fix wave 54909d1..6367b24 — 4/4 addressed (doc honesty access_route_improvement 0건, UI alt-row dedup, pipeline order+guard, riders), re-review clean
P3 COMPLETE (4814027..6367b24). Deferred to future: reading regex precedes policy in detectTopic(soft overlap), evaluate_ai_explainer_retrieval.mjs has stale topic duplicate(P2부터 drift), card badges inline styles(cosmetic), scenario toggles inert-but-visible on separate_track schools
