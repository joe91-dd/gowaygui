$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$nodeRuntime = 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (!(Test-Path -LiteralPath $nodeRuntime)) { $nodeRuntime = (Get-Command node -ErrorAction Stop).Source }
function Test-ReviewPort([int]$port, [string]$expected) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if (!$listener) { return $false }
    $page = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 5
    if ($page.Content -notmatch $expected) { throw "端口 $port 已被其他服务占用，未停止该服务。" }
    return $true
}
if (!(Test-ReviewPort 7482 'G1 五龟验收')) {
    $reviewScript = Join-Path $PSScriptRoot 'serve.mjs'
    Start-Process -FilePath $nodeRuntime -ArgumentList ('"' + $reviewScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'review-server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'review-server.err')
}
if (!(Test-ReviewPort 7483 'G1 实战验收')) {
    $savedPort = $env:PORT
    $savedBuild = $env:GOWAYGUI_BUILD_ROOT
    try {
        $env:PORT = '7483'
        $env:GOWAYGUI_BUILD_ROOT = Join-Path $projectRoot 'game/build/g1-cast-20260916'
        $gameScript = Join-Path $projectRoot 'game/tools/build-serve.mjs'
        Start-Process -FilePath $nodeRuntime -ArgumentList ('"' + $gameScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'game-server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'game-server.err')
    } finally { $env:PORT = $savedPort; $env:GOWAYGUI_BUILD_ROOT = $savedBuild }
}
Write-Output '角色与素材：http://127.0.0.1:7482/'
Write-Output '实际战斗：http://127.0.0.1:7483/?showcase=g1'
