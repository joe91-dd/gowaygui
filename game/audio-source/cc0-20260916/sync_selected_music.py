"""Update only selected music and its duration metadata in the existing playtest export."""
from pathlib import Path
import hashlib,json,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BUILT=ROOT/'game/build/web-mobile/assets/resources'
PREVIEW=ROOT/'output/web/assets/resources'
selection=json.loads((HERE/'music-selection.json').read_text(encoding='utf8'))
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
assets={a['key']:a for a in manifest['assets']}
copies=[]
for track in selection['tracks']:
    key=track['key']
    meta=json.loads((ROOT/'game/assets/resources/audio'/f'{key}.ogg.meta').read_text(encoding='utf8'))
    uid=meta['uuid']
    for folder,suffix in [('native','.ogg'),('import','.json')]:
        relative=Path(folder)/uid[:2]/(uid+suffix)
        source,target=BUILT/relative,PREVIEW/relative
        assert source.is_file() and target.is_file(), f'Unexpected export layout: {relative}'
        if folder=='native':assert hashlib.sha256(source.read_bytes()).hexdigest()==assets[key]['sha256']
        else:
            before,after=target.read_text(encoding='utf8'),source.read_text(encoding='utf8')
            assert 'cc.AudioClip' in before and key in before and 'cc.AudioClip' in after and key in after
        copies.append((source,target))
for source,target in copies:
    backup=HERE/'before-music-a'/'playtest'/target.relative_to(PREVIEW)
    if not backup.exists():
        backup.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(target,backup)
    shutil.copy2(source,target)
    assert target.read_bytes()==source.read_bytes()
print('Updated existing playtest: three music assets and three duration metadata files.')
