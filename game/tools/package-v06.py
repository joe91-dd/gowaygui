"""Package the verified web artifact; never reads or copies browser storage."""
import hashlib
import json
from pathlib import Path
import zipfile
import sys

root = Path(__file__).resolve().parents[2]
build = root / 'game/build/web-mobile'
report = json.loads((root / 'game/temp/build-logs/latest-build.json').read_text(encoding='utf-8-sig'))
tag = 'gameplay' if '--gameplay' in sys.argv else 'v07' if '--v07' in sys.argv else 'v061' if '--v061' in sys.argv else 'v06'
version = '玩法增量 2026-09-10' if tag == 'gameplay' else '0.7' if tag == 'v07' else '0.6.1' if tag == 'v061' else '0.6'
verification = json.loads((root / f'docs/reports/{tag}-built.json').read_text(encoding='utf-8'))
main = build / 'assets/main/index.js'
digest = hashlib.sha256(main.read_bytes()).hexdigest()
assert report['status'] == 'passed' and report['exitCode'] == 36 and report['builtCorePassed']
assert verification['status'] == 'passed' and digest == report['bundleSha256']
assert digest == next(x['sha256'] for x in verification['loadedFiles'] if x['relative'] == 'assets/main/index.js')
server = (root / 'game/tools/build-serve.mjs').read_text(encoding='utf-8').replace("'../build/web-mobile'", "'./web'")
launcher = r'''@echo off
cd /d "%~dp0"
set "GOWAYGUI_NODE=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%GOWAYGUI_NODE%" goto run
where node >nul 2>nul
if errorlevel 1 goto missing
set "GOWAYGUI_NODE=node"
:run
echo Open http://127.0.0.1:7457/ in your existing browser.
echo Keep this window open. Ctrl+C stops this server.
echo If the port is already in use, keep the existing game server and open that URL.
"%GOWAYGUI_NODE%" "%~dp0serve.mjs"
pause
exit /b
:missing
echo Node.js is required. The development computer already has it installed.
pause
'''.replace('\n', '\r\n')
files = sorted(p for p in build.rglob('*') if p.is_file())
manifest = {'version': version + ' Gameplay Prototype', 'bundleSha256': digest,
            'buildReport': report, 'files': [
                {'path': 'web/' + p.relative_to(build).as_posix(), 'bytes': p.stat().st_size,
                 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
out = root / f'output/gowaygui-{tag}-playtest.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in files:
        z.write(p, 'web/' + p.relative_to(build).as_posix())
    z.writestr('serve.mjs', server)
    z.writestr('Start-Playtest.cmd', launcher)
    z.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    if tag == 'gameplay':
        for name in ['GAMEPLAY_PLAY_GUIDE.md','GAMEPLAY_INCREMENT_ACCEPTANCE.md','MULTIFRONT_AND_SHOP_RULES.md']:
            z.write(root / 'docs' / name, name)
        for name in ['gameplay-built.json','gameplay-cocos-build.json','gameplay-tests.txt','gameplay-ui.md','gameplay-balance.json','gameplay-book-odds.json','gameplay-shop.png','gameplay-raid.png']:
            z.write(root / 'docs/reports' / name, 'reports/' + name)
    elif tag == 'v07':
        z.write(root / 'docs/V07_PLAY_GUIDE.md', 'V07_PLAY_GUIDE.md')
        z.write(root / 'docs/V07_IMPLEMENTATION.md', 'V07_IMPLEMENTATION.md')
        for name in ['v07-built.json','v07-cocos-build.json','v07-tests.txt','v07-ui-final.md','v07-raid-simulation.json']:
            z.write(root / 'docs/reports' / name, 'reports/' + name)
    else:
        z.write(root / 'docs/V06_PLAY_GUIDE.md', 'V06_PLAY_GUIDE.md')
        z.write(root / 'docs/V06_CONFIG.md', 'V06_CONFIG.md')
    if tag == 'v061':
        z.write(root / 'docs/V061_CHANGES.md', 'V061_CHANGES.md')
        for report_name in ['v061-built.json', 'v061-cocos-build.json', 'v061-tests.txt', 'v061-ui-final.txt']:
            z.write(root / 'docs/reports' / report_name, 'reports/' + report_name)
    z.writestr('README.txt', f'《哥喂龟》V{version} 本地核心玩法试玩版\n\n解压后双击 Start-Playtest.cmd，保持窗口开启，再用原浏览器访问 http://127.0.0.1:7457/。\n若本机现有游戏服务已运行，直接打开上述地址，无需重复启动。\n不要直接双击 web/index.html。存档保存在浏览器内，包中不含玩家存档。\n本机已有 Node.js；换电脑运行才需要安装 Node.js。\n操作与数值见包内 PLAY_GUIDE 和配置说明文档。\n请保留同一浏览器和地址继续已有进度；更换浏览器、域名或端口会使用另一份存档。\n')
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    for entry in manifest['files']:
        assert hashlib.sha256(z.read(entry['path'])).hexdigest() == entry['sha256']
result = {'archive': str(out), 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
          'runtimeFiles': len(files), 'bundleSha256': digest, 'allPackagedRuntimeHashesVerified': True}
(root / f'docs/reports/{tag}-package.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
