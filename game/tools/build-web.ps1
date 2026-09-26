param(
    [string]$CreatorPath = '',
    [string]$ConfigName = 'build-config.web-mobile.json',
    [string]$UserDataName = 'creator-user-data',
    [switch]$HardwareGraphics,
    [switch]$SoftwareRendering,
    [int]$TimeoutSeconds = 900,
    [string]$NodePath = ''
)
$ErrorActionPreference = 'Stop'
$projectPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
. (Join-Path $PSScriptRoot 'resolve-dev-tools.ps1')
$NodePath = Resolve-GameNode $NodePath
$CreatorPath = Resolve-GameCreator $projectPath $CreatorPath
$configPath = Join-Path $projectPath $ConfigName
$buildConfig = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($buildConfig.outputName -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid build output directory' }
$outputPath = Join-Path (Join-Path $projectPath 'build') $buildConfig.outputName
$logsPath = Join-Path $projectPath 'temp/build-logs'
New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
if (-not (Test-Path -LiteralPath $CreatorPath)) { throw "Cocos Creator missing: $CreatorPath" }
if (-not (Test-Path -LiteralPath $configPath)) { throw "Build configuration missing: $configPath" }
if (-not (Test-Path -LiteralPath $NodePath)) { throw "Node runtime missing: $NodePath" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutPath = Join-Path $logsPath "$stamp.stdout.log"
$stderrPath = Join-Path $logsPath "$stamp.stderr.log"
$creatorLog = Join-Path $logsPath "$stamp.creator.log"
if ($UserDataName -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid build profile directory' }
$userDataPath = Join-Path (Join-Path $projectPath 'temp') $UserDataName
New-Item -ItemType Directory -Path $userDataPath -Force | Out-Null
# Run the editor outside a restricted child-process environment: its engine
# compiler writes its own installation cache. Force Chromium's SwiftShader path
# so the GPU helper does not depend on the host graphics driver.
$graphicsFlag = if ($HardwareGraphics) { '' } elseif ($SoftwareRendering -or -not $HardwareGraphics) { ' --disable-gpu --disable-crash-reporter --disable-gpu-sandbox --no-sandbox' } else { '' }
$arguments = '--user-data-dir="' + $userDataPath + '"' + $graphicsFlag + ' --project "' + $projectPath + '" --build "configPath=' + $configPath + ';logDest=' + $creatorLog + '"'
Write-Output "Building $projectPath"
Write-Output "Log: $creatorLog"
$buildStartedUtc = [DateTime]::UtcNow
$process = Start-Process -FilePath $CreatorPath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
# Wait for the CLI itself. Start-Process -Wait also waits for abandoned Electron
# recovery windows, even when the builder has already returned success.
$buildProcessHandle = $process.Handle
$completed = $process.WaitForExit($TimeoutSeconds * 1000)
if (-not $completed) {
    try { Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.ParentProcessId -eq $process.Id -and $_.Name -eq 'CocosCreator.exe' -and $_.CommandLine -like ('*' + $userDataPath + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } } catch {}
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Cocos build timed out after $TimeoutSeconds seconds; the editor engine query did not complete."
}
$code = $process.ExitCode
if ($null -eq $code) {
    if (-not ('GowayguiBuildProcess' -as [type])) { Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class GowayguiBuildProcess { [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode); }' }
    [uint32]$nativeExitCode = 0
    if (-not [GowayguiBuildProcess]::GetExitCodeProcess($buildProcessHandle, [ref]$nativeExitCode)) { throw 'Cannot read Cocos builder exit code.' }
    $code = $nativeExitCode
}
# Only this invocation's children with this project's dedicated user-data path.
try {
    $buildChildren = Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.ParentProcessId -eq $process.Id -and $_.Name -eq 'CocosCreator.exe' -and $_.CommandLine -like ('*' + $userDataPath + '*') }
    foreach ($buildChild in $buildChildren) { Stop-Process -Id $buildChild.ProcessId -Force -ErrorAction SilentlyContinue }
} catch { Write-Warning 'The builder exited; an Electron helper may remain until Cocos closes it.' }
$indexPath = Join-Path $outputPath 'index.html'
$criticalErrors = @(Select-String -LiteralPath $stdoutPath,$stderrPath -Pattern 'Script .+ attached to .+ is missing or invalid|Missing class:|\[Build\].*Error|SyntaxError:|Cannot find module|Error EFX[0-9]+' | ForEach-Object { $_.Line })
$layoutWarningPattern = 'SyntaxError: [^\r\n]*\\\.CocosCreator\\editor\\(?:window|layout)\.json: Unexpected end of JSON input'
$editorWarnings = @($criticalErrors | Where-Object { $_ -match $layoutWarningPattern })
$criticalErrors = @($criticalErrors | Where-Object { $_ -notmatch $layoutWarningPattern })
$report = [ordered]@{ timestamp = (Get-Date).ToString('o'); buildStartedUtc = $buildStartedUtc.ToString('o'); status = 'failed'; creator = $CreatorPath; project = $projectPath; exitCode = $code; indexExists = (Test-Path -LiteralPath $indexPath); criticalErrors = $criticalErrors; log = $creatorLog; stdout = $stdoutPath; stderr = $stderrPath; builtCorePassed = $false }
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logsPath 'latest-build.json') -Encoding utf8
$report['editorWarnings'] = $editorWarnings
if ($code -ne 36) {
    Get-Content -LiteralPath $stdoutPath -Tail 60
    Get-Content -LiteralPath $stderrPath -Tail 40
    throw "Cocos build did not return success code 36. Actual: $code"
}
if (-not (Test-Path -LiteralPath $indexPath)) { throw "Cocos returned success without expected index.html" }
if ($criticalErrors.Count -gt 0) { $criticalErrors | Write-Output; throw 'Build returned 36 but reported missing scripts or compilation errors.' }
$bundlePath = Join-Path $outputPath 'assets/main/index.js'
if (-not (Test-Path -LiteralPath $bundlePath)) { throw 'Cocos returned success without the main script bundle.' }
$bundleWrittenUtc = (Get-Item -LiteralPath $bundlePath).LastWriteTimeUtc
if ($bundleWrittenUtc -lt $buildStartedUtc.AddSeconds(-2)) { throw 'The main bundle predates this build; refusing to validate an old build as new.' }
$regressionPath = Join-Path $PSScriptRoot 'test-built-core.cjs'
$regressionReport = Join-Path $logsPath "$stamp.built-core.json"
& $NodePath $regressionPath $outputPath --report $regressionReport
$regressionCode = $LASTEXITCODE
if ($regressionCode -eq 0 -and $buildConfig.outputName -eq 'doc4-polish') {
    & $NodePath (Join-Path $PSScriptRoot 'test-built-skills.cjs') $outputPath (Join-Path $logsPath ($stamp + '.built-skills.json'))
    if ($LASTEXITCODE -ne 0) { $regressionCode = $LASTEXITCODE }
}
$report['bundleWrittenUtc'] = $bundleWrittenUtc.ToString('o')
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try { $report['bundleSha256'] = ([BitConverter]::ToString($sha256.ComputeHash([IO.File]::ReadAllBytes($bundlePath)))).Replace('-','').ToLowerInvariant() }
finally { $sha256.Dispose() }
$report['builtCoreReport'] = $regressionReport
$report['builtCoreExitCode'] = $regressionCode
$report.builtCorePassed = $regressionCode -eq 0
if ($report.builtCorePassed) { $report.status = 'passed' }
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logsPath 'latest-build.json') -Encoding utf8
if ($regressionCode -ne 0) { throw "Cocos built-core regression failed. See $regressionReport" }
Write-Output "BUILD_SUCCESS: $indexPath"
exit 0

