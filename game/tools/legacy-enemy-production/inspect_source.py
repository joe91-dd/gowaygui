import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parent
asset=sys.argv[sys.argv.index('--')+1]
record=json.loads((ROOT/'attempts'/f'{asset}-r1.json').read_text('utf-8'))
source=next(Path(x['path']) for x in record['files'] if Path(x['path']).suffix.lower()=='.glb')
out=ROOT/'inspection'/asset;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)])
span=hi-lo;factor=2/max(span);center=(lo+hi)*.5
for o in meshes:
 mw=o.matrix_world.copy();o.parent=None
 for v in o.data.vertices:v.co=(mw@v.co-center)*factor
 o.matrix_world=Matrix.Identity(4)
normalized=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
floorZ=min(v.z for v in normalized)
for o in meshes:
 for v in o.data.vertices:v.co.z-=floorZ
height=span.z*factor
data={'asset':asset,'source':str(source),'taskId':record['taskId'],'rawBounds':[list(lo),list(hi)],'normalizedDimensions':list(span*factor),'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'meshObjects':len(meshes),'materials':[m.name for m in bpy.data.materials],'textures':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images if im.type=='IMAGE'],'bones':sum(len(o.data.bones) for o in bpy.data.objects if o.type=='ARMATURE'),'animations':len(bpy.data.actions),'geometryModified':False,'normalizationForInspectionOnly':True}
(out/'source-inspection.json').write_text(json.dumps(data,indent=2),encoding='utf8')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
world=bpy.data.worlds.new('ReviewWorld');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.75,.81,.88,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
for loc,energy,size in [((-3,-4,6),700,5),((4,-1,3),350,4),((0,4,5),500,3)]:
 d=bpy.data.lights.new('ReviewArea','AREA');d.energy=energy;d.shape='DISK';d.size=size
 o=bpy.data.objects.new('ReviewArea',d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,height*.45))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
floor=bpy.context.object;m=bpy.data.materials.new('ReviewIvory');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.70,.67,.59,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;floor.data.materials.append(m)
d=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=2.65
for name,loc in [('front',(0,-6,height*.50)),('side',(-6,0,height*.50)),('back',(0,6,height*.50)),('battle',(3,-6,5))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,height*.46))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'source-review.blend'))
print('SOURCE_REVIEW_READY',asset,flush=True)
