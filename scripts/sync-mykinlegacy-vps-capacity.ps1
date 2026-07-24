[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$secureRoot = Join-Path $env:LOCALAPPDATA "MyKinLegacy\monitoring\vps-capacity"
$latestPath = Join-Path $secureRoot "latest.json"
$historyPath = Join-Path $secureRoot "history.jsonl"
$sshKey = Join-Path $env:LOCALAPPDATA "MyKinLegacy\Monitoring\production-ops-ssh"
$sshHost = "root@216.128.154.152"
New-Item -ItemType Directory -Path $secureRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath $sshKey)) {
  throw "Protected production operations SSH key is unavailable."
}

$remoteOutput = & ssh.exe `
  -i $sshKey `
  -o BatchMode=yes `
  -o StrictHostKeyChecking=accept-new `
  -o ConnectTimeout=15 `
  $sshHost `
  "cd /root/mykinlegacy && bash deployment/vps-capacity-monitor.sh" 2>&1
$sshExit = $LASTEXITCODE
if ($sshExit -notin @(0, 92)) {
  throw "Read-only VPS capacity collection failed with exit code $sshExit."
}

$values = [ordered]@{}
$remoteOutput | ForEach-Object {
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
  source = "read-only-ssh"
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
