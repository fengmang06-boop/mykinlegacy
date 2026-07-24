[CmdletBinding()]
param([switch] $ForceTest)

$ErrorActionPreference = "Stop"
$secureRoot = Join-Path $env:LOCALAPPDATA "MyKinLegacy\monitoring\vps-capacity"
$latestPath = Join-Path $secureRoot "latest.json"
$receiptPath = Join-Path $secureRoot "notification-latest.json"
if (-not $ForceTest -and -not (Test-Path -LiteralPath $latestPath)) { exit 0 }
$status = if (Test-Path -LiteralPath $latestPath) {
  Get-Content -Raw -LiteralPath $latestPath | ConvertFrom-Json
} else {
  [pscustomobject]@{
    source_run_id = "TEST"
    root_usage_percent = 93
    root_free_bytes = 7GB
    mysql_health = "unhealthy"
    largest_path = "/var/lib/docker"
    capacity_alert_level = "CRITICAL"
  }
}
if (-not $ForceTest -and $status.capacity_alert_level -eq "INFO") { exit 0 }

$freeGb = [math]::Round(([double]$status.root_free_bytes / 1GB), 1)
$title = "MyKinLegacy VPS容量 $($status.capacity_alert_level)"
$body = "磁盘 $($status.root_usage_percent)% | 可用 ${freeGb}GB | 最大占用 $($status.largest_path) | MySQL $($status.mysql_health)"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>$([System.Security.SecurityElement]::Escape($title))</text>
      <text>$([System.Security.SecurityElement]::Escape($body))</text>
    </binding>
  </visual>
</toast>
"@
$document = New-Object Windows.Data.Xml.Dom.XmlDocument
$document.LoadXml($xml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($document)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("MyKinLegacy Monitoring")
$notifier.Show($toast)

[ordered]@{
  dispatched_at = (Get-Date).ToString("o")
  source_run_id = $status.source_run_id
  alert_level = $status.capacity_alert_level
  title = $title
  content = $body
  contains_credentials = $false
  contains_customer_pii = $false
} | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding UTF8
