"""Import a generated asset and render neutral inspection views. No source is overwritten."""
import bpy
import json
import math
from mathutils import Vector
from pathlib import Path
import sys

args=sys.argv[sys.argv.index('--')+1:]
asset=args[0]
root=Path(__file__).resolve().parent
out=root/'inspection'/asset
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'models'/f'{asset}_glb.glb'))
objects=list(bpy.context.scene.objects)
meshes=[o for o in objects if o.type=='MESH']
corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector(tuple(min(c[i] for c in corners) for i in range(3)))
hi=Vector(tuple(max(c[i] for c in corners) for i in range(3)))
center=(lo+hi)/2
base=Vector((center.x,center.y,lo.z))
scale=2.4/max((hi-lo).z,.001)
parent=bpy.data.objects.new(asset+'_asset_root',None)
bpy.context.collection.objects.link(parent)
for o in objects:
    if o.parent is None:
        o.parent=parent
parent.scale=(scale,)*3
parent.location=-base*scale
bpy.context.view_layer.update()
report={'asset':asset,'sourceDimensions':list(hi-lo),'meshObjects':len(meshes),
 'vertices':sum(len(o.data.vertices) for o in meshes),
 'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
 'armatures':sum(o.type=='ARMATURE' for o in objects),
 'materials':[m.name for m in bpy.data.materials],
 'images':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images if i.type=='IMAGE']}
(out/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')

# Ground receives real cast shadows; the model's feet sit on z=0.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003))
floor=bpy.context.object
floor.name='inspection_ground'
mat=bpy.data.materials.new('warm_ivory_ground')
mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(.76,.74,.65,1)
bsdf.inputs['Roughness'].default_value=.85
floor.data.materials.append(mat)
world=bpy.data.worlds.new('soft_studio_world')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.76,.82,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
bpy.context.scene.world=world
def area(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((0,0,1.1))-obj.location).to_track_quat('-Z','Y').to_euler()
area('key',(-3,-4,6),650,4,(1,.91,.78))
area('fill',(4,-1,3),220,4,(.7,.87,1))
area('rim',(1,3,5),480,3,(.75,.9,1))
camera_data=bpy.data.cameras.new('inspection_camera')
camera=bpy.data.objects.new('inspection_camera',camera_data)
bpy.context.collection.objects.link(camera)
camera.data.type='ORTHO';camera.data.ortho_scale=3.05
scene=bpy.context.scene
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False
views=[('front',(0,-6,2.5)),('quarter',(4,-6,2.8)),('side',(6,0,2.5)),('back',(0,6,2.5))]
for name,loc in views:
    camera.location=loc
    camera.rotation_euler=(Vector((0,0,1.2))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/(asset+'-inspection.blend')))
print('INSPECTION_COMPLETE '+json.dumps(report))
