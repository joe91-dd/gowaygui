
import bpy,numpy as np
bpy.ops.wm.open_mainfile(filepath=r'C:/Users/Administrator/Documents/ChatGPT/gowaygui/output/enemy-g1-production-20260917/production/B01/b01.blend')
o=next(o for o in bpy.data.objects if o.type=='MESH')
uv=np.array([d.uv[:] for d in o.data.uv_layers.active.data]);a=np.array([p.loop_start for p in o.data.polygons]);tri=uv[a+1]-uv[a];tri2=uv[a+2]-uv[a];areas=abs(tri[:,0]*tri2[:,1]-tri[:,1]*tri2[:,0])/2
print('UV_STATS',uv.min(0),uv.max(0),'zero',sum(areas<1e-10),'sum',sum(areas),'polys',len(a),'sample',uv[:9])

