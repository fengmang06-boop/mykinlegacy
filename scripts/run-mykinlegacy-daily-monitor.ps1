[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$secureRoot = Join-Path $env:LOCALAPPDATA "MyKinLegacy\monitoring"
$logRoot = Join-Path $secureRoot "logs"
$python = Join-Path $env:LOCALAPPDATA "Python\pythoncore-3.14-64\python.exe"
$seoMonitor = Join-Path $PSScriptRoot "mykinlegacy-seo-daily-monitor.py"
$cloudflareMonitor = Join-Path $secureRoot "cloudflare_readonly_verify.py"
$stripeMonitor = Join-Path $secureRoot "stripe_readonly_verify.py"
$stripeCredential = Join-Path $secureRoot "stripe-restricted-key.dpapi"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdoutLog = Join-Path $logRoot "$timestamp.stdout.log"
$stderrLog = Join-Path $logRoot "$timestamp.stderr.log"
$summaryPath = Join-Path $secureRoot "daily-monitor-run-summary.json"

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$results = [ordered]@{}

function Invoke-SafeMonitor {
  param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [string] $Script
  )

  $output = & $python $Script 2>> $stderrLog
  $exitCode = $LASTEXITCODE
  if ($output) { $output | Out-File -FilePath $stdoutLog -Append -Encoding utf8 }
  $script:results[$Name] = if ($exitCode -eq 0) { "SUCCESS" } else { "FAILED" }
  return $exitCode
}

$failed = $false
if ((Invoke-SafeMonitor -Name "gsc_ga4" -Script $seoMonitor) -ne 0) { $failed = $true }
if ((Invoke-SafeMonitor -Name "cloudflare" -Script $cloudflareMonitor) -ne 0) { $failed = $true }

if (Test-Path -LiteralPath $stripeCredential) {
  if ((Invoke-SafeMonitor -Name "stripe_readonly" -Script $stripeMonitor) -ne 0) { $failed = $true }
} else {
  $results["stripe_readonly"] = "ACCESS_UNAVAILABLE"
  "Stripe read-only credential is unavailable; no broader production credential was used." |
    Out-File -FilePath $stderrLog -Append -Encoding utf8
}

$summary = [ordered]@{
  completed_at = (Get-Date).ToString("o")
  results = $results
  stdout_log = $stdoutLog
  stderr_log = $stderrLog
  credentials_in_arguments = $false
  indexing_requested = $false
  sitemap_submitted = $false
}
$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding utf8

if ($failed) { exit 1 }
exit 0
