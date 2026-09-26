import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');key=sys.argv[sys.argv.index('--')+1];OUT=ROOT/'output/game-revision-20260916/mobile-cast'/key;OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/g1-polish-20260916/characters'/key/(key+'.blend')),load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None;rig.data.pose_position='REST'
for tr in rig.animation_data.nla_tracks:tr.mute=True
for pb in rig.pose.bones:pb.matrix_basis.identity()
high=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name);high.name+='SOURCE';low=high.copy();low.data=high.data.copy();bpy.context.collection.objects.link(low);low.name='G1_'+key+'_Body'
for mod in list(low.modifiers):low.modifiers.remove(mod)
bpy.ops.object.select_all(action='DESELECT');low.select_set(True);bpy.context.view_layer.objects.active=low
low.data.use_mirror_x=False
for uv in list(low.data.uv_layers):low.data.uv_layers.remove(uv)
rem=low.modifiers.new('Manifold game surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.012;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
tri=sum(len(p.vertices)-2 for p in low.data.polygons);dec=low.modifiers.new('Game budget','DECIMATE');dec.ratio=min(1,8000/max(1,tri));dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.0001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
for edge in low.data.edges:edge.use_seam=False
# Stable game UV atlas, baked from original authored color only, without duplicated light/shadow.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012);bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('G1_'+key+'_MobileAtlas',width=2048,height=2048,alpha=False);image.filepath_raw=str(OUT/'body-color.png');image.file_format='PNG'
material=bpy.data.materials.new('G1_'+key+'_MobileBody');material.use_nodes=True;nodes=material.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.75;tex=nodes.new('ShaderNodeTexImage');tex.image=image;nodes.active=tex;material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);low.data.materials.clear();low.data.materials.append(material)
# Nearest-surface texture transfer avoids black ray misses on generated open geometry.
import numpy as np
from mathutils.bvhtree import BVHTree
high.data.calc_loop_triangles();low.data.calc_loop_triangles()
verts=np.array([tuple(v.co) for v in high.data.vertices]);tri=list(high.data.loop_triangles);ids=np.array([tuple(t.vertices) for t in tri]);uvh=np.array([[tuple(high.data.uv_layers.active.data[l].uv) for l in t.loops] for t in tri]);hp=verts[ids]
bvh=BVHTree.FromPolygons([tuple(v) for v in verts],[tuple(t) for t in ids],all_triangles=True)
sources=[]
for mat in high.data.materials:
 ims=[n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image];im=ims[0];w,h=im.size;pix=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pix);sources.append((pix.reshape(h,w,4),w,h))
