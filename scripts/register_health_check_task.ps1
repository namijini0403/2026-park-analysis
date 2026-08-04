<#
  공모전 앱 일일 점검을 Windows 작업 스케줄러에 등록/해제하는 스크립트
  ------------------------------------------------------------
  등록 :  powershell -File scripts\register_health_check_task.ps1
  해제 :  powershell -File scripts\register_health_check_task.ps1 -Unregister
  시각 변경:  powershell -File scripts\register_health_check_task.ps1 -At 21:00

  - 매일 지정한 시각에 daily_health_check_scheduled.ps1 을 실행한다.
  - PC가 꺼져 있어 그 시각을 놓치면, 켜진 직후 보충 실행된다(StartWhenAvailable).
  - 17/17 이 깨질 때만 팝업으로 알린다(정상인 날은 조용히 로그만).
#>

param(
    [string]$At = "09:00",
    [string]$Until = "2026-07-30",   # 이 날짜(포함)까지만 실행하고 이후 자동 중지
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"
$TaskName  = "ParkAnalysis-DailyHealthCheck"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$target    = Join-Path $scriptDir "daily_health_check_scheduled.ps1"

if ($Unregister) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "[해제 완료] '$TaskName' 작업을 제거했습니다." -ForegroundColor Yellow
    } else {
        Write-Host "[안내] 등록된 '$TaskName' 작업이 없습니다." -ForegroundColor DarkGray
    }
    return
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument ('-NoProfile -WindowStyle Hidden -File "{0}"' -f $target)

$trigger = New-ScheduledTaskTrigger -Daily -At $At
# 종료일(포함) 23:59까지 실행하고 이후로는 트리거되지 않게 한다
$trigger.EndBoundary = ([datetime]"$Until 23:59:00").ToString("s")

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -DontStopOnIdleEnd

# 기존 동일 작업이 있으면 덮어쓴다
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description "공모전 앱(2026-park-analysis) 라이브 사이트 일일 점검. 문제 시 팝업 알림." | Out-Null

Write-Host "[등록 완료] '$TaskName' - 매일 $At 실행" -ForegroundColor Green
Write-Host "  실행 대상: $target" -ForegroundColor DarkGray
Write-Host "  로그 위치: $(Join-Path $scriptDir 'logs')" -ForegroundColor DarkGray
