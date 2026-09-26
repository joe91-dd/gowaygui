"""Promote frozen c12b after review; preserve the existing Cocos UUID and c11.

No Blender/Cocos invocation. Default is verification; explicit promote/rollback
commands mutate only named stone-turtle runtime files and source receipts.
"""
import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SOURCE = HERE.parents[1]
RUNTIME = ROOT / 'game/assets/resources/models/stone-turtle'
ARCHIVE = SOURCE / 'versions/c11'
CURRENT = SOURCE / 'promotion-manifest.json'
RECEIPT = HERE / 'promotion-manifest.json'
UUID = '5d7d68a1-9672-41e8-a0ad-05d7a87185f7'
PAYLOADS = ('stone-colour.png', 'stone-roughness.png', 'stone-turtle.fbx')
FILES = tuple(name + suffix for name in PAYLOADS for suffix in ('', '.meta'))
OLD_FBX = '9bc1cc37580ad3cb1c9fb57e2f54bf574fc7bac129befb1f7b08f60027d836a7'
NEW_FBX = 'fd2dee9cf539ac5e9b73cfb21cdcac1fede7f25ff60934f68e078d288357ac3c'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def rel(path): return path.relative_to(ROOT).as_posix()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def ensure(value, message):
    if not value: raise RuntimeError(message)
def stamp(): return datetime.now(timezone.utc).isoformat()
def check_uuid(): ensure(read(RUNTIME / 'stone-turtle.fbx.meta')['uuid'] == UUID, 'Existing FBX UUID changed')
def copy_atomic(source, target):
    staging = HERE / 'promotion-staging'; staging.mkdir(exist_ok=True)
    staged = staging / target.name
    shutil.copyfile(source, staged)
    ensure(sha(source) == sha(staged), 'Staging copy failed')
    os.replace(staged, target)

def verify():
    receipt = read(RECEIPT); check_uuid()
    ensure(read(CURRENT)['version'] == 'stone-sample-12b', 'Current version is no longer c12b')
    for item in receipt['before_runtime']:
        ensure(sha(ROOT / item['archive_path']) == item['sha256'], 'c11 archive changed: '+item['name'])
    ensure(sha(ARCHIVE / 'promotion-manifest.json') == receipt['previous_manifest_sha256'], 'Previous manifest archive changed')
    for item in receipt['promoted_runtime']:
        ensure(sha(ROOT / item['target_path']) == item['sha256'], 'Runtime candidate changed: '+item['target_path'])
        ensure(sha(ROOT / item['candidate_path']) == item['sha256'], 'Frozen export changed: '+item['candidate_path'])
    for path, digest in {**receipt['canonical_source_hashes'], **receipt['candidate_source_hashes']}.items():
        ensure(sha(ROOT / path) == digest, 'Preserved/frozen source changed: '+path)
    return {'status':'verified-c12b-runtime-candidate-not-final-art', 'runtime_uuid':UUID,
        'runtime_fbx_sha256':sha(RUNTIME/'stone-turtle.fbx'), 'c11_archive_verified':True,
        'canonical_v10_source_preserved':True, 'frozen_sources_verified':True,
        'meta_byte_changes_since_promotion':[name for name,digest in receipt['meta_hashes_immediately_after_promotion'].items() if sha(RUNTIME/name)!=digest]}

