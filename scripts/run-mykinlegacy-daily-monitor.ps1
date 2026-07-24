[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $RunId,
  [Parameter(Mandatory)] [string] $RunDirectory,
  [Parameter(Mandatory)] [string] $RunType,
  [Parameter(Mandatory)] [string] $TargetReportDate
)

$ErrorActionPreference = "Stop"
$secureRoot = Join-Path $env:LOCALAPPDATA "MyKinLegacy\monitoring"
$dailyRoot = Join-Path $secureRoot "daily-results"
$dataRoot = Join-Path $dailyRoot "data"
$historyDb = Join-Path $secureRoot "history\seo-history.sqlite"
$python = Join-Path $env:LOCALAPPDATA "Python\pythoncore-3.14-64\python.exe"
$seoMonitor = Join-Path $PSScriptRoot "mykinlegacy-seo-daily-monitor.py"
$cloudflareMonitor = Join-Path $secureRoot "cloudflare_readonly_verify.py"
$stripeMonitor = Join-Path $secureRoot "stripe_readonly_verify.py"
$observationReporter = Join-Path $PSScriptRoot "render-mykinlegacy-observation-report.py"
$intelligenceBuilder = Join-Path $PSScriptRoot "mykinlegacy-daily-seo-intelligence.py"
$stateTool = Join-Path $PSScriptRoot "mykinlegacy-monitoring-state.py"
$cloudflareResult = Join-Path $secureRoot "cloudflare-verification-result.json"
$stripeResult = Join-Path $secureRoot "stripe-verification-result.json"
$stripeCredential = Join-Path $secureRoot "stripe-restricted-key.dpapi"
$summaryPath = Join-Path $secureRoot "daily-monitor-run-summary.json"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdoutLog = Join-Path $RunDirectory "stdout.log"
$stderrLog = Join-Path $RunDirectory "stderr.log"
$stagePath = Join-Path $RunDirectory "stage-status.json"
$providerPath = Join-Path $RunDirectory "provider-status.json"
$exceptionPath = Join-Path $RunDirectory "exception.json"
$outputPath = Join-Path $RunDirectory "output-files.json"
$securityPath = Join-Path $RunDirectory "security-scan.json"
$completionPath = Join-Path $RunDirectory "completion.json"
$rawRoot = Join-Path $RunDirectory "raw"
$startedAt = (Get-Date).ToString("o")

foreach ($path in @($RunDirectory, $rawRoot, $dailyRoot, $dataRoot, (Split-Path $historyDb -Parent))) {
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}
New-Item -ItemType File -Path $stdoutLog -Force | Out-Null
New-Item -ItemType File -Path $stderrLog -Force | Out-Null

