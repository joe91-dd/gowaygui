"""Package only the separately built, verified Art UI V2 preview; never touch the gameplay baseline."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[2]
build = root / 'game/build/art-v2'
out = root / 'output/art-ui-v2'
baseline = root / 'output/gowaygui-gameplay-playtest.zip'
baseline_hash = '23db59c3c3e5cf5219f31dbaefe345cc14b418b6416f0270b3aa2a8d87e154a2'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(baseline) == baseline_hash, 'Gameplay baseline changed; refuse to package.'
report = json.loads((root / 'game/temp/build-logs/latest-build.json').read_text(encoding='utf-8-sig'))
assert report['status'] == 'passed' and report['exitCode'] == 36 and report['builtCorePassed']
verification = json.loads(Path(report['builtCoreReport']).read_text(encoding='utf-8'))
assert Path(verification['buildDir']).resolve() == build.resolve()
assert verification['status'] == 'passed'
digest = sha(build / 'assets/main/index.js')
assert digest == report['bundleSha256']
assert digest == next(x['sha256'] for x in verification['loadedFiles'] if x['relative'] == 'assets/main/index.js')
out.mkdir(parents=True, exist_ok=True)
(out / 'reports').mkdir(exist_ok=True)
shutil.copyfile(root / 'game/temp/build-logs/latest-build.json', out / 'reports/cocos-build.json')
shutil.copyfile(report['builtCoreReport'], out / 'reports/built-core.json')
shutil.copyfile(root / 'game/temp/art-v2-tests.log', out / 'reports/tests.txt')
shutil.copyfile(root / 'docs/art-v2/design-qa.md', out / 'reports/design-qa.md')
shutil.copyfile(root / 'docs/art-v2/PREVIEW_GUIDE.md', out / 'PREVIEW_GUIDE.md')

server = (root / 'game/tools/build-serve.mjs').read_text(encoding='utf-8')
server = server.replace("'../build/web-mobile'", "'./web'").replace('process.env.PORT || 7457', 'process.env.PORT || 7458')
server = server.replace('Build web-mobile first.', 'The Art UI V2 web folder is missing.')
launcher = r'''@echo off
cd /d "%~dp0"
set "GOWAYGUI_BUILD_ROOT="
set "PORT=7458"
set "GOWAYGUI_NODE=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%GOWAYGUI_NODE%" goto run
where node >nul 2>nul
if errorlevel 1 goto missing
set "GOWAYGUI_NODE=node"
:run
echo Open http://127.0.0.1:7458/ in your browser.
echo Keep this window open. Ctrl+C stops this preview only.
"%GOWAYGUI_NODE%" "%~dp0serve.mjs"
pause
exit /b
:missing
echo Node.js is required. It is already installed on the development computer.
pause
'''
readme = '''《哥喂龟》Art / UI V2 界面迁移预览

这是独立的界面迁移预览，尚非全部正式美术完成版。
解压后双击 Start-Art-V2.cmd，再访问 http://127.0.0.1:7458/。
请保持启动窗口打开；不要直接双击 web/index.html。
旧玩法基线仍使用 7457，本包不会修改旧包或旧构建目录。
若 7458 已被当前美术预览占用，可直接打开该地址。

新端口使用单独的浏览器存档，不会自动覆盖或迁移 7457 的进度。
包内没有玩家存档，不包含测试账号的购买或合成进度。
当前登录是本地进入，好友等联网内容仍按原版使用本地 AI。
完成范围、操作说明与尚未完成的 3D/战斗美术见 PREVIEW_GUIDE.md。
'''
files = sorted(p for p in build.rglob('*') if p.is_file())
manifest = {'version': 'Art UI V2 UI migration preview', 'completeArtMigration': False,
            'bundleSha256': digest, 'baselineTag': 'gameplay-baseline-20260910',
            'protectedBaselineSha256': baseline_hash,
            'files': [{'path': 'web/' + p.relative_to(build).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in files]}
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(out / 'README.txt').write_text(readme, encoding='utf-8')
archive = root / 'output/gowaygui-art-ui-v2-preview.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in files:
        z.write(p, 'web/' + p.relative_to(build).as_posix())
    for p in sorted(out.rglob('*')):
        if p.is_file(): z.write(p, p.relative_to(out).as_posix())
    z.writestr('serve.mjs', server)
    z.writestr('Start-Art-V2.cmd', launcher.replace('\n', '\r\n'))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for item in manifest['files']:
        assert hashlib.sha256(z.read(item['path'])).hexdigest() == item['sha256']
assert sha(baseline) == baseline_hash
result = {'archive': str(archive), 'bytes': archive.stat().st_size, 'sha256': sha(archive),
          'runtimeFiles': len(files), 'bundleSha256': digest, 'allPackagedRuntimeHashesVerified': True,
          'gameplayBaselineUnchanged': True}
(out / 'package-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
