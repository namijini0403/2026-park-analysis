# deploy_airbyte_20260928.ps1  (v2 - non-interactive link, two targets)
# Usage (PowerShell 7):
#   pwsh -ExecutionPolicy Bypass -File "<this file>"                  # target: web  (park-analysis-web-production.up.railway.app)
#   pwsh -ExecutionPolicy Bypass -File "<this file>" -Target preview  # target: preview (datarock.up.railway.app, the PPT QR address)
#   add -SkipTests to skip step 1, -SkipBuild to reuse the last snapshot in outputs/hitl-release-path.txt
#
# Steps: [1] tests  [2] railway link (by ID, no prompts)  [3] Airbyte raw-store variables  [4] build + snapshot + railway up
# The snapshot Dockerfile installs python3 + requirements.txt, so this redeploy also fixes "spawn python ENOENT".
# Airbyte side (destination + daily connection + first sync) is already done; nothing here touches Airbyte.

param(
  [ValidateSet('web','preview')] [string] $Target = 'web',
  [switch] $SkipTests,
  [switch] $SkipBuild
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host "== working dir: $PWD  | target: $Target"

$targets = @{
  web     = @{ project='ced0c8e2-5f05-403d-a086-56c6604d0bb2'; env='2480fc29-fff5-41b1-acd2-1c6671de267a'; service='f9ad0f15-3258-4d43-9dbf-62dfd91258ab'; name='2026-park-analysis / park-analysis-web'; url='https://park-analysis-web-production.up.railway.app' }
  preview = @{ project='819e8af2-e6db-4fbf-bab9-76731a7408d5'; env='08a322cd-3447-4eef-8a9e-a7a8d8ead656'; service='0959785c-35d7-4734-b4c0-63b2c8e4eeac'; name='education-living-area-preview (datarock.up.railway.app)'; url='https://datarock.up.railway.app' }
}
$pgSvc = '3920cb30-7449-4f5b-bc98-1fd36c3d1310'   # Postgres in 2026-park-analysis (Airbyte destination; TCP proxy metro.proxy.rlwy.net:18581)
$t = $targets[$Target]

function Step($n, $msg) { Write-Host ""; Write-Host "==== [$n] $msg" -ForegroundColor Cyan }

Step 1 'Regression tests'
if ($SkipTests) { Write-Host 'skipped (-SkipTests)' } else {
  node scripts/tests/test_update_center_airbyte.cjs
  if ($LASTEXITCODE -ne 0) { throw 'airbyte_catalog test failed - stop and report the output' }
  npm run test:update-center
  if ($LASTEXITCODE -ne 0) { throw 'update-center test suite failed - stop and report the output' }
}

Step 2 "Railway link -> $($t.name)"
railway whoami
if ($LASTEXITCODE -ne 0) { Write-Host 'Not logged in. Running: railway login'; railway login }
railway link --project $t.project --environment $t.env --service $t.service
if ($LASTEXITCODE -ne 0) { throw 'railway link failed (expected account: seokamrock@gmail.com)' }
railway status

Step 3 'Airbyte raw-store variables (no redeploy yet)'
if ($Target -eq 'web') {
  # app DATABASE_URL already points to the same Postgres (internal host); only schema/stream/max-age are needed
  railway variables --set "AIRBYTE_RAW_SCHEMA=airbyte_raw" --set "AIRBYTE_RAW_STREAM=datagokr_catalog" --set "AIRBYTE_RAW_MAX_AGE_HOURS=72" --skip-deploys
} else {
  # preview has no DATABASE_URL (file store on a volume) -> point it at the Postgres public proxy the Airbyte destination writes to
  # Postgres lives in the 2026-park-analysis project: link there just to read the password, then link back to preview
  $w = $targets['web']
  railway link --project $w.project --environment $w.env --service $pgSvc
  if ($LASTEXITCODE -ne 0) { throw 'railway link to Postgres (2026-park-analysis) failed' }
  $pw = (railway variables --kv | Select-String '^PGPASSWORD=').Line -replace '^PGPASSWORD=',''
  railway link --project $t.project --environment $t.env --service $t.service
  if ($LASTEXITCODE -ne 0) { throw 'railway link back to preview failed' }
  if (-not $pw) { throw 'Could not read PGPASSWORD from the Postgres service' }
  $rawUrl = "postgresql://postgres:$pw@metro.proxy.rlwy.net:18581/railway"
  railway variables --set "AIRBYTE_RAW_DATABASE_URL=$rawUrl" --set "AIRBYTE_RAW_SCHEMA=airbyte_raw" --set "AIRBYTE_RAW_STREAM=datagokr_catalog" --set "AIRBYTE_RAW_MAX_AGE_HOURS=72" --set "PGSSL_NO_VERIFY=1" --skip-deploys
  Remove-Variable pw, rawUrl
  Write-Host 'AIRBYTE_RAW_DATABASE_URL set on preview (value not printed).'
}

Step 4 'Build + snapshot + deploy'
if ($SkipBuild -and (Test-Path 'outputs/hitl-release-path.txt')) {
  Write-Host 'reusing last snapshot (-SkipBuild)'
} else {
  npm run build:vercel
  if ($LASTEXITCODE -ne 0) { throw 'build:vercel failed' }
  node scripts/deploy/prepare_hitl_release.cjs
  if ($LASTEXITCODE -ne 0) { throw 'snapshot failed - deploy aborted' }
}
$releasePath = (Get-Content -LiteralPath 'outputs/hitl-release-path.txt' -Raw).Trim()
Write-Host "Release snapshot: $releasePath"
railway up "$releasePath" --path-as-root --no-gitignore --detach --json --message "Airbyte collection layer (airbyte_catalog) + python runtime [$Target]"
Write-Host ''
Write-Host "Done. Wait for SUCCESS in Railway, then open $($t.url)/update-center.html and check:" -ForegroundColor Green
Write-Host '  - panel [9] Airbyte shows the raw store with 10 datasets and a recent sync time'
Write-Host '  - parks/schools/redevelopment/nightlife*/construction* show check type airbyte_catalog (baseline on first scan)'
Write-Host '  - libraries/school_zones/school_public_disclosures no longer fail with spawn python ENOENT'
Write-Host 'Run again with -Target preview -SkipTests -SkipBuild to deploy the same snapshot to datarock.up.railway.app.'
