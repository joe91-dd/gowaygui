import bpy,json,sys,math,time
from pathlib import Path
from mathutils import Vector
def bounds(objects):
 deps=bpy.context.evaluated_depsgraph_get();points=[]
 for o in objects:
  e=o.evaluated_get(deps);me=e.to_mesh();points.extend(e.matrix_world@v.co for v in me.vertices);e.to_mesh_clear()
 return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])
R=Path(__file__).resolve().parent
keys=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [r['key'] for r in [*json.loads((R/'plan.json').read_text('utf8'))['bosses'],*json.loads((R/'plan.json').read_text('utf8'))['world']]]
for key in keys:
 if key in json.loads((R/'remaining.json').read_text('utf8')):
  while True:
   log=(R/'full-batch.log').read_text('utf8',errors='replace')
   if 'FINISHED '+key+' ' in log:break
   if 'FAILED '+key+' ' in log or 'Blender quit' in log:raise RuntimeError('Missing completed master '+key)
   time.sleep(3)
 dest=R/'production'/key;m=json.loads((dest/'manifest.json').read_text('utf8'));
 if m.get('runtimeOptimized'):continue
 bpy.ops.wm.open_mainfile(filepath=str(dest/(key+'.blend')))
 rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 before=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons);limit=42000 if key.startswith('world') else 30000
 for r in rigs:r.data.pose_position='REST'
 for o in meshes:
  n=sum(len(p.vertices)-2 for p in o.data.polygons)
  if n>limit*.92:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   dec=o.modifiers.new('Runtime silhouette budget','DECIMATE');dec.ratio=limit*.90/n;dec.use_collapse_triangulate=True
   while list(o.modifiers).index(dec)>0:bpy.ops.object.modifier_move_up(modifier=dec.name)
   bpy.ops.object.modifier_apply(modifier=dec.name)
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  tri=o.modifiers.new('Explicit tangent triangles','TRIANGULATE')
  while list(o.modifiers).index(tri)>0:bpy.ops.object.modifier_move_up(modifier=tri.name)
  bpy.ops.object.modifier_apply(modifier=tri.name)
 for r in rigs:
  r.data.pose_position='POSE';r.animation_data.action=None
  for t in r.animation_data.nla_tracks:t.mute=False
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:
  if o.type in {'ARMATURE','MESH','EMPTY'}:o.select_set(True)
 bpy.ops.export_scene.fbx(filepath=str(dest/(key+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,use_tspace=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
 bpy.ops.export_scene.gltf(filepath=str(dest/(key+'.glb')),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_animations=True,export_tangents=True)
 for r in rigs:
  for t in r.animation_data.nla_tracks:t.mute=True
  r.animation_data.action=bpy.data.actions.get('idle')
 bpy.context.scene.frame_set(5);bpy.context.view_layer.update()
 scene=bpy.context.scene
 lo,hi=bounds(meshes);center=(lo+hi)/2;height=hi.z-lo.z
 scene.world=bpy.data.worlds.new('Coastal studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.70,.82,.90,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
 for name,at,energy,size,col in [('Warm key',(-3,-4,6),520,4,(1,.87,.70)),('Sky fill',(4,-2,3),380,3,(.65,.84,1)),('Rim',(1,4,5),650,3,(.7,1,1))]:
  d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=Vector(at)*height/2;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Codex camera');cam=bpy.data.objects.new('Codex camera',d);scene.collection.objects.link(cam)
 direction=Vector((.32,-1,.32)).normalized();cam.location=center+direction*height*5;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO'
 inv=cam.matrix_world.inverted();bpy.context.view_layer.update();inv=cam.matrix_world.inverted();pts=[inv@(o.matrix_world@Vector(v)) for o in meshes for v in o.bound_box];d.ortho_scale=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts),height)*1.14
 scene.camera=cam;scene.render.film_transparent=True;scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100;scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.view_settings.view_transform='AgX';scene.render.filepath=str(dest/'portrait.png');bpy.ops.render.render(write_still=True)

 m['masterTriangles']=before;m['triangles']=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons);m['runtimeOptimized']=True;m['tangentsExported']=True
 (dest/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8');print('OPTIMIZED',key,before,m['triangles'],flush=True)
