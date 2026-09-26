"""Record a read-only hash inventory of all four leaf source archives.
Logical freeze only: no file attributes, geometry, textures, or old records changed.
"""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];BASE=HERE.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files={}
for candidate in ['candidate-01','candidate-02','candidate-03','candidate-04']:
    for p in sorted((BASE/candidate).rglob('*')):
        if p.is_file():files[str(p.relative_to(ROOT))]={'bytes':p.stat().st_size,'sha256':sha(p)}
for name in ['build_leaf_turtle_candidate01.py','build_leaf_turtle_candidate02.py','build_leaf_turtle_candidate03.py','build_leaf_turtle_candidate04.py']:
    p=ROOT/'game/art-source'/name;files[str(p.relative_to(ROOT))]={'bytes':p.stat().st_size,'sha256':sha(p)}
p=BASE/'promotion-manifest.json';files[str(p.relative_to(ROOT))]={'bytes':p.stat().st_size,'sha256':sha(p)}
runtime={p.name:sha(p) for p in (ROOT/'game/assets/resources/models/leaf-turtle').iterdir() if p.is_file() and not p.name.endswith('.meta')}
record={'status':'c01-c04 source archives frozen after c04 approved runtime promotion; no further source edits unless separately authorized',
    'files':files,'file_count':len(files),'runtime_payload_sha256':runtime,
    'source_mutations_performed_by_freeze':False,'filesystem_attributes_changed':False,'cocos_meta_excluded_from_runtime_payload':True}
(BASE/'source-freeze.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('LEAF_SOURCE_ARCHIVES_FROZEN '+json.dumps({'files':len(files),'runtime_payloads':len(runtime)}))
