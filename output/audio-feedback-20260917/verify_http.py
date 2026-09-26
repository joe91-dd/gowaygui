from pathlib import Path
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[2]
base='http://127.0.0.1:7461'
def get(path):
    with urllib.request.urlopen(base+path,timeout=15) as response:return response.read()
assert b'<html' in get('/').lower()
assert get('/assets/main/index.js')==(ROOT/'game/build/web-mobile/assets/main/index.js').read_bytes()
m=json.loads((ROOT/'game/audio-source/cc0-20260916/manifest.json').read_text(encoding='utf8'))
for a in m['assets']:
    path=ROOT/a['runtime']
    uid=json.loads(Path(str(path)+'.meta').read_text(encoding='utf8'))['uuid']
    assert hashlib.sha256(get('/assets/resources/native/'+uid[:2]+'/'+uid+path.suffix)).hexdigest()==a['sha256'],a['key']
print('Game HTTP 200; current UI bundle and all 36 served audio files verified.')
