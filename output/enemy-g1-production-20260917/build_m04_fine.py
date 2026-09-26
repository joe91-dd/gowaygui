"""Reproducible G1 enemy rig and runtime export. Original provider files stay immutable."""
import bpy, bmesh, sys, math, json, shutil, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parent
ID=sys.argv[sys.argv.index('--')+1];key=ID.lower()
plan=json.loads((ROOT/'production-plan.json').read_text('utf-8'))
cfg=next(x for x in plan['items'] if x['id']==ID);family=cfg['rigFamily']
cfg=dict(cfg)
if ID.startswith(('B','H')):cfg['targetRuntimeTriangles']=40000
if family=='octopus':cfg['targetRuntimeTriangles']=60000
if ID.startswith('M'):cfg['targetRuntimeTriangles']=14000
if ID in ('E01','M04'):cfg['targetRuntimeTriangles']=22000
record=json.loads((ROOT/'attempts'/f'{ID}-r1.json').read_text('utf-8'))
source=next(x['path'] for x in record['files'] if x['path'].endswith('.glb'))
OUT=ROOT/'production'/ID;OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if ID=='B07':
 rotation=Matrix.Rotation(math.radians(60),4,'Z')
 for o in meshes:o.matrix_world=rotation@o.matrix_world
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=2/(hi.z-lo.z)
for o in meshes:
 mw=o.matrix_world.copy();o.parent=None
 for v in o.data.vertices:v.co=(mw@v.co-center)*scale
 o.matrix_world=Matrix.Identity(4);o.data.update()
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name='G1_'+key+'_Body'
for o in list(bpy.context.scene.objects):
 if o!=body:bpy.data.objects.remove(o,do_unlink=True)
sourceTris=sum(len(p.vertices)-2 for p in body.data.polygons)
high=body.copy();high.data=body.data.copy();high.name='BakeSource';bpy.context.collection.objects.link(high)
high.select_set(False);body.select_set(True);bpy.context.view_layer.objects.active=body
# Weld geometric seams before reduction and bake the original colors to a new UV atlas.
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bm.to_mesh(body.data);bm.free()
if ID in ('M01','M03','M04','M05','E01','B10'):
 # These sources contain overlapping internal topology that collapses into spikes.
 # Reconstruct only the low-resolution surface; keep the original for color baking.
 body.data.remesh_voxel_size=.007 if ID=='M04' else .018 if ID.startswith('M') else .012;body.data.remesh_voxel_adaptivity=0
 bpy.ops.object.voxel_remesh()
 print('CLEAN_SURFACE',ID,len(body.data.vertices),len(body.data.polygons),flush=True)
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
lowTris=sum(len(p.vertices)-2 for p in body.data.polygons)
mod=body.modifiers.new('RuntimeLOD','DECIMATE');mod.ratio=min(1,cfg['targetRuntimeTriangles']/lowTris);mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name)
actualTris=sum(len(p.vertices)-2 for p in body.data.polygons)
if actualTris>cfg['targetRuntimeTriangles']+4:
 # A collapse that cannot reach its target exposes overlapping/non-manifold source faces.
 # Restart from the untouched high mesh and build a clean surface before reducing again.
 old=body.data;body.data=high.data.copy();bpy.data.meshes.remove(old)
 bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bm.to_mesh(body.data);bm.free()
 body.data.remesh_voxel_size=.007 if ID=='M04' else .018 if ID.startswith('M') else .012;body.data.remesh_voxel_adaptivity=0;bpy.ops.object.voxel_remesh()
 bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
 cleanTris=sum(len(p.vertices)-2 for p in body.data.polygons)
 mod=body.modifiers.new('RepairedLOD','DECIMATE');mod.ratio=min(1,cfg['targetRuntimeTriangles']/cleanTris);mod.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
