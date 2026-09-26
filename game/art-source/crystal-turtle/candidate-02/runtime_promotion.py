"""Promote approved crystal c02 into its own new runtime directory.

Stdlib only. Does not start Blender/Cocos, invent .meta UUIDs or overwrite any
other species. Default command is read-only verification; promote is explicit.
"""
import argparse, hashlib, json, os, shutil
from datetime import datetime, timezone
from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
RUNTIME=ROOT/'game/assets/resources/models/crystal-turtle'
RECEIPT=HERE/'promotion-manifest.json';CURRENT=HERE.parent/'promotion-manifest.json'
PAYLOADS=('crystal-colour.png','crystal-roughness.png','crystal-turtle.fbx')
EXPECTED_FBX='b35d20a6ffbc737231631e505c8ae5b9d5eefea3a83b1b46fd58b838a5bd0364'
EXPECTED_BLEND='694e5496e9e44040259f3f4ea525b42a51e13acb52c4c685b134fb2fb152a51e'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def rel(path):return path.relative_to(ROOT).as_posix()
def ensure(value,message):
    if not value:raise RuntimeError(message)

def verify():
    receipt=read(RECEIPT)
    ensure(read(CURRENT)['version']=='crystal-sample-02','Current crystal version changed')
    for item in receipt['runtime_files']:
        ensure(sha(ROOT/item['runtime_path'])==item['sha256'],'Runtime payload changed: '+item['name'])
        ensure(sha(ROOT/item['source_path'])==item['sha256'],'Frozen export changed: '+item['name'])
    for path,digest in receipt['frozen_source_hashes'].items():ensure(sha(ROOT/path)==digest,'Frozen source changed: '+path)
    for path,digest in receipt['protected_source_and_runtime_hashes'].items():
        # Cocos may legitimately update its own importer .meta after promotion.
        if path.endswith('.meta'):continue
        ensure(sha(ROOT/path)==digest,'Other source/runtime payload changed: '+path)
    return {'status':'verified-crystal-c02-runtime-candidate-not-final-art',
        'runtime_fbx_sha256':sha(RUNTIME/'crystal-turtle.fbx'),
        'source_and_payloads_verified':True,'c01_stone_and_spike_payloads_preserved':True,
        'meta_files_created_by_promotion':False,
        'current_meta_files':[rel(path) for path in RUNTIME.glob('*.meta')]}

