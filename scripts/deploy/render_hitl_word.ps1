param([string]$DocPath,[string]$PdfPath)
$ErrorActionPreference='Stop'
$word=$null
$document=$null
$progressFile=Join-Path $PSScriptRoot '../../outputs/hitl-release-validation/word-progress.log'
function ReportStep([string]$step) { Add-Content -LiteralPath $progressFile -Value ((Get-Date -Format o)+' '+$step) }
try {
  ReportStep 'creating Word instance'
  $word=New-Object -ComObject Word.Application
  ReportStep 'Word instance created'
  $word.Visible=$false
  $word.DisplayAlerts=0
  $word.AutomationSecurity=3
  $confirmConversions=$false
  $readOnly=$true
  $document=$word.Documents.Open([ref]$DocPath,[ref]$confirmConversions,[ref]$readOnly)
  ReportStep 'document opened'
  $document.ExportAsFixedFormat($PdfPath,17)
  ReportStep 'PDF exported'
} finally {
  $saveChanges=0
  if ($null -ne $document) {$document.Close([ref]$saveChanges)}
  if ($null -ne $word) {$word.Quit([ref]$saveChanges)}
  ReportStep 'Word instance closed'
}
if (-not (Test-Path -LiteralPath $PdfPath)) {throw 'Word PDF export did not produce a file'}