body.data.validate();body.data.update()
print('LOW_SURFACE',ID,len(body.data.vertices),len(body.data.polygons),flush=True)
for p in body.data.polygons:p.use_smooth=True
for layer in list(body.data.uv_layers):body.data.uv_layers.remove(layer)
body.data.uv_layers.new(name='RuntimeUV')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(80),island_margin=.0005);bpy.ops.object.mode_set(mode='OBJECT')
body.data.materials.clear()
mat=bpy.data.materials.new('G1_'+key+'_Atlas');mat.use_nodes=True;body.data.materials.append(mat)
im=bpy.data.images.new(key+'_albedo',width=cfg['textureSize'],height=cfg['textureSize'],alpha=False)
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;mat.node_tree.nodes.active=tex
bsdf=mat.node_tree.nodes.get('Principled BSDF');mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.7
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.045;scene.render.bake.max_ray_distance=.15;scene.render.bake.margin=12
scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);high.select_set(True);bpy.context.view_layer.objects.active=body
# Thin overlapping plates require nearest-surface transfer instead of cage ray projection.
from mathutils.bvhtree import BVHTree
sourceMaterial=high.data.materials[0];sourceNode=sourceMaterial.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].links[0].from_node
assert sourceNode.type=='TEX_IMAGE'
sourceImage=sourceNode.image;sw,sh=sourceImage.size;sp=np.array(sourceImage.pixels[:],dtype=np.float32).reshape(sh,sw,4)
hp=np.array([v.co[:] for v in high.data.vertices]);hf=np.array([p.vertices[:] for p in high.data.polygons]);assert hf.shape[1]==3
huv=np.array([[high.data.uv_layers.active.data[i].uv[:] for i in p.loop_indices] for p in high.data.polygons])
bvh=BVHTree.FromPolygons([Vector(p) for p in hp],hf.tolist(),all_triangles=True)
size=cfg['textureSize'];pixels=np.zeros((size,size,4),np.float32);valid=np.zeros((size,size),bool)
verts=np.array([v.co[:] for v in body.data.vertices]);pendingPositions=[];pendingXY=[];pendingNormals=[]
def transfer():
 if not pendingPositions:return
 pos=np.concatenate(pendingPositions);xy=np.concatenate(pendingXY);normals=np.concatenate(pendingNormals);pendingPositions.clear();pendingXY.clear();pendingNormals.clear()
 for offset in range(0,len(pos),32768):
  batch=pos[offset:offset+32768];ij=xy[offset:offset+32768];hits=[]
  for point,normal in zip(batch,normals[offset:offset+32768]):
   point=Vector(point);normal=Vector(normal);hit=bvh.find_nearest(point)
   if hit[1].dot(normal)<.3:
    candidates=[h for h in bvh.find_nearest_range(point,max(.04,hit[3]*2)) if h[1].dot(normal)>.3]
    if candidates:hit=min(candidates,key=lambda h:h[3])
   hits.append(hit)
  ids=np.array([hit[2] for hit in hits]);nearest=np.array([hit[0][:] for hit in hits]);tri=hp[hf[ids]]
  a=tri[:,1]-tri[:,0];b=tri[:,2]-tri[:,0];q=nearest-tri[:,0]
  aa=(a*a).sum(1);ab=(a*b).sum(1);bb=(b*b).sum(1);aq=(a*q).sum(1);bq=(b*q).sum(1);den=np.maximum(aa*bb-ab*ab,1e-20)
  v=(bb*aq-ab*bq)/den;w=(aa*bq-ab*aq)/den;u=1-v-w;uv=huv[ids];uv=uv[:,0]*u[:,None]+uv[:,1]*v[:,None]+uv[:,2]*w[:,None]
  tx=(uv[:,0]%1)*sw-.5;ty=(uv[:,1]%1)*sh-.5;x0=np.floor(tx).astype(int);y0=np.floor(ty).astype(int);fx=(tx-x0)[:,None];fy=(ty-y0)[:,None]
  col=(sp[y0%sh,x0%sw]*(1-fx)+sp[y0%sh,(x0+1)%sw]*fx)*(1-fy)+(sp[(y0+1)%sh,x0%sw]*(1-fx)+sp[(y0+1)%sh,(x0+1)%sw]*fx)*fy
  pixels[ij[:,1],ij[:,0]]=col;valid[ij[:,1],ij[:,0]]=True
