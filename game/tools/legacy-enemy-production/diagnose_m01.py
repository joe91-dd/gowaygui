import bpy,sys,json,numpy as np
from pathlib import Path
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'production/M01/m01.base.blend'))
m=next(o for o in bpy.data.objects if o.type=='MESH');r=next(o for o in bpy.data.objects if o.type=='ARMATURE')
r.data.pose_position='REST'
coords=np.array([v.co[:] for v in m.data.vertices]);edges=np.array([e.vertices[:] for e in m.data.edges]);lens=np.linalg.norm(coords[edges[:,0]]-coords[edges[:,1]],axis=1)
print('MESH_DIAG',len(coords),len(m.data.polygons),np.percentile(lens,[0,50,90,99,100]).tolist(),flush=True)
s=(R/'review_runtime.py').read_text()
s=s[s.index("scene=bpy.context.scene;"):s.index('def vertices():')]
manifest=json.loads((R/'production/M01/manifest.json').read_text());from mathutils import Vector
exec(s)
bpy.context.scene.render.filepath=str(R/'inspection/M01/rest-diagnostic.png');bpy.ops.render.render(write_still=True)