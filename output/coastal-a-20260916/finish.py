"""Coastal fauna production pass. Original CC0 inputs remain immutable.
Rebuilds the eyes, skin palette, weighted armour and baked mobile atlases.
The same exported rig is used for combat and the catalogue portrait.
"""
import bpy,math,json,sys,colorsys,time
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parent
PLAN=json.loads((R/'plan.json').read_text('utf8'))
ROOT=R.parents[1]
OLD=R.parent/'g1-polish-20260916/production'
WORLD_TONES={'world-0':('#398F9F','#214961','#71D8DD'),'world-1':('#8A4433','#493D40','#FF9B40'),'world-2':('#546FAA','#203D62','#B2C9FA'),'world-3':('#406B7B','#3D535C','#85E1F1'),'world-4':('#3889AA','#173D58','#6DDAED')}
PALETTES=['#347F78','#387897','#78679D','#B28741','#AC5143','#346575','#57A7B0']
def linear(c):
 c=c/255;return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)) for i in (1,3,5))+(1,)
def material(name,h,rough=.64,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgb(h);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;m.diffuse_color=rgb(h);return m
def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']
def comp(mesh,indices):
 ids=set(indices);adj={i:set() for i in ids}
 for e in mesh.edges:
  a,b=e.vertices
  if a in ids and b in ids:adj[a].add(b);adj[b].add(a)
 result=[]
 while ids:
  stack=[ids.pop()];part=[]
  while stack:
   i=stack.pop();part.append(i)
   for j in adj[i]:
    if j in ids:ids.remove(j);stack.append(j)
  result.append(part)
 return result
def bounds(objects,evaluated=True):
 deps=bpy.context.evaluated_depsgraph_get();points=[]
 for o in objects:
  e=o.evaluated_get(deps) if evaluated else o
  me=e.to_mesh() if evaluated else e.data
  points.extend(e.matrix_world@v.co for v in me.vertices)
  if evaluated:e.to_mesh_clear()
 return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])
def skin(o,rig,bone):
 bpy.context.view_layer.update()
 world=o.matrix_world.copy();o.parent=rig;o.matrix_world=world
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Coastal rigid skin','ARMATURE');mod.object=rig
 for p in o.data.polygons:p.use_smooth=True
 return o
def ellipsoid(name,at,scale,mat,rig,bone,segments=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=8,radius=1,location=at);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);skin(o,rig,bone);return o
def spike(name,start,end,radius,mat,rig,bone):
 d=Vector(end)-Vector(start);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=radius,radius2=.008,depth=d.length,location=(Vector(start)+Vector(end))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);skin(o,rig,bone);return o
def ribbon(name,points,width,mat,rig,bone):
 vs=[]
 for i,p in enumerate(points):
  p=Vector(p);vs.extend([tuple(p+Vector((0,.003,width/2))),tuple(p-Vector((0,.003,width/2)))])
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)]);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return skin(o,rig,bone)
exec((R/'detail_pass.py').read_text('utf8'),globals())
exec((R/'atlas_face.py').read_text('utf8'),globals())