for poly in body.data.polygons:
 uv=np.array([body.data.uv_layers.active.data[i].uv[:] for i in poly.loop_indices])*size
 low=np.floor(uv.min(0)).astype(int).clip(0,size-1);upper=np.ceil(uv.max(0)).astype(int).clip(0,size-1)
 xx,yy=np.meshgrid(np.arange(low[0],upper[0]+1),np.arange(low[1],upper[1]+1));x=xx+.5;y=yy+.5;a,b,c=uv
 den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
 if abs(den)<1e-10:continue
 u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;w=1-u-v;inside=(u>=0)&(v>=0)&(w>=0)
 if not inside.any():continue
 tri=verts[list(poly.vertices)];pendingPositions.append(tri[0]*u[inside,None]+tri[1]*v[inside,None]+tri[2]*w[inside,None]);pendingXY.append(np.stack([xx[inside],yy[inside]],1))
 pendingNormals.append(np.tile(np.array(poly.normal[:]),(int(inside.sum()),1)))
 if len(pendingPositions)>=600:transfer()
transfer()
for iteration in range(3):
 old=valid.copy();sums=np.zeros_like(pixels);counts=np.zeros_like(valid,dtype=np.float32)
 for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
  mask=np.roll(old,(dy,dx),(0,1));sums+=np.roll(pixels,(dy,dx),(0,1))*mask[:,:,None];counts+=mask
 fill=(~old)&(counts>0);pixels[fill]=sums[fill]/counts[fill,None];valid|=fill
pixels[:,:,3]=1;im.pixels.foreach_set(pixels.ravel());im.update()
print('NEAREST_SURFACE_BAKE',ID,int(valid.sum()),flush=True)

bpy.data.objects.remove(high,do_unlink=True)
for old in list(bpy.data.images):
 if old!=im:bpy.data.images.remove(old)
for i,m in enumerate(body.data.materials):m.name=f'G1_{key}_Atlas_{i}'
for i,im in enumerate([im for im in bpy.data.images if im.size[0]>0]):
 if max(im.size)>cfg['textureSize']:im.scale(cfg['textureSize'],cfg['textureSize'])
 im.filepath_raw=str(OUT/f'{key}_texture_{i}.png');im.file_format='PNG';im.save();im.pack()
coords=np.array([v.co[:] for v in body.data.vertices]);x,y,z=coords.T
W=max(abs(x.min()),abs(x.max()));D=max(abs(y.min()),abs(y.max()))
defs={}
def bone(name,a,b,parent='body'):defs[name]=(tuple(a),tuple(b),parent)
bone('root',(0,0,0),(0,0,.15),None);bone('body',(0,0,.65),(0,0,1.1),'root')
chains=[]
def chain(prefix,points,parent='body'):
 names=[]
 for i in range(len(points)-1):
  n=prefix+'.'+str(i);bone(n,points[i],points[i+1],parent);parent=n;names.append(n)
 chains.append((prefix,names));return names
if family in ('crab','hermit'):
 for side,sgn in [('L',1),('R',-1)]:
  for j in range(3):
   yy=(-.32+j*.37)*D
   chain('leg'+str(j)+'.'+side,[(sgn*.38*W,yy,.68),(sgn*.72*W,yy+.05,.42),(sgn*.87*W,yy-.14,.06)])
  high=ID=='B01' and sgn==-1
  chain('claw.'+side,[(sgn*.42*W,-.22*D,.91),(sgn*.79*W,-.24*D,1.16 if high else .73),(sgn*.79*W,-.65*D,1.40 if high else .48)])
elif family=='quadruped':
 bone('head',(0,-D*.36,1.02),(0,-D*.72,1.26))
 for side,sgn in [('L',1),('R',-1)]:
  for j,yy in enumerate([-.38*D,.35*D]):
   chain('leg'+str(j)+'.'+side,[(sgn*W*.42,yy,.77),(sgn*W*.55,yy+.07,.40),(sgn*W*.57,yy-.07,.07)])
 chain('tail',[(0,D*.35,.72),(0,D*.65,.66),(0,D*.95,.57)])
elif family in ('octopus','blob'):
 count=8 if family=='octopus' else 4
 for j in range(count):
  a=math.tau*j/count+math.pi/8
  chain('tentacle'+str(j),[(math.cos(a)*W*.27,math.sin(a)*D*.27,.85 if family=='octopus' else .54),(math.cos(a)*W*.62,math.sin(a)*D*.62,.38),(math.cos(a)*W*.91,math.sin(a)*D*.91,.24)])
