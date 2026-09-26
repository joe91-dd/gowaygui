param([string]$NodePath='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
$ErrorActionPreference='Stop'
$gameRoot=Split-Path $PSScriptRoot -Parent
$compilerPath='C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js'
Push-Location $gameRoot
try {
  & $NodePath $compilerPath --target ES2020 --module commonjs --strict --skipLibCheck --rootDir assets/scripts --outDir .test-build assets/scripts/core/game.ts
  if($LASTEXITCODE -ne 0){throw '领域模块 TypeScript 编译失败'}
  & $NodePath --test tests/domain.test.cjs
  if($LASTEXITCODE -ne 0){throw '领域测试失败'}
} finally {Pop-Location}
