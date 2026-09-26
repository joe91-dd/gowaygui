import bpy, numpy as np,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent;a=sys.argv[sys.argv.index('--')+1];out=root/'hand-study-soft'/a;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'production'/a/(a+'.blend1')))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');body=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
for side in (['L','R'] if a=='yandun' else ['L']):
 group=body.vertex_groups['hand.'+side].index;matrix=rig.data.bones['hand.'+side].matrix_local;inv=matrix.inverted()
 for v in body.data.vertices:
  weight=next((g.weight for g in v.groups if g.group==group),0)
  if weight<.05:continue
  p=inv@v.co
  if p.y<=.105:continue
  theta=min(1.20,(p.y-.105)/.24);r=.24
  q=Vector((p.x,.105+(r-p.z)*np.sin(theta),r+(p.z-r)*np.cos(theta)))
  v.co=v.co.lerp(matrix@q,min(1,weight*1.4))
body.data.update();bpy.ops.wm.save_as_mainfile(filepath=str(out/(a+'.blend')))
print('GRIP_STUDY_READY')
