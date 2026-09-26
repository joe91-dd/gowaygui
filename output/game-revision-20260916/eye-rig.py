import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');OUT=ROOT/'output/game-revision-20260916/eyes';OUT.mkdir(exist_ok=True)
key=sys.argv[sys.argv.index('--')+1];folder=OUT/key;folder.mkdir(exist_ok=True)
info=next(x for x in json.loads((ROOT/'output/game-revision-20260916/rig-review/inspection.json').read_text()) if x['key']==key)
anchors={'yandun':[(194,221,25,23),(310,221,25,23)],'yeling':[(184,286,24,25),(289,285,24,25)],'shange':[(195,269,26,24),(318,269,26,24)],'yangguang':[(208,298,25,25),(302,298,25,25)],'chaoxing':[(178,311,28,20),(327,311,28,20)]}
colours={'yandun':('#E4B35F','#AF7132'),'yeling':('#E0BE69','#96772A'),'shange':('#96CBD0','#2B77B9'),'yangguang':('#E5C273','#A15A39'),'chaoxing':('#A1C4D9','#7755B3')}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/g1-polish-20260916/characters'/key/(key+'.blend')),load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');body=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis.identity()
rig.data.pose_position='REST';bpy.context.view_layer.update()
def rgb(h):
 a=[int(h[i:i+2],16)/255 for i in (1,3,5)];return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)+(1,)
def mat(name,colour,rough):
 m=bpy.data.materials.new('G1_'+name+'_'+key);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=rgb(colour);p.inputs['Roughness'].default_value=rough;return m
skin=mat('Lid',colours[key][0],.65);white=mat('Sclera','#E8EDE1',.20);iris=mat('Iris',colours[key][1],.21);pupil=mat('Pupil','#101D23',.12);edge=mat('IrisRim','#3F382C',.22)
centers=[];definitions=[];parts=[];scale=max(info['headMax'][0]-info['headMin'][0],info['headMax'][2]-info['headMin'][2])*1.45
for side,(px,py,rx,rz) in zip(['R','L'],anchors[key]):
 x=info['center'][0]+(px-256)/512*scale;z=info['center'][2]+(256-py)/512*scale
 hit,loc,normal,index=body.ray_cast(Vector((x,-5,z)),Vector((0,1,0)))
 if not hit:raise RuntimeError('eye ray missed '+side)
 rz=rz/512*scale;rx=rx/512*scale;center=Vector((x,loc.y+rz*.77,z));radii=Vector((rx,rz,rz))
 centers.append((side,center,radii));
 for suffix in ['eye','lidUpper','lidLower']:
  name=suffix+'.'+side;definitions.append((name,center,center+Vector((0,0,.04)),'head'))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name,a,b,parent in definitions:
 bone=rig.data.edit_bones.get(name) or rig.data.edit_bones.new(name);bone.head=a;bone.tail=b;bone.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
def mesh_part(name,vs,faces,material,bone):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 group=o.vertex_groups.new(name=bone);group.add(list(range(len(vs))),1,'REPLACE');mod=o.modifiers.new('Eye skin','ARMATURE');mod.object=rig;o.parent=rig;parts.append(o);return o
for side,c,r in centers:
 # True ellipsoidal globe; moving iris caps and pupil share an eyeball joint.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=c);o=bpy.context.object;o.name='EyeBall_'+side;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 # Bake object transform to mesh in rig coordinates.
 for v in o.data.vertices:v.co+=c
 o.location=(0,0,0);o.data.materials.append(white)
 for p in o.data.polygons:p.use_smooth=True
 g=o.vertex_groups.new(name='eye.'+side);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Eye skin','ARMATURE');mod.object=rig;o.parent=rig;parts.append(o)
 # Preserve the approved painted iris by projecting its original UVs onto the new globe.
 material=body.data.materials[0].copy();material.name='G1_EyeSurface_'+key
 if material.use_nodes:
  bs=material.node_tree.nodes.get('Principled BSDF')
  if bs:bs.inputs['Roughness'].default_value=.22
 vs=[];faces=[];tex=[]
 body.data.calc_loop_triangles()
 triangles={}
 for tri in body.data.loop_triangles:triangles.setdefault(tri.polygon_index,[]).append(tri)
 for j in range(10):
  t=1.48*j/9
  for i in range(40):
   angle=i/40*math.tau;p=c+Vector((r.x*math.sin(t)*math.cos(angle),-r.y*math.cos(t)-.001,r.z*math.sin(t)*math.sin(angle)));vs.append(tuple(p))
   hit,loc,normal,face=body.ray_cast(Vector((p.x,-5,p.z)),Vector((0,1,0)));uv=Vector((0,0))
   if hit:
    tri=triangles[face][0];aa,bb,cc=[body.data.vertices[k].co for k in tri.vertices];v0=bb-aa;v1=cc-aa;v2=loc-aa;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);den=d00*d11-d01*d01
    if abs(den)>1e-15:
     v=(d11*v2.dot(v0)-d01*v2.dot(v1))/den;w=(d00*v2.dot(v1)-d01*v2.dot(v0))/den;u=1-v-w
     uv=sum((body.data.uv_layers.active.data[k].uv*f for k,f in zip(tri.loops,[u,v,w])),Vector((0,0)))
   tex.append(tuple(uv))
   if j:
    b=j*40+i;n=j*40+(i+1)%40;faces.append((b-40,n-40,n,b))
 front=mesh_part('Eye_Surface_'+side,vs,faces,material,'eye.'+side);uv=front.data.uv_layers.new(name='UVMap')
 for poly in front.data.polygons:
  for li in poly.loop_indices:uv.data[li].uv=tex[front.data.loops[li].vertex_index]
 for upper in [True,False]:
  vs=[];faces=[];limit=math.radians(90)
  for j in range(10):
   t=limit*j/9
   for i in range(32):
    a=i/32*math.tau;sgn=1 if upper else -1
    vs.append(tuple(c+Vector(((r.x+.0028)*math.sin(t)*math.cos(a),(r.y+.003)*math.sin(t)*math.sin(a),sgn*(r.z+.003)*math.cos(t)))))
    if j:
     b=j*32+i;n=j*32+(i+1)%32;faces.append((b-32,n-32,n,b) if upper else (b,n,n-32,b-32))
  mesh_part(('UpperLid_' if upper else 'LowerLid_')+side,vs,faces,skin,('lidUpper.' if upper else 'lidLower.')+side)