elif family=='biped':
 bone('head',(0,-.08,1.12),(0,-.08,1.65))
 for side,sgn in [('L',1),('R',-1)]:
  chain('arm.'+side,[(sgn*W*.35,0,1.04),(sgn*W*.66,-.06,.83),(sgn*W*.9,-.18,.60)])
  chain('leg.'+side,[(sgn*W*.25,0,.54),(sgn*W*.30,0,.29),(sgn*W*.35,-.18,.06)])
elif family in ('ray','floating'):
 for side,sgn in [('L',1),('R',-1)]:
  chain('fin.'+side,[(sgn*W*.22,0,.95),(sgn*W*.58,.02,1),(sgn*W*.95,.12,.96)])
 chain('tail',[(0,D*.25,.75),(0,D*.62,.66),(0,D*.95,.58)])
elif family=='snail':
 bone('head',(0,-D*.40,.40),(0,-D*.78,.72))
 for side,sgn in [('L',1),('R',-1)]:
  chain('eye.'+side,[(sgn*W*.32,-D*.61,.76),(sgn*W*.36,-D*.65,1.02),(sgn*W*.42,-D*.69,1.20)],'head')
 chain('foot',[(0,-D*.7,.15),(0,0,.18),(0,D*.72,.15)])
else:raise ValueError('Unimplemented anatomy '+family)
# Optional per-character landmark refinements stay visible and editable.
landmark=ROOT/'landmarks'/f'{ID}.json'
if landmark.exists():
 for name,points in json.loads(landmark.read_text()).items():defs[name]=(tuple(points[0]),tuple(points[1]),defs[name][2])
rigdata=bpy.data.armatures.new('G1_'+key+'_Skeleton');rig=bpy.data.objects.new('G1_'+key+'_Rig',rigdata);bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in defs.items():
 eb=rigdata.edit_bones.new(name);eb.head=a;eb.tail=b
 if parent:eb.parent=rigdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
def smooth(a,b,t):
 t=np.clip((t-a)/(b-a),0,1);return t*t*(3-2*t)
def distance(a,b):
 a=np.array(a);d=np.array(b)-a;t=np.clip((coords-a)@d/(d@d),0,1);return np.linalg.norm(coords-a-t[:,None]*d,axis=1)
names=list(defs);ni={n:i for i,n in enumerate(names)};weights=np.zeros((len(coords),len(names)),np.float32);weights[:,ni['body']]=1
for prefix,chainNames in chains:
 ds=np.stack([distance(*defs[n][:2]) for n in chainNames],axis=1)
 near=np.exp(-((ds.min(axis=1))/(max(W,D)*.24))**4)
 if prefix.startswith('leg'):
  mask=(1-smooth(.58,.82,z))*smooth(.15*W,.38*W,abs(x))
  if prefix.endswith('.L'):mask*=x>0
  if prefix.endswith('.R'):mask*=x<0
 elif prefix.startswith('claw'):
  side=1 if prefix.endswith('.L') else -1
  mask=smooth(W*.44,W*.69,x*side)*(1-smooth(D*.02,D*.32,y))*smooth(.22,.5,z)
 elif prefix.startswith('arm'):
  side=1 if prefix.endswith('.L') else -1
  mask=smooth(W*.3,W*.52,x*side)*smooth(.39,.62,z)*(1-smooth(1.16,1.4,z))
 elif prefix.startswith('tentacle'):mask=1-smooth(.85,1.12,z) if family=='octopus' else 1-smooth(.42,.72,z)
 elif prefix.startswith('fin'):mask=smooth(W*.28,W*.58,abs(x))
 elif prefix.startswith('tail'):mask=smooth(D*.38,D*.67,y)
 elif prefix.startswith('eye'):mask=smooth(.66,.95,z)*(1-smooth(-D*.55,-D*.24,y))
 else:mask=1-smooth(.18,.35,z)
 amount=near*mask
 influence=np.exp(-((ds-ds.min(axis=1)[:,None])/.14)**2);influence/=np.maximum(influence.sum(axis=1)[:,None],1e-9)
 weights*=1-amount[:,None]
 for k,n in enumerate(chainNames):weights[:,ni[n]]+=amount*influence[:,k]
