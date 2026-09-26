"""Build editable, source-faithful G1 game rigs. Does not replace faces or repaint atlases.

The high resolution source GLBs remain untouched in models/. Runtime reduction,
weights, sockets and all animation keys are reproducible here and editable in Blender.
"""
import bpy, bmesh, json, math, sys, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parent
ASSET=sys.argv[sys.argv.index('--')+1]
OUT=ROOT/'production'/ASSET; OUT.mkdir(parents=True,exist_ok=True)
CONFIG={
 'yandun':dict(role='stone',height=2.50,hip=.73,neck=1.51,shoulder=(.53,-.08,1.46),elbow=(.87,-.10,1.14),wrist=(1.13,-.18,.91),foot=.37,headY=-.32,headTop=1.99,target=58000,weapon=None),
 'yeling':dict(role='spike',height=2.30,hip=.66,neck=1.38,shoulder=(.39,-.08,1.30),elbow=(.66,-.12,1.05),wrist=(.83,-.20,.87),foot=.28,headY=-.16,headTop=2.28,target=44000,weapon='leaf-bow'),
 'shange':dict(role='crystal',height=2.32,hip=.65,neck=1.40,shoulder=(.43,-.08,1.33),elbow=(.70,-.12,1.08),wrist=(.87,-.18,.88),foot=.27,headY=-.22,headTop=2.29,target=44000,weapon='wave-staff'),
 'yangguang':dict(role='leaf',height=2.28,hip=.63,neck=1.36,shoulder=(.42,-.08,1.28),elbow=(.68,-.12,1.05),wrist=(.84,-.19,.86),foot=.28,headY=-.18,headTop=2.28,target=44000,weapon='sun-lantern'),
 'chaoxing':dict(role='bubble',height=2.32,hip=.65,neck=1.42,shoulder=(.42,-.07,1.33),elbow=(.70,-.12,1.09),wrist=(.89,-.18,.89),foot=.29,headY=-.20,headTop=2.31,target=46000,weapon='tide-staff'),
}
C=CONFIG[ASSET]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mesh_import(path,height,name):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));items=list(set(bpy.data.objects)-before)
 meshes=[o for o in items if o.type=='MESH']
 corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)])
 s=height/(hi.z-lo.z);center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
 for o in meshes:
  mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw
  for v in o.data.vertices:v.co=(mw@v.co-center)*s
  o.matrix_world=Matrix.Identity(4)
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 for other in items:
  if other.name in bpy.data.objects and other!=o:bpy.data.objects.remove(other,do_unlink=True)
 return o

body=mesh_import(ROOT/'models'/f'{ASSET}_glb.glb',C['height'],'G1_'+ASSET+'_Body')
original_tris=sum(len(p.vertices)-2 for p in body.data.polygons)
# G1's atlas contains many closely spaced UV islands. A first reduction test moved
# colours across their boundaries, so preserve the source topology for this review.
# Source-faithful geometry takes priority over advertising an unverified mobile LOD.
body.data.validate(verbose=False);body.data.update()
for p in body.data.polygons:p.use_smooth=True
for i,m in enumerate(body.data.materials):m.name=f'G1_{ASSET}_Atlas_{i}'

