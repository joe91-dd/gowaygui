param([int]$Port=7654)
$ErrorActionPreference='Stop'
$game=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$root=Join-Path $game 'build/turtle-swap-20260923'
$logs=Join-Path $game 'temp/turtle-swap-preview-20260923'
$url="http://127.0.0.1:$Port/?preview=all-maps&all-modes=1&cache=20260924turtle-swap"
if($Port -lt 1024 -or $Port -gt 65535){throw 'Invalid port'}
if(!(Test-Path -LiteralPath (Join-Path $root 'index.html'))){throw 'Build the game first.'}
$existing=$null
try{$existing=Invoke-WebRequest "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 3}catch{if($_.Exception.Response){throw 'This port serves a different application. Choose a free port.'}}
if($existing){$health=$existing.Content | ConvertFrom-Json;if($health.data.service -ne 'gowaygui-rooms'){throw 'Room service is missing.'};Write-Output $url;exit 0}
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$env:PORT=[string]$Port;$env:HOST='127.0.0.1';$env:GAME_ROOT=$root
$env:GOWAYGUI_ROOM_CORE=Join-Path $game '.server-build-turtle-swap/core'
$env:ROOM_DATA=Join-Path $game 'temp/turtle-swap-preview-20260923/rooms.json'
$backup=Join-Path $logs 'previous-room-state'
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Get-ChildItem -LiteralPath (Split-Path $env:ROOM_DATA) -Filter 'rooms.json*' -File | ForEach-Object { if(!(Test-Path -LiteralPath (Join-Path $backup $_.Name))){Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $backup $_.Name)} }
$entry=Join-Path $game 'server/lobby-server.cjs'
$p=Start-Process -FilePath $node -ArgumentList ('"'+$entry+'"') -WorkingDirectory $game -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
@{pid=$p.Id;port=$Port;root=$root;started=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logs 'server.json')
$health=$null
for($i=0;$i -lt 20;$i++){try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2;if($health.data.service -eq 'gowaygui-rooms'){break}}catch{};Start-Sleep -Milliseconds 300}
if($health.data.service -ne 'gowaygui-rooms'){throw 'Room service failed to start; inspect temp/turtle-swap-preview-20260923/stderr.log.'}
Write-Output $url