function Write-JsonFile {
  param([Parameter(Mandatory)] [object] $Value, [Parameter(Mandatory)] [string] $Path, [int] $Depth = 12)
  $Value | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-SafeMessage {
  param([string] $Value)
  if (-not $Value) { return $null }
  $safe = $Value -replace '(?i)\b(rk|sk|pk)_(live|test)_[A-Za-z0-9]+\b', '[REDACTED]'
  $safe = $safe -replace '(?i)\bwhsec_[A-Za-z0-9]+\b', '[REDACTED]'
  $safe = $safe -replace '(?i)\bya29\.[A-Za-z0-9._-]+\b', '[REDACTED]'
  $safe = $safe -replace '(?i)\bBearer\s+[A-Za-z0-9._-]+\b', '[REDACTED]'
  $safe = $safe -replace '\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b', '[REDACTED]'
  $safe = $safe.Replace("`r", " ").Replace("`n", " ").Trim()
  if ($safe.Length -gt 500) { $safe = $safe.Substring(0, 500) }
  return $safe
}

$stageNames = @(
  "credential_loading",
  "gsc",
  "ga4",
  "cloudflare",
  "stripe",
  "website_health",
  "article_analysis",
  "query_page_mapping",
  "sqlite_update",
  "report_generation",
  "json_validation",
  "security_scan",
  "status_file_creation",
  "notification_dispatch"
)
$stages = [ordered]@{}
foreach ($name in $stageNames) {
  $stages[$name] = [ordered]@{
    start_time = $null
    end_time = $null
    status = "PENDING"
    sanitized_error_type = $null
    sanitized_error_message = $null
    retry_count = 0
  }
}
$providers = [ordered]@{}
$exceptions = New-Object System.Collections.ArrayList
$firstFailedStage = $null

function Save-StageState {
  Write-JsonFile -Value ([ordered]@{
    run_id = $RunId
    run_type = $RunType
    target_report_date = $TargetReportDate
    updated_at = (Get-Date).ToString("o")
    stages = $stages
  }) -Path $stagePath
  Write-JsonFile -Value ([ordered]@{
    run_id = $RunId
    target_report_date = $TargetReportDate
    updated_at = (Get-Date).ToString("o")
    providers = $providers
  }) -Path $providerPath
  if ($exceptions.Count -gt 0) {
    Write-JsonFile -Value ([ordered]@{
      run_id = $RunId
      target_report_date = $TargetReportDate
      first_failed_stage = $firstFailedStage
      exceptions = @($exceptions)
      contains_credentials = $false
      contains_customer_pii = $false
    }) -Path $exceptionPath
  }
}

function Start-Stage {
  param([Parameter(Mandatory)] [string] $Name)
  $stages[$Name].start_time = (Get-Date).ToString("o")
  $stages[$Name].status = "RUNNING"
  Save-StageState
}

function Complete-Stage {
  param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [ValidateSet("SUCCESS", "FAILED", "SKIPPED")] [string] $Status,
    [string] $ErrorType,
    [string] $ErrorMessage
  )
  if (-not $stages[$Name].start_time) { $stages[$Name].start_time = (Get-Date).ToString("o") }
  $stages[$Name].end_time = (Get-Date).ToString("o")
  $stages[$Name].status = $Status
  $stages[$Name].sanitized_error_type = Get-SafeMessage $ErrorType
  $stages[$Name].sanitized_error_message = Get-SafeMessage $ErrorMessage
  if ($Status -eq "FAILED") {
    if (-not $script:firstFailedStage) { $script:firstFailedStage = $Name }
    [void]$exceptions.Add([ordered]@{
      stage = $Name
      captured_at = (Get-Date).ToString("o")
      error_type = Get-SafeMessage $ErrorType
      error_message = Get-SafeMessage $ErrorMessage
    })
  }
  Save-StageState
}

function Invoke-ExternalStage {
  param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [string] $Executable,
    [Parameter(Mandatory)] [string[]] $Arguments
  )
  Start-Stage $Name
  $stageStdout = Join-Path $RunDirectory "$Name.stdout.log"
  $stageStderr = Join-Path $RunDirectory "$Name.stderr.log"
  try {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments `
      -WorkingDirectory (Split-Path $PSScriptRoot -Parent) -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $stageStdout -RedirectStandardError $stageStderr
    if (Test-Path -LiteralPath $stageStdout) {
      Get-Content -LiteralPath $stageStdout -ErrorAction SilentlyContinue |
        Add-Content -LiteralPath $stdoutLog -Encoding UTF8
    }
    if (Test-Path -LiteralPath $stageStderr) {
      Get-Content -LiteralPath $stageStderr -ErrorAction SilentlyContinue |
        Add-Content -LiteralPath $stderrLog -Encoding UTF8
    }
    if ($process.ExitCode -ne 0) {
      $message = if (Test-Path -LiteralPath $stageStderr) {
        (Get-Content -LiteralPath $stageStderr -Tail 10 -ErrorAction SilentlyContinue) -join " "
      } else {
        "External process returned exit code $($process.ExitCode)"
      }
      Complete-Stage -Name $Name -Status "FAILED" -ErrorType "ExternalProcessFailure" -ErrorMessage $message
      return $false
    }
    Complete-Stage -Name $Name -Status "SUCCESS"
    return $true
  } catch {
    Complete-Stage -Name $Name -Status "FAILED" `
      -ErrorType $_.Exception.GetType().Name -ErrorMessage $_.Exception.Message
    return $false
  }
}

function Copy-IfPresent {
  param([string] $Source, [string] $Destination)
  if (Test-Path -LiteralPath $Source) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  }
}

$scriptHashes = [ordered]@{
  wrapper_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $PSCommandPath).Hash.ToLowerInvariant()
  seo_monitor_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $seoMonitor).Hash.ToLowerInvariant()
  observation_reporter_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $observationReporter).Hash.ToLowerInvariant()
  intelligence_builder_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $intelligenceBuilder).Hash.ToLowerInvariant()
  state_tool_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $stateTool).Hash.ToLowerInvariant()
  cloudflare_monitor_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $cloudflareMonitor).Hash.ToLowerInvariant()
  stripe_monitor_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $stripeMonitor).Hash.ToLowerInvariant()
}

