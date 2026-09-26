"""Freeze first-round bytes and prepare a bounded, independent second art round.

Plain Python only. No Blender, production writes, image processing or regeneration.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, shutil

HOME = Path(__file__).resolve().parent
FIRST = HOME / 'candidate-01'
SECOND = HOME / 'candidate-02'
FREEZE = HOME / 'first-round-freeze.json'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

actual = {p.relative_to(FIRST).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p)}
          for p in sorted(FIRST.rglob('*')) if p.is_file()}
if FREEZE.exists():
    old = json.loads(FREEZE.read_text(encoding='utf-8'))
    assert old['files'] == actual, 'Frozen first-round content changed'
else:
    FREEZE.write_text(json.dumps({
        'status': 'first-round-complete-original-bytes-frozen',
        'recordedAtUtc': datetime.now(timezone.utc).isoformat(),
        'rootReview': 'Direction approved; second round only courtyard edge, pearl support, sparse low foliage.',
        'scope': 'Every candidate-01 file, including original previews, logs and blend backups, retained in place.',
        'files': actual,
    }, ensure_ascii=False, indent=2), encoding='utf-8')

SECOND.mkdir(exist_ok=True)
for name in ['author_home_candidate.py', 'home_composition.py', 'verify_home_island.py',
             'render_home_views.py', 'finalize_home_candidate.py', 'prepare_home_layout.py',
             'render_layout_plan.cjs', 'layout-proposal.json', 'layout-proposal.svg',
             'layout-proposal.png']:
    target = SECOND / name
    if not target.exists():
        shutil.copyfile(FIRST / name, target)

print(json.dumps({'status': 'first-round-frozen-second-round-sources-prepared',
                  'frozenFiles': len(actual), 'frozenBytes': sum(v['bytes'] for v in actual.values()),
                  'blenderStarted': False, 'runtimeModified': False}))
