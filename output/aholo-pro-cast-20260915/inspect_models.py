"""Neutral source inspection. Geometry and source materials remain untouched."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
asset=sys.argv[sys.argv.index('--')+1]
out=ROOT/'inspection'/asset;out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{asset}_glb.glb'))
objects=list(bpy.context.scene.objects);meshes=[o for o in objects if o.type=='MESH']
corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(p[i] for p in corners) for i in range(3)]);hi=Vector([max(p[i] for p in corners) for i in range(3)])
scale=2.4/max(hi.z-lo.z,.001);base=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
root=bpy.data.objects.new('SourceAsset',None);bpy.context.collection.objects.link(root)
for o in objects:
 if o.parent is None:o.parent=root
root.scale=(scale,)*3;root.location=-base*scale;bpy.context.view_layer.update()
report={'asset':asset,'sourceDimensions':list(hi-lo),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'meshObjects':len(meshes),'armatures':sum(o.type=='ARMATURE' for o in objects),'materials':[],'images':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images if im.type=='IMAGE'],'geometryModified':False}
for m in bpy.data.materials:
 info={'name':m.name,'nodes':[]}
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type=='TEX_IMAGE':info['nodes'].append({'type':'image','image':n.image.name if n.image else None})
   if n.type=='BSDF_PRINCIPLED':info['roughness']=n.inputs['Roughness'].default_value;info['metallic']=n.inputs['Metallic'].default_value
 report['materials'].append(info)
(out/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005));ground=bpy.context.object;ground.name='StudioGround'
mat=bpy.data.materials.new('StudioLimestone');mat.diffuse_color=(.71,.72,.70,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.71,.72,.70,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9;ground.data.materials.append(mat)
world=bpy.data.worlds.new('NeutralWorld');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.8,.85,.92,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35;bpy.context.scene.world=world
def light(name,loc,power,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',(-3,-4,6),500,5,(1,.95,.87));light('Fill',(4,-2,3),170,5,(.82,.9,1));light('Rim',(1,3,5),320,4,(.9,.96,1))
d=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=max(3.15,(hi.x-lo.x)*scale*1.25,(hi.y-lo.y)*scale*1.25)
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
views=[('front',(0,-6,1.7)),('quarter',(4,-6,2.8)),('side',(6,0,1.7)),('back',(0,6,1.7))]
for name,loc in views:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,1.2))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/(asset+'-source-review.blend')))
print('INSPECTION_COMPLETE '+json.dumps(report))
