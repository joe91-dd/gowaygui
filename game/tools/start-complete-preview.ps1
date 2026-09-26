param([int]$Port=7613)
$ErrorActionPreference='Stop'
$game=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$root=Join-Path $game 'build\integrated-20260917'
$node='D:\Program Files\nodejs\node.exe'
$data='F:\Codex\GameData\gowaygui'
$logs='F:\Codex\Projects\gowaygui\output\complete-test-20260917'
$env:TEMP='F:\Codex\Temp';$env:TMP=$env:TEMP
$existing=Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if($existing){
  try {
    $health=Invoke-RestMethod ('http://127.0.0.1:'+$Port+'/api/health') -TimeoutSec 4
    $served=Invoke-WebRequest -UseBasicParsing ('http://127.0.0.1:'+$Port+'/assets/main/index.js') -TimeoutSec 20
    $bytes=[Text.Encoding]::UTF8.GetBytes($served.Content)
    $hasher=[Security.Cryptography.SHA256]::Create()
    try {$hash=([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()} finally {$hasher.Dispose()}
    $expected=(Get-FileHash -LiteralPath (Join-Path $root 'assets\main\index.js')).Hash.ToLowerInvariant()
    if($health.data.service -eq 'gowaygui-rooms' -and $hash -eq $expected){Write-Output ('http://127.0.0.1:'+$Port+'/?preview=all-maps&v=complete-20260917');return}
  } catch {}
  throw "端口 $Port 已被其他版本占用。请先关闭旧游戏预览服务，勿关闭 Codex。"
}
foreach($p in @($node,(Join-Path $root 'index.html'),(Join-Path $game '.server-build\core\game.js'))){if(-not(Test-Path -LiteralPath $p)){throw "缺少文件：$p"}}
New-Item -ItemType Directory -Path $data,$logs,$env:TEMP -Force | Out-Null
$env:PORT=[string]$Port;$env:HOST='127.0.0.1'
$env:GAME_ROOT=$root;$env:ROOM_DATA=Join-Path $data 'rooms.json';$env:GOWAYGUI_ROOM_CORE=Join-Path $game '.server-build\core'
$script=Join-Path $game 'server\lobby-server.cjs'
$p=Start-Process -FilePath $node -ArgumentList ('"'+$script+'"') -WorkingDirectory $game -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'server.stdout.log') -RedirectStandardError (Join-Path $logs 'server.stderr.log')
@{pid=$p.Id;port=$Port;root=$root;roomData=$env:ROOM_DATA;started=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logs 'server.json') -Encoding utf8
Write-Output ('http://127.0.0.1:'+$Port+'/?preview=all-maps&v=complete-20260917')