if 'head' in defs:
 mask=smooth(1.04,1.24,z)*(1-smooth(-D*.2,D*.12,y)) if family!='snail' else (1-smooth(-D*.6,-D*.27,y))*smooth(.2,.5,z)
 if ID in ('B02','B07'):mask=np.maximum(mask,smooth(D*.32,D*.58,-y)*smooth(.3,.55,z))
 if ID=='B06':mask*=1-smooth(W*.24,W*.42,abs(x));mask*=1-smooth(1.65,1.78,z)
 if ID=='B10':mask=smooth(.92,1.13,z)
 weights*=1-mask[:,None];weights[:,ni['head']]+=mask
edges=np.array([e.vertices[:] for e in body.data.edges]);ea,eb=edges.T;degree=np.bincount(np.r_[ea,eb],minlength=len(coords))
for _ in range(4):
 sums=np.zeros_like(weights);np.add.at(sums,ea,weights[eb]);np.add.at(sums,eb,weights[ea]);weights=.75*weights+.25*sums/np.maximum(1,degree[:,None])
groups=[body.vertex_groups.new(name=n) for n in names]
for vi,row in enumerate(weights):
 ids=np.argsort(row)[-4:];total=row[ids].sum()
 for k in ids:
  if row[k]>.00001:groups[k].add([vi],float(row[k]/total),'REPLACE')
body.parent=rig;mod=body.modifiers.new('Deform','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
rest={n:rigdata.bones[n].matrix_local.to_quaternion() for n in names}
def rotate(n,rx=0,ry=0,rz=0):
 q=Quaternion((1,0,0),math.radians(rx))@Quaternion((0,1,0),math.radians(ry))@Quaternion((0,0,1),math.radians(rz))
 pb=rig.pose.bones[n];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=rest[n].inverted()@q@rest[n]
def reset():
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
def pose(clip,t):
 reset();cycle=math.sin(t*math.tau)
 # Action envelopes have anticipation, contact and recovery.
 hit=max(0,1-abs(t-.4)/.16);wind=max(0,1-abs(t-.21)/.2)
 if clip in ('idle','walk'):
  rotate('body',rx=.8*cycle,rz=.6*cycle)
  for j,(prefix,ns) in enumerate(chains):
   s=1 if '.L' in prefix else -1
   phase=math.sin(t*math.tau+(j%2)*math.pi)
   amp=(10 if clip=='walk' else 1.4)
   if prefix.startswith('leg'):
    rotate(ns[0],rx=amp*phase,rz=amp*.22*phase);rotate(ns[1],rx=-amp*.65*phase)
   elif prefix.startswith('tentacle'):
    rotate(ns[0],rx=amp*.55*phase,ry=amp*.55*phase);rotate(ns[1],rx=-amp*.7*phase)
   elif prefix.startswith('fin'):
    rotate(ns[0],ry=s*amp*phase);rotate(ns[1],ry=s*amp*.6*math.sin(t*math.tau-.6))
   elif prefix.startswith('tail'):
    rotate(ns[0],rz=amp*.6*phase);rotate(ns[1],rz=amp*.9*math.sin(t*math.tau-.6))
   elif prefix.startswith(('claw','arm')):rotate(ns[0],rx=amp*.22*phase,rz=s*amp*.13*phase)
  if family in ('blob','floating'):rig.pose.bones['body'].scale=(1+.025*cycle,1+.025*cycle,1-.03*cycle)
 elif clip in ('attack','skill'):
  power=1 if clip=='attack' else 1.25
  rotate('body',rx=(-3*wind+5*hit)*power,rz=(3*wind-4*hit)*power)
  for j,(prefix,ns) in enumerate(chains):
   s=1 if '.L' in prefix else -1
   if prefix.startswith(('claw','arm')):
    active=1 if clip=='skill' or s==-1 else .3
    rotate(ns[0],rx=(18*wind-25*hit)*active,rz=s*(-7*wind+10*hit)*active)
    rotate(ns[1],rx=(-13*wind+22*hit)*active)
   elif prefix.startswith('tentacle'):
    rotate(ns[0],rx=(12*wind-22*hit)*math.cos(j*math.tau/len(chains)),ry=(12*wind-22*hit)*math.sin(j*math.tau/len(chains)))
    rotate(ns[1],rx=13*wind-25*hit)
   elif prefix.startswith('fin'):rotate(ns[0],ry=s*(18*wind-25*hit))
   elif prefix.startswith('tail'):rotate(ns[0],rz=12*wind-22*hit);rotate(ns[1],rz=18*wind-28*hit)
  if 'head' in defs:rotate('head',rx=-9*wind+12*hit)
  if family in ('blob','floating','snail'):rig.pose.bones['body'].scale=(1+.05*wind-.03*hit,1+.05*hit,1-.04*wind+.03*hit)
 elif clip=='hit':
  f=math.sin(math.pi*t)*math.exp(-3*t);rotate('body',rx=-14*f,rz=9*f)
  for prefix,ns in chains:
   if not prefix.startswith('leg'):rotate(ns[0],rx=9*f)
 elif clip=='exit':
  f=smooth(.05,.85,t);rotate('body',rx=-12*f,ry=24*f)
  # Lower torso in global Z, keeping a stable corpse rather than looping.
  rig.pose.bones['body'].location=rest['body'].inverted()@Vector((0,0,-.22*f))
  for j,(prefix,ns) in enumerate(chains):
   rotate(ns[0],rx=(14 if j%2 else -14)*f,ry=(10 if j%2 else -10)*f)
   rotate(ns[1],rx=-18*f)
clips={};durations={'idle':120,'walk':32,'attack':28,'skill':56,'hit':21,'exit':45}
rig.animation_data_create()
for name,frames in durations.items():
 a=bpy.data.actions.new(name);rig.animation_data.action=a
 for frame in sorted(set([*range(0,frames+1,2),frames])):
  pose(name,frame/frames)
  if family not in ('ray','floating'):
   bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   low=min(v.co.z for v in body.evaluated_get(dg).data.vertices)
   rig.pose.bones['root'].location=rest['root'].inverted()@Vector((0,0,-low+.002))
  for pb in rig.pose.bones:
   pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('scale',frame=frame)
 for fc in a.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
 track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,a);track.mute=True;clips[name]=a
 rig.animation_data.action=None
