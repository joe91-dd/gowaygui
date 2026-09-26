param([int]$Port=7627)
$ErrorActionPreference='Stop'
$project='F:/Codex/Projects/gowaygui/game'
$node='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$root=Join-Path $project 'build/map-themes-20260920'
$logs=Join-Path $project 'temp/map-theme-preview'
if(-not(Test-Path -LiteralPath (Join-Path $root 'index.html'))){throw 'Build map-themes first.'}
try {
 $health=Invoke-RestMethod ('http://127.0.0.1:'+$Port+'/api/health') -TimeoutSec 2
 if($health.data.service -eq 'gowaygui-rooms'){Write-Output ('http://127.0.0.1:'+$Port+'/themes.html');exit 0}
 throw 'The preview port is already in use.'
} catch { if($_.Exception.Message -eq 'The preview port is already in use.'){throw} }
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$env:PORT=[string]$Port;$env:HOST='127.0.0.1';$env:GAME_ROOT=$root
$env:GOWAYGUI_ROOM_CORE=Join-Path $project '.server-build-map-themes/core'
$env:ROOM_DATA=Join-Path $logs 'rooms.json'
$process=Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $project 'server/lobby-server.cjs')+'"') -WorkingDirectory $project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
@{pid=$process.Id;port=$Port;root=$root;started=$process.StartTime.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logs 'server.json')
for($i=0;$i -lt 20;$i++){
 try{$health=Invoke-RestMethod ('http://127.0.0.1:'+$Port+'/api/health') -TimeoutSec 2;if($health.data.service -eq 'gowaygui-rooms'){break}}catch{}
 Start-Sleep -Milliseconds 300
}
if($health.data.service -ne 'gowaygui-rooms'){throw 'Preview health check failed.'}
Write-Output ('http://127.0.0.1:'+$Port+'/themes.html')
