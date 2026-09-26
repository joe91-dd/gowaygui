"""Read the approved c12b source without changing it; write this study only."""
import bpy
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
SOURCE=HERE.parent/'candidate-12/c12b'

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
protected=[path for path in SOURCE.rglob('*') if path.is_file()]
protected += list((ROOT/'game/assets/resources/models/stone-turtle').glob('*'))
provenance={str(path.relative_to(ROOT)).replace('\\','/'):{'sha256':digest(path),'bytes':path.stat().st_size} for path in protected if path.is_file()}
(HERE/'protected-inputs.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')

def inspect(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.context.scene.render.threads_mode='FIXED';bpy.context.scene.render.threads=4
    graph=bpy.context.evaluated_depsgraph_get()
    rows=[]
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        evaluated=ob.evaluated_get(graph);mesh=evaluated.to_mesh()
        weights=[sum(group.weight for group in vertex.groups) for vertex in ob.data.vertices]
        rows.append({'name':ob.name,'bone':ob.get('bone'),'vertices':len(ob.data.vertices),'faces':len(ob.data.polygons),
          'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons),'evaluated_triangles':sum(len(p.vertices)-2 for p in mesh.polygons),
          'uv_layers':[layer.name for layer in ob.data.uv_layers],'materials':[m.name if m else None for m in ob.data.materials],
          'modifiers':[(m.name,m.type) for m in ob.modifiers],
          'min_weight_sum':min(weights) if weights else None,'max_weight_sum':max(weights) if weights else None,
          'groups':[g.name for g in ob.vertex_groups],'dimensions':list(ob.dimensions)})
        evaluated.to_mesh_clear()
    return {'file':str(path.relative_to(ROOT)),'meshes':rows,
      'rigs':[{'name':o.name,'bones':[b.name for b in o.data.bones]} for o in bpy.context.scene.objects if o.type=='ARMATURE'],
      'actions':[{'name':a.name,'range':list(a.frame_range),'slots':[s.identifier for s in a.slots]} for a in bpy.data.actions],
      'images':[{'name':im.name,'packed':bool(im.packed_file),'size':list(im.size),'filepath':im.filepath} for im in bpy.data.images if im.source=='FILE'],
      'cameras':[{'name':o.name,'location':list(o.location),'rotation':list(o.rotation_euler),'type':o.data.type,'lens':o.data.lens,'ortho_scale':o.data.ortho_scale} for o in bpy.context.scene.objects if o.type=='CAMERA']}

result=[inspect(SOURCE/'stone-turtle.blend'),inspect(SOURCE/'stone-turtle-review-scene.blend')]
(HERE/'source-inspection.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
for item in result:
    character=[r for r in item['meshes'] if r['groups']]
    print('SOURCE_INSPECTION',json.dumps({'file':item['file'],'meshes':len(item['meshes']),'character_meshes':len(character),'triangles':sum(r['triangles'] for r in character),'largest':sorted(character,key=lambda r:r['triangles'],reverse=True)[:12]}))
