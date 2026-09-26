import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;out=ROOT/'production'/'guard-beacon';out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
def mat(name,col,rough=.7,metal=0,emit=0):
 m=bpy.data.materials.new('CC0_Guard_'+name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Emission Color'].default_value=(*col,1);p.inputs['Emission Strength'].default_value=emit;return m
stone=mat('Ivory',(.70,.65,.49));edge=mat('Limestone',(.90,.84,.65));gold=mat('Brass',(.44,.30,.13),.36,.6);dark=mat('Jade',(.07,.27,.25));light=mat('CrystalLight',(.12,.67,.70),.28,0,.4)
def cyl(name,r,depth,z,m,verts=8):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(m);b=o.modifiers.new('Soft bevel','BEVEL');b.width=.027;b.segments=3;bpy.ops.object.modifier_apply(modifier=b.name);o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
cyl('石阶底座',.61,.12,.06,stone);cyl('象牙石阶',.51,.13,.17,edge);cyl('黄铜嵌边',.445,.027,.244,gold);cyl('海玉基座',.418,.12,.304,dark);cyl('晶石承托',.35,.08,.397,edge)
for i in range(3):
 a=i*math.tau/3;curve=bpy.data.curves.new('Bronze strut','CURVE');curve.dimensions='3D';curve.bevel_depth=.032;curve.bevel_resolution=2;curve.use_fill_caps=True;s=curve.splines.new('BEZIER');s.bezier_points.add(3)
 for b,(r,z) in zip(s.bezier_points,[(.38,.24),(.46,.49),(.38,.78),(.25,.84)]):b.co=(math.cos(a)*r,math.sin(a)*r,z);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new('护晶铜托',curve);bpy.context.collection.objects.link(o);o.data.materials.append(gold);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH')
 for j in range(2):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.045,location=(math.cos(a)*(.54-j*.10),math.sin(a)*(.54-j*.10),.127+j*.10));bpy.context.object.name='玉色符石';bpy.context.object.data.materials.append(light)
# Authored cut crystal with a clear tapered silhouette and contrasting facets.
crystal=mat('CrystalBlue',(.08,.48,.67),.24,.10,.22);crystal_light=mat('CrystalFacet',(.27,.78,.89),.25,.06,.18)
verts=[(.225*math.cos(i*math.tau/8),.225*math.sin(i*math.tau/8),.73) for i in range(8)]+[(0,0,1.16),(0,0,.43)];faces=[]
for i in range(8):faces.extend([(i,(i+1)%8,8),((i+1)%8,i,9)])
mesh=bpy.data.meshes.new('Cut crystal');mesh.from_pydata(verts,[],faces);mesh.materials.append(crystal);mesh.materials.append(crystal_light);ob=bpy.data.objects.new('CC0_Guard_Crystal',mesh);bpy.context.collection.objects.link(ob)
for face in mesh.polygons:face.material_index=face.index%3==0
for i in range(3):
 a=i*math.tau/3;bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.048,location=(math.cos(a)*.25,math.sin(a)*.25,.84));bpy.context.object.name='铜托封帽';bpy.context.object.data.materials.append(gold)
socket=bpy.data.objects.new('FX_Weapon_Core',None);bpy.context.collection.objects.link(socket);socket.location=(0,0,.88)
bpy.context.view_layer.update();bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out/'guard-beacon.glb'),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out/'guard-beacon.fbx'),use_selection=True,object_types={'MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True,bake_anim=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'guard-beacon.blend'))
raw=(out/'guard-beacon.glb').read_bytes();report=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')]);triangles=sum(report['accessors'][p['indices']]['count']//3 for m in report['meshes'] for p in m['primitives'])
rep=dict(runtimeKey='guard-beacon',name='海心守护灯塔',group='project-authored',source='output/free-assets-20260916/prepare_guard.py',author=['哥喂龟项目 · Blender 程序化建模'],height=1.16,license='Project-authored',bones=0,runtimeAnimations=[],triangles=triangles,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),changes=['Fully Blender-authored cut crystal, capped brass cradle and limestone pedestal; no third-party mesh in final beacon','Ground origin at the lower stone step']);(out/'manifest.json').write_text(json.dumps(rep,ensure_ascii=False,indent=2),encoding='utf8')
print('GUARD_BEACON_READY')
