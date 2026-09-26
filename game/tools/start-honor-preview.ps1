param([int]$Port=7493)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$gameRoot=Join-Path $projectRoot 'game/build/honor-final-20260917'
$nodePath='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if(!(Test-Path -LiteralPath (Join-Path $gameRoot 'index.html'))){throw 'Honor build missing'}
$logs=Join-Path $projectRoot 'output/honor-release-20260917'
$env:PORT=[string]$Port
$env:HOST='127.0.0.1'
$env:GAME_ROOT=$gameRoot
$env:ROOM_DATA=Join-Path $logs 'preview-rooms.json'
$process=Start-Process -FilePath $nodePath -ArgumentList 'game/server/lobby-server.cjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'server.stdout.log') -RedirectStandardError (Join-Path $logs 'server.stderr.log')
Write-Output "Honor preview PID: $($process.Id)"
Write-Output "http://127.0.0.1:$Port/?preview=all-maps&v=honor-release"
