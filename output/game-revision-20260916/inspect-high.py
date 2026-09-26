import bpy
from pathlib import Path
r=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui');bpy.ops.wm.open_mainfile(filepath=str(r/'output/g1-polish-20260916/characters/shange/shange.blend'),load_ui=False)
o=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
print('SOURCE',o.name,'modifiers',[(m.name,m.type) for m in o.modifiers], 'UV',[(u.name,u.active_render,u.active) for u in o.data.uv_layers],flush=True)
for m in o.data.materials:
 print('MATERIAL',m.name,flush=True)
 for n in m.node_tree.nodes:
  if n.type=='TEX_IMAGE':print(n.name,n.image.name,[(x.to_node.name,x.to_socket.name) for x in n.outputs['Color'].links],flush=True)
