<#
  공모전 앱 일일 점검 스크립트
  ------------------------------------------------------------
  심사자 방문 전 매일 라이브 사이트가 정상인지 한 번에 확인한다.
  점검 항목:
    1) 메인 페이지 로딩
    2) Vercel 방문자 분석 스크립트 반영 여부
    3) AI 챗봇 (학교 선택 모드 / 공개 비식별 모드) 실제 답변 여부
    4) 지도/상세리포트/시뮬레이션이 쓰는 핵심 데이터 자산 13종

  실행 방법:
    - 파일 우클릭 > "PowerShell에서 실행"
    - 또는 터미널에서:  powershell -ExecutionPolicy Bypass -File scripts\daily_health_check.ps1
#>

$ErrorActionPreference = "Stop"
$Base = "https://2026-park-analysis.vercel.app"

$pass = 0
$fail = 0

function Test-Url {
    param([string]$Path, [string]$Label)
    $url = "$Base/$Path"
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 20
        $code = [int]$resp.StatusCode
    } catch {
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
        else { $code = 0 }
    }
    if ($code -eq 200) {
        Write-Host ("  [OK]   {0,-3}  {1}" -f $code, $Label) -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host ("  [FAIL] {0,-3}  {1}" -f $code, $Label) -ForegroundColor Red
        $script:fail++
    }
}

function Test-AiChatbot {
    param([string]$Label, [hashtable]$Body)
    $url = "$Base/api/ai-explainer-v2"
    try {
        $json = $Body | ConvertTo-Json -Depth 6 -Compress
        $resp = Invoke-RestMethod -Uri $url -Method Post -Body $json `
            -ContentType "application/json" -TimeoutSec 30
        if ($resp.answerable -eq $true) {
            Write-Host ("  [OK]   answerable  {0}" -f $Label) -ForegroundColor Green
            $script:pass++
        } else {
            $reason = $resp.blocked_reason
            Write-Host ("  [FAIL] blocked     {0}  ({1})" -f $Label, $reason) -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host ("  [FAIL] error       {0}  ({1})" -f $Label, $_.Exception.Message) -ForegroundColor Red
        $script:fail++
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " 공모전 앱 일일 점검  -  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host " $Base" -ForegroundColor DarkGray
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`n[1] 페이지 / 방문자 분석" -ForegroundColor Yellow
Test-Url -Path ""                                -Label "메인 페이지"
Test-Url -Path "_vercel/insights/script.js"      -Label "Vercel 방문자 분석 스크립트"
Test-Url -Path "ui-preview/dist/index.html"      -Label "상세리포트/시뮬레이션 iframe"
Test-Url -Path "logo.png"                        -Label "로고"

Write-Host "`n[2] AI 챗봇 (실제 질문 전송)" -ForegroundColor Yellow
Test-AiChatbot -Label "학교 선택 모드 (case 분류)" -Body @{
    mode          = "identified_school_explainer"
    question      = "이 학교가 왜 이 케이스로 분류됐나요?"
    question_type = "case_reason"
    school_context = @{
        school_id  = "B000012345"
        school_name = "석암초등학교"
        case_label = "즉시 개선"
        case_type  = "case1"
    }
}
Test-AiChatbot -Label "공개 비식별 모드 (용어 설명)" -Body @{
    mode          = "public_anonymous_explainer"
    question      = "KNN 유사학교가 무슨 뜻인가요?"
    question_type = "glossary"
}

Write-Host "`n[3] 핵심 데이터 자산" -ForegroundColor Yellow
$assets = @(
    "data_processed/school_priority_with_functional_park_layer.csv",
    "data_processed/schools.csv",
    "data_processed/school_nearest_park.csv",
    "data_processed/parks.csv",
    "data_processed/candidate_barrier_routes_by_school.json",
    "data_processed/robust_candidate_recommendations.json",
    "data_processed/robust_shap_candidate_explanations.json",
    "data_processed/school_isochrone_500m.geojson",
    "data_processed/school_buffer_500m.geojson",
    "data_processed/candidate_grid_final.geojson",
    "data_processed/gu_summary.csv"
)
foreach ($a in $assets) { Test-Url -Path $a -Label $a }

Write-Host "`n==================================================" -ForegroundColor Cyan
$total = $pass + $fail
if ($fail -eq 0) {
    Write-Host (" 결과: 전부 정상  ({0}/{1})  심사 준비 완료" -f $pass, $total) -ForegroundColor Green
} else {
    Write-Host (" 결과: {0}개 정상 / {1}개 문제  ->  위 [FAIL] 항목 확인 필요" -f $pass, $fail) -ForegroundColor Red
}
Write-Host "==================================================`n" -ForegroundColor Cyan

# 더블클릭 실행 시 결과를 볼 수 있게 창 유지
if ($Host.Name -eq "ConsoleHost" -and -not $env:CI) {
    Write-Host "(아무 키나 누르면 닫힙니다)" -ForegroundColor DarkGray
    [void][System.Console]::ReadKey($true)
}
