"""Editable reconstruction of the bow after G1 produced branching, broken limbs."""
import bpy, math
from mathutils import Vector

def make_bow():
 objects=[]
 def mat(name,col,rough,metal=0):
  m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
 wood=mat('G1_Bow_Honeywood',(.26,.104,.031),.55);leather=mat('G1_Bow_Leather',(.11,.051,.024),.83);gold=mat('G1_Bow_Brushed_Brass',(.55,.32,.091),.34,.67)
 jade=mat('G1_Bow_Jade_Leaf',(.039,.145,.087),.62);vein=mat('G1_Bow_Leaf_Vein',(.16,.32,.17),.52);thread=mat('G1_Bow_Flax_String',(.54,.40,.20),.8)
 def curve(name,points,rad,material,res=3):
  d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=16;d.bevel_depth=rad;d.bevel_resolution=res
  s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
  for p,v in zip(s.bezier_points,points):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
  o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(material);objects.append(o);return o
 # Grip at local origin, single continuous recurve silhouette.
 curve('Rebuilt_single_bow',[(-.24,0,-.73),(-.10,0,-.59),(.12,0,-.40),(.15,0,-.22),(0,0,0),(.15,0,.22),(.12,0,.40),(-.10,0,.59),(-.24,0,.73)],.032,wood,5)
 curve('Bow_string',[(-.24,0,-.73),(-.24,0,0),(-.24,0,.73)],.0045,thread,2)
 # Wrapped grip consists of actual helical leather geometry, not a flat label.
 pts=[]
 for i in range(200):
  t=i/199;angle=t*math.tau*8;pts.append((math.cos(angle)*.040,math.sin(angle)*.040,-.135+t*.27))
 curve('Leather_grip_binding',pts,.010,leather,3)
 for z in [-.148,.148,-.67,.67]:
  x=0 if abs(z)<.2 else -.205
  curve('Brass_binding',[(x+math.cos(i*math.tau/24)*.043,math.sin(i*math.tau/24)*.043,z) for i in range(25)],.009,gold,3)
 for j,(cx,cz,sgn) in enumerate([(.12,.34,1),(.12,-.34,-1),(.14,.42,-1),(.14,-.42,1)]):
  verts=[];faces=[];segments=20
  for i in range(segments+1):
   t=i/segments;w=math.sin(t*math.pi)**.9*.095
   for side in [-1,0,1]:verts.append((cx+sgn*t*.15+side*w,-.037-math.sin(t*math.pi)*(.016 if side else .038),cz+t*.25*(1 if cz>0 else -1)))
   if i:
    k=i*3;faces.extend([(k-3,k,k+1,k-2),(k-2,k+1,k+2,k-1)])
  me=bpy.data.meshes.new('Sculpted_leaf');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Jade_leaf_'+str(j),me);bpy.context.collection.objects.link(o);o.data.materials.append(jade)
  sol=o.modifiers.new('Leaf_thickness','SOLIDIFY');sol.thickness=.007;sub=o.modifiers.new('Leaf_surface','SUBSURF');sub.levels=1
  for p in me.polygons:p.use_smooth=True
  objects.append(o)
  path=[(cx+sgn*(i/12)*.15,-.074,cz+(i/12)*.25*(1 if cz>0 else -1)) for i in range(13)];curve('Leaf_mid_rib',path,.0025,vein,2)
  for k in range(1,5):
   t=k/5;xx=cx+sgn*t*.15;zz=cz+t*.25*(1 if cz>0 else -1)
   for side in [-1,1]:curve('Leaf_fine_vein',[(xx,-.069,zz),(xx+side*.055,-.055,zz+.022*(1 if cz>0 else -1))],.0014,vein,1)
 for z in [-.25,.25]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(.11,-.048,z));o=bpy.context.object;o.name='Brass_leaf_pin';o.scale=(.030,.013,.030);o.data.materials.append(gold);objects.append(o)
 # Join in rest coordinates. Keep materials separate for native game roughness.
 for o in objects:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
  else:
   for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();out=bpy.context.object;out.name='G1_Leaf_Bow_Blender_Reconstruction'
 return out