reset();scene=bpy.context.scene;scene.render.fps=30
# Independently evaluate skinned vertices at multiple frames, not just clip names.
deformation={}
for name,a in clips.items():
 rig.animation_data.action=a;scene.frame_set(0);dg=bpy.context.evaluated_depsgraph_get();base=np.array([v.co[:] for v in body.evaluated_get(dg).data.vertices])
 maximum=0
 for fraction in [.2,.4,.7,1]:
  scene.frame_set(round(durations[name]*fraction));dg=bpy.context.evaluated_depsgraph_get();posed=np.array([v.co[:] for v in body.evaluated_get(dg).data.vertices]);maximum=max(maximum,float(np.linalg.norm(posed-base,axis=1).max()))
 deformation[name]=maximum
 if maximum<.001:raise RuntimeError('Static clip '+name)
rig.animation_data.action=None;reset()
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/f'{key}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/f'{key}.fbx'),use_selection=True,object_types={'ARMATURE','MESH'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=clips['idle'];scene.frame_set(0)
report={'id':ID,'taskId':record['taskId'],'family':family,'height':2,'dimensions':[float(x.max()-x.min()),float(y.max()-y.min()),2],'sourceTriangles':sourceTris,'runtimeTriangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(defs),'maxInfluences':4,'clips':{n:f/30 for n,f in durations.items()},'meshDeformation':deformation,'stage':'awaiting-visual-and-fbx-review','sourceUnchanged':True}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
(OUT/'bones.json').write_text(json.dumps(defs,indent=2),encoding='utf-8')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{key}.blend'))
shutil.copy2(OUT/f'{key}.blend',OUT/f'{key}.base.blend')
print('ENEMY_RIG_BUILT',json.dumps(report),flush=True)
