import bpy,bmesh,numpy as np,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parent;ID='M03'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(R/'source/M03/M03_glb.glb'))
m=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=m
points=[m.matrix_world@v.co for v in m.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));mw=m.matrix_world.copy();scale=2/(hi.z-lo.z);m.parent=None
for v in m.data.vertices:v.co=(mw@v.co-center)*scale
m.matrix_world=Matrix.Identity(4);m.data.update()
def report(stage):
 p=np.array([v.co[:] for v in m.data.vertices]);e=np.array([e.vertices[:] for e in m.data.edges]);l=np.linalg.norm(p[e[:,0]]-p[e[:,1]],axis=1);print(stage,len(p),len(m.data.polygons),np.percentile(l,[50,99,100]).tolist(),flush=True)
report('RAW')
bm=bmesh.new();bm.from_mesh(m.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bm.to_mesh(m.data);bm.free();report('WELDED')
m.data.remesh_voxel_size=.018;m.data.remesh_voxel_adaptivity=0;bpy.ops.object.voxel_remesh();report('SCULPT_VOXEL')
bm=bmesh.new();bm.from_mesh(m.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(m.data);bm.free();report('TRIANGULATED')
mod=m.modifiers.new('LOD','DECIMATE');mod.ratio=14000/len(m.data.polygons);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name);report('DECIMATED')
for p in m.data.polygons:p.use_smooth=True
m.data.materials.clear();mat=bpy.data.materials.new('Solid gray');mat.diffuse_color=(.48,.52,.55,1);m.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'inspection/M03/surface-test.blend'))
manifest={'dimensions':[2.63,2.31,2]};s=(R/'review_runtime.py').read_text();s=s[s.index('scene=bpy.context.scene;'):s.index('def vertices():')];key='M03';exec(s)
bpy.context.scene.render.filepath=str(R/'inspection/M03/surface-test.png');bpy.ops.render.render(write_still=True)