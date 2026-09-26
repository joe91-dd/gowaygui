"""Non-destructive game LOD. No welding: keep the generated UV seam vertices.
Faces and hand silhouettes receive a lower collapse weight than shell/clothing.
The untouched high-resolution rig and textures remain in production/.
"""
import bpy, sys, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
asset=sys.argv[sys.argv.index('--')+1]
src=ROOT/'production'/asset; out=ROOT/'runtime'/asset;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src/(asset+'.blend')),load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=True
for pb in rig.pose.bones:pb.matrix_basis.identity()
bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
report={'asset':asset,'meshes':[],'sourcePreserved':True,'uvSeamsWelded':False}
for obj in list(bpy.data.objects):
 if obj.type!='MESH' or len(obj.data.polygons)<1500:continue
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 before=sum(len(p.vertices)-2 for p in obj.data.polygons)
 group=obj.vertex_groups.new(name='LOD_Surface_Preservation')
 isbody='_Body' in obj.name
 for v in obj.data.vertices:
  x,y,z=v.co
  face=isbody and z>1.35 and y<-.13 and abs(x)<.49
  hand=isbody and z<1.20 and z>.62 and abs(x)>.77
  group.add([v.index],.025 if face else .16 if hand else 1,'REPLACE')
 mod=obj.modifiers.new('Game_LOD_Preserve_UV','DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=.37 if isbody else .32
 mod.vertex_group=group.name;mod.vertex_group_factor=12;mod.use_collapse_triangulate=True
 # Evaluate reduction before skinning. Applying only this modifier retains the rig.
 while list(obj.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
 bpy.ops.object.modifier_apply(modifier=mod.name);obj.vertex_groups.remove(obj.vertex_groups.get(group.name))
 # Retain at most four deform influences after collapsing vertices.
 deform={g.index for g in obj.vertex_groups if g.name in rig.data.bones}
 for v in obj.data.vertices:
  ws=sorted([(g.group,g.weight) for g in v.groups if g.group in deform],key=lambda x:-x[1]);total=sum(w for _,w in ws[:4])
  for gi,_ in ws[4:]:obj.vertex_groups[gi].remove([v.index])
  for gi,w in ws[:4]:obj.vertex_groups[gi].add([v.index],w/max(total,1e-8),'REPLACE')
 after=sum(len(p.vertices)-2 for p in obj.data.polygons)
 report['meshes'].append({'name':obj.name,'sourceTriangles':before,'runtimeTriangles':after})
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
 if obj.type in {'ARMATURE','MESH','EMPTY'}:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/(asset+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(out/(asset+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/(asset+'.blend')))
report['runtimeTriangles']=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
(out/'lod-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('GAME_LOD_COMPLETE',json.dumps(report))
