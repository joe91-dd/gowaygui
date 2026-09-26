"""Synchronize the verified complete build to the existing local playtest folder."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'game/build/web-mobile'
target=ROOT/'output/web'
report_path=ROOT/'game/temp/build-logs/20260917-003312.built-core.json'
report=json.loads(report_path.read_text(encoding='utf-8-sig'))
assert report['status']=='passed'
bundle=source/'assets/main/index.js'
bundle_hash=next(f['sha256'] for f in report['loadedFiles'] if f['relative']=='assets/main/index.js')
assert hashlib.sha256(bundle.read_bytes()).hexdigest()==bundle_hash
assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in (ROOT/'game/assets/scripts/view').glob('*.ts'))
manifest=json.loads((ROOT/'game/audio-source/cc0-20260916/manifest.json').read_text(encoding='utf8'))
assert len(manifest['assets'])==36
native=list((source/'assets/resources/native').rglob('*'))
hashes={hashlib.sha256(p.read_bytes()).hexdigest() for p in native if p.suffix in ['.ogg','.wav']}
assert all(a['sha256'] in hashes for a in manifest['assets'])
shutil.copytree(source,target,dirs_exist_ok=True)
assert (target/'assets/main/index.js').read_bytes()==bundle.read_bytes()
deployed={hashlib.sha256(p.read_bytes()).hexdigest() for p in (target/'assets/resources/native').rglob('*') if p.suffix in ['.ogg','.wav']}
assert all(a['sha256'] in deployed for a in manifest['assets'])
result=dict(status='passed',audioAssets=36,source=str(source),target=str(target),bundleSha256=bundle_hash,buildReport=str(report_path))
(Path(__file__).resolve().parent/'deployment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(result,ensure_ascii=True))
