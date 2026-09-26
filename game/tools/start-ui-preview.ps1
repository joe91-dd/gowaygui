param([int]$Port=7492)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$gameRoot=Join-Path $projectRoot 'game/build/ui-complete-20260917'
$nodePath='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if(!(Test-Path -LiteralPath (Join-Path $gameRoot 'index.html'))){throw 'The UI preview build is missing.'}
try {
  $health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
  if($health.data.service -eq 'gowaygui-rooms'){
    Write-Output "http://127.0.0.1:$Port/?preview=all-maps&v=ui-complete-final"
    return
  }
} catch {}
$logs=Join-Path $projectRoot 'output/ui-complete-20260917'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$env:PORT=[string]$Port
$env:HOST='127.0.0.1'
$env:GAME_ROOT=$gameRoot
$env:ROOM_DATA=Join-Path $logs 'preview-rooms.json'
$serverScript=Join-Path $projectRoot 'game/server/lobby-server.cjs'
$process=Start-Process -FilePath $nodePath -ArgumentList @('"'+$serverScript+'"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'server.stdout.log') -RedirectStandardError (Join-Path $logs 'server.stderr.log')
Write-Output "Preview service PID: $($process.Id)"
Write-Output "http://127.0.0.1:$Port/?preview=all-maps&v=ui-complete-final"
