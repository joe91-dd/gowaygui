"""Verify staged, provenance-hashed source archives keep their exact bytes."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
def git(*args, data=None):
    return subprocess.run(['git', *args], cwd=root, input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout

entries = git('ls-files', '--stage', '-z', '--', 'game/art-source', 'game/audio-source').split(b'\0')
files = []
for entry in entries:
    if not entry:
        continue
    fields, name = entry.split(b'\t', 1)
    mode, oid, stage = fields.split()
    if stage != b'0':
        raise RuntimeError(f'Unmerged archive: {name!r}')
    if b'\n' in name or b'\r' in name:
        raise RuntimeError('Unexpected newline in archive filename')
    files.append((name, oid.decode('ascii')))
oids = git('hash-object', '--no-filters', '--stdin-paths',
           data=b'\n'.join(name for name, _ in files) + b'\n').decode('ascii').splitlines()
assert len(oids) == len(files)
different = [name.decode('utf-8') for (name, expected), actual in zip(files, oids) if expected != actual]
print(json.dumps({'scope': 'Tracked art/audio archive index blobs versus unfiltered working-file bytes; not license or art-quality verification',
                  'checked': len(files), 'status': 'failed' if different else 'passed',
                  'different': different}, ensure_ascii=False, indent=2))
raise SystemExit(bool(different))
