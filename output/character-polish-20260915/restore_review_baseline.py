"""Restore the five saved pre-experiment sources after visual rejection.
Only works on the explicitly named cast directory; the running web build stays intact.
"""
import bpy,sys,json,shutil
from pathlib import Path
HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[1]
SOURCE=PROJECT/'game/art-source/approved-cast'
sys.path.insert(0,str(SOURCE))
import build_cast as C
roles=[a for a in sys.argv[sys.argv.index('--')+1:] if a in C.ROLES]
for role in roles:
    archived=HERE/'unapproved-attempt'/role/(role+'.blend1')
    out=SOURCE/role;runtime=PROJECT/'game/assets/resources/models-approved'/role
    if not archived.is_file():raise FileNotFoundError(archived)
    bpy.ops.wm.open_mainfile(filepath=str(archived))
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    if len(rigs)!=1:raise RuntimeError('Expected one original rig')
    rig=rigs[0];parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==rig]
    if len(parts)<20:raise RuntimeError('Expected editable original character parts')
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(role+'.blend')))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();body=bpy.context.object;body.name=role.title()+'ApprovedSkin'
    lod=body.modifiers.new('Runtime triangle budget','DECIMATE');lod.ratio=.46;lod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=lod.name)
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.fbx(filepath=str(runtime/(role+'.fbx')),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
    bpy.ops.export_scene.gltf(filepath=str(out/(role+'.glb')),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
    stats=json.loads((out/'manifest.json').read_text(encoding='utf8'))
    for k in ['surfaceMaps','surfaceResolution','surfaceUV']:stats.pop(k,None)
    stats.update(triangles=sum(len(p.vertices)-2 for p in body.data.polygons),vertices=len(body.data.vertices),weightedVertices=sum(bool(v.groups) for v in body.data.vertices),status='Restored pre-experiment candidate; not approved as commercial-final')
    (out/'manifest.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
    C.scene_review(role,rig,out)
    print('BASELINE_RESTORED',role,stats['triangles'],flush=True)