$manifest = [ordered]@{
  run_id = $RunId
  run_type = $RunType
  target_report_date = $TargetReportDate
  started_at = $startedAt
  windows_user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  working_directory = (Get-Location).Path
  script_path = $PSCommandPath
  process_id = $PID
  parent_process_id = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue).ParentProcessId
  task_name = $env:MYKINLEGACY_TASK_NAME
  powershell_version = $PSVersionTable.PSVersion.ToString()
  python_executable = $python
  credentials_recorded = $false
  production_modified = "NO"
  indexing_requests_made = 0
}
Write-JsonFile -Value $manifest -Path (Join-Path $RunDirectory "run-manifest.json")
Save-StageState

$credentialOk = Invoke-ExternalStage -Name "credential_loading" -Executable $python `
  -Arguments @("-X", "utf8", $seoMonitor, "--probe", "credential")
$providers["credential_loading"] = [ordered]@{ status = if ($credentialOk) { "SUCCESS" } else { "FAILED" } }
Save-StageState

$gscOk = $false
$ga4Ok = $false
if ($credentialOk) {
  $gscOk = Invoke-ExternalStage -Name "gsc" -Executable $python `
    -Arguments @("-X", "utf8", $seoMonitor, "--probe", "gsc")
  $ga4Ok = Invoke-ExternalStage -Name "ga4" -Executable $python `
    -Arguments @("-X", "utf8", $seoMonitor, "--probe", "ga4")
} else {
  Complete-Stage -Name "gsc" -Status "SKIPPED" -ErrorMessage "credential loading failed"
  Complete-Stage -Name "ga4" -Status "SKIPPED" -ErrorMessage "credential loading failed"
}
$providers["gsc"] = [ordered]@{ status = if ($gscOk) { "SUCCESS" } else { $stages["gsc"].status } }
$providers["ga4"] = [ordered]@{ status = if ($ga4Ok) { "SUCCESS" } else { $stages["ga4"].status } }
Save-StageState

$cloudflareOk = Invoke-ExternalStage -Name "cloudflare" -Executable $python `
  -Arguments @("-X", "utf8", $cloudflareMonitor)
$providers["cloudflare"] = [ordered]@{ status = if ($cloudflareOk) { "SUCCESS" } else { "FAILED" } }
Copy-IfPresent -Source $cloudflareResult -Destination (Join-Path $rawRoot "cloudflare-verification-result.json")
Save-StageState

if (Test-Path -LiteralPath $stripeCredential) {
  $stripeOk = Invoke-ExternalStage -Name "stripe" -Executable $python `
    -Arguments @("-X", "utf8", $stripeMonitor)
  $providers["stripe"] = [ordered]@{ status = if ($stripeOk) { "SUCCESS" } else { "FAILED" } }
  Copy-IfPresent -Source $stripeResult -Destination (Join-Path $rawRoot "stripe-verification-result.json")
} else {
  $stripeOk = $false
  Start-Stage "stripe"
  Complete-Stage -Name "stripe" -Status "FAILED" -ErrorType "CredentialUnavailable" `
    -ErrorMessage "Stripe read-only credential is unavailable."
  $providers["stripe"] = [ordered]@{ status = "ACCESS_UNAVAILABLE" }
}
Save-StageState

