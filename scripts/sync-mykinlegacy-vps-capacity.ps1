[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repo = "fengmang06-boop/mykinlegacy"
$workflow = "vps-capacity-monitor.yml"
$secureRoot = Join-Path $env:LOCALAPPDATA "MyKinLegacy\monitoring\vps-capacity"
$latestPath = Join-Path $secureRoot "latest.json"
$historyPath = Join-Path $secureRoot "history.jsonl"
New-Item -ItemType Directory -Path $secureRoot -Force | Out-Null

$headers = @{
  Accept = "application/vnd.github+json"
  "User-Agent" = "MyKinLegacy-Capacity-Monitor"
}
$runs = Invoke-RestMethod -Headers $headers `
  -Uri "https://api.github.com/repos/$repo/actions/workflows/$workflow/runs?status=completed&per_page=10"
$run = @($runs.workflow_runs | Where-Object { $_.conclusion -in @("success", "failure") }) |
  Select-Object -First 1
if ($null -eq $run) { throw "No completed capacity workflow run is available." }

$artifacts = Invoke-RestMethod -Headers $headers `
  -Uri "https://api.github.com/repos/$repo/actions/runs/$($run.id)/artifacts"
$artifact = @($artifacts.artifacts | Where-Object {
  $_.name -eq "vps-capacity-status-$($run.id)" -and -not $_.expired
}) | Select-Object -First 1
if ($null -eq $artifact) { throw "The latest capacity artifact is unavailable." }

$zipPath = Join-Path $secureRoot "capacity-$($run.id).zip"
$extractPath = Join-Path $secureRoot "run-$($run.id)"
Invoke-WebRequest -Headers $headers -Uri $artifact.archive_download_url -OutFile $zipPath
if (Test-Path -LiteralPath $extractPath) {
  Remove-Item -LiteralPath $extractPath -Recurse -Force
}
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
$statusFile = Join-Path $extractPath "capacity-status.txt"
if (-not (Test-Path -LiteralPath $statusFile)) {
  throw "capacity-status.txt is missing from the artifact."
}

$values = [ordered]@{}
Get-Content -LiteralPath $statusFile | ForEach-Object {
  if ($_ -match '^([a-z_]+)=(.*)$') {
    $values[$matches[1]] = $matches[2]
  }
}
$required = @(
  "timestamp", "root_total_bytes", "root_used_bytes", "root_free_bytes",
  "root_usage_percent", "inode_usage_percent", "mysql_health",
  "production_lock_status", "alert_level", "deployment_allowed"
)
foreach ($key in $required) {
  if (-not $values.Contains($key)) { throw "Capacity field missing: $key" }
}

$snapshot = [ordered]@{
  source_run_id = [long]$run.id
  source_commit = [string]$run.head_sha
  synced_at = (Get-Date).ToString("o")
  timestamp = $values.timestamp
  root_total_bytes = [long]$values.root_total_bytes
  root_used_bytes = [long]$values.root_used_bytes
  root_free_bytes = [long]$values.root_free_bytes
  root_usage_percent = [int]$values.root_usage_percent
  inode_usage_percent = [int]$values.inode_usage_percent
  docker_directory_bytes = [long]$values.docker_directory_bytes
  mysql_data_bytes = [long]$values.mysql_data_bytes
  mysql_health = $values.mysql_health
  mysql_restart_count = $values.mysql_restart_count
  production_lock_status = $values.production_lock_status
  largest_path = $values.largest_path
  capacity_alert_level = $values.alert_level
  deployment_allowed = $values.deployment_allowed
  contains_credentials = $false
  contains_customer_pii = $false
  indexing_requests_made = 0
}
$json = $snapshot | ConvertTo-Json -Depth 4
$json | Set-Content -LiteralPath $latestPath -Encoding UTF8
Add-Content -LiteralPath $historyPath -Value ($json -replace "`r?`n", "")
Write-Output "CAPACITY_STATUS=$latestPath"
Write-Output "ALERT_LEVEL=$($snapshot.capacity_alert_level)"
Write-Output "DEPLOYMENT_ALLOWED=$($snapshot.deployment_allowed)"
