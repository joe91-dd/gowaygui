param([string]$NodePath='')
$ErrorActionPreference='Stop'
$gameRoot=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'resolve-dev-tools.ps1')
$NodePath=Resolve-GameNode $NodePath
$compilerPath=Join-Path $gameRoot 'node_modules/typescript/lib/tsc.js'
if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'Run npm ci in game first.' }
Push-Location $gameRoot
try {
  & $NodePath $compilerPath --target ES2020 --module commonjs --strict --skipLibCheck --rootDir assets/scripts --outDir .test-build assets/scripts/core/game.ts assets/scripts/core/battle.ts assets/scripts/core/marketView.ts assets/scripts/core/worldBoss.ts assets/scripts/core/visualTrial.ts
  if($LASTEXITCODE -ne 0){throw 'Core TypeScript compilation failed'}
  $testFiles=@(Get-ChildItem -LiteralPath tests -Filter '*.test.cjs' | ForEach-Object {$_.FullName})
  & $NodePath --test --test-concurrency=4 @testFiles
  if($LASTEXITCODE -ne 0){throw 'Domain or integration tests failed'}
  & $NodePath $compilerPath --noEmit -p tsconfig.json
  if($LASTEXITCODE -ne 0){throw 'Cocos TypeScript check failed'}
} finally {Pop-Location}
