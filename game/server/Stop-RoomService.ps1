param([int]$Port=7464)
$ErrorActionPreference='Stop'
$pidFile=Join-Path $PSScriptRoot "data/room-$Port.pid"
if(!(Test-Path -LiteralPath $pidFile)){Write-Output 'No service PID file found.';exit 0}
$serviceProcessId=[int](Get-Content -LiteralPath $pidFile)
$serviceProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$serviceProcessId"
$entry=Join-Path $PSScriptRoot 'lobby-server.cjs'
if($serviceProcess -and (!$serviceProcess.CommandLine -or !$serviceProcess.CommandLine.Contains($entry))){throw 'PID belongs to a different program. Nothing was stopped.'}
if($serviceProcess){Stop-Process -Id $serviceProcessId}
Remove-Item -LiteralPath $pidFile
Write-Output 'Room service stopped.'
