import bpy,json
from pathlib import Path
from collections import defaultdict
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'candidate-12/c12b'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'stone-turtle-review-scene.blend'))
ob=bpy.data.objects['StoneTurtle_SkinnedMesh']; m=ob.data
parents=list(range(len(m.vertices)))
def root(i):
    while parents[i]!=i: parents[i]=parents[parents[i]];i=parents[i]
    return i
for e in m.edges:
    a,b=map(root,e.vertices);parents[a]=b
parts=defaultdict(list)
for v in m.vertices:parts[root(v.index)].append(v.index)
polys=defaultdict(list)
for p in m.polygons:polys[root(p.vertices[0])].append(p)
rows=[]
for ids in parts.values():
    verts=[m.vertices[i] for i in ids]
    bounds=[[min(v.co[a] for v in verts) for a in range(3)],[max(v.co[a] for v in verts) for a in range(3)]]
    rows.append({'first_vertex':ids[0],'vertices':len(ids),'triangles':sum(len(p.vertices)-2 for p in polys[root(ids[0])]),'bone':ob.vertex_groups[verts[0].groups[0].group].name,'bounds':bounds})
(HERE/'runtime-components.json').write_text(json.dumps(rows,indent=2))
bybone=defaultdict(int)
for r in rows:bybone[r['bone']]+=r['triangles']
print('BONE_TRIS',dict(bybone));print('HEAD_ISLANDS',json.dumps([r for r in rows if r['bone']=='head']))
