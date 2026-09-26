import bpy,sys,pathlib,json
base=pathlib.Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui/output/g1-polish-20260916')
key=sys.argv[sys.argv.index('--')+1];src=base/'characters'/key;out=base/'battle-lod'/key;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src/(key+'.blend')))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None;rig.data.pose_position='REST'
for tr in rig.animation_data.nla_tracks:tr.mute=False
total=sum(len(p.vertices)-2 for o in bpy.data.objects if o.type=='MESH' for p in o.data.polygons)
ratio=min(1,30000/total)
report={'asset':key,'sourceTriangles':0,'runtimeTriangles':0}
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 before=sum(len(p.vertices)-2 for p in o.data.polygons);report['sourceTriangles']+=before
 if before>2500:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Battle_LOD','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
  while o.modifiers[0]!=mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
  bpy.ops.object.modifier_apply(modifier=mod.name);o.data.validate()
  if len(o.vertex_groups):bpy.ops.object.vertex_group_limit_total(limit=4)
 report['runtimeTriangles']+=sum(len(p.vertices)-2 for p in o.data.polygons)
rig.data.pose_position='POSE'
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'}:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/(key+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(out/(key+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
(out/'manifest.json').write_text(json.dumps(report,indent=2));print('LOD_DONE',report)
