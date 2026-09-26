"""Execute the parent-approved c04 three-file promotion; never author Cocos meta.
Plain Python, no Blender or Cocos. Source proposal and reviewed images verified.
"""
import hashlib,json,shutil
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];OUT=HERE/'runtime-candidate'
TARGET=ROOT/'game/assets/resources/models/leaf-turtle'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
proposal=json.loads((OUT/'promotion-proposal.json').read_text(encoding='utf-8'))
review=json.loads((OUT/'technical-manual-review.json').read_text(encoding='utf-8'))
lod=json.loads((OUT/'lod-manifest.json').read_text(encoding='utf-8'))
for path,digest in lod['protected_inputs'].items():assert sha(ROOT/path)==digest,('Protected input changed',path)
for name,digest in review['images_actually_viewed'].items():assert sha(OUT/name)==digest,('Reviewed final image changed',name)
for name,digest in proposal['script_sha256'].items():assert sha(HERE/name)==digest,('Reviewed build script changed',name)
allowed={'leaf-turtle.fbx','leaf-colour.png','leaf-roughness.png'}
assert len(proposal['files'])==3
TARGET.mkdir(parents=True,exist_ok=True)
existing={p.name:sha(p) for p in TARGET.iterdir() if p.is_file()}
assert all(name in allowed or name.endswith('.meta') for name in existing),('Unexpected destination file',existing.keys())
files=[]
for item in proposal['files']:
    source=(ROOT/item['source']).resolve();destination=(ROOT/item['proposed_destination']).resolve()
    assert source.parent==(OUT/'export').resolve() and destination.parent==TARGET.resolve()
    assert source.name==destination.name and source.name in allowed
    assert source.stat().st_size==item['bytes'] and sha(source)==item['sha256']
    if destination.exists():assert sha(destination)==item['sha256'],('Refuse replacing an unknown existing runtime payload',destination)
    else:shutil.copy2(source,destination)
    assert sha(destination)==sha(source)==item['sha256']
    files.append({**item,'destination':str(destination.relative_to(ROOT)),'target_sha256':sha(destination),'source_target_identical':True})
for name,digest in existing.items():assert sha(TARGET/name)==digest,('Pre-existing destination file changed',name)
for path,digest in lod['protected_inputs'].items():assert sha(ROOT/path)==digest
assert {p.name for p in TARGET.iterdir() if p.is_file() and not p.name.endswith('.meta')}==allowed
promotion={**proposal,'status':'Promoted c04 LOD runtime candidate after parent actually viewed final front and battle renders; final Cocos acceptance pending.',
    'files':files,'approved_by':'root agent review of final render-front.png and render-battle.png',
    'source_proposal_sha256':sha(OUT/'promotion-proposal.json'),
    'runtime_destination':str(TARGET.relative_to(ROOT)),'meta_or_uuid_written':False,'existing_meta_sha256':{n:d for n,d in existing.items() if n.endswith('.meta')},
    'cocos_started':False,'cocos_actual_validation_complete':False,'runtime_promoted':True}
write(OUT/'promotion.json',promotion)
write(HERE.parent/'promotion-manifest.json',promotion)
print('LEAF_C04_PROMOTED '+json.dumps({'files':3,'fbx_sha256':sha(TARGET/'leaf-turtle.fbx'),'meta_written':False}))