# Join per material into one skinned object; Blender exporter keeps four weights maximum.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();eyes=bpy.context.object;eyes.name='G1_Eyes_Lids_'+key
# Rest skeleton axes point up Z; a rotation about local X closes both caps.
rig.data.pose_position='POSE'
for name,_,_,_ in definitions:rig.pose.bones[name].rotation_mode='XYZ'
# Add continuous short blinks and tiny saccades to authored clips.
for action in list(bpy.data.actions):
 if action.name not in ['idle','walk','attack','attack2','skill','greeting','hit','rest','exit']:continue
 rig.animation_data.action=action;end=int(action.frame_range[1]);frames=sorted(set([0,end,max(1,int(end*.61)),max(2,int(end*.61)+2),max(3,int(end*.61)+3),min(end,int(end*.61)+6)]))
 for f in frames:
  bpy.context.scene.frame_set(f);blink=1 if f in [int(end*.61)+2,int(end*.61)+3] and action.name in ['idle','greeting','rest'] else 0
  for side,c,r in centers:
   for label,sgn in [('lidUpper',1),('lidLower',-1)]:
    pb=rig.pose.bones[label+'.'+side];pb.rotation_euler=(math.radians(-60+60*blink)*sgn,0,0);pb.keyframe_insert('rotation_euler',frame=f)
   pb=rig.pose.bones['eye.'+side];pb.rotation_euler=(0,0,math.radians(1.6)*math.sin(f/max(end,1)*math.tau));pb.keyframe_insert('rotation_euler',frame=f)
 for fc in action.fcurves:
  if any(x in fc.data_path for x in ['lidUpper','lidLower','eye.']):
   for kp in fc.keyframe_points:kp.interpolation='BEZIER';kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis.identity()
# Inspection scene uses the same framing as source comparisons.
scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.64,.72,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
center=Vector(info['center'])
for name,loc,power,size,col in [('Key',(-3,-4,6),450,4,(1,.94,.85)),('Fill',(4,-3,4),300,4,(.8,.92,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=scale;scene.camera=cam;cam.location=(0,-6,center.z);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
for name,angle in [('open',-60),('closed',0)]:
 for side,c,r in centers:
  rig.pose.bones['lidUpper.'+side].rotation_euler.x=math.radians(angle);rig.pose.bones['lidLower.'+side].rotation_euler.x=-math.radians(angle)
 bpy.context.view_layer.update();scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
for pb in rig.pose.bones:pb.matrix_basis.identity()
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in {'ARMATURE','MESH','EMPTY'}:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(folder/(key+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(folder/(key+'.blend')))
(folder/'eye-rig.json').write_text(json.dumps({'asset':key,'bones':len(rig.data.bones),'eyeCenters':[{ 'side':side,'center':list(c),'radii':list(r)} for side,c,r in centers],'note':'New independent globe, iris and upper/lower eyelid geometry; source face retained for comparison. Inspect before integrating.'},indent=2))
print('EYE_SAMPLE_COMPLETE',key,flush=True)
