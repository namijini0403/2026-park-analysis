# SDD ledger — plan: docs/superpowers/plans/2026-08-09-p1-layer-registry.md
Task 1: complete (commits b5fcf5b..69e7a24, review clean; controller-approved amendment: layerToggleBar contains filter groups, so selective button replacement instead of innerHTML wipe)
Task 1: minor (deferred): cssColor branch dead until first layer with cssColor — intentional mechanism for P2
Task 2: complete (commits 69e7a24..bcbaa49, review clean)
Task 3: complete (commits bcbaa49..072b026, review clean)
Task 4: complete (commits 072b026..3d15f11, review clean; amendment: js-yaml pinned @^4.3.1 — v5 dropped default export)
Task 5: complete (commits 3d15f11..5448284, review clean)
Final review: fix wave 5448284..2616d30 — 6/6 addressed, re-review clean
Controller visual pass (headless Chrome CDP, localhost:3000): registry-generated 5 toggle buttons + checkboxes + labels OK; ON/OFF sync (checked/is-on/aria) OK for all 5; case filters 6 (island injected) OK; access filters 6 OK; panel shows new branding; ZERO app console errors. Map tiles blocked by env: Kakao key not registered for localhost:3000 (Referer→401→ORB). NOT a regression — init() early-returns on SDK failure by design.
P1 COMPLETE (b5fcf5b..2616d30). Notes for P2 plan: gu-filter requires new layer CSV to carry gu-derivable column or markers vanish on gu select; cssColor first-use acceptance check (off=neutral border, on=colored); Railway build smoke after root package-lock.json new; validator minor hardening done in fix wave.