matids=np.array([t.material_index for t in tri]);res=2048;out=np.zeros((res,res,4),dtype=np.float32);filled=np.zeros((res,res),dtype=bool)
for tid,t in enumerate(low.data.loop_triangles):
 uv=np.array([tuple(low.data.uv_layers.active.data[l].uv) for l in t.loops])*res;lo=np.maximum(0,np.floor(uv.min(0)).astype(int));hi=np.minimum(res-1,np.ceil(uv.max(0)).astype(int));ys,xs=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];px=xs+.5;py=ys+.5
 a,b,c=uv;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
 if abs(den)<1e-10:continue
 u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den;v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den;mask=(u>=0)&(v>=0)&(u+v<=1)
 if not mask.any():continue
 x=xs[mask];y=ys[mask];u=u[mask];v=v[mask];p=np.array([tuple(low.data.vertices[j].co) for j in t.vertices]);points=u[:,None]*p[0]+v[:,None]*p[1]+(1-u-v)[:,None]*p[2]
 hits=[bvh.find_nearest(Vector(point)) for point in points];idx=np.array([hit[2] for hit in hits]);q=np.array([tuple(hit[0]) for hit in hits]);a=hp[idx,0];ab=hp[idx,1]-a;ac=hp[idx,2]-a;aq=q-a;d00=np.einsum('ij,ij->i',ab,ab);d01=np.einsum('ij,ij->i',ab,ac);d11=np.einsum('ij,ij->i',ac,ac);d20=np.einsum('ij,ij->i',aq,ab);d21=np.einsum('ij,ij->i',aq,ac);d=d00*d11-d01*d01;d=np.where(abs(d)<1e-15,1e-15,d);v=(d11*d20-d01*d21)/d;w=(d00*d21-d01*d20)/d;texuv=(1-v-w)[:,None]*uvh[idx,0]+v[:,None]*uvh[idx,1]+w[:,None]*uvh[idx,2]
 for mi,(pix,tw,th) in enumerate(sources):
  choose=matids[idx]==mi
  if not choose.any():continue
  co=texuv[choose];sx=np.clip(co[:,0]*tw-.5,0,tw-1);sy=np.clip(co[:,1]*th-.5,0,th-1);x0=np.floor(sx).astype(int);y0=np.floor(sy).astype(int);x1=np.minimum(tw-1,x0+1);y1=np.minimum(th-1,y0+1);fx=(sx-x0)[:,None];fy=(sy-y0)[:,None];colors=(pix[y0,x0]*(1-fx)+pix[y0,x1]*fx)*(1-fy)+(pix[y1,x0]*(1-fx)+pix[y1,x1]*fx)*fy;out[y[choose],x[choose]]=colors
 filled[y,x]=True
 if tid%1500==0:print('ATLAS',key,tid,flush=True)
for _ in range(14):
 for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
  near=np.roll(filled,(dy,dx),(0,1));use=near&~filled;shift=np.roll(out,(dy,dx),(0,1));out[use]=shift[use];filled|=use
out[:,:,3]=1;image.pixels.foreach_set(out.ravel());image.save();image.pack()
scene=bpy.context.scene;scene.render.engine='CYCLES'
# Transfer the authored body, hand and secondary face weights to the new surface.
bpy.ops.object.select_all(action='DESELECT');low.select_set(True);bpy.context.view_layer.objects.active=low
mod=low.modifiers.new('Nearest surface skin transfer','DATA_TRANSFER');mod.object=high;mod.use_vert_data=True;mod.data_types_verts={'VGROUP_WEIGHTS'};mod.vert_mapping='POLYINTERP_NEAREST';bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
arm=low.modifiers.new('G1 Skeleton','ARMATURE');arm.object=rig
bpy.data.objects.remove(high,do_unlink=True)
for o in list(bpy.data.objects):
 if o.type!='MESH' or o==low:continue
 n=sum(len(p.vertices)-2 for p in o.data.polygons)
 if n>2500:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Rigid equipment LOD','DECIMATE');mod.ratio=2500/n;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
rig.data.pose_position='POSE'
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'}:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_all_influences=False,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/(key+'.fbx')),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,bake_anim_simplify_factor=0.0)
for tr in rig.animation_data.nla_tracks:tr.mute=True
rig.animation_data.action=bpy.data.actions.get('idle');scene.frame_set(0)
triangles=sum(len(p.vertices)-2 for o in bpy.data.objects if o.type=='MESH' for p in o.data.polygons)
(OUT/'manifest.json').write_text(json.dumps({'asset':key,'triangles':triangles,'bones':len(rig.data.bones),'clips':len(rig.animation_data.nla_tracks),'colorAtlas':'body-color.png','limits':'Battle LOD only; high resolution source retained. Original face/finger controls transferred, not anatomically retopologized.'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(key+'.blend')))
# Full character preview catches UV bake misses and silhouette damage.
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.76,.83,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
for name,loc,power,size,col in [('Key',(-3,-4,6),600,5,(1,.93,.82)),('Fill',(4,-2,4),220,4,(.78,.9,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=col;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('QA');cam=bpy.data.objects.new('QA',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=3.25;scene.camera=cam;cam.location=(2,-6,2.8);cam.rotation_euler=(Vector((0,0,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'review.png');bpy.ops.render.render(write_still=True)
print('MOBILE_CAST',key,triangles,flush=True)
