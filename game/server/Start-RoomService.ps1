param([int]$Port=7464,[switch]$Lan)
$ErrorActionPreference='Stop'
$gameDirectory=Split-Path $PSScriptRoot -Parent
$nodeExecutable='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$compiler='C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js'
$entry=Join-Path $PSScriptRoot 'lobby-server.cjs'
$runtime=Join-Path $PSScriptRoot 'data'
if($Port -lt 1024 -or $Port -gt 65535){throw 'Port must be between 1024 and 65535.'}
if(!(Test-Path -LiteralPath (Join-Path $gameDirectory 'build/living-expedition/index.html'))){throw 'Build the living-expedition game first.'}
$listeners=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if($listeners){
  $owned=$listeners | ForEach-Object {Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"} | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($entry)}
  if($owned){Write-Output "Room service is already running: http://127.0.0.1:$Port/";exit 0}
  throw "Port $Port is already used by another process. Choose a different port."
}
& $nodeExecutable $compiler -p (Join-Path $gameDirectory 'tsconfig.server.json')
if($LASTEXITCODE -ne 0){throw 'Room server compilation failed.'}
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$env:PORT=[string]$Port
$env:HOST=if($Lan){'0.0.0.0'}else{'127.0.0.1'}
$env:ROOM_DATA=Join-Path $runtime 'rooms.json'
$env:GAME_ROOT=Join-Path $gameDirectory 'build/living-expedition'
$child=Start-Process -FilePath $nodeExecutable -ArgumentList @('"'+$entry+'"') -WorkingDirectory $gameDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime "room-$Port.log") -RedirectStandardError (Join-Path $runtime "room-$Port.error.log")
$child.Id | Set-Content -LiteralPath (Join-Path $runtime "room-$Port.pid")
Write-Output "Room service started (PID $($child.Id)): http://127.0.0.1:$Port/"
if($Lan){Write-Output 'LAN clients use this computer IPv4 address with the same port. The server keeps room state in game/server/data/rooms.json.'}
