$ErrorActionPreference='Stop'
$gameRoot='C:\Users\Administrator\Documents\ChatGPT\gowaygui'
$entry=Join-Path $gameRoot 'game\server\lobby-server.cjs'
$nodeExecutable='C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$targets=@(
 @{Port=7473;Pid=7692;Data='output\release-polish-20260915\qa-rooms.json';Log='output\release-polish-20260915\qa-server';PidFile='output\release-polish-20260915\qa-server.pid'}
)
foreach($target in $targets){
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($target.Pid)"
 if(!$process -or !$process.CommandLine.Contains($entry)){throw "Process identity changed for $($target.Port)"}
 if($target.Port -eq 7473 -and !(Test-Path -LiteralPath (Join-Path $gameRoot $target.Data))){throw 'Existing save data missing; refusing restart'}
 [System.Diagnostics.Process]::GetProcessById($target.Pid).Kill()
 $env:PORT=[string]$target.Port
 $env:HOST='127.0.0.1'
 $env:ROOM_DATA=Join-Path $gameRoot $target.Data
 $env:GAME_ROOT=Join-Path $gameRoot 'game\build\living-expedition'
 $child=Start-Process -FilePath $nodeExecutable -ArgumentList @('"'+$entry+'"') -WorkingDirectory $gameRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput ((Join-Path $gameRoot $target.Log)+'.log') -RedirectStandardError ((Join-Path $gameRoot $target.Log)+'.error.log')
 $child.Id | Set-Content -LiteralPath (Join-Path $gameRoot $target.PidFile)
 Write-Output "Updated port $($target.Port), PID $($child.Id), existing data retained"
}
