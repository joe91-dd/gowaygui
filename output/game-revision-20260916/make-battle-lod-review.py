import bpy,sys,pathlib,json
base=pathlib.Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui/output/g1-polish-20260916')
key=sys.argv[sys.argv.index('--')+1];src=base/'characters'/key;out=base.parent/'game-revision-20260916'/'battle-lod'/key;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src/(key+'.blend')))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None;rig.data.pose_position='REST'
for tr in rig.animation_data.nla_tracks:tr.mute=False
total=sum(len(p.vertices)-2 for o in bpy.data.objects if o.type=='MESH' for p in o.data.polygons)
ratio=min(1,11000/total)
report={'asset':key,'sourceTriangles':0,'runtimeTriangles':0}
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 before=sum(len(p.vertices)-2 for p in o.data.polygons);report['sourceTriangles']+=before
 if before>300:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000015);bpy.ops.object.mode_set(mode='OBJECT')
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

from mathutils import Vector
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');scene=bpy.context.scene;scene.frame_set(0);scene.render.engine='CYCLES'
bpy.ops.wm.save_as_mainfile(filepath=str(out/(key+'.blend')))

scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.76,.83,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
for name,loc,power,size,col in [('Key',(-3,-4,6),600,5,(1,.93,.82)),('Fill',(4,-2,4),220,4,(.78,.9,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=3.25;scene.camera=cam;cam.location=(2,-6,2.8);cam.rotation_euler=(Vector((0,0,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(out/'review.png');bpy.ops.render.render(write_still=True)
print('LOD_REVIEW',key,flush=True)
