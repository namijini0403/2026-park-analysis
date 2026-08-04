<#
  공모전 앱 일일 점검 - 자동 실행 래퍼 (Windows 작업 스케줄러용)
  ------------------------------------------------------------
  - 기존 daily_health_check.ps1 을 그대로 실행하고
  - 결과를 scripts\logs\ 에 날짜별 로그로 저장하며
  - 17/17 이 깨질 때(=FAIL 발생)에만 팝업 경고를 띄운다.
  - 정상인 날은 조용히 로그만 남기고 끝난다.

  오탐(false alarm) 방지:
  - 부팅 직후 인터넷이 아직 안 붙은 상태에서 도는 것을 막기 위해,
    대상 호스트 DNS 해석이 될 때까지 최대 약 3분 대기한다.
  - 그래도 네트워크가 없으면 '사이트 문제'가 아니므로 알림 대신 SKIP 으로 기록한다.
  - 점검이 실패하면 일시적 문제일 수 있으니 60초 후 1회 재시도한 뒤에만 알린다.

  수동 등록/해제는 register_health_check_task.ps1 참고.
#>

$ErrorActionPreference = "Stop"

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$base       = Join-Path $scriptDir "daily_health_check.ps1"
$logDir     = Join-Path $scriptDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

$stamp      = Get-Date -Format "yyyy-MM-dd_HHmm"
$log        = Join-Path $logDir ("health_{0}.log" -f $stamp)
$targetHost = "2026-park-analysis.vercel.app"

$utf8 = New-Object System.Text.UTF8Encoding($true)
function Append-Utf8 {
    param([string]$Path, [string]$Line)
    $existing = if (Test-Path $Path) { [System.IO.File]::ReadAllText($Path, $utf8) } else { "" }
    [System.IO.File]::WriteAllText($Path, ($existing + $Line + "`r`n"), $utf8)
}

# 점검 스크립트가 끝에서 키 입력을 기다리지 않도록 CI 플래그를 켠다
$env:CI = "1"

# --- 네트워크 준비 대기 (부팅 직후 오탐 방지): DNS 해석 최대 ~3분 ---
$online = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        [void][System.Net.Dns]::GetHostEntry($targetHost)
        $online = $true
        break
    } catch {
        Start-Sleep -Seconds 15
    }
}

# 인터넷이 안 붙은 상태면 사이트 문제로 보지 않는다 -> 알림 없이 SKIP 기록
if (-not $online) {
    $skipLine = "[{0}] SKIP - 네트워크 미연결(DNS 해석 실패)로 점검 보류. 사이트 문제 아님." -f (Get-Date -Format "yyyy-MM-dd HH:mm")
    Append-Utf8 -Path (Join-Path $logDir "SKIPPED.log") -Line $skipLine
    exit 0
}

# 점검을 1회 실행하고 통과 여부(true/false)를 반환
function Invoke-Check {
    Start-Transcript -Path $log -Force | Out-Null
    try {
        & $base
    } catch {
        Write-Host ("[WRAPPER-ERROR] 점검 스크립트 실행 실패: {0}" -f $_.Exception.Message)
    }
    Stop-Transcript | Out-Null

    $content = Get-Content $log -Raw
    $failed  = ($content -match "\[FAIL\]") -or ($content -match "\[WRAPPER-ERROR\]")
    return (-not $failed)
}

$passed = Invoke-Check
if (-not $passed) {
    # 일시적 문제(순간 네트워크 끊김 등)일 수 있으니 60초 후 1회 재시도
    Start-Sleep -Seconds 60
    $passed = Invoke-Check
}

# 가장 최근 로그를 latest.log 로도 복사 (빠르게 열어보기용)
Copy-Item $log (Join-Path $logDir "latest.log") -Force

if (-not $passed) {
    $failLine = "[{0}] FAIL 감지 - 로그: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm"), $log
    Append-Utf8 -Path (Join-Path $logDir "FAILURES.log") -Line $failLine

    # 화면에 팝업 경고 (로그인 세션이 있을 때만 보임)
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "공모전 앱 점검에서 문제가 발견됐습니다.`n(60초 후 재시도까지 실패)`n`n로그 확인:`n$log",
            "⚠ 공모전 앱 점검 실패",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
    } catch { }

    exit 1
}

exit 0