Start-Stage "website_health"
$health = $null
try {
  $productResponse = Invoke-WebRequest -Uri "https://mykinlegacy.com/api/v1/products" -UseBasicParsing -TimeoutSec 30
  $productPayload = $productResponse.Content | ConvertFrom-Json
  $products = if ($null -ne $productPayload.data -and $null -ne $productPayload.data.products) {
    @($productPayload.data.products)
  } elseif ($null -ne $productPayload.products) {
    @($productPayload.products)
  } else {
    @()
  }
  $product = @($products | Where-Object { $_.product_code -eq "family_legacy_collection" }) | Select-Object -First 1
  $productPackage = @($product.packages | Where-Object {
    $_.status -eq "active" -and $_.price_cents -eq 4900 -and $_.currency -eq "USD"
  }) | Select-Object -First 1
  $health = [ordered]@{
    checked_at = (Get-Date).ToString("o")
    homepage_http = (Invoke-WebRequest -Uri "https://mykinlegacy.com/" -UseBasicParsing -TimeoutSec 30).StatusCode
    health_http = (Invoke-WebRequest -Uri "https://mykinlegacy.com/health" -UseBasicParsing -TimeoutSec 30).StatusCode
    create_http = (Invoke-WebRequest -Uri "https://mykinlegacy.com/create" -UseBasicParsing -TimeoutSec 30).StatusCode
    product_api_http = $productResponse.StatusCode
    product_status = $product.status
    product_active_usd_49 = if ($productPackage) { "YES" } else { "NO" }
    robots_http = (Invoke-WebRequest -Uri "https://mykinlegacy.com/robots.txt" -UseBasicParsing -TimeoutSec 30).StatusCode
    sitemap_http = (Invoke-WebRequest -Uri "https://mykinlegacy.com/sitemap.xml" -UseBasicParsing -TimeoutSec 30).StatusCode
  }
  $healthOk = (
    $health.homepage_http -eq 200 -and
    $health.health_http -eq 200 -and
    $health.create_http -eq 200 -and
    $health.product_api_http -eq 200 -and
    $health.product_status -eq "active" -and
    $health.product_active_usd_49 -eq "YES" -and
    $health.robots_http -eq 200 -and
    $health.sitemap_http -eq 200
  )
  if (-not $healthOk) { throw "One or more health conditions failed." }
  Complete-Stage -Name "website_health" -Status "SUCCESS"
  $providers["health"] = [ordered]@{ status = "SUCCESS" }
  Write-JsonFile -Value $health -Path (Join-Path $rawRoot "health.json")
} catch {
  Complete-Stage -Name "website_health" -Status "FAILED" `
    -ErrorType $_.Exception.GetType().Name -ErrorMessage $_.Exception.Message
  $providers["health"] = [ordered]@{ status = "FAILED" }
}
Save-StageState

$collectionOk = $false
if ($credentialOk -and $gscOk -and $ga4Ok) {
  $collectionOk = Invoke-ExternalStage -Name "article_analysis" -Executable $python `
    -Arguments @("-X", "utf8", $seoMonitor, "--date", $TargetReportDate)
  Copy-IfPresent -Source (Join-Path $dailyRoot "latest.json") -Destination (Join-Path $rawRoot "latest.json")
} else {
  Complete-Stage -Name "article_analysis" -Status "SKIPPED" `
    -ErrorMessage "Google read-only provider preflight failed."
}

$combinedPath = Join-Path $dailyRoot "latest.json"
if ($collectionOk -and (Test-Path -LiteralPath $combinedPath)) {
  $combined = Get-Content -Raw -LiteralPath $combinedPath | ConvertFrom-Json
  $gscTimestamp = [ordered]@{
    report_date = $combined.report_date
    sitewide = [ordered]@{
      daily = $combined.sitewide.daily.gsc
      trailing_7_complete_days = $combined.sitewide.trailing_7_complete_days.gsc
      since_observation_baseline = $combined.sitewide.since_observation_baseline.gsc
    }
    articles = @($combined.articles | ForEach-Object {
      [ordered]@{
        path = $_.path
        http_status = $_.http_status
        sitemap_present = $_.sitemap_present
        indexing = $_.gsc_indexing
        public_indexability = $_.public_indexability
        daily = $_.daily.gsc
        cumulative_since_publication = $_.cumulative_since_publication.gsc
        delta_vs_previous_monitor = $_.delta_vs_previous_monitor.indexing
      }
    })
    focused_indexing_verification = $combined.focused_indexing_verification
  }
  $ga4Timestamp = [ordered]@{
    report_date = $combined.report_date
    sitewide = [ordered]@{
      daily = $combined.sitewide.daily.ga4
      trailing_7_complete_days = $combined.sitewide.trailing_7_complete_days.ga4
      since_observation_baseline = $combined.sitewide.since_observation_baseline.ga4
    }
    articles = @($combined.articles | ForEach-Object {
      [ordered]@{
        path = $_.path
        daily = $_.daily.ga4
        cumulative_since_publication = $_.cumulative_since_publication.ga4
      }
    })
  }
  Write-JsonFile -Value $gscTimestamp -Path (Join-Path $dailyRoot "$timestamp-gsc.json")
  Write-JsonFile -Value $ga4Timestamp -Path (Join-Path $dailyRoot "$timestamp-ga4.json")
}
if ($health) { Write-JsonFile -Value $health -Path (Join-Path $dailyRoot "$timestamp-health.json") }
Copy-IfPresent -Source $cloudflareResult -Destination (Join-Path $dailyRoot "$timestamp-cloudflare.json")
Copy-IfPresent -Source $stripeResult -Destination (Join-Path $dailyRoot "$timestamp-stripe.json")

$queryMapOk = $false
if ($collectionOk) {
  $queryMapOk = Invoke-ExternalStage -Name "query_page_mapping" -Executable $python `
    -Arguments @(
      "-X", "utf8", $intelligenceBuilder,
      "--report-date", $TargetReportDate,
      "--timestamp", $timestamp,
      "--daily-root", $dailyRoot,
      "--history-db", $historyDb
    )
} else {
  Complete-Stage -Name "query_page_mapping" -Status "SKIPPED" `
    -ErrorMessage "Article analysis did not complete."
}

Start-Stage "sqlite_update"
try {
  $sqliteCount = & $python -X utf8 -c @"
import sqlite3
connection=sqlite3.connect(r'$historyDb')
print(connection.execute('select count(*) from daily_site_metrics where report_date=?', ('$TargetReportDate',)).fetchone()[0])
connection.close()
"@
  if ($LASTEXITCODE -ne 0 -or [int]$sqliteCount -ne 1) {
    throw "Expected one SQLite row for target report date."
  }
  Complete-Stage -Name "sqlite_update" -Status "SUCCESS"
} catch {
  Complete-Stage -Name "sqlite_update" -Status "FAILED" `
    -ErrorType $_.Exception.GetType().Name -ErrorMessage $_.Exception.Message
}