def run(record):
 started=time.time();key=record['key'];boss=key.startswith(('boss','world'));world=key.startswith('world');idx=record.get('base',int(key.split('-')[1]) if key.startswith('fauna') else 0);src=PLAN['fauna'][idx];tier=record.get('tier',0);dest=R/'production'/key;dest.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.open_mainfile(filepath=str(OLD/src['key']/(src['key']+'.blend')))
 scene=bpy.context.scene;scene.render.fps=30;scene.render.threads_mode='FIXED';scene.render.threads=4
 rigs=[o for o in scene.objects if o.type=='ARMATURE'];rig=rigs[0];root=next(o for o in scene.objects if o.type=='EMPTY' and o.parent is None)
 root.name=key
 for r in rigs:
  if r.animation_data:
   r.animation_data.action=None
   for t in r.animation_data.nla_tracks:t.mute=True
  r.data.pose_position='REST'
 bpy.context.view_layer.update();source_objects=set(meshes())
 # Restore semantic material names from the immutable glTF; the earlier pass
 # replaced them with numeric IDs and lost the distinction between eyes and skin.
 import struct
 data=Path(src['path']).read_bytes();gltf=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]].decode())
 original=gltf.get('materials',[])
 for m in list(bpy.data.materials):
  if not m.use_nodes:continue
  p=m.node_tree.nodes.get('Principled BSDF')
  if not p:continue
  c=p.inputs['Base Color'].default_value
  match=min(original,key=lambda n:sum((n.get('pbrMetallicRoughness',{}).get('baseColorFactor',[.8,.8,.8,1])[j]-c[j])**2 for j in range(3)))
  m.name='Source_'+match.get('name','Skin')
 # Warm, bright, controlled colours in linear space; never apply whole-body emission.
 for m in list(bpy.data.materials):
  if not m.use_nodes:continue
  p=m.node_tree.nodes.get('Principled BSDF')
  if not p:continue
  n=m.name.lower();p.inputs['Roughness'].default_value=.59
  if 'eye_white' in n:p.inputs['Base Color'].default_value=rgb('#F7EBCF');p.inputs['Roughness'].default_value=.28
  elif 'eye_black' in n:p.inputs['Base Color'].default_value=rgb('#142C34');p.inputs['Roughness'].default_value=.23
  elif 'gold' in n:p.inputs['Base Color'].default_value=rgb('#DDBA73');p.inputs['Roughness'].default_value=.4;p.inputs['Metallic'].default_value=.35
  elif 'tongue' in n or 'mouth' in n:p.inputs['Base Color'].default_value=rgb('#8F5363')
  elif 'horn' in n or 'teeth' in n:p.inputs['Base Color'].default_value=rgb('#E9D9AE');p.inputs['Roughness'].default_value=.56
  elif not p.inputs['Base Color'].is_linked:
   c=p.inputs['Base Color'].default_value;h,s,v=colorsys.rgb_to_hsv(*c[:3]);s=min(.72,s*.90);v=min(.79,v*1.42+.045);c=colorsys.hsv_to_rgb(h,s,v)
   if False:
    accent=rgb(PALETTES[tier]);c=tuple(c[i]*.38+accent[i]*.62 for i in range(3))
   p.inputs['Base Color'].default_value=(*c,1)
  if world and not p.inputs['Base Color'].is_linked and any(v in n for v in ['main','hair','secondary']):
   p.inputs['Base Color'].default_value=rgb(WORLD_TONES[key][1 if 'secondary' in n or 'hair' in n else 0])
  if 'eye' not in n:
   # Broad painted value variation, baked offline; no procedural runtime shaders.
   tree=m.node_tree;nodes=tree.nodes;source=p.inputs['Base Color'].links[0].from_socket if p.inputs['Base Color'].is_linked else None
   base=tuple(p.inputs['Base Color'].default_value)
   tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=9;tex.inputs['Detail'].default_value=1;tex.inputs['Roughness'].default_value=.35
   ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.86,.86,.86,1);ramp.color_ramp.elements[1].color=(1,1,1,1);tree.links.new(tex.outputs['Fac'],ramp.inputs[0])
   mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=base
   if source:tree.links.new(source,mul.inputs[1])
   tree.links.new(ramp.outputs[0],mul.inputs[2]);
   ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.16;ao.samples=8
   shade=nodes.new('ShaderNodeMixRGB');shade.blend_type='MULTIPLY';shade.inputs[0].default_value=.23;tree.links.new(mul.outputs[0],shade.inputs[1]);tree.links.new(ao.outputs['Color'],shade.inputs[2]);tree.links.new(shade.outputs[0],p.inputs['Base Color'])
 soften_source(source_objects,rig,world)
 atlas_face(source_objects,rig,idx)
 # Author eye shape in geometry, with iris, pupil, catchlight and an upper brow.
 iris=material('Iris','#CCAA56',.29);pupil=material('Pupil','#0C2730',.23);shine=material('Eye_catchlight','#FFF8E2',.2);brow=material('Brow','#29444D',.73)
 for o in list(meshes()):
  slots=[i for i,m in enumerate(o.data.materials) if m and 'eye_black' in m.name.lower()]
  for slot in slots:
   ids={v for p in o.data.polygons if p.material_index==slot for v in p.vertices}
   for group in comp(o.data,ids):
    if len(group)<4:continue
    pts=[o.data.vertices[i].co for i in group];lo=Vector([min(v[j] for v in pts) for j in range(3)]);hi=Vector([max(v[j] for v in pts) for j in range(3)]);size=hi-lo;c=(lo+hi)/2
    if size.x<.03 or size.z>size.x*1.4 or c.y>0:continue
    if idx not in [0,7,8,12,24,25,26,39] and abs(c.x)<size.x*.4:continue
    # Original half-shut horizontal pupils are opened while retaining the face.
    for i in group:o.data.vertices[i].co.z=c.z+(o.data.vertices[i].co.z-c.z)*1.32
    weights={}
    for i in group:
     for g in o.data.vertices[i].groups:weights[o.vertex_groups[g.group].name]=weights.get(o.vertex_groups[g.group].name,0)+g.weight
    bone=max(weights,key=weights.get) if weights else 'Head';at=o.matrix_world@c;s=o.matrix_world.to_scale().x;radius=size.x*s*.49
    at.y-=max(size.y*s*.4,.008)
    ellipsoid('Iris lens',at,(radius,.012*s,radius*.95),iris,rig,bone)
    ellipsoid('Pupil lens',at+Vector((0,-.011*s,0)),(radius*.47,.015*s,radius*.76),pupil,rig,bone)
    ellipsoid('Catchlight',at+Vector((-radius*.22,-.020*s,radius*.35)),(radius*.16,.009*s,radius*.20),shine,rig,bone,12)
    side=1 if c.x>0 else -1
    ribbon('Focused brow',[at+Vector((-radius*1.15,-.006,radius*(1.05+side*.20))),at+Vector((0,-.025,radius*1.20)),at+Vector((radius*1.15,-.006,radius*(1.05-side*.20)))],radius*.23,brow,rig,bone)
 # Rigid skinning: trim pieces share the existing rig and cannot drift off the body.
 lo,hi=bounds(meshes(),False);height=hi.z-lo.z;width=hi.x-lo.x;depth=hi.y-lo.y;mid=(lo+hi)/2
 def bonepos(names,fallback):
  b=next((rig.data.bones.get(n) for n in names if rig.data.bones.get(n)),None)
  return (rig.matrix_world@b.head_local,b.name) if b else (Vector(fallback),'Head' if rig.data.bones.get('Head') else rig.data.bones[0].name)
 chest,chestbone=bonepos(['Torso','Body','Head'],(mid.x,mid.y,lo.z+height*.46));head,headbone=bonepos(['Head'],(mid.x,mid.y,lo.z+height*.72))
 accent=material('Coastal_Enamel',WORLD_TONES[key][1] if world else ['#244B60','#27475D','#34585D'][idx%3],.42)
 gold=material('Coastal_Brass','#D7AF68',.38,.52);ivory=material('Coastal_Ivory','#E4D6B4',.63)
 gem=material('CC0_Gem_'+key,(WORLD_TONES[key][2] if world else ['#76CBBF','#83C9E0','#AD99D4','#F4D288','#EC8B77','#8DCFD2','#83DBE0'][tier]),.23,.10)
 shell=material('Coastal_Leather','#354F61',.76)
 # Coastal insignia, scale-mail shoulders and fitted rim, proportional to each body.
 bulky=idx<17;z=lo.z+height*(.15 if bulky else .43);y=mid.y-depth*.33
 ellipsoid('Breastplate',(mid.x,y,z),(height*(.30 if bulky else .16),height*.046,height*(.12 if bulky else .09)),accent,rig,chestbone)
 ellipsoid('Breastplate rim',(mid.x,y+.006,z),(height*(.32 if bulky else .178),height*.040,height*(.134 if bulky else .105)),gold,rig,chestbone)
 ellipsoid('Sea-glass insignia',(mid.x,y-height*.045,z),(height*.035,height*.018,height*.055),gem,rig,chestbone,12)
 if idx>=36:
  for side in ['L','R']:
   at,bn=bonepos(['UpperArm.'+side,'Shoulder.'+side],(mid.x+(-1 if side=='R' else 1)*width*.25,mid.y,lo.z+height*.57))
   size=height*(.095 if not boss else .14)
   ellipsoid('Shoulder bronze rim',at,(size*1.1,size*.86,size*.72),gold,rig,bn)
   ellipsoid('Shoulder enamel',at+Vector((0,-size*.08,size*.08)),(size,size*.85,size*.68),accent,rig,bn)
   if boss and idx not in [55,16]:spike('Reef shoulder crest',at+Vector((0,0,size*.3)),at+Vector(((-1 if side=='R' else 1)*size*.45,0,size*1.7)),size*.35,ivory,rig,bn)
 elif bulky:
  # Orb species keep their original silhouettes, but gain small grounded fins/paws.
  for side in [-1,1]:
   at=Vector((mid.x+side*width*.29,mid.y-depth*.18,lo.z+height*.035))
   ellipsoid('Coastal small foot',at,(height*.11,height*.15,height*.055),accent,rig,chestbone)
 if boss:
  # Each tier develops crown, shell plates and gemstones; silhouettes change with rank.
  # A rear crest grows from the carapace; never float a generic crown above a fin.
  if idx not in [58,55,16]:
   for j in range(3):
    x=mid.x+(j-1)*height*.08
    start=Vector((x,mid.y+depth*.17,lo.z+height*.72));end=start+Vector(((x-mid.x)*.32,height*.06,height*(.14+(j==1)*.035)))
    ellipsoid('Crest root',start,(height*.064,height*.07,height*.06),accent,rig,headbone)
    spike('Tidal crest',start,end,height*.042,ivory,rig,headbone)
  for j in range(3+(tier>=3)*2):
   x=mid.x+(j-(1 if tier<3 else 2))*height*.105;at=Vector((x,mid.y+depth*.26,lo.z+height*.49))
   ellipsoid('Carapace scale',at,(height*.11,height*.09,height*.20),accent,rig,chestbone)
   if tier>=2:spike('Back crystal',at+Vector((0,0,height*.12)),at+Vector((0,height*.10,height*.35)),height*.050,gem,rig,chestbone)
  if world and idx not in [30,33,55,16]:
   # World bosses have a broad chest guard and crown gem, not a generic giant aura.
   for side in [-1,1]:
    spike('World crest',head+Vector((side*height*.14,0,height*.24)),head+Vector((side*height*.28,height*.04,height*.45)),height*.07,ivory,rig,headbone)
   ellipsoid('World crown heart',head+Vector((0,-height*.13,height*.13)),(height*.065,height*.034,height*.09),gem,rig,headbone,12)
 # Signature equipment encodes the boss's threat in its silhouette.
 if boss:
  ability=record.get('ability','breakwater')
  if idx>=36 and (ability in ['breakwater','shock'] or any(c in record.get('name','') for c in ['钳','虾'])):
   for side in [-1,1]:
    at,bn=bonepos(['Middle1.'+('L' if side>0 else 'R'),'LowerArm.'+('L' if side>0 else 'R')],(mid.x+side*width*.47,mid.y-depth*.08,lo.z+height*.34))
    r=height*.115
    ellipsoid('Armoured pincer cuff',at,(r,r*.90,r*1.1),accent,rig,bn)
    for split in [-1,1]:
     start=at+Vector((split*r*.56,-r*.5,0));tip=at+Vector((split*r*.28,-r*2.2,r*.35))
     spike('Curved pincer',start,tip,r*.53,ivory,rig,bn)
  if ability=='mortar' and idx>=36:
   at,bn=bonepos(['Shoulder.R','Torso','Head'],(mid.x-width*.2,mid.y,lo.z+height*.56));at+=Vector((0,0,height*.13))
   ellipsoid('Shoulder cannon housing',at,(height*.11,height*.17,height*.10),shell,rig,bn)
   ellipsoid('Bronze muzzle',at+Vector((0,-height*.16,0)),(height*.08,height*.022,height*.08),gold,rig,bn)
   ellipsoid('Dark bore',at+Vector((0,-height*.182,0)),(height*.055,height*.014,height*.055),pupil,rig,bn)
  if ability in ['drain','frost','rally'] and idx>=36:
   at,bn=bonepos(['Middle1.L','LowerArm.L','Head'],(mid.x+width*.34,mid.y,lo.z+height*.5))
   start=at-Vector((0,0,height*.21));end=at+Vector((0,0,height*.25))
   spike('Tide sceptre shaft',start,end,height*.020,gold,rig,bn)
   ellipsoid('Tide sceptre crown',end,(height*.065,height*.052,height*.065),accent,rig,bn)
   spike('Sceptre sea-glass',end,end+Vector((0,0,height*.15)),height*.06,gem,rig,bn)
 if boss or idx>=36:add_fine_details(record,rig,locals())
 # Consolidate all opaque pieces to one skinned mesh, keeping the emissive insets separate.
 if idx==27:
  for o in list(meshes()):
   if o not in source_objects:bpy.data.objects.remove(o,do_unlink=True)
 allmeshes=meshes();gemmeshes=[o for o in allmeshes if len(o.data.materials)==1 and o.data.materials[0]==gem];opaque=[o for o in allmeshes if o not in gemmeshes]
 def join(objects,name):
  if not objects:return None
  bpy.ops.object.select_all(action='DESELECT')
  # Bake bone-parented held objects into rig space, with rigid skin weights.
  for o in objects:
   if o.parent_type=='BONE':
    bn=o.parent_bone;w=o.matrix_world.copy();o.parent_type='OBJECT';o.parent=rig;o.matrix_world=w;skin(o,rig,bn)
   o.select_set(True)
  base=next((o for o in objects if any(m.type=='ARMATURE' for m in o.modifiers)),objects[0]);bpy.context.view_layer.objects.active=base;bpy.ops.object.join();base.name=name
  return base
 body=join(opaque,'CoastalBody_'+key);crystals=join(gemmeshes,'CoastalInlays_'+key)
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
 # Mobile delivery geometry is budgeted before UV baking, so maps match the shipped mesh.
 master_triangles=sum(len(p.vertices)-2 for o in meshes() for p in o.data.polygons)
 target=36000 if world else 24500 if boss else 14000
 current=sum(len(p.vertices)-2 for p in body.data.polygons)
 if current>target:
  mod=body.modifiers.new('Coastal A runtime budget','DECIMATE');mod.ratio=target/current
  while list(body.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
  bpy.ops.object.modifier_apply(modifier=mod.name)
 for o in meshes():
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Stable tangent triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.objects.active=body
 # Fresh non-overlapping UVs allow original textures and painted colours to share one atlas.
 uv=body.data.uv_layers.new(name='CoastalAtlas');body.data.uv_layers.active=uv;uv.active_render=True
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.016);bpy.ops.object.mode_set(mode='OBJECT')
 resolution=1024 if world else 768 if boss else 512
 scene.render.engine='CYCLES';scene.cycles.samples=4;scene.render.bake.margin=8
 normal_map,surface_map=bake_detail_maps(body,dest,key,resolution)
 image=bpy.data.images.new('CC0_Coastal_'+key,width=resolution,height=resolution,alpha=False);image.generated_color=(.2,.3,.3,1)
 scene.render.engine='CYCLES';scene.cycles.samples=4;scene.cycles.bake_type='DIFFUSE';scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8
 for m in body.data.materials:
  if not m or not m.use_nodes:continue
  # Pin any original atlas lookup to its old UV map before assigning the new bake map.
  for n in list(m.node_tree.nodes):
   if n.type=='TEX_IMAGE' and not n.inputs['Vector'].is_linked:
    uvnode=m.node_tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map=body.data.uv_layers[0].name;m.node_tree.links.new(uvnode.outputs[0],n.inputs['Vector'])
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.nodes.active=n
 bpy.ops.object.bake(type='DIFFUSE')
 image.filepath_raw=str(dest/(key+'_albedo.png'));image.file_format='PNG';image.save();image.pack()
 mat=material('CC0_CoastalAtlas_'+key,'#FFFFFF',.62);tree=mat.node_tree;n=tree.nodes.new('ShaderNodeTexImage');n.image=image;tree.links.new(n.outputs['Color'],tree.nodes.get('Principled BSDF').inputs['Base Color']);p=tree.nodes.get('Principled BSDF');nrm=tree.nodes.new('ShaderNodeTexImage');nrm.image=normal_map;decode=tree.nodes.new('ShaderNodeNormalMap');tree.links.new(nrm.outputs['Color'],decode.inputs['Color']);tree.links.new(decode.outputs[0],p.inputs['Normal']);packed=tree.nodes.new('ShaderNodeTexImage');packed.image=surface_map;channels=tree.nodes.new('ShaderNodeSeparateColor');tree.links.new(packed.outputs['Color'],channels.inputs[0]);tree.links.new(channels.outputs['Green'],p.inputs['Roughness']);tree.links.new(channels.outputs['Blue'],p.inputs['Metallic']);body.data.materials.clear();body.data.materials.append(mat)
 for p in body.data.polygons:p.material_index=0
 for name in [layer.name for layer in body.data.uv_layers if layer.name!='CoastalAtlas']:
  body.data.uv_layers.remove(body.data.uv_layers[name])
 body.data.uv_layers.active=body.data.uv_layers['CoastalAtlas'];body.data.uv_layers.active.active_render=True
 # Add a single material-specific emission source; runtime animates only these insets.
 p=gem.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=p.inputs['Base Color'].default_value;p.inputs['Emission Strength'].default_value=.22
 for r in rigs:r.data.pose_position='POSE';r.animation_data.action=bpy.data.actions.get('idle')
 scene.frame_set(5);bpy.context.view_layer.update();lo,hi=bounds(meshes());factor=src['height']/(hi.z-lo.z);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));root.scale*=factor;root.location=(root.location-center)*factor
 bpy.context.view_layer.update()
 # NLA export preserves all existing walk / attacks, with a safe skill fallback for blob species.
 for r in rigs:
  r.animation_data.action=None
  tracks=r.animation_data.nla_tracks
  for target in ['attack2','skill']:
   if not any(t.name==target for t in tracks):
    a=bpy.data.actions.get('attack')
    if a:
     a=a.copy();a.name=target;t=tracks.new();t.name=target;t.strips.new(target,0,a)
  if not any(t.name=='exit' for t in tracks):
   a=bpy.data.actions.new('exit');r.animation_data.action=a;bone=r.pose.bones[0]
   for frame,factor in [(0,1),(8,1.03),(24,.02)]:
    bone.scale=(factor,)*3;bone.keyframe_insert(data_path='scale',frame=frame)
   bone.scale=(1,)*3;r.animation_data.action=None;t=tracks.new();t.name='exit';t.strips.new('exit',0,a)
  for t in tracks:t.mute=False
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.fbx(filepath=str(dest/(key+'.fbx')),use_selection=True,use_tspace=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
 bpy.ops.export_scene.gltf(filepath=str(dest/(key+'.glb')),export_format='GLB',export_tangents=True,use_selection=True,export_animation_mode='NLA_TRACKS',export_animations=True)
 for r in rigs:
  for t in r.animation_data.nla_tracks:t.mute=True
  r.animation_data.action=bpy.data.actions.get('idle')
 scene.frame_set(5);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(key+'.blend')))
 # Portrait is derived from this actual asset. Fit evaluated geometry, not stale accessor bounds.
 lo,hi=bounds(meshes());center=(lo+hi)/2;height=hi.z-lo.z
 scene.world=bpy.data.worlds.new('Coastal studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.70,.82,.90,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
 for name,at,energy,size,col in [('Warm key',(-3,-4,6),520,4,(1,.87,.70)),('Sky fill',(4,-2,3),380,3,(.65,.84,1)),('Rim',(1,4,5),650,3,(.7,1,1))]:
  d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=Vector(at)*height/2;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Codex camera');cam=bpy.data.objects.new('Codex camera',d);scene.collection.objects.link(cam)
 direction=Vector((.32,-1,.32)).normalized();cam.location=center+direction*height*5;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO'
 inv=cam.matrix_world.inverted();bpy.context.view_layer.update();inv=cam.matrix_world.inverted();pts=[inv@(o.matrix_world@Vector(v)) for o in meshes() for v in o.bound_box];d.ortho_scale=max(max(p.x for p in pts)-min(p.x for p in pts),max(p.y for p in pts)-min(p.y for p in pts),height)*1.14
 scene.camera=cam;scene.render.film_transparent=True;scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100;scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.view_settings.view_transform='AgX';scene.render.filepath=str(dest/'portrait.png');bpy.ops.render.render(write_still=True)
 metrics={**record,'artVersion':4,'faceRevision':4,'style':'A — 海雾灵焰','runtimeOptimized':True,'tangentsExported':True,'masterTriangles':master_triangles,'surfaceMaps':['normal','surface'],'sourceKey':src['key'],'source':src['source'],'license':src['license'],'height':src['height'],'triangles':sum(len(p.vertices)-2 for o in meshes() for p in o.data.polygons),'drawMaterials':sum(len(o.data.materials) for o in meshes()),'clips':[t.name for t in rig.animation_data.nla_tracks],'seconds':round(time.time()-started,1)}
 (dest/'manifest.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2),encoding='utf8');print('FINISHED '+key+' '+str(metrics['seconds'])+'s',flush=True)

records=[*PLAN['world'],*PLAN['bosses'],*PLAN['fauna']]
keys=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for record in records:
 if keys and record['key'] not in keys:continue
 if (R/'production'/record['key']/'manifest.json').exists() and (record.get('base',int(record['key'].split('-')[1]) if record['key'].startswith('fauna') else 0) not in [55,56] or json.loads((R/'production'/record['key']/'manifest.json').read_text('utf8')).get('faceRevision')==4):continue
 try:run(record)
 except Exception as e:
  import traceback;traceback.print_exc();print('FAILED '+record['key']+' '+str(e),flush=True)
  (R/(record['key']+'.error.txt')).write_text(traceback.format_exc())
