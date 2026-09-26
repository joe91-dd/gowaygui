"""Read editable source and prove generated grass/bush roots lie over actual grass terrain."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'boss-bay.blend'))
ground=bpy.data.objects['Continuous_grass_island']
tree=BVHTree.FromPolygons([ground.matrix_world@v.co for v in ground.data.vertices],[list(f.vertices) for f in ground.data.polygons])
results=[];fail=[]
for ob in bpy.context.scene.objects:
    if ob.type!='MESH' or not ob.name.startswith(('Bush_','Grass_','Boss_reed_')) or ob.name.startswith('Boss_reed_seed_'):continue
    pts=[ob.matrix_world@v.co for v in ob.data.vertices];low=min(p.z for p in pts)
    rootpts=[p for p in pts if p.z<=low+.0002]
    root=sum(rootpts,Vector())/len(rootpts)
    hit=tree.ray_cast(Vector((root.x,root.y,3)),Vector((0,0,-1)))
    row={'part':ob.name,'rootCocos':[root.x,root.z,-root.y], 'terrainY':hit[0].z if hit[0] else None}
    if hit[0] is None:fail.append(row)
    results.append(row)
report={'status':'pass' if not fail else 'needs-correction','sourceBlendSha256':hashlib.sha256((OUT/'boss-bay.blend').read_bytes()).hexdigest(),
 'checkedRootParts':len(results),'unsupportedRoots':fail,
 'method':'Raycast low-root center of each editable bush/grass/reed mesh onto actual Continuous_grass_island mesh. This detects coastline-external scatter independently of the builder predicate.',
 'notes':['Root center support is checked; curved outer leaf tips may naturally overhang rock or sand.','Cocos animation and view acceptance remain separate.']}
(OUT/'vegetation-support-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2));assert not fail,fail
