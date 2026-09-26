# Resolve developer tools without tying a checkout to one Windows account/drive.
function Resolve-GameNode([string]$ExplicitPath = '') {
    if ($ExplicitPath) { return $ExplicitPath }
    if ($env:NODE_PATH_EXE) { return $env:NODE_PATH_EXE }
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw 'Install Node.js 22 or later, or pass -NodePath / set NODE_PATH_EXE.'
}
function Resolve-GameCreator([string]$GameRoot, [string]$ExplicitPath = '') {
    if ($ExplicitPath) { return $ExplicitPath }
    if ($env:COCOS_CREATOR) { return $env:COCOS_CREATOR }
    $localCopy = Join-Path $GameRoot 'temp/cocos-editor-3.8.8/CocosCreator.exe'
    if (Test-Path -LiteralPath $localCopy) { return $localCopy }
    $command = Get-Command CocosCreator.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw 'Set COCOS_CREATOR to your Cocos Creator 3.8.8 executable, or pass -CreatorPath.'
}
