"""Promote frozen candidate-02 bytes and record import handoff data.

Run with Blender --background -t 2 --python FILE. This reads source metadata,
never renders, never starts Cocos, and never creates importer UUIDs or .meta.
"""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import shutil
import bpy
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/ink-blob/candidate-02'
FBX=SOURCE/'export/ink-blob.fbx'
DEST=ROOT/'game/assets/resources/models/enemies/ink-blob/ink-blob.fbx'
EXPECTED='3fadf087fdd359486b9cd23b1f9d415f826481d5743c71d95fcbcb7dcc1d08d3'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(FBX)==EXPECTED,'Frozen candidate changed'
if DEST.exists():assert sha(DEST)==EXPECTED,'Runtime destination contains another version; refusing to overwrite'
checks=json.loads((SOURCE/'round-trip-check.json').read_text(encoding='utf-8'))
assert checks['fbx_round_trip']=='pass' and checks['fbx_sha256']==EXPECTED
source_checks=json.loads((SOURCE/'source-check.json').read_text(encoding='utf-8'))
assert source_checks['source_check']=='pass'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'ink-blob-review-scene.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene;scene.render.threads_mode='FIXED';scene.render.threads=2
rig=bpy.data.objects['InkBlob_Rig'];mesh=bpy.data.objects['InkBlob_SkinnedMesh']
rig.animation_data.use_nla=False
def bounds():
    obj=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pts=[obj.matrix_world@v.co for v in obj.data.vertices]
    return {'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)]}
motion={}
for name in ['idle','walk','attack','hit','exit']:
    action=bpy.data.actions[name];rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    lo,hi=map(int,action.frame_range);samples=[]
    for frame in range(lo,hi+1):
        scene.frame_set(frame);bpy.context.view_layer.update();samples.append(bounds())
    motion[name]={'seconds':(hi-lo)/30,'frames':[lo,hi],'loop':name in ['idle','walk'],
        'expected_cocos_take':'InkBlob_Rig|'+name,
        'all_integer_frames_bounds_blender_m':{'min':[min(b['min'][i] for b in samples) for i in range(3)],'max':[max(b['max'][i] for b in samples) for i in range(3)]}}
rig.animation_data.action=bpy.data.actions['idle']
if len(rig.animation_data.action.slots):rig.animation_data.action_slot=rig.animation_data.action.slots[0]
scene.frame_set(1);bpy.context.view_layer.update();rest=bounds()
SCALE=.68
peak_height=max(motion[name]['all_integer_frames_bounds_blender_m']['max'][2] for name in ['idle','walk','attack','hit'])
bar_height=round(peak_height*SCALE+.16,2)
rough=bpy.data.images['InkBlob_Roughness_512'];pix=np.empty(len(rough.pixels),dtype=np.float32);rough.pixels.foreach_get(pix)
rgba=pix.reshape((-1,4));assert np.allclose(rgba[:,0],rgba[:,1]) and np.allclose(rgba[:,1],rgba[:,2]) and np.allclose(rgba[:,3],1)
pngs={}
raw=FBX.read_bytes()
for filename in ['ink-colour.png','ink-roughness.png']:
    path=SOURCE/'export'/filename;content=path.read_bytes();offset=raw.find(content)
    assert offset>=0,'Exact source PNG not found embedded in FBX: '+filename
    pngs[filename]={'sha256':sha(path),'bytes':len(content),'embedded_exact_png_byte_offset':offset}
sources={}
for filename in ['ink-blob.blend','ink-blob-review-scene.blend','ink-blob.glb','model-stats.json','round-trip-check.json','source-check.json']:
    p=SOURCE/filename;sources[filename]={'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size}
DEST.parent.mkdir(parents=True,exist_ok=True)
created=not DEST.exists()
if created:shutil.copy2(FBX,DEST);DEST.touch()
assert sha(DEST)==EXPECTED
manifest={
 'promoted_at_local':datetime.now().astimezone().isoformat(),
 'status':'Approved for this offline sample review; runtime candidate only. First Cocos build and final visual acceptance pending.',
 'enemy_kind':'ink','display_name':'小墨团','candidate':'candidate-02','runtime_file':str(DEST.relative_to(ROOT)),
 'runtime_sha256':sha(DEST),'runtime_bytes':DEST.stat().st_size,'copied_frozen_bytes':True,
 'runtime_file_created_by_this_run':created,'meta_created_by_this_script':False,'cocos_build_started':False,
 'source_fbx':str(FBX.relative_to(ROOT)),'source_fbx_sha256':sha(FBX),'sources':sources,'embedded_pngs':pngs,
 'geometry':{'triangles':7870,'weighted_vertices':3967,'bones':9,'meshes':1,'materials':1},
 'coordinate_handoff':{'source_axes':'Blender Z up / -Y forward','export_axes':'FBX axis_forward=-Z / axis_up=Y',
    'expected_cocos_forward':'+Z, verify after first importer pass','recommended_model_uniform_scale':SCALE,
    'foot_origin_cocos_local_y':0,'ground_position':'Set actor root Y to road surface; levelId=1 road Y=0.064',
    'rest_bounds_blender_m':rest,'rest_height_at_recommended_scale_m':(rest['max'][2]-rest['min'][2])*SCALE,
    'standing_action_peak_height_at_recommended_scale_m':peak_height*SCALE,
    'recommended_health_bar_local_y_on_unscaled_actor':bar_height,
    'recommended_health_bar_local_y_if_parented_under_scaled_model':bar_height/SCALE},
 'clips':motion,
 'expected_import':{'prefab_resource_path':'models/enemies/ink-blob/ink-blob/ink-blob','path_status':'Expected only; inspect generated importer metadata on first build',
    'material_name_prefix':'InkBlob_Toy_Atlas','source_material_name':mesh.data.materials[0].name,
    'effect':'Expected util/dcc/imported-specular-glossiness; confirm actual first import',
    'colour':{'embedded_png':'ink-colour.png','blender_property':'Principled BSDF Base Color','expected_import_property':'mainTexture','native_standard_property':'mainTexture','sampling':'sRGB colour'},
    'roughness':{'embedded_png':'ink-roughness.png','blender_property':'Principled BSDF Roughness','expected_import_property':'shininessExponentMap','native_standard_property':'pbrMap','sampling':'linear data, G=roughness',
       'source_gray_levels_u8':sorted(set(np.rint(rgba[:,0]*255).astype(int).tolist())),'alpha_u8':255},
    'native_standard_starting_values':{'roughness':1,'metallic':0,'occlusion':0,'specularIntensity':.5,'mainColor':[255,255,255,255],'albedoScale':[1,1,1]}},
 'integration_notes':['Do not apply the temporary-enemy procedural shrink/drop on top of this authored exit clip.',
    'Current temporary enemy view disables at 0.55s; authored exit is 0.833s, so keep the visual node until clip completes.',
    'Existing TurtleMaterialAdapter filters StoneAtlas_; InkBlob_Toy_Atlas requires an explicit separate or expanded eligibility check.',
    'Use embedded textures from the imported material first; no duplicate external PNG copies were added to resources.',
    'No importer UUIDs were fabricated. Do not claim Cocos imported/runtime validation before its first build.']}
out=ROOT/'game/art-source/enemies/ink-blob/promotion-manifest.json'
out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'runtime_sha256':sha(DEST),'runtime_file':str(DEST),'scale':SCALE,'rest_height':manifest['coordinate_handoff']['rest_height_at_recommended_scale_m'],
 'peak_height':peak_height*SCALE,'health_bar_offset':bar_height,'material':mesh.data.materials[0].name,'roughness_gray_u8':manifest['expected_import']['roughness']['source_gray_levels_u8']},ensure_ascii=False,indent=2),flush=True)
print('INK_BLOB_RUNTIME_CANDIDATE_PROMOTED_NO_RENDER_NO_COCOS',flush=True)
