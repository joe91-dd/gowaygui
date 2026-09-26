"""Freeze original bytes and copy only unchanged texture inputs/review renderer; no Blender."""
from pathlib import Path
import json,hashlib,shutil,ast
OUT=Path(__file__).resolve().parent;FIRST=OUT.parent/'candidate-01'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files={p.relative_to(FIRST).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(FIRST.rglob('*')) if p.is_file()}
freeze=OUT/'c01-full-freeze.json'
if freeze.exists():assert json.loads(freeze.read_text(encoding='utf-8'))['files']==files
else:freeze.write_text(json.dumps({'status':'all-first-round-bytes-preserved-in-place-including-old-runtime-reports','files':files},ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['island-colour.png','island-roughness.png','render_boss_views.py']:
    target=OUT/name
    if not target.exists():shutil.copyfile(FIRST/name,target)
    assert sha(target)==sha(FIRST/name)
for p in OUT.glob('*.py'):ast.parse(p.read_text(encoding='utf-8'))
print(json.dumps({'frozenFiles':len(files),'sourceTexturesCopiedUnmodified':True,'ast':'pass','blenderStarted':False}))
