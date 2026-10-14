param([ValidateSet('Release','Debug')][string]$Variant='Release')
$ErrorActionPreference='Stop'
$gameRoot='F:\Codex\Projects\gowaygui\game'
$apkTools=Join-Path $gameRoot 'temp/android-tools'
$env:JAVA_HOME=Join-Path $apkTools 'java/jdk-17.0.20.1+1'
$env:ANDROID_SDK_ROOT=Join-Path $apkTools 'sdk'
$env:ANDROID_HOME=$env:ANDROID_SDK_ROOT
$env:ANDROID_USER_HOME=Join-Path $apkTools 'android-user'
Remove-Item Env:ANDROID_SDK_HOME -ErrorAction SilentlyContinue
$env:GRADLE_USER_HOME=Join-Path $apkTools 'gradle-cache'
$env:TEMP='F:\Codex\Temp'
$env:TMP=$env:TEMP
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
$project=Join-Path $gameRoot 'build/android-test-20260928/proj'
$gradle=Join-Path $apkTools 'gradle/gradle-8.11.1/bin/gradle.bat'
if(!(Test-Path -LiteralPath $gradle)){throw 'Verified Gradle 8.11.1 is not installed'}
# Keep the exported project name ASCII for CMake, with a readable Android label.
'<resources><string name="app_name" translatable="false">哥喂龟·测试版</string></resources>' | Set-Content -Encoding utf8 -LiteralPath (Join-Path $project 'res/values/strings.xml')
$log=Join-Path $gameRoot 'temp/android-build-20260928/gradle.log'
& $gradle -p $project (':gowaygui:assemble'+$Variant) --no-daemon --max-workers=4 --console=plain --stacktrace 2>&1 | Tee-Object -FilePath $log
if($LASTEXITCODE -ne 0){throw "Android compilation failed; see $log"}
Write-Output "APK output: $project/build/gowaygui/outputs/apk/$($Variant.ToLower())"
