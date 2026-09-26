"""Apply the same approved head-normal transfer to the editable parts archive.

This corrects the build script's initial pre-transfer archive ordering only.
It does not rebuild or modify the final candidate, FBX, or render source.
"""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
def normals_map(ob):
    m=ob.data;head=ob.vertex_groups['head'];uv=m.uv_layers.active.data;rows={}
    for p in m.polygons:
        if not all(any(g.group==head.index and g.weight>.999 for g in m.vertices[i].groups) for i in p.vertices):continue
        face=tuple(sorted(tuple(m.vertices[i].co) for i in p.vertices))
        for i in p.loop_indices:rows[(face,tuple(m.vertices[m.loops[i].vertex_index].co),tuple(uv[i].uv))]=(i,tuple(m.corner_normals[i].vector))
    return rows
frozen=[HERE/'stone-turtle-lod.blend',*(HERE/'export').glob('*')]
digests={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in frozen if p.is_file()}
bpy.ops.wm.open_mainfile(filepath=str(HERE/'stone-turtle-lod-parts.blend'))
bpy.context.scene.render.threads_mode='FIXED';bpy.context.scene.render.threads=4
reference=bpy.data.objects['Approved_c12b_28572_reference'];original=normals_map(reference);results=[]
for ob in bpy.context.scene.objects:
    if ob.get('bone')!='head' or not ob.name.startswith('LOD_'):continue
    normals=[tuple(n.vector) for n in ob.data.corner_normals]
    for key,(index,value) in normals_map(ob).items():normals[index]=original[key][1]
    ob.data.normals_split_custom_set(normals)
    error=max((Vector(n)-Vector(original[k][1])).length for k,(i,n) in normals_map(ob).items())
    assert error<.0002
    results.append({'part':ob.name,'max_normal_vector_error':error})
assert len(results)==12
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'stone-turtle-lod-parts.blend'))
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==d for p,d in digests.items())
(HERE/'editable-parts-normal-check.json').write_text(json.dumps({'parts':results,'final_candidate_and_export_unchanged':True},indent=2))
print('PARTS_ARCHIVE_FINALIZED')
