$ErrorActionPreference='Stop'
$gameRoot='F:\Codex\Projects\gowaygui\game'
$tools=Join-Path $gameRoot 'temp/android-tools'
$env:JAVA_HOME=Join-Path $tools 'java/jdk-17.0.20.1+1'
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
$env:TEMP='F:\Codex\Temp';$env:TMP=$env:TEMP
$sdkTools=Join-Path $tools 'sdk/build-tools/36.0.0'
$apk=Join-Path $gameRoot 'build/android-test-20260928/proj/build/gowaygui/outputs/apk/release/gowaygui-release.apk'
$out=Join-Path $gameRoot '../output/android-apk-20260928'
if(!(Test-Path -LiteralPath $apk)){throw 'Release test APK has not been generated'}
& (Join-Path $sdkTools 'apksigner.bat') verify --verbose --print-certs $apk 2>&1 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $out 'signature.log')
if($LASTEXITCODE -ne 0){throw 'APK signature verification failed'}
& (Join-Path $sdkTools 'aapt.exe') dump badging $apk | Set-Content -Encoding utf8 -LiteralPath (Join-Path $out 'apk-manifest.log')
if($LASTEXITCODE -ne 0){throw 'APK manifest cannot be read'}
$manifest=Get-Content -LiteralPath (Join-Path $out 'apk-manifest.log') -Raw
if($manifest -notmatch "package: name='com.gowaygui.androidtest'" -or $manifest -notmatch "native-code: 'arm64-v8a'"){throw 'Unexpected package or ABI'}
& (Join-Path $sdkTools 'aapt.exe') dump xmltree $apk AndroidManifest.xml | Set-Content -Encoding utf8 -LiteralPath (Join-Path $out 'android-manifest-tree.log')
if($LASTEXITCODE -ne 0){throw 'APK manifest tree cannot be read'}
$tree=Get-Content -LiteralPath (Join-Path $out 'android-manifest-tree.log') -Raw
if($tree -notmatch 'screenOrientation.*0x6'){throw 'Main activity is not sensorLandscape'}
& (Join-Path $sdkTools 'zipalign.exe') -c -P 16 -v 4 $apk | Set-Content -Encoding utf8 -LiteralPath (Join-Path $out 'alignment.log')
if($LASTEXITCODE -ne 0){throw 'APK ZIP alignment verification failed'}
$destination=Join-Path $out 'gowaygui-android-test-20260928-arm64.apk'
Copy-Item -LiteralPath $apk -Destination $destination -Force
$python='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$report=Join-Path $out 'apk-verification.json'
& $python (Join-Path $gameRoot 'tools/verify-android-apk.py') $destination --report $report
if($LASTEXITCODE -ne 0){throw 'APK resource integrity check failed'}
$verified=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
if((Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $verified.sha256){throw 'Delivery copy differs from signed APK'}
($verified.sha256+'  '+[IO.Path]::GetFileName($destination)) | Set-Content -Encoding ascii -LiteralPath ($destination+'.sha256')
Write-Output "Verified APK: $destination"
