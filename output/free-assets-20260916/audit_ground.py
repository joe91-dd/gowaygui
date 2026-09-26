import bpy,sys,json
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent;key='shark';bpy.ops.wm.open_mainfile(filepath=str(p/'production'/key/(key+'.blend')),load_ui=False);bpy.context.scene.frame_set(0);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();out=[]
for ob in bpy.context.scene.objects:
 if ob.type!='MESH':continue
 ev=ob.evaluated_get(dg);me=ev.to_mesh();used=set(i for f in me.polygons for i in f.vertices);pts=[ev.matrix_world@me.vertices[i].co for i in used];bounds=[ev.matrix_world@Vector(v) for v in ev.bound_box]
 out.append(dict(name=ob.name,verts=len(me.vertices),faces=len(me.polygons),used=len(used),hide=ob.hide_render,minz=min((x.z for x in pts),default=0),maxz=max((x.z for x in pts),default=0),boxmin=min(x.z for x in bounds),boxmax=max(x.z for x in bounds)));ev.to_mesh_clear()
print('VISIBLE_MESH_BOUNDS',json.dumps(out))

print('CUSTOM_SHAPES',[(o.name,[(b.name,b.custom_shape.name if b.custom_shape else None) for b in o.pose.bones if b.custom_shape]) for o in bpy.data.objects if o.type=='ARMATURE'])
print('MESH_FLAGS',[(o.name,o.hide_get(),o.hide_viewport,o.display_type,[m.name for m in o.data.materials]) for o in bpy.data.objects if o.type=='MESH'])
