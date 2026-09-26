"""Minimal boss c02 export: reverse only downward grass faces; no regenerated geometry.

Explicit open upper-surface orientation is a required postcondition, rather than trusting
volume-based normal recalculation for an open island sheet. Run after Blender slot release.
"""
import bpy,bmesh,json,hashlib,math,shutil
from pathlib import Path
OUT=Path(__file__).resolve().parent;FIRST=OUT.parent/'candidate-01';ROOT=OUT.parents[4]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
frozen=json.loads((OUT/'c01-full-freeze.json').read_text(encoding='utf-8'))
for name,item in frozen['files'].items():assert sha(FIRST/name)==item['sha256'],name
old=json.loads((FIRST/'environment-manifest.json').read_text(encoding='utf-8'))

def uv_geometry_snapshot(ob):
    # Ignore only cyclic winding/order within each face; retain every vertex-to-UV pair.
    mesh=ob.data;uv=mesh.uv_layers.active.data
    return {'positions':[list(v.co) for v in mesh.vertices],
            'faces':[sorted((mesh.loops[i].vertex_index,tuple(uv[i].uv)) for i in p.loop_indices) for p in mesh.polygons],
            'materials':[m.name for m in mesh.materials],
            'matrix':[list(row) for row in ob.matrix_world]}

def enforce_open_surface_up(ob,filter_atlas=False):
    before=uv_geometry_snapshot(ob);bm=bmesh.new();bm.from_mesh(ob.data);bm.faces.ensure_lookup_table()
    uv=bm.loops.layers.uv.active;targets=[]
    for face in bm.faces:
        if filter_atlas:
            u=sum(loop[uv].uv.x for loop in face.loops)/len(face.loops)
            v=sum(loop[uv].uv.y for loop in face.loops)/len(face.loops)
            if (int(u*8),int(v*4))!=(1,0):continue
        targets.append(face)
    assert len(targets)==2304,(ob.name,len(targets))
    bad=[face for face in targets if face.normal.z<-.1]
    assert len(bad)==2304,'c01 expected defect must match before applying a correction'
    bmesh.ops.reverse_faces(bm,faces=bad);bm.normal_update()
    assert all(face.normal.z>.97 for face in targets),'Open grass surface must face upward'
    bm.to_mesh(ob.data);bm.free();ob.data.update()
    assert uv_geometry_snapshot(ob)==before,'The correction changed coordinates, UV pairs, other faces or transforms'
    return {'object':ob.name,'facesReversed':len(bad),'positionsUvPairsMaterialsTransformsIdentical':True,
            'explicitUpwardPostcondition':'all 2304 grass polygon normals local Z > .97'}

for name in ['island-colour.png','island-roughness.png']:
    assert sha(OUT/name)==sha(FIRST/name)
# Editable source retained as separate objects. No review-only ocean/cameras are included.
bpy.ops.wm.open_mainfile(filepath=str(FIRST/'boss-bay.blend'))
editable=bpy.data.objects.get('Continuous_grass_island');assert editable is not None
source_check=enforce_open_surface_up(editable)
for image in bpy.data.images:
    if image.size[0]>0:assert image.packed_file
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'boss-bay.blend'))
# Reuse already-joined, frozen first-round model to preserve every other mesh's exact data.
bpy.ops.wm.open_mainfile(filepath=str(FIRST/'boss-bay-review-scene.blend'))
ground=bpy.data.objects.get('Ground');assert ground is not None
export_check=enforce_open_surface_up(ground,True)
groups=['Ground','Landmarks_and_nature','Pearl_and_lamps']
exported=[bpy.data.objects[n] for n in groups]
anchors=[ob for ob in bpy.context.scene.objects if ob.type=='EMPTY']
bpy.ops.object.select_all(action='DESELECT')
for ob in exported+anchors:ob.select_set(True)
bpy.context.view_layer.objects.active=ground
bpy.ops.export_scene.fbx(filepath=str(OUT/'boss-bay.fbx'),use_selection=True,object_types={'MESH','EMPTY'},axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=False,path_mode='COPY',embed_textures=True)
stats=[{'name':o.name,'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)} for o in exported]
assert stats==old['runtimeMeshes']
points=[o.matrix_world@v.co for o in exported for v in o.data.vertices]
bounds={'min':[min(p.x for p in points),min(p.z for p in points),min(-p.y for p in points)],'max':[max(p.x for p in points),max(p.z for p in points),max(-p.y for p in points)]}
assert bounds==old['geometryBoundsCocos']
scene=bpy.context.scene;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=32
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'boss-bay-review-scene.blend'))
manifest=dict(old)
manifest.update(version='boss-bay-candidate-02',status='Only grass winding/normals corrected; pending actual Cocos import/visibility acceptance.',fbxSha256=sha(OUT/'boss-bay.fbx'),sourceFbxSha256=sha(FIRST/'boss-bay.fbx'))
(OUT/'environment-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
report={'status':'minimal-source-and-export-corrected','sourceCheck':source_check,'exportCheck':export_check,
        'routeSlotsBoundsUnchanged':True,'totalTriangles':old['totalTriangles'],'sourceSha256':sha(OUT/'boss-bay.blend'),'fbxSha256':sha(OUT/'boss-bay.fbx'),
        'retainedDegenerates':'128 center-ring triangulation degenerates retained; no vertex or topology simplification.',
        'runtimeModified':False,'materialDoubleSidedWorkaround':False}
(OUT/'correction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('BOSS_C02_CORRECTED '+json.dumps(report))
