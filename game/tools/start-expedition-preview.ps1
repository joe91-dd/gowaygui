param([int]$Port=7656,[string]$BuildName='expedition-rations-20260924',[string]$CoreName='.server-build-rations')
$ErrorActionPreference='Stop'
$game=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if($BuildName -notmatch '^[a-zA-Z0-9_-]+$'){throw 'Invalid build directory'}
$root=Join-Path $game ('build/'+$BuildName)
$logs=Join-Path $game ('temp/expedition-preview-'+$Port)
$url="http://127.0.0.1:$Port/?preview=all-maps&all-modes=1&cache=20260924rations"
if($Port -lt 1024 -or $Port -gt 65535){throw 'Invalid port'}
if(!(Test-Path -LiteralPath (Join-Path $root 'index.html'))){throw 'Build the game first.'}
$existing=$null
try{$existing=Invoke-WebRequest "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 3}catch{if($_.Exception.Response){throw 'This port serves a different application. Choose a free port.'}}
if($existing){$health=$existing.Content | ConvertFrom-Json;if($health.data.service -ne 'gowaygui-rooms'){throw 'Room service is missing.'};Write-Output $url;exit 0}
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$env:PORT=[string]$Port;$env:HOST='127.0.0.1';$env:GAME_ROOT=$root
if($CoreName -notmatch '^\.[a-zA-Z0-9_-]+$'){throw 'Invalid core directory'}
$env:GOWAYGUI_ROOM_CORE=Join-Path $game ($CoreName+'/core')
$env:ROOM_DATA=Join-Path $logs 'rooms.json'
$backup=Join-Path $logs 'previous-room-state'
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Get-ChildItem -LiteralPath (Split-Path $env:ROOM_DATA) -Filter 'rooms.json*' -File | ForEach-Object { if(!(Test-Path -LiteralPath (Join-Path $backup $_.Name))){Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $backup $_.Name)} }
$entry=Join-Path $game 'server/lobby-server.cjs'
$p=Start-Process -FilePath $node -ArgumentList ('"'+$entry+'"') -WorkingDirectory $game -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
@{pid=$p.Id;port=$Port;root=$root;started=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logs 'server.json')
$health=$null
for($i=0;$i -lt 20;$i++){try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2;if($health.data.service -eq 'gowaygui-rooms'){break}}catch{};Start-Sleep -Milliseconds 300}
if($health.data.service -ne 'gowaygui-rooms'){throw 'Room service failed to start; inspect temp/expedition-preview-20260924/stderr.log.'}
Write-Output $url


