# git_commit_qa_20260928.ps1 - commit the app QA fixes (park-railway-deploy worktree)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
git status --short
git add -A -- api/update-center.js api/_school_table.js api/_domain_stats.js api/_agent.js api/_agent_tools.js api/_school_profile.js assets/domain-stats.js assets/chat-map.js update-center.html scripts/tests/test_update_center_airbyte.cjs tests/test_chat_answer_recovery.cjs contest_plan/app_qa_20260928.md git_commit_qa_20260928.ps1
git commit -m "QA fixes: sources state from store (survives redeploy), DISTRICT label, PAPS label unified to 4-5 grade, update-center typo, chat map lazy-load wording" -m "See contest_plan/app_qa_20260928.md"
git log --oneline -3
Write-Host 'Committed. Push with: git push' -ForegroundColor Green
