"""Copy the reviewed coral candidate; do not author importer metadata."""
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

source = Path(__file__).resolve().parent
root = source.parents[4]
destination = root / 'game/assets/resources/environment/coral-bend'
assert (root / 'game/assets/scripts').is_dir() and destination.is_relative_to(root)
names = ('coral-bend.fbx', 'island-colour.png', 'island-roughness.png')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source / names[0]) == '298f3326a6b46ac36259226762e711f2603183b01d30f84ca86239c9f17fff40'
for name in names:
    old = destination / name
    if old.exists() and sha(old) != sha(source / name):
        raise RuntimeError(f'Refusing to replace a different runtime file: {old}')
destination.mkdir(parents=True, exist_ok=True)
records = []
for name in names:
    target = destination / name
    if not target.exists():
        shutil.copyfile(source / name, target)
    assert sha(source / name) == sha(target)
    records.append({'source': (source / name).relative_to(root).as_posix(),
                    'destination': target.relative_to(root).as_posix(),
                    'bytes': target.stat().st_size, 'sha256': sha(target)})
manifest = {
    'schemaVersion': 1, 'promotedAtUtc': datetime.now(timezone.utc).isoformat(),
    'status': 'runtime-candidate-pending-cocos-review', 'levelId': 2,
    'authorization': 'Root reviewed battle, top-down, coral-inlet and layout comparison; approved candidate with tested legacy-save migration.',
    'expectedResourcesPrefabPath': 'environment/coral-bend/coral-bend/coral-bend',
    'materials': ['Island_atlas', 'Warm_pearl_and_lamps'],
    'stationCoordinates': [[-5, 1], [-1, 1], [3.395, 1.099], [1, -3], [5.832, -.748]],
    'routeChanged': False, 'files': records, 'metasOrUuidsAuthored': False,
    'cocosLaunched': False,
    'pending': ['Actual Cocos import, lighting and culling', 'Actual restored formation and enemy contacts', 'Performance and final art acceptance'],
}
(source / 'promotion-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': manifest['status'], 'files': records}, ensure_ascii=False))
