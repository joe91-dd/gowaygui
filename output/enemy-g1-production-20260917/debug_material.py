import bpy,json
from pathlib import Path
ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui/output/enemy-g1-production-20260917')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'production/B01/b01.blend'))
for im in bpy.data.images:print('IMAGE',im.name,im.filepath,im.size[:],im.source,im.type)
for ob in bpy.data.objects:
 if ob.type=='MESH':print('MESH',ob.name,'UV',[(l.name,l.active_render) for l in ob.data.uv_layers],len(ob.data.polygons),[(m.name,[(n.name,n.image.filepath if n.image else '') for n in m.node_tree.nodes if n.type=='TEX_IMAGE']) for m in ob.data.materials])