def promote():
    if RECEIPT.exists():return verify()
    if RUNTIME.exists():
        for path in RUNTIME.iterdir():
            if path.is_file() and path.name.endswith('.meta'):continue
            ensure(path.is_file() and path.name in PAYLOADS and sha(path)==sha(HERE/'export'/path.name),
                'Runtime crystal directory contains an unexpected resource; inspect before replacing anything')
    ensure(not CURRENT.exists(),'An existing crystal promotion requires explicit review')
    ensure(sha(HERE/'export/crystal-turtle.fbx')==EXPECTED_FBX,'Approved FBX changed')
    ensure(sha(HERE/'crystal-turtle.blend')==EXPECTED_BLEND,'Approved editable model changed')
    candidate=read(HERE/'candidate-manifest.json');technical=read(HERE/'round-trip-check.json')
    completed=read(HERE/'review-complete.json');manual=read(HERE/'technical-manual-review.json')
    ensure(completed['six_fbx_clips_checked'] and completed['atlas_rebuild_checked'] and not completed['quick_only'],'Full c02 technical checks required')
    ensure(technical['fbx_sha256']==EXPECTED_FBX and len(technical['clips'])==6,'Wrong artifact or incomplete clips')
    ensure(technical['atlas_rebuild_byte_identical'] and technical['packed_source_textures']==2,'Atlas source/packing check failed')
    ensure(technical['c01_non_shell_geometry_uv_weights_unchanged'] and technical['opaque_glb_and_source_verified'],'Frozen c01 body or opacity check failed')
    ensure(manual['all_ten_images_viewed'] and manual['technical_review_complete'],'Actual pose review incomplete')
    ensure(manual['approved_shape_frozen'] and manual['parent_runtime_candidate_authorization'],'Parent runtime-candidate authorization missing')
    for clip in technical['clips'].values():
        ensure(clip['loop_seam_m']<.0001 and clip['max_vertex_motion_m']>.0001 and clip['minimum_z_m']>-.003,'Clip quality check failed')
    clearance=read(HERE/'animation-clearance.json')
    ensure(all(clip['max_shell']==clip['max_front_legs']==0 for clip in clearance['clips'].values()),'Front face intersection requires review')
    for path,digest in candidate['protected_inputs'].items():ensure(sha(ROOT/path)==digest,'Protected input changed before promotion: '+path)
    for name,digest in completed['approved_view_hashes_preserved'].items():ensure(sha(HERE/name)==digest,'Approved view changed')
    ensure(len(completed['approved_view_hashes_preserved'])==2,'Both approved views must stay unchanged')
    RUNTIME.mkdir(parents=True,exist_ok=True);staging=HERE/'promotion-staging';staging.mkdir(exist_ok=True)
    files=[]
    for name in PAYLOADS:
        source=HERE/'export'/name;staged=staging/name;target=RUNTIME/name
        shutil.copy2(source,staged);ensure(sha(staged)==sha(source),'Staging copy mismatch')
        os.replace(staged,target);ensure(sha(target)==sha(source),'Runtime copy mismatch')
        files.append({'name':name,'source_path':rel(source),'runtime_path':rel(target),'sha256':sha(target),'bytes':target.stat().st_size})
    # A running editor may import the new files on its own. Preserve any such
    # .meta verbatim; this script never creates, replaces or deletes metadata.
    metadata_present_after_copy=[rel(path) for path in RUNTIME.glob('*.meta')]
    sources=[HERE/name for name in ['crystal-turtle.blend','crystal-turtle-review-scene.blend','crystal-turtle-keypose-review.blend',
        'crystal-turtle.glb','inputs/authored-c12b-foundation.blend','inputs/provenance.json','atlas-parameters.json',
        'candidate-manifest.json','round-trip-check.json','animation-clearance.json','review-complete.json',
        'technical-manual-review.json','review_candidate02.py','render-front.png','render-three-quarter.png']]
    sources += [ROOT/'game/art-source/build_crystal_turtle_candidate02.py']
    sources += [p for p in HERE.glob('*.png') if p not in sources]
    receipt={'version':'crystal-sample-02','status':'runtime-candidate-pending-actual-Cocos-review-not-final-art',
        'promoted_at_utc':datetime.now(timezone.utc).isoformat(),'runtime_directory':rel(RUNTIME),
        'expected_runtime_prefab_path':'models/crystal-turtle/crystal-turtle/crystal-turtle',
        'prefab_path_confirmed_in_cocos':False,'runtime_asset_uuid':None,'meta_created_by_promotion':False,
        'metadata_present_after_copy':metadata_present_after_copy,
        'uuid_note':'New species directory; Cocos creates folder/file/subasset UUIDs on first import. No hand-authored metadata.',
        'runtime_files':files,'runtime_fbx_sha256':EXPECTED_FBX,
        'current_editable_source':rel(HERE/'crystal-turtle.blend'),
        'current_generation_script':'game/art-source/build_crystal_turtle_candidate02.py',
        'frozen_source_hashes':{rel(path):sha(path) for path in sources},
        'protected_source_and_runtime_hashes':candidate['protected_inputs'],
        'triangles':technical['triangles'],'weighted_vertices':technical['weighted_vertices'],'bones':technical['bones'],
        'materials':1,'uv_layers':1,'material_name_expected':'CrystalAtlas_01','material_prefix':'CrystalAtlas_',
        'texture_mapping_expected':{
            'mainTexture':{'file':'crystal-colour.png','native_standard_property':'mainTexture'},
            'shininessExponentMap':{'file':'crystal-roughness.png','native_standard_property':'pbrMap'}},
        'material_mapping_confirmed_in_cocos':False,'opaque_material':True,'transmission':0,'alpha':1,
        'blender_coordinates':{'up':'+Z','forward':'-Y'},'fbx_export_coordinates':{'up':'+Y','forward':'-Z'},
        'expected_cocos_forward':'+Z','battle_scale':.65,'foot_origin_y':0,
        'rest_bounds_blender_xyz':technical['rest_bounds_blender_xyz'],
        'expected_rest_bounds_cocos_xyz_unscaled':technical['expected_rest_bounds_cocos_xyz_unscaled'],
        'expected_rest_bounds_cocos_xyz_at_scale_065':technical['expected_rest_bounds_cocos_xyz_at_scale_065'],
        'animation_name_prefix_expected':'CrystalTurtle_Rig|',
        'clips':{name:{'first_frame':clip['first'],'last_frame':clip['last'],'fps':30,'seconds':clip['seconds'],
            'loop_recommended':name in ('idle','rest')} for name,clip in technical['clips'].items()},
        'front_face_half_frame_samples':sum(len(clip['samples']) for clip in clearance['clips'].values()),
        'atlas_source':'Original numeric palette, deterministic noise seed 73161 and analytic UV equations in the independent generation script.',
        'atlas_raster_inputs':[],'approved_views_re_rendered':False,'geometry_changed_since_parent_review':False,
        'blender_processes_exited_before_promotion':True,'cocos_started':False,
        'remaining_review':'Root must inspect actual Cocos import, native material bridge, size/orientation and six clips. User final art acceptance is not implied.'}
    write(RECEIPT,receipt);write(CURRENT,receipt)
    result=verify();write(HERE/'promotion-verification.json',result);return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=('verify','promote'),default='verify',nargs='?')
    print(json.dumps(globals()[parser.parse_args().command](),ensure_ascii=False,indent=2))

