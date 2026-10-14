param(
  [string]$OutputDirectory='F:\Codex\Projects\gowaygui\output\android-apk-compact-20260928',
  [string]$ApkName='gowaygui-android-test-20260928-compact-arm64.apk'
)
$ErrorActionPreference='Stop'
$gameRoot='F:\Codex\Projects\gowaygui\game'
$apkTools=Join-Path $gameRoot 'temp/android-tools'
$env:JAVA_HOME=Join-Path $apkTools 'java/jdk-17.0.20.1+1'
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
$env:TEMP='F:\Codex\Temp';$env:TMP=$env:TEMP
$sdkTools=Join-Path $apkTools 'sdk/build-tools/36.0.0'
$unsigned=Join-Path $OutputDirectory 'gowaygui-compact-unsigned.apk'
$aligned=Join-Path $OutputDirectory 'gowaygui-compact-aligned.apk'
$destination=Join-Path $OutputDirectory $ApkName
$keystore=Join-Path $gameRoot 'temp/cocos-editor-3.8.8/resources/tools/keystore/debug.keystore'
if(!(Test-Path -LiteralPath $unsigned)){throw 'Compact unsigned APK is missing'}
& (Join-Path $sdkTools 'zipalign.exe') -f -P 16 4 $unsigned $aligned
if($LASTEXITCODE -ne 0){throw 'ZIP alignment failed'}
# The public Cocos test certificate is the same as the previous test package.
& (Join-Path $sdkTools 'apksigner.bat') sign --ks $keystore --ks-key-alias debug_keystore --ks-pass pass:123456 --key-pass pass:123456 --out $destination $aligned
if($LASTEXITCODE -ne 0){throw 'APK signing failed'}
& (Join-Path $sdkTools 'apksigner.bat') verify --verbose --print-certs $destination 2>&1 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $OutputDirectory 'signature.log')
if($LASTEXITCODE -ne 0){throw 'Signature verification failed'}
& (Join-Path $sdkTools 'aapt.exe') dump badging $destination | Set-Content -Encoding utf8 -LiteralPath (Join-Path $OutputDirectory 'apk-manifest.log')
if($LASTEXITCODE -ne 0){throw 'Manifest verification failed'}
$manifest=Get-Content -LiteralPath (Join-Path $OutputDirectory 'apk-manifest.log') -Raw
if($manifest -notmatch "package: name='com.gowaygui.androidtest'" -or $manifest -notmatch "native-code: 'arm64-v8a'"){throw 'Package or ABI changed'}
& (Join-Path $sdkTools 'zipalign.exe') -c -P 16 -v 4 $destination | Set-Content -Encoding utf8 -LiteralPath (Join-Path $OutputDirectory 'alignment.log')
if($LASTEXITCODE -ne 0){throw 'Signed APK alignment failed'}
$python='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $python (Join-Path $gameRoot 'tools/verify-android-apk.py') $destination --report (Join-Path $OutputDirectory 'apk-verification.json')
if($LASTEXITCODE -ne 0){throw 'APK integrity verification failed'}
$verification=Get-Content -LiteralPath (Join-Path $OutputDirectory 'apk-verification.json') -Raw | ConvertFrom-Json
($verification.sha256+'  '+[IO.Path]::GetFileName($destination)) | Set-Content -Encoding ascii -LiteralPath ($destination+'.sha256')
Write-Output "Verified compact APK: $destination"
