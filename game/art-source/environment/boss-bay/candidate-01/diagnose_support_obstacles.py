"""Read-only source object attribution for failed actual-FBX support samples."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent
report=json.loads((OUT/'foot-support-check.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(OUT/'boss-bay.blend'))
samples=[p for s in report['slots'] for p in s['unsupportedSamples']]
found=[]
for ob in bpy.context.scene.objects:
    if ob.type!='MESH':continue
    tree=BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],[list(p.vertices) for p in ob.data.polygons])
    for p in samples:
        h=tree.ray_cast(Vector((p['x'],-p['z'],3)),Vector((0,0,-1)))[0]
        if h is not None and h.z>.293:
            found.append({'object':ob.name,'sample':p,'sourceHitY':h.z})
print(json.dumps(found,indent=2))
