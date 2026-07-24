[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$user = "$env:USERDOMAIN\$env:USERNAME"
$taskName = "MyKinLegacy VPS Capacity Monitor"
$notifyTaskName = "MyKinLegacy VPS Capacity Notification"

$action = New-ScheduledTaskAction -Execute $powershell `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$PSScriptRoot\sync-mykinlegacy-vps-capacity.ps1`"" `
  -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Once -At ([datetime]::Today.AddMinutes(10)) `
  -RepetitionInterval (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$definition = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description "Downloads the latest sanitized, read-only MyKinLegacy VPS capacity artifact. No production writes or credentials."
Register-ScheduledTask -TaskName $taskName -InputObject $definition -Force | Out-Null

$notifyAction = New-ScheduledTaskAction -Execute $powershell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSScriptRoot\notify-mykinlegacy-vps-capacity.ps1`"" `
  -WorkingDirectory $repoRoot
$notifyTrigger = New-ScheduledTaskTrigger -Once -At ([datetime]::Today.AddMinutes(15)) `
  -RepetitionInterval (New-TimeSpan -Hours 1)
$notifyPrincipal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$notifySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew
$notifyDefinition = New-ScheduledTask -Action $notifyAction -Trigger $notifyTrigger -Principal $notifyPrincipal `
  -Settings $notifySettings -Description "Displays sanitized VPS capacity alerts at WARNING or higher."
Register-ScheduledTask -TaskName $notifyTaskName -InputObject $notifyDefinition -Force | Out-Null

Write-Output "CAPACITY_TASK=$taskName"
Write-Output "NOTIFICATION_TASK=$notifyTaskName"
