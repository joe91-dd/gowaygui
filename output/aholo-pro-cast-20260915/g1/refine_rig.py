"""Unify skin weights at duplicated UV seam vertices without welding geometry."""
import bpy,sys,json,numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parent
asset=sys.argv[sys.argv.index('--')+1];out=ROOT/'production'/asset
bpy.ops.wm.open_mainfile(filepath=str(out/(asset+'.blend')),load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');body=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
coords=np.array([v.co[:] for v in body.data.vertices]);names=[g.name for g in body.vertex_groups]
w=np.zeros((len(coords),len(names)),dtype=np.float32)
for v in body.data.vertices:
 for g in v.groups:w[v.index,g.group]=g.weight
_,groups,counts=np.unique(np.round(coords,5),axis=0,return_inverse=True,return_counts=True)
sums=np.zeros((len(counts),len(names)),dtype=np.float64);np.add.at(sums,groups,w);w=(sums/counts[:,None])[groups]
for v,row in zip(body.data.vertices,w):
 for g in body.vertex_groups:g.remove([v.index])
 ix=np.argsort(row)[-4:];total=sum(row[k] for k in ix)
 for k in ix:
  if row[k]>.00001:body.vertex_groups[k].add([v.index],float(row[k]/total),'REPLACE')
# Restore an upright tool in the neutral grip; it still moves rigidly with hand.L.
rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
if asset!='yandun':
 hand=rig.pose.bones['hand.L'];worldrot=(rig.matrix_world@hand.matrix).to_quaternion();restrot=(rig.matrix_world@hand.bone.matrix_local).to_quaternion()
 correction=(worldrot@restrot.inverted()).inverted().to_matrix().to_4x4()
 grip=bpy.data.objects.get('FX_Weapon_Grip');pivot=grip.matrix_world.translation.copy()
 transform=Matrix.Translation(pivot)@correction@Matrix.Translation(-pivot)
 targets=[o for o in bpy.data.objects if o.parent==rig and o.parent_type=='BONE' and o.parent_bone=='hand.L' and o!=grip]
 original={o:o.matrix_world.copy() for o in targets}
 for o in targets:o.matrix_world=transform@original[o]
 bpy.context.view_layer.update()
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'}:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/(asset+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(out/(asset+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/(asset+'.blend')))
p=out/'manifest.json';rep=json.loads(p.read_text(encoding='utf8'));rep['coincidentWeightGroups']=int(sum(counts>1));rep['uvSeamWeightsUnified']=True;rep['neutralEquipmentUpright']=True
if asset=='yeling':rep['weaponProvenance']='Blender-authored jade recurved bow replaces malformed AHOLO leaf-bow; source generation preserved separately.'
p.write_text(json.dumps(rep,ensure_ascii=False,indent=2),encoding='utf8')
print('RIG_SEAM_FIX',asset,int(sum(counts>1)))
