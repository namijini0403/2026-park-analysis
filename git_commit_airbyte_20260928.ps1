# git_commit_airbyte_20260928.ps1 - commit today's Airbyte integration in park-railway-deploy (git worktree)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
git status --short
git add -A -- scripts/update_center/airbyte_raw.mjs scripts/update_center/scan.mjs scripts/update_center/pipeline.mjs scripts/update_center/coverage.mjs api/update-center.js update-center.html data_sources.yaml package.json scripts/tests/test_update_center_airbyte.cjs scripts/deploy/prepare_hitl_release.cjs airbyte/source-datagokr-catalog.yaml contest_plan/airbyte_integration_20260928.md deploy_airbyte_20260928.ps1 git_commit_airbyte_20260928.ps1
git commit -m "Airbyte collection layer: airbyte_catalog check type, raw-store reader, update-center panel; pipeline error dedup; python runtime deploy script" -m "Airbyte(모두의 AI 실험실) custom connector for data.go.kr catalog -> Railway Postgres airbyte_raw. 8 sources switched to airbyte_catalog. Signals only; approval/rollback unchanged. Deployed to park-analysis-web-production and datarock.up.railway.app on 2026-09-28."
git log --oneline -3
Write-Host ''
Write-Host 'Committed on current branch. To push:  git push' -ForegroundColor Green
