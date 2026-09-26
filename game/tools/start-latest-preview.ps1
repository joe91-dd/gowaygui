param([int]$Port=7617,[string]$BuildName='hud-reference-r2-20260920',[switch]$OpenBrowser)
$ErrorActionPreference='Stop'
$game=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if($BuildName -notmatch '^[a-zA-Z0-9_-]+$'){throw 'Invalid build name.'}
$root=Join-Path $game ('build\'+$BuildName)
$core=Join-Path $game '.server-build-recovery\core'
$node='D:\Program Files\nodejs\node.exe'
$data='F:\Codex\GameData\gowaygui'
$logs=Join-Path (Join-Path $game '..\output\latest-preview') ([string]$Port)
$url='http://127.0.0.1:'+$Port+'/?preview=all-maps&v='+$BuildName
$env:TEMP='F:\Codex\Temp';$env:TMP=$env:TEMP
foreach($file in @($node,(Join-Path $root 'index.html'),(Join-Path $root 'assets\main\index.js'),(Join-Path $core 'game.js'))){if(-not(Test-Path -LiteralPath $file)){throw "Missing: $file"}}
$health=$null
try{$health=Invoke-RestMethod ('http://127.0.0.1:'+$Port+'/api/health') -TimeoutSec 2}catch{}
if($health){
 if($health.data.service -ne 'gowaygui-rooms'){throw 'Port is used by another service.'}
 $client=New-Object Net.WebClient
 try{$servedBytes=$client.DownloadData('http://127.0.0.1:'+$Port+'/assets/main/index.js')}finally{$client.Dispose()}
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$actual=([BitConverter]::ToString($sha.ComputeHash($servedBytes))).Replace('-','')}finally{$sha.Dispose()}
 if($actual -ne (Get-FileHash -LiteralPath (Join-Path $root 'assets\main\index.js')).Hash){throw 'Port serves a different build. Stop the identified game server before switching.'}
 if($OpenBrowser){Start-Process $url -WindowStyle Hidden}
 Write-Output $url
 exit 0
}
New-Item -ItemType Directory -Force -Path $logs,$data,$env:TEMP | Out-Null
$env:PORT=[string]$Port;$env:HOST='127.0.0.1';$env:GAME_ROOT=$root
$env:ROOM_DATA=Join-Path $data 'rooms.json';$env:GOWAYGUI_ROOM_CORE=$core
$serverScript=Join-Path $game 'server\lobby-server.cjs'
$p=Start-Process -FilePath $node -ArgumentList ('"'+$serverScript+'"') -WorkingDirectory $game -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'server.stdout.log') -RedirectStandardError (Join-Path $logs 'server.stderr.log')
@{pid=$p.Id;port=$Port;root=$root;core=$core;started=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logs 'server.json') -Encoding utf8
for($i=0;$i -lt 30;$i++){
 try{$health=Invoke-RestMethod ('http://127.0.0.1:'+$Port+'/api/health') -TimeoutSec 2;break}catch{Start-Sleep -Milliseconds 500}
}
if($null -eq $health -or $health.data.service -ne 'gowaygui-rooms'){throw 'Preview health check failed.'}
if($OpenBrowser){Start-Process $url -WindowStyle Hidden}
Write-Output $url
