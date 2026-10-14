param([switch]$Compile)
$ErrorActionPreference='Stop'
$gameRoot='F:\Codex\Projects\gowaygui\game'
if(!(Test-Path -LiteralPath (Join-Path $gameRoot 'assets/scenes/Main.scene'))){throw 'Canonical project missing on F:'}
$apkTools=Join-Path $gameRoot 'temp/android-tools'
$env:JAVA_HOME=Join-Path $apkTools 'java/jdk-17.0.20.1+1'
$env:ANDROID_SDK_ROOT=Join-Path $apkTools 'sdk'
$env:ANDROID_HOME=$env:ANDROID_SDK_ROOT
$env:NDK_ROOT=Join-Path $env:ANDROID_SDK_ROOT 'ndk/27.2.12479018'
$env:ANDROID_USER_HOME=Join-Path $apkTools 'android-user'
$env:GRADLE_USER_HOME=Join-Path $apkTools 'gradle-cache'
$env:TEMP='F:\Codex\Temp';$env:TMP=$env:TEMP
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
$apkLogs=Join-Path $gameRoot 'temp/android-build-20260928'
New-Item -ItemType Directory -Force -Path $apkLogs | Out-Null
$creator=Join-Path $gameRoot 'temp/cocos-editor-3.8.8/CocosCreator.exe'
$config=Join-Path $gameRoot 'build-config.android-test.json'
$apkUserData=Join-Path $apkLogs 'editor-profile'
$options='configPath='+$config+';logDest='+(Join-Path $apkLogs 'creator.log')
if($Compile){$options+=';stage=make'}
$argv='--user-data-dir="'+$apkUserData+'" --disable-gpu --disable-crash-reporter --disable-gpu-sandbox --no-sandbox --project "'+$gameRoot+'" --build "'+$options+'"'
$process=Start-Process -FilePath $creator -ArgumentList $argv -WorkingDirectory $gameRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $apkLogs 'stdout.log') -RedirectStandardError (Join-Path $apkLogs 'stderr.log')
@{pid=$process.Id;start=(Get-Date).ToString('o');project=$gameRoot;compile=[bool]$Compile} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $apkLogs 'process.json')
Write-Output "Android build launched: $($process.Id); logs: $apkLogs"
