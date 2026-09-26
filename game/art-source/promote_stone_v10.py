"""Promote the reviewed, frozen v10 bytes; preserve v09 and Cocos metadata."""
import bpy
import json
import hashlib
import shutil
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
CANDIDATE=SOURCE/'candidate-10'
RUNTIME=ROOT/'game/assets/resources/models/stone-turtle'
ARCHIVE=SOURCE/'versions/v09'
OLD='91f0a61c689d1e227d227559f57d22b7c9673563a3262bbf8f60182c1e4f9599'
NEW='8b8f0c56b2be36e8fa1fb082a253cc34271cf53d6983001f78f61ce4eb38260d'
UUID='5d7d68a1-9672-41e8-a0ad-05d7a87185f7'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(RUNTIME/'stone-turtle.fbx')==OLD,'Runtime changed; re-inspect before promotion'
assert sha(CANDIDATE/'export/stone-turtle.fbx')==NEW,'Frozen candidate changed'
assert json.loads((RUNTIME/'stone-turtle.fbx.meta').read_text(encoding='utf-8'))['uuid']==UUID
assert not ARCHIVE.exists(),'Existing archive must never be overwritten'
source_checks={}
for name in ['stone-turtle.blend','stone-turtle-review-scene.blend']:
    bpy.ops.wm.open_mainfile(filepath=str(CANDIDATE/name))
    images=[i for i in bpy.data.images if i.source=='FILE']
    assert len(images)==2 and all(i.packed_file for i in images),name
    source_checks[name]={'sha256':sha(CANDIDATE/name),'packed_textures':[i.name for i in images]}

# Copy the complete previous canonical source, then snapshot its runtime bytes
# and metadata separately. No existing directory is moved or deleted.
ARCHIVE.mkdir(parents=True)
for path in SOURCE.iterdir():
    if path.is_file():shutil.copy2(path,ARCHIVE/path.name)
archive_runtime=ARCHIVE/'runtime';archive_runtime.mkdir()
for path in RUNTIME.iterdir():
    if path.is_file():shutil.copy2(path,archive_runtime/path.name)
shutil.copy2(ROOT/'game/art-source/build_stone_turtle.py',ARCHIVE/'build_stone_turtle.snapshot.py')
assert sha(archive_runtime/'stone-turtle.fbx')==OLD
archive_manifest={'version':'stone-sample-09','archived_at_utc':datetime.now(timezone.utc).isoformat(),
 'runtime_fbx_sha256':OLD,'asset_uuid':UUID,'source_main':'stone-turtle.blend',
 'runtime_fbx':'runtime/stone-turtle.fbx','note':'Original canonical v09 preserved before v10 promotion. Source textures are packed.'}
(ARCHIVE/'archive-manifest.json').write_text(json.dumps(archive_manifest,ensure_ascii=False,indent=2),encoding='utf-8')

# Exact frozen candidate export bytes, not a regenerated variant. Keep all live
# .meta files in place so user import settings and UUIDs remain continuous.
for name in ['stone-turtle.fbx','stone-colour.png','stone-roughness.png']:
    shutil.copy2(CANDIDATE/'export'/name,RUNTIME/name)
    if name=='stone-turtle.fbx':(RUNTIME/name).touch()
for name in ['stone-turtle.blend','stone-turtle-review-scene.blend','stone-turtle.glb',
             'model-stats.json','round-trip-check.json','render-three-quarter.png',
             'pose-idle.png','pose-attack.png','pose-skill.png','pose-hit.png','pose-rest.png','pose-fusion.png']:
    shutil.copy2(CANDIDATE/name,SOURCE/name)
stats=json.loads((SOURCE/'model-stats.json').read_text(encoding='utf-8'))
stats['version']='stone-sample-10'
stats['status']='Promoted runtime review candidate; awaiting Cocos lighting/material review and user aesthetic acceptance.'
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

# These three views previously depicted v09. They are archived and will be
# regenerated from the promoted source; do not leave misleading old evidence.
for name in ['render-front.png','render-side.png','render-battle.png']:
    path=SOURCE/name
    assert path.resolve().parent==SOURCE.resolve()
    if path.exists():
        assert sha(path)==sha(ARCHIVE/name)
        path.unlink()
assert sha(RUNTIME/'stone-turtle.fbx')==NEW
assert all(sha(SOURCE/name)==check['sha256'] for name,check in source_checks.items())
assert json.loads((RUNTIME/'stone-turtle.fbx.meta').read_text(encoding='utf-8'))['uuid']==UUID
assert not list(RUNTIME.glob('*.glb'))
manifest={'version':'stone-sample-10','promotion_status':'runtime-review-not-final-art',
 'promoted_at_utc':datetime.now(timezone.utc).isoformat(),'frozen_candidate':'candidate-10',
 'previous_version_archive':'versions/v09','previous_fbx_sha256':OLD,'runtime_fbx_sha256':NEW,
 'source_glb_sha256':sha(SOURCE/'stone-turtle.glb'),
 'runtime_asset_uuid':UUID,'runtime_prefab_path':'models/stone-turtle/stone-turtle/stone-turtle',
 'geometry_changed_during_promotion':False,'live_meta_files_replaced':False,
 'source_checks':source_checks,'runtime_triangles':stats['triangles'],'runtime_vertices':stats['vertices'],
 'clips':stats['clips'],'forward_axis_cocos':'+Z','foot_origin_y':0.0,
 'remaining_review':'Cocos v10 lighting/material/animation review; final art acceptance remains pending.'}
(SOURCE/'promotion-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