def promote():
    if RECEIPT.exists(): return verify()
    ensure(not ARCHIVE.exists(), 'c11 archive already exists; inspect before retrying')
    check_uuid(); previous = read(CURRENT)
    ensure(previous['version'] == 'stone-sample-11', 'Current version is not the approved c11 base')
    ensure(sha(RUNTIME/'stone-turtle.fbx') == OLD_FBX, 'Unexpected runtime c11 FBX')
    ensure(sha(HERE/'export/stone-turtle.fbx') == NEW_FBX, 'Frozen c12b FBX changed')
    for item in previous['promoted_runtime']:
        ensure(sha(ROOT/item['target_path']) == item['sha256'], 'Current c11 payload does not match its receipt')
    complete = read(HERE/'review-complete.json'); roundtrip = read(HERE/'round-trip-check.json')
    ensure(complete['protected_inputs_unchanged'] and complete['round_trip_clips']==6 and complete['rendered_poses'], 'Technical/pose checks incomplete')
    ensure(read(HERE/'manual-review.json')['all_seven_images_viewed'], 'Actual render review incomplete')
    ensure(roundtrip['fbx_sha256']==NEW_FBX and roundtrip['atlas_source_rebuild_byte_identical'], 'Wrong round-trip artifact or atlas source')
    for clip in read(HERE/'animation-clearance.json')['clips'].values():
        ensure(clip['max_shell']==clip['max_front_legs']==0, 'Facial animation overlap requires review')
    for path,digest in read(HERE/'candidate-manifest.json')['protected_inputs'].items():
        ensure(sha(ROOT/path)==digest, 'Protected pre-promotion source/runtime changed: '+path)
    canonical = previous['canonical_source_hashes']
    for path,digest in canonical.items(): ensure(sha(ROOT/path)==digest,'Canonical v10 source changed')
    before = [{'name':name,'target_path':rel(RUNTIME/name),'archive_path':rel(ARCHIVE/'runtime'/name),
        'sha256':sha(RUNTIME/name),'bytes':(RUNTIME/name).stat().st_size} for name in FILES]
    previous_sha=sha(CURRENT); (ARCHIVE/'runtime').mkdir(parents=True)
    for item in before:
        shutil.copy2(ROOT/item['target_path'],ROOT/item['archive_path'])
        ensure(sha(ROOT/item['archive_path'])==item['sha256'],'c11 backup verification failed')
    shutil.copy2(CURRENT,ARCHIVE/'promotion-manifest.json')
    ensure(sha(ARCHIVE/'promotion-manifest.json')==previous_sha,'Previous receipt backup failed')
    write(ARCHIVE/'archive-manifest.json',{'version':'stone-sample-11','archived_at_utc':stamp(),'asset_uuid':UUID,
        'runtime_files':before,'previous_manifest_sha256':previous_sha,
        'editable_c11_source_preserved':rel(SOURCE/'candidate-11/stone-turtle.blend'),
        'canonical_v10_source_hashes':canonical})
    for name in PAYLOADS: copy_atomic(HERE/'export'/name,RUNTIME/name)
    # Do not overwrite live .meta files or invent importer subresource UUIDs.
    check_uuid()
    for item in before:
        if item['name'].endswith('.meta'): ensure(sha(RUNTIME/item['name'])==item['sha256'],'Live metadata was altered')
    sources = [HERE/name for name in ['stone-turtle.blend','stone-turtle-review-scene.blend','stone-turtle-keypose-review.blend',
        'stone-turtle.glb','candidate-manifest.json','atlas-parameters.json','round-trip-check.json','animation-clearance.json','review-complete.json','manual-review.json']]
    sources += [ROOT/'game/art-source/build_stone_turtle_candidate12b.py',ROOT/'game/art-source/stone_turtle_atlas.py',
        HERE/'review_candidate12b.py',SOURCE/'candidate-11/stone-turtle.blend',ROOT/'game/art-source/build_stone_turtle_candidate11.py']
    receipt = {'version':'stone-sample-12b','promotion_status':'runtime-review-not-final-art','promoted_at_utc':stamp(),
        'runtime_asset_uuid':UUID,'runtime_prefab_path':'models/stone-turtle/stone-turtle/stone-turtle',
        'previous_version_archive':'versions/c11','previous_manifest_sha256':previous_sha,
        'previous_fbx_sha256':OLD_FBX,'runtime_fbx_sha256':NEW_FBX,'before_runtime':before,
        'promoted_runtime':[{'target_path':rel(RUNTIME/name),'candidate_path':rel(HERE/'export'/name),
            'sha256':sha(RUNTIME/name),'bytes':(RUNTIME/name).stat().st_size} for name in PAYLOADS],
        'meta_hashes_immediately_after_promotion':{name:sha(RUNTIME/name) for name in FILES if name.endswith('.meta')},
        'live_meta_files_replaced':False,'geometry_changed_during_promotion':False,
        'canonical_source_version':'stone-sample-10-preserved','canonical_source_hashes':canonical,
        'current_editable_source':rel(HERE/'stone-turtle.blend'),'current_generation_script':'game/art-source/build_stone_turtle_candidate12b.py',
        'atlas_generation_script':'game/art-source/stone_turtle_atlas.py','atlas_raster_inputs':[],
        'candidate_source_hashes':{rel(path):sha(path) for path in sources},
        'runtime_triangles_expected':roundtrip['triangles'],'runtime_vertices_expected':roundtrip['weighted_vertices'],
        'runtime_bones_expected':roundtrip['bones'],'runtime_materials_expected':1,
        'clips':{name:clip['seconds'] for name,clip in roundtrip['clips'].items()},
        'forward_axis_cocos':'+Z','battle_scale':.65,'foot_origin_y':0,
        'review_basis':'Parent actually viewed final front/three-quarter and authorized runtime candidate after technical review. All seven renders viewed, six FBX actions and source-atlas rebuild checked.',
        'remaining_review':'Actual Cocos importer/material/animation and final user art approval remain pending.',
        'tools_started':{'blender':False,'cocos':False},
        'rollback_command':'python game/art-source/stone-turtle/candidate-12/c12b/runtime_promotion.py rollback',
        'note':'Use the current_editable_source/current_generation_script. The canonical v10 builder intentionally remains archived in place, following the c11 promotion convention.'}
    write(RECEIPT,receipt); write(CURRENT,receipt)
    result=verify(); write(HERE/'promotion-verification.json',result); return result

def rollback():
    receipt=read(RECEIPT); check_uuid()
    for item in receipt['promoted_runtime']:
        old=next(old for old in receipt['before_runtime'] if old['name']==Path(item['target_path']).name)
        ensure(sha(ROOT/item['target_path']) in (old['sha256'],item['sha256']),'Refusing to overwrite a later runtime version')
    for item in receipt['before_runtime']:
        ensure(sha(ROOT/item['archive_path'])==item['sha256'],'c11 archive changed')
    ensure(sha(ARCHIVE/'promotion-manifest.json')==receipt['previous_manifest_sha256'],'Archived c11 receipt changed')
    # Run only while no asset-writing Cocos build is active.
    for item in sorted(receipt['before_runtime'],key=lambda item:item['name']=='stone-turtle.fbx'):
        copy_atomic(ROOT/item['archive_path'],ROOT/item['target_path'])
    copy_atomic(ARCHIVE/'promotion-manifest.json',CURRENT); check_uuid()
    result={'status':'restored-runtime-c11','at_utc':stamp(),'runtime_uuid':UUID,'runtime_fbx_sha256':sha(RUNTIME/'stone-turtle.fbx')}
    write(HERE/'rollback-receipt.json',result); return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=('verify','promote','rollback'),default='verify',nargs='?')
    print(json.dumps(globals()[parser.parse_args().command](),ensure_ascii=False,indent=2))
