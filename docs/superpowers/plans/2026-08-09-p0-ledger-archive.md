# SDD ledger — plan: docs/superpowers/plans/2026-08-09-p0-rebranding-fixes.md
Task 1: complete (commits fa02184..b385aa0, review clean)
Task 2: complete (commits b385aa0..4500988, review clean)
Task 2: minor (deferred): ParkLens 2 occurrences remain in ui-preview JS bundle from components outside task scope — locate source and rebrand in final pass
Task 2: minor (deferred): pre-existing dist/source CSS drift fixed incidentally by rebuild — Task 6 smoke should eyeball other preview pages
Task 3: complete (commits 4500988..4f0c7cf, review clean)
Task 4: complete (commits 4f0c7cf..0eb91f7, review clean)
Task 5: fix round 1/5 (1 addressed — wildcard Railway CORS pattern removed per security ruling; commits 8b67b9b..60f29d2)
Task 5: complete (commits 0eb91f7..60f29d2, review clean; NOTE plan amendment: broad wildcard /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/ ruled a security defect and excluded — final state has exact production domain only)
Task 6: fix round 1/5 (2 addressed, 0 open — smoke evidence re-captured verbatim, count corrected 5→8; no new commits)
Task 6: complete (commits 60f29d2..783b1d2, review clean)
Final review: fix wave 783b1d2..253edde — 4/4 addressed (Critical PreviewWorkspaceSafe rebrand, spec CORS amendment, narrative axes, og:image comment), re-review clean
P0 COMPLETE (e21cdfe..253edde). Deferred to P1 plan: meta-description tag, candidate_panel_examples duplicate source-of-truth, FALLBACK_CANDIDATE_PANEL_EXAMPLES drift risk. Deferred to P2 plan: '내부 공급' cover copy re-check when internal-supply axis ships.
