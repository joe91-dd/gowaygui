"""Normalize selected CC0 assets, preserving their original skeletons and animation.
The downloaded source models and licence metadata are immutable inputs.
"""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/'fauna-inputs.json').read_text('utf8'))
keys=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [r['key'] for r in manifest]
for key in keys:
 record=next(r for r in manifest if r['key']==key);name=record['name'];height=record['height']
 out=ROOT/'production'/key;out.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=record['path'])
 # Blender imports some glTF joints with wire-only custom shape meshes. They are
 # not visible geometry and must not enlarge the ground/height bounds.
 custom_shapes={b.custom_shape for rig in bpy.context.scene.objects if rig.type=='ARMATURE' for b in rig.pose.bones if b.custom_shape}
 for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
  for bone in rig.pose.bones:bone.custom_shape=None
 for o in list(bpy.context.scene.objects):
  if o in custom_shapes or o.type=='MESH' and not o.data.polygons:bpy.data.objects.remove(o,do_unlink=True)
 items=list(bpy.context.scene.objects);meshes=[o for o in items if o.type=='MESH'];rigs=[o for o in items if o.type=='ARMATURE']
 for rig in rigs:
  if rig.animation_data:
   rig.animation_data.action=None
   for track in rig.animation_data.nla_tracks:track.mute=True
 bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
 corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)])
 scale=height/(hi.z-lo.z);root=bpy.data.objects.new(key,None);bpy.context.collection.objects.link(root)
 for o in items:
  if o.parent is None:o.parent=root
 root.scale=(scale,)*3;root.location=Vector((-(hi.x+lo.x)/2,-(hi.y+lo.y)/2,-lo.z))*scale
 # Rough dielectric surfaces and a shared coastal colour range, without bleaching textures.
 for i,m in enumerate(bpy.data.materials):
  m.name=f'CC0_{key}_{i}'
  if m.use_nodes:
   for node in m.node_tree.nodes:
    if node.type=='BSDF_PRINCIPLED':
     node.inputs['Roughness'].default_value=.76;node.inputs['Metallic'].default_value=0
     if key=='golem':
      # A new stone-guardian material, retaining the CC0 humanoid mesh and rig.
      # Desaturate the palette into blue-grey stone; retain the source light/dark pattern.
      linked=list(node.inputs['Base Color'].links)
      if linked:
       incoming=linked[0].from_socket;tree=m.node_tree;mix=tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='COLOR';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.24,.35,.37,1)
       tree.links.new(incoming,mix.inputs[1]);tree.links.new(mix.outputs[0],node.inputs['Base Color'])
      else:node.inputs['Base Color'].default_value=(.24,.35,.37,1)
      node.inputs['Roughness'].default_value=.9
 for ob in meshes:
  # Keep angular stone and wood planes; smooth only animated organic surfaces.
  if rigs:
   for p in ob.data.polygons:p.use_smooth=True
 # Duplicate source actions under stable runtime names. Source GLBs retain every original clip.
 mapping={'idle':['Idle','Flying_Idle','Swim','Tentacle_Idle'],'walk':['Walk','Fast_Flying','Run','Swim_Fast','Swim','Tentacle_Idle'],'attack':['Sword','Punch','Headbutt','Bite_Front','Swim_Bite','Attack','Tentacle_Attack'],
          'attack2':['Sword','Weapon','Headbutt','Attack2','Punch'],'skill':['Weapon','Sword','Headbutt','Attack2','Punch'],
          'hit':['HitReact','HitRecieve'],'exit':['Death'],'rest':['Death'],'greeting':['Wave','Yes']}
 animation_names=[]
 for rig in rigs:
  if not rig.animation_data:continue
  originals=[s.action for t in rig.animation_data.nla_tracks for s in t.strips]
  if rig.animation_data.action:originals.append(rig.animation_data.action)
  # Action names are preserved by the GLB importer and available even on tracks.
  if not originals:originals=list(bpy.data.actions)
  for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
  for target,candidates in mapping.items():
   source=next((a for c in candidates for a in originals if a.name.split('.')[0]==c),None)
   if not source:continue
   action=source.copy();action.name=target
   track=rig.animation_data.nla_tracks.new();track.name=target
   strip=track.strips.new(target,0,action);strip.action_frame_start=action.frame_range[0];strip.action_frame_end=action.frame_range[1]
   animation_names.append(target)
  rig.animation_data.action=None
 # Ground calibration must use deformed geometry in the actual idle pose.
 # The undeformed glTF accessor bounds may place the pelvis at ground level.
 if rigs:
  for rig in rigs:
   for track in rig.animation_data.nla_tracks:track.mute=True
   rig.animation_data.action=bpy.data.actions.get('idle')
  bpy.context.scene.frame_set(0);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  posed=[]
  for ob in meshes:
   evaluated=ob.evaluated_get(deps);geometry=evaluated.to_mesh()
   visible_vertices={i for face in geometry.polygons for i in face.vertices}
   posed.extend(evaluated.matrix_world@geometry.vertices[i].co for i in visible_vertices)
   evaluated.to_mesh_clear()
  plo=Vector([min(v[i] for v in posed) for i in range(3)]);phi=Vector([max(v[i] for v in posed) for i in range(3)])
  factor=height/max(.0001,phi.z-plo.z);center=Vector(((phi.x+plo.x)/2,(phi.y+plo.y)/2,plo.z))
  root.scale*=factor;root.location=(root.location-center)*factor
  for rig in rigs:
   rig.animation_data.action=None
   for track in rig.animation_data.nla_tracks:track.mute=False
  bpy.context.view_layer.update()
 bpy.context.scene.render.fps=30
 for index,im in enumerate([i for i in bpy.data.images if i.type=='IMAGE' and i.size[0]>0]):
  im.filepath_raw=str(out/(key+f'_texture_{index}.png'));im.file_format='PNG';im.save();im.pack()
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=str(out/(key+'.glb')),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_animations=bool(rigs))
 bpy.ops.export_scene.fbx(filepath=str(out/(key+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=bool(rigs),bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
 # Save an editable source-normalized Blender file before adding a QA stage.
 for rig in rigs:
  for track in rig.animation_data.nla_tracks:track.mute=True
  idle=bpy.data.actions.get('idle');rig.animation_data.action=idle
 bpy.context.scene.frame_set(0);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/(key+'.blend')))
 data={**record,'runtimeKey':key,'height':height,'runtimeAnimations':animation_names,'bones':sum(len(r.data.bones) for r in rigs),'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'changes':['Normalized scale and ground pivot','Stable animation names','Removed importer bone custom-shape meshes before export','Ground and height recalibrated using evaluated idle skinning','Rough coastal materials; source colours retained']}
 (out/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
 print('ANIMATION_REPAIRED '+key,flush=True)
 continue
 # Visual review of exactly the exported source, with its actual skeletal rest pose.
 bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.005));floor=bpy.context.object;m=bpy.data.materials.new('Review_floor');m.diffuse_color=(.58,.66,.62,1);floor.data.materials.append(m);floor.is_shadow_catcher=True
 scene=bpy.context.scene;world=bpy.data.worlds.new('Review_world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
 for loc,energy in [((-3,-4,6),650),((4,2,4),250)]:
  d=bpy.data.lights.new('Area','AREA');d.energy=energy;d.size=4;o=bpy.data.objects.new('Area',d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,height*.5))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',d);bpy.context.collection.objects.link(cam);cam.location=(3,-6,height*1.0+1);cam.rotation_euler=(Vector((0,0,height*.47))-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=max(height*1.4,(hi.x-lo.x)*scale*1.3,(hi.y-lo.y)*scale*1.3);scene.camera=cam
 scene.render.film_transparent=True;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(out/'preview.png');bpy.ops.render.render(write_still=True)
 print('FREE_ASSET_READY '+key,flush=True)