def crystal_material(mesh,kind):
 if not mesh.data.materials:return
 src=mesh.data.materials[0]
 if not src.use_nodes:return
 p=next((n for n in src.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not p or not p.inputs['Base Color'].is_linked:return
 image_node=p.inputs['Base Color'].links[0].from_node
 if image_node.type!='TEX_IMAGE' or not image_node.image:return
 im=image_node.image;pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(im.size[1],im.size[0],4)
 uvs=np.empty(len(mesh.data.uv_layers.active.data)*2,dtype=np.float32);mesh.data.uv_layers.active.data.foreach_get('uv',uvs);uvs=uvs.reshape(-1,2)
 starts=np.array([p.loop_start for p in mesh.data.polygons]);center=(uvs[starts]+uvs[starts+1]+uvs[starts+2])/3
 rgb=pixels[(center[:,1]*im.size[1]).astype(int).clip(0,im.size[1]-1),(center[:,0]*im.size[0]).astype(int).clip(0,im.size[0]-1),:3]
 r,g,b=rgb.T
 mask=(b>r*1.38)&(g>r*1.25)&(b>.16) if kind=='blue' else (b>g*1.35)&(r>g*1.25)&(b>.12)
 if not np.any(mask):return
 m=src.copy();m.name=f'G1_{ASSET}_Crystal_Atlas';q=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for link in list(q.inputs['Roughness'].links):m.node_tree.links.remove(link)
 q.inputs['Roughness'].default_value=.26;q.inputs['Metallic'].default_value=.08;q.inputs['Emission Color'].default_value=(.03,.28,.40,1) if kind=='blue' else (.22,.07,.38,1);q.inputs['Emission Strength'].default_value=.24
 index=len(mesh.data.materials);mesh.data.materials.append(m)
 for poly,yes in zip(mesh.data.polygons,mask):
  if yes:poly.material_index=index
if ASSET=='yandun':crystal_material(body,'blue')

rig_data=bpy.data.armatures.new(ASSET+'_DeformSkeleton');rig=bpy.data.objects.new('G1_'+ASSET+'_Rig',rig_data);bpy.context.collection.objects.link(rig)
rig.show_in_front=True;bpy.context.view_layer.objects.active=rig;body.select_set(False);rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
hip=C['hip'];neck=C['neck'];S=Vector(C['shoulder']);E=Vector(C['elbow']);W=Vector(C['wrist'])
defs={'root':((0,0,0),(0,0,.2),None),'pelvis':((0,0,hip*.70),(0,0,hip), 'root'),
      'chest':((0,0,hip),(0,0,neck),'pelvis'),
      'head':((0,C['headY'],neck),(0,C['headY']-.025,min(C['headTop']-.12,neck+.43)),'chest')}
for side,sgn in [('L',1),('R',-1)]:
 reflect=lambda v:(v[0]*sgn,v[1],v[2])
 sh,el,wr=reflect(S),reflect(E),reflect(W)
 tip=Vector(wr)+(Vector(wr)-Vector(el)).normalized()*.17
 defs.update({
  'clavicle.'+side:((0,0,neck-.13),sh,'chest'),
  'upperarm.'+side:(sh,el,'clavicle.'+side),'forearm.'+side:(el,wr,'upperarm.'+side),'hand.'+side:(wr,tuple(tip),'forearm.'+side),
  'thigh.'+side:((sgn*C['foot']*.86,-.01,hip),(sgn*C['foot'],-.04,.35),'pelvis'),
  'shin.'+side:((sgn*C['foot'],-.04,.35),(sgn*C['foot'],-.09,.16),'thigh.'+side),
  'foot.'+side:((sgn*C['foot'],-.09,.16),(sgn*C['foot'],-.34,.075),'shin.'+side),
 })
for name,(a,b,parent) in defs.items():
 eb=rig_data.edit_bones.new(name);eb.head=a;eb.tail=b
 if parent:eb.parent=rig_data.edit_bones[parent]
 if name.startswith(('upperarm','forearm','hand')):eb.align_roll(Vector((0,-1,0)))
bpy.ops.object.mode_set(mode='OBJECT')
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
coords=np.array([v.co[:] for v in body.data.vertices]);N=len(coords)
names=list(defs);ni={n:i for i,n in enumerate(names)};weights=np.zeros((N,len(names)),dtype=np.float32)
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def segment_distance(points,a,b):
 a=np.array(a);b=np.array(b);d=b-a;t=np.clip(((points-a)@d)/(d@d),0,1);return np.linalg.norm(points-(a+t[:,None]*d),axis=1)
x,y,z=coords.T;ax=np.abs(x)
core=smooth(hip*.82,hip+ .29,z);weights[:,ni['chest']]=core;weights[:,ni['pelvis']]=1-core
# The shell and crystal crown stay on the thorax. The face and its hood/helmet turn together.
head=smooth(neck-.04,neck+.11,z)*(1-smooth(.03,.20,y))
if ASSET=='yandun':head*=1-smooth(C['headTop']-.12,C['headTop']+.025,z);head*=1-smooth(.35,.52,ax)
else:head=np.maximum(head,smooth(neck+.23,neck+.40,z)*(1-smooth(.17,.34,y)))
weights*=1-head[:,None];weights[:,ni['head']]+=head
for side,sgn in [('L',1),('R',-1)]:
 side_mask=(x*sgn>0).astype(float)
 # Lower robe and rear cape follow the pelvis rather than being pulled along by a hand.
 leg=(1-smooth(hip-.06,hip+.12,z))*side_mask*(1-smooth(.13,.35,y))
 low=smooth(.12,.27,z);high=smooth(.29,.47,z)
 legw={'foot.'+side:1-low,'shin.'+side:low*(1-high),'thigh.'+side:high}
 weights*=1-leg[:,None]
 for n,w in legw.items():weights[:,ni[n]]+=leg*w
 an=['upperarm.'+side,'forearm.'+side,'hand.'+side]
 ds=np.stack([segment_distance(coords,defs[n][0],defs[n][1]) for n in an],axis=1)
 arm_weight=np.exp(-(ds/.14)**2);arm_weight/=np.maximum(arm_weight.sum(axis=1,keepdims=True),1e-9)
 torso_radius=np.interp(z,[0,.65,.90,1.20,1.45,2.5],[E.x+.08,E.x-.03,.55,.40,C['shoulder'][0]-.06,.48])
 armmask=smooth(torso_radius-.035,torso_radius+.11,ax)*side_mask*smooth(.35,.62,z)*(1-smooth(C['shoulder'][2]+.08,C['shoulder'][2]+.24,z))*(1-smooth(.12,.34,y))
 # Open fingertips extend below the wrist. They must never be assigned to a thigh
 # merely because they share its height; the outside hand silhouette is wholly an arm.
 armmask=np.maximum(armmask,side_mask*smooth(E.x-.05,E.x+.10,ax)*(1-smooth(C['shoulder'][2]+.07,C['shoulder'][2]+.23,z)))
 # Source shoulder guards belong to the shoulder joint, with a blended seam into the chest.
 weights*=1-armmask[:,None]
 for k,n in enumerate(an):weights[:,ni[n]]+=armmask*arm_weight[:,k]
# Surface smoothing removes weight seams without blurring or changing the original mesh.
edges=np.array([e.vertices[:] for e in body.data.edges]);ea,eb=edges[:,0],edges[:,1];degree=np.bincount(np.r_[ea,eb],minlength=N)
for _ in range(10):
 sums=np.zeros_like(weights);np.add.at(sums,ea,weights[eb]);np.add.at(sums,eb,weights[ea]);weights=.55*weights+.45*sums/np.maximum(1,degree[:,None])
groups=[body.vertex_groups.new(name=n) for n in names]
for vi,row in enumerate(weights):
 ids=np.argsort(row)[-4:];total=row[ids].sum()
 for k in ids:
  if row[k]>.0001:groups[k].add([vi],float(row[k]/total),'REPLACE')
body.parent=rig;mod=body.modifiers.new('G1_Skeleton','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True

def new_material(name,col,rough=.6,metal=0,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 p.inputs['Emission Color'].default_value=(*col,1);p.inputs['Emission Strength'].default_value=emit;return m
def parent_bone(obj,bone):
 bpy.context.view_layer.update();mw=obj.matrix_world.copy();obj.parent=rig;obj.parent_type='BONE';obj.parent_bone=bone;bpy.context.view_layer.update();obj.matrix_world=mw
def curve_object(name,pts,thickness,material):
 data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=thickness;data.bevel_resolution=3
 sp=data.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for bp,co in zip(sp.bezier_points,pts):bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.data.materials.append(material);return ob

equipment=[];sockets=[]
def socket(name,loc,bone):
 ob=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ob);ob.location=loc;ob.empty_display_size=.055;parent_bone(ob,bone);sockets.append({'name':name,'bone':bone,'position':list(loc)})
 return ob
if C['weapon']:
 wid=C['weapon'];size={'leaf-bow':1.45,'wave-staff':2.20,'sun-lantern':.68,'tide-staff':2.13}[wid]
 if wid=='leaf-bow':
  sys.path.insert(0,str(ROOT));from bow_repair import make_bow
  weapon=make_bow()
  for v in weapon.data.vertices:v.co.z+=.73
 else:weapon=mesh_import(ROOT/'models'/f'{wid}_glb.glb',size,'G1_'+wid)
 for i,m in enumerate(weapon.data.materials):
  if wid!='leaf-bow':m.name=f'G1_{wid}_Atlas_{i}'
 if wid in ['wave-staff','tide-staff']:crystal_material(weapon,'blue' if wid=='wave-staff' else 'purple')
 # Remove only isolated generated debris; retain the asset's authored shape and surface UVs.
 weapon.data.validate(verbose=False);weapon.data.update()
 if wid=='leaf-bow':
  # AHOLO supplied overlapping strings and a detached sliver. Keep the sculpted bow limbs
  # and replace the central string with one continuous, separately editable tension string.
  bm=bmesh.new();bm.from_mesh(weapon.data)
  # Tiny disconnected components cannot contribute a bow limb; remove them by surface area.
  todo=set(bm.verts);components=[]
  while todo:
   seed=todo.pop();stack=[seed];group={seed}
   while stack:
    v=stack.pop()
    for edge in v.link_edges:
     u=edge.other_vert(v)
     if u in todo:todo.remove(u);group.add(u);stack.append(u)
   components.append(group)
  biggest=max(len(c) for c in components)
  trash=[v for g in components if len(g)<max(16,biggest*.004) for v in g]
  if trash:bmesh.ops.delete(bm,geom=trash,context='VERTS')
  bm.to_mesh(weapon.data);bm.free()
  # Keep generated geometry intact beyond isolated fragments for source comparison.
  # The corrected string is tensioned behind the grip, with jade/brass detailing.
  center=Vector((W.x+.03,W.y-.075,W.z-.72));weapon.location=center
  gem=center+Vector((0,0,1.25));bone='hand.L'
 elif wid=='sun-lantern':
  center=Vector((W.x+.05,W.y-.035,W.z-.67));weapon.location=center;gem=center+Vector((0,0,.31));bone='hand.L'
 else:
  center=Vector((W.x+.035,W.y-.015,W.z-.91));weapon.location=center;gem=center+Vector((0,0,size-.19));bone='hand.L'
 equipment.insert(0,weapon)
 for ob in equipment:parent_bone(ob,bone)
 socket('FX_Weapon_Core',gem,bone);socket('FX_Weapon_Grip',tuple(W),bone)
 if wid=='leaf-bow':socket('FX_Quiver',(.24,.25,1.76),'chest')
 if wid=='leaf-bow':
  curve=[(-.24,0,-.73),(-.10,0,-.59),(.12,0,-.40),(.15,0,-.22),(0,0,0),(.15,0,.22),(.12,0,.40),(-.10,0,.59),(-.24,0,.73)]
  for i,p in enumerate(curve):socket('FX_Vine_'+str(i).zfill(2),center+Vector((p[0],p[1]-.035,p[2]+.73)),bone)
else:
 socket('FX_Weapon_Core',(0,.03,2.37),'chest')
 for side,sgn in [('L',1),('R',-1)]:
  socket('FX_Crystal_Wrist_'+side,(sgn*.97,-.28,1.07),'forearm.'+side)
  socket('FX_Crystal_Foot_'+side,(sgn*C['foot'],-.36,.12),'foot.'+side)
socket('FX_Chest',(0,-.29,1.15),'chest')

rest={n:rig.data.bones[n].matrix_local.copy() for n in defs}
def reset():
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
def global_rotation(name,angles):
 q=Quaternion((1,0,0),math.radians(angles[0]))@Quaternion((0,1,0),math.radians(angles[1]))@Quaternion((0,0,1),math.radians(angles[2]))
 r=rest[name].to_quaternion();rig.pose.bones[name].rotation_quaternion=r.inverted()@q@r
def solve_arm(side,target,bend):
 upper=rig.pose.bones['upperarm.'+side];fore=rig.pose.bones['forearm.'+side];hand=rig.pose.bones['hand.'+side]
 bpy.context.view_layer.update();base=upper.head.copy();target=Vector(target);axis=target-base;distance=axis.length;axis.normalize()
 L1=rig.data.bones[upper.name].length;L2=rig.data.bones[fore.name].length
 reach=min(max(distance,abs(L1-L2)+.001),L1+L2-.001);target=base+axis*reach
 along=(L1*L1-L2*L2+reach*reach)/(2*reach);perp=Vector(bend)-axis*Vector(bend).dot(axis)
 if perp.length<.01:perp=Vector((0,-1,0)).cross(axis)
 elbow=base+axis*along+perp.normalized()*math.sqrt(max(.00001,L1*L1-along*along))
 for pb,h,t in [(upper,base,elbow),(fore,elbow,target)]:
  rq=rest[pb.name].to_quaternion();rv=Vector(defs[pb.name][1])-Vector(defs[pb.name][0]);q=rv.rotation_difference(t-h)@rq
  pb.matrix=Matrix.LocRotScale(h,q,Vector((1,1,1)));bpy.context.view_layer.update()
 # Rigid grip inherits the wrist orientation. Equipment is never skin-deformed.
 hand.rotation_quaternion=Quaternion((1,0,0),0)

def pose(frame,rot=None,hands=None,hips=0,step=0):
 reset();rot=rot or {};hands=hands or {}
 # Lower the A-pose into a relaxed, readable combat stance.
 for n,a in rot.items():global_rotation(n,a)
 rig.pose.bones['pelvis'].location.z=hips
 bpy.context.view_layer.update()
 for side,sgn in [('L',1),('R',-1)]:
  default=(sgn*(W.x-.10),W.y-.08,W.z+.055)
  if side=='L' and C['weapon']:default=(sgn*(W.x-.06),W.y-.07,W.z+.08)
  solve_arm(side,hands.get(side,default),(sgn*.8,.18,-.7))
 if step:
  global_rotation('thigh.L',(step,0,0));global_rotation('thigh.R',(-step,0,0));global_rotation('shin.L',(max(0,-step)*.7,0,0));global_rotation('shin.R',(max(0,step)*.7,0,0))
 for pb in rig.pose.bones:
  pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('scale',frame=frame)

clips={}
def make_clip(name,keys):
 reset();a=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=a
 for k in keys:pose(*k)
 for fc in a.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='BEZIER';kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
 tr=rig.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,a);st.action_frame_start=0;st.action_frame_end=keys[-1][0];tr.mute=True
 rig.animation_data.action=None;clips[name]=a

make_clip('idle',[(0,), (30,{'chest':(-1.2,0,0),'head':(0,0,-2)}),(60,), (90,{'chest':(.8,0,0),'head':(0,0,2)}),(120,)])
make_clip('walk',[(0,{'chest':(2,0,0)},None,0,0),(8,{'chest':(3,0,2)},None,.014,18),(16,{'chest':(2,0,0)},None,0,0),(24,{'chest':(3,0,-2)},None,.014,-18),(32,{'chest':(2,0,0)},None,0,0)])
if ASSET=='yandun':
 for name,side,sgn in [('attack','R',-1),('attack2','L',1)]:
  make_clip(name,[(0,), (6,{'chest':(-4,0,sgn*-9),'head':(0,0,sgn*5)},{side:(sgn*.8,.01,1.20)}),
    (11,{'chest':(6,0,sgn*10),'head':(-3,0,sgn*-6)},{side:(sgn*.35,-.99,1.08)}),
    (15,{'chest':(4,0,sgn*7)},{side:(sgn*.41,-.91,1.07)}),(28,)])
 make_clip('skill',[(0,), (12,{'chest':(7,0,0),'head':(-7,0,0)},{'L':(.66,-.55,1.36),'R':(-.66,-.55,1.36)}),
  (22,{'chest':(-4,0,-12),'head':(2,0,8)},{'L':(1.1,-.13,1.35),'R':(-1.1,-.13,1.35)}),
  (36,{'chest':(-3,0,12),'head':(0,0,-8)},{'L':(1.05,-.24,1.31),'R':(-1.05,-.24,1.31)}),
  (52,{'chest':(4,0,0),'head':(-2,0,0)},{'L':(.95,-.30,1.06),'R':(-.95,-.30,1.06)}),(66,)])
elif ASSET=='yeling':
 for name,power in [('attack',1),('attack2',1.1)]:
  make_clip(name,[(0,), (7,{'chest':(0,0,-18),'head':(0,0,15)},{'L':(.43,-.54,1.18),'R':(-.22,-.35,1.29)}),
   (13,{'chest':(-2,0,-22),'head':(0,0,19)},{'L':(.40,-.61,1.23),'R':(-.44,-.20,1.39)}),
   (16,{'chest':(1,0,-20),'head':(0,0,17)},{'L':(.41,-.60,1.24),'R':(-.56,-.13,1.40)}),(30,)])
 make_clip('skill',[(0,), (12,{'chest':(-5,0,-18),'head':(-7,0,16)},{'L':(.42,-.58,1.39),'R':(-.35,-.23,1.48)}),
  (22,{'chest':(-8,0,-21),'head':(-10,0,17)},{'L':(.40,-.58,1.47),'R':(-.51,-.18,1.49)}),
  (28,{'chest':(-3,0,-17),'head':(-4,0,14)},{'L':(.41,-.57,1.46),'R':(-.59,-.10,1.46)}),(51,)])
else:
 for name,sign in [('attack',1),('attack2',-1)]:
  make_clip(name,[(0,), (7,{'chest':(-3,0,-4*sign),'head':(-2,0,3*sign)},{'L':(W.x-.11,-.30,W.z+.19),'R':(-.46,-.36,1.21)}),
   (13,{'chest':(3,0,5*sign),'head':(0,0,-2*sign)},{'L':(W.x-.12,-.42,W.z+.16),'R':(-.30,-.62,1.35)}),
   (18,{'chest':(2,0,3*sign)},{'R':(-.38,-.55,1.29)}),(32,)])
 high=1.24 if ASSET=='yangguang' else 1.34
 make_clip('skill',[(0,), (12,{'chest':(-4,0,-5),'head':(-5,0,3)},{'L':(W.x-.15,-.32,high),'R':(-.46,-.42,1.26)}),
  (24,{'chest':(-6,0,0),'head':(-8,0,0)},{'L':(W.x-.19,-.30,high+.14),'R':(-.42,-.56,1.49)}),
  (38,{'chest':(-3,0,4),'head':(-2,0,-3)},{'L':(W.x-.16,-.30,high+.11),'R':(-.37,-.57,1.48)}),
  (52,{'chest':(3,0,0),'head':(2,0,0)},{'L':(W.x-.15,-.39,high-.07),'R':(-.42,-.51,1.19)}),(65,)])
make_clip('hit',[(0,), (4,{'chest':(-7,0,-4),'head':(5,0,3)}),(11,{'chest':(2,0,2),'head':(-1,0,-1)}),(23,)])
make_clip('greeting',[(0,), (16,{'chest':(-2,0,0),'head':(-3,0,-7)},{'R':(-.58,-.49,1.44)}),
 (27,{'head':(1,0,-5)},{'R':(-.69,-.46,1.54)}),(40,{'head':(-2,0,-3)},{'R':(-.55,-.49,1.47)}),(60,)])
make_clip('rest',[(0,), (25,{'chest':(12,0,0),'head':(14,0,0)}),(65,{'chest':(12,0,0),'head':(14,0,0)})])
make_clip('exit',[(0,), (12,{'chest':(-8,0,6),'head':(8,0,-4)}),(28,{'pelvis':(0,26,0),'chest':(-35,0,-15),'head':(12,0,0)},None,-.12),(48,{'pelvis':(0,38,0),'chest':(-45,0,-10)},None,-.19)])
reset();rig.animation_data.action=clips['idle'];bpy.context.scene.frame_set(0)

# All textures are original embedded source assets, exported under unambiguous names.
for index,im in enumerate([im for im in bpy.data.images if im.type=='IMAGE' and im.size[0]>0]):
 im.filepath_raw=str(OUT/(f'{ASSET}_texture_{index}.png'));im.file_format='PNG';im.save();im.pack()
scene=bpy.context.scene;scene.render.fps=30
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for ob in [rig,body,*equipment]+[bpy.data.objects[s['name']] for s in sockets]:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
# Convert curve equipment to meshes for game import; the saved scene retains their history in this script.
for ob in equipment:
 if ob.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for ob in [rig,body,*equipment]+[bpy.data.objects[s['name']] for s in sockets]:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/(ASSET+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/(ASSET+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=clips['idle'];scene.frame_set(0)
report={'asset':ASSET,'role':C['role'],'source':'AHOLO G1 / PRO generation','originalTriangles':original_tris,'runtimeTriangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(defs),'maxInfluences':4,'height':C['height'],'weapon':C['weapon'],'clips':{n:round(a.frame_range[1]/30,3) for n,a in clips.items()},'sockets':sockets,'faceGeometryReplaced':False,'texturesRepainted':False,'knownLimitations':['Generated triangulated topology; weights require extreme-pose visual review.','Facial expressions are the source sculpt, not a full facial blendshape rig.']}
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(ASSET+'.blend')))
print('G1_RIG_COMPLETE '+json.dumps(report,ensure_ascii=False))