$reportOk = $false
if ($collectionOk) {
  $reportOk = Invoke-ExternalStage -Name "report_generation" -Executable $python `
    -Arguments @(
      "-X", "utf8", $observationReporter,
      "--date", $TargetReportDate,
      "--timestamp", $timestamp,
      "--daily-root", $dailyRoot,
      "--repo-root", (Split-Path $PSScriptRoot -Parent)
    )
  if (
    -not (Test-Path -LiteralPath (Join-Path $dailyRoot "$TargetReportDate-daily-report.zh-CN.md")) -or
    -not (Test-Path -LiteralPath (Join-Path $dailyRoot "$TargetReportDate-daily-seo-intelligence.zh-CN.md"))
  ) {
    $reportOk = $false
    Complete-Stage -Name "report_generation" -Status "FAILED" `
      -ErrorType "ReportMissing" -ErrorMessage "One or more required reports are missing."
  }
} else {
  Complete-Stage -Name "report_generation" -Status "SKIPPED" `
    -ErrorMessage "Article analysis did not complete."
}

$validationOk = Invoke-ExternalStage -Name "json_validation" -Executable $python `
  -Arguments @(
    "-X", "utf8", $stateTool, "inspect",
    "--date", $TargetReportDate,
    "--daily-root", $dailyRoot,
    "--history-db", $historyDb
  )

Start-Stage "security_scan"
$scanPaths = @($RunDirectory)
foreach ($path in @(
  (Join-Path $dailyRoot "$TargetReportDate-daily-report.zh-CN.md"),
  (Join-Path $dailyRoot "$TargetReportDate-daily-seo-intelligence.zh-CN.md")
)) {
  if (Test-Path -LiteralPath $path) { $scanPaths += $path }
}
if (Test-Path -LiteralPath $dataRoot) {
  $scanPaths += @(Get-ChildItem -LiteralPath $dataRoot -Filter "$TargetReportDate-*.json" -File | ForEach-Object { $_.FullName })
}
$credentialMatches = 0
$piiMatches = 0
foreach ($scanPath in $scanPaths) {
  $files = if ((Get-Item -LiteralPath $scanPath).PSIsContainer) {
    Get-ChildItem -LiteralPath $scanPath -File -Recurse
  } else {
    Get-Item -LiteralPath $scanPath
  }
  foreach ($file in $files) {
    if ($file.Name -in @("security-scan.json", "output-files.json")) { continue }
    $text = Get-Content -Raw -LiteralPath $file.FullName -ErrorAction SilentlyContinue
    if ($text -match '(?i)\b(rk|sk|pk)_(live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9]+\b|\bya29\.[A-Za-z0-9._-]+\b') {
      $credentialMatches += 1
    }
    if ($text -match '\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b') {
      $piiMatches += 1
    }
  }
}
$security = [ordered]@{
  scanned_at = (Get-Date).ToString("o")
  credential_file_matches = $credentialMatches
  email_pattern_file_matches = $piiMatches
  contains_credentials = $credentialMatches -gt 0
  contains_customer_pii = $piiMatches -gt 0
  production_modified = "NO"
  indexing_requests_made = 0
}
Write-JsonFile -Value $security -Path $securityPath
if ($credentialMatches -eq 0 -and $piiMatches -eq 0) {
  Complete-Stage -Name "security_scan" -Status "SUCCESS"
} else {
  Complete-Stage -Name "security_scan" -Status "FAILED" `
    -ErrorType "SensitiveDataPatternDetected" `
    -ErrorMessage "Security scan found a credential or email pattern in monitoring outputs."
}

Complete-Stage -Name "status_file_creation" -Status "SKIPPED" `
  -ErrorMessage "Status file is created by the outer orchestrator."
Complete-Stage -Name "notification_dispatch" -Status "SKIPPED" `
  -ErrorMessage "Notification is dispatched by the outer orchestrator."

$failed = @($stages.GetEnumerator() | Where-Object { $_.Value.status -eq "FAILED" }).Count -gt 0
$results = [ordered]@{
  credential_loading = $stages["credential_loading"].status
  gsc = $stages["gsc"].status
  ga4 = $stages["ga4"].status
  cloudflare = $stages["cloudflare"].status
  stripe = $stages["stripe"].status
  website_health = $stages["website_health"].status
  article_analysis = $stages["article_analysis"].status
  query_page_mapping = $stages["query_page_mapping"].status
  sqlite_update = $stages["sqlite_update"].status
  report_generation = $stages["report_generation"].status
  json_validation = $stages["json_validation"].status
  security_scan = $stages["security_scan"].status
}
$summary = [ordered]@{
  run_id = $RunId
  run_type = $RunType
  target_report_date = $TargetReportDate
  started_at = $startedAt
  completed_at = (Get-Date).ToString("o")
  failed_stage = $firstFailedStage
  results = $results
  stdout_log = $stdoutLog
  stderr_log = $stderrLog
  run_directory = $RunDirectory
  daily_markdown_report = (Join-Path $dailyRoot "$TargetReportDate-daily-report.zh-CN.md")
  daily_seo_intelligence_report = (Join-Path $dailyRoot "$TargetReportDate-daily-seo-intelligence.zh-CN.md")
  daily_seo_data_directory = $dataRoot
  seo_history_database = $historyDb
  credentials_in_arguments = $false
  indexing_requested = $false
  sitemap_submitted = $false
  script_hashes = $scriptHashes
  vps_capacity = if (Test-Path -LiteralPath (Join-Path $secureRoot "vps-capacity\latest.json")) {
    Get-Content -Raw -LiteralPath (Join-Path $secureRoot "vps-capacity\latest.json") | ConvertFrom-Json
  } else {
    [ordered]@{ status = "UNAVAILABLE"; deployment_allowed = "UNKNOWN" }
  }
}
Write-JsonFile -Value $summary -Path $summaryPath
Write-JsonFile -Value $summary -Path (Join-Path $RunDirectory "runner-summary.json")
Write-JsonFile -Value $summary -Path (Join-Path $dailyRoot "$timestamp-summary.json")

$files = @()
Get-ChildItem -LiteralPath $RunDirectory -File -Recurse | ForEach-Object {
  $files += [ordered]@{
    path = $_.FullName.Substring($RunDirectory.Length + 1)
    size = $_.Length
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
  }
}
Write-JsonFile -Value $files -Path $outputPath

$completion = [ordered]@{
  run_id = $RunId
  run_type = $RunType
  target_report_date = $TargetReportDate
  started_at = $startedAt
  completed_at = (Get-Date).ToString("o")
  status = if ($failed) { "FAILED" } else { "PIPELINE_SUCCESS_PENDING_STATUS" }
  failed_stage = $firstFailedStage
  production_modified = "NO"
  indexing_requests_made = 0
}
Write-JsonFile -Value $completion -Path $completionPath

if ($failed -or -not $validationOk) { exit 1 }
exit 0
