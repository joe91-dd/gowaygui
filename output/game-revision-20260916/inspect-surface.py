import bpy,bmesh,json
from pathlib import Path
R=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui/output')
for f in [R/'g1-polish-20260916/characters/shange/shange.blend',R/'game-revision-20260916/battle-lod/shange/shange.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(f),load_ui=False)
 for o in bpy.data.objects:
  if o.type!='MESH':continue
  v=o.data.vertices;b=bmesh.new();b.from_mesh(o.data)
  print(json.dumps({'file':str(f),'object':o.name,'verts':len(v),'faces':len(o.data.polygons),'bbox':[[min(p.co[i] for p in v),max(p.co[i] for p in v)] for i in range(3)],'worldScale':list(o.matrix_world.to_scale()),'boundary':sum(e.is_boundary for e in b.edges),'nonmanifold':sum(not e.is_manifold for e in b.edges),'modifiers':[(m.name,m.type) for m in o.modifiers],'zeroFaces':sum(p.area<1e-10 for p in o.data.polygons),'shapeKeys':o.data.shape_keys is not None}),flush=True)
  b.free()
