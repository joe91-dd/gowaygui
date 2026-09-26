import bpy,sys,json
from pathlib import Path
root=Path(__file__).resolve().parent;a=sys.argv[sys.argv.index('--')+1];out=root/'production'/a
bpy.ops.wm.open_mainfile(filepath=str(root/'hand-study'/a/(a+'.blend')))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.data.objects:
 if ob.type in {'ARMATURE','MESH','EMPTY'}:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/(a+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(out/(a+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/(a+'.blend')))
f=out/'manifest.json';r=json.loads(f.read_text(encoding='utf8'));r['gripSculpt']='curled weapon hand; warrior fists';f.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
print('GRIP_COMMITTED',a)
