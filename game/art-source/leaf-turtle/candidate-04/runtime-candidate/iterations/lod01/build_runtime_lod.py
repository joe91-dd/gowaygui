"""Build an isolated c04 runtime candidate from the approved immutable high mesh.
Blender -b -t 2 --python-exit-code 1 --python THIS. No promotion or Cocos.
"""
import ast,bpy,bmesh,hashlib,json,shutil
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
OUT=HERE/'runtime-candidate';EXPORT=OUT/'export';INPUT=OUT/'inputs'
for p in [OUT,EXPORT,INPUT]:p.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
approved=json.loads((HERE/'candidate-manifest.json').read_text(encoding='utf-8'))
protected=dict(approved['protected_inputs'])
for p in [HERE/'leaf-turtle.blend',HERE/'leaf-turtle-review-scene.blend',HERE/'render-three-quarter.png',ROOT/'game/art-source/build_leaf_turtle_candidate04.py']:
    protected[str(p.relative_to(ROOT))]=sha(p)
assert sha(HERE/'leaf-turtle.blend')=='902faa81d3c99e5bd9bdf3f00d868d25a000eb9f0dfe802615eb17ea07a62986'
def assert_protected():
    for path,digest in protected.items():assert sha(ROOT/path)==digest,('Protected source changed',path)
assert_protected()
bpy.ops.wm.open_mainfile(filepath=str(HERE/'leaf-turtle.blend'))
scene=bpy.context.scene;scene.render.fps=30;scene.frame_set(1)
rig=next(o for o in scene.objects if o.type=='ARMATURE')
parts=[o for o in scene.objects if o.type=='MESH' and 'bone' in o]
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=bpy.data.actions['idle']
rig.animation_data.action_slot=rig.animation_data.action.slots[0]
scene.frame_set(1);bpy.context.view_layer.update()
# Rebuild both original atlases from numeric parameters, never from a PNG input.
source=HERE/'inputs/authored_leaf_c02_functions.py'
snapshot=INPUT/'authored_leaf_atlas_source.py';shutil.copy2(source,snapshot)
tree=ast.parse(snapshot.read_text(encoding='utf-8'))
chosen=[n for n in tree.body if (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ('PALETTE','ATLAS_PARAMETERS') for t in n.targets)) or (isinstance(n,ast.FunctionDef) and n.name=='build_atlas')]
assert len(chosen)==3
namespace={'bpy':bpy,'np':np,'Path':Path}
exec(compile(ast.Module(body=chosen,type_ignores=[]),str(snapshot),'exec'),namespace)
namespace['build_atlas'](EXPORT)
for name in ['leaf-colour.png','leaf-roughness.png']:
    assert (EXPORT/name).read_bytes()==(HERE/'textures'/name).read_bytes(),('Numeric atlas rebuild differs',name)
write(OUT/'atlas-parameters.json',namespace['ATLAS_PARAMETERS'])
for image in list(bpy.data.images):
    if image.name.startswith('LeafTurtle_') and image.users:
        name='leaf-roughness.png' if 'Roughness' in image.name else 'leaf-colour.png'
        image.filepath=str(EXPORT/name);image.pack()

# Each ring is sampled from exactly the approved positions and semantic UVs.
# Keep root/tip, both flanks, and all three central midrib columns. No collapse
# decimator is applied to the leaves, so their root-to-tip topology stays legible.
ROWS=[0,1,3,5,6,7,8,10,11,13,15,16]
COLS=[0,2,3,5,6,7,9,10,12,13,15,17]
leaf_report=[];part_report=[]
for ob in parts:
    before=sum(len(p.vertices)-2 for p in ob.data.polygons)
    if ob.name.startswith('Layered_leaf_'):
        old=ob.data;assert len(old.vertices)==306
        selected=[r*18+c for r in ROWS for c in COLS]
        vertices=[old.vertices[i].co.copy() for i in selected]
        uv_by_vertex={loop.vertex_index:old.uv_layers.active.data[loop.index].uv.copy() for loop in old.loops}
        faces=[];width=len(COLS)
        for row in range(len(ROWS)-1):
            for col in range(width):
                faces.append((row*width+col,row*width+(col+1)%width,(row+1)*width+(col+1)%width,(row+1)*width+col))
        faces.extend([tuple(range(width-1,-1,-1)),tuple((len(ROWS)-1)*width+j for j in range(width))])
        mesh=bpy.data.meshes.new(ob.name+'_sampled_lod_mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
        for material in old.materials:mesh.materials.append(material)
        uv=mesh.uv_layers.new(name=old.uv_layers.active.name)
        for loop in mesh.loops:uv.data[loop.index].uv=uv_by_vertex[selected[loop.vertex_index]]
        for polygon in mesh.polygons:polygon.use_smooth=True
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        bvh=BVHTree.FromPolygons(vertices,faces,all_triangles=False)
        distances=[bvh.find_nearest(v.co)[3] for v in old.vertices]
        source_bounds=[[min(v.co[a] for v in old.vertices),max(v.co[a] for v in old.vertices)] for a in range(3)]
        lod_bounds=[[min(v[a] for v in vertices),max(v[a] for v in vertices)] for a in range(3)]
        bounds_error=max(abs(a-b) for x,y in zip(source_bounds,lod_bounds) for a,b in zip(x,y))
        ob.data=mesh;ob.vertex_groups.clear();group=ob.vertex_groups.new(name='shell');group.add(list(range(len(vertices))),1,'REPLACE')
        leaf_report.append({'name':ob.name,'source_triangles':before,'lod_triangles':sum(len(p.vertices)-2 for p in mesh.polygons),
            'source_vertices_to_lod_surface_max_m':max(distances),'bounds_error_max_m':bounds_error,'selected_vertex_positions_exact':True})
        assert max(distances)<.025 and bounds_error<.015,('Leaf sampling error',ob.name,max(distances),bounds_error)
    else:
        name=ob.name
        ratio=.35
        if name=='Head_sculpt':ratio=.40
        elif name.startswith('Eye_white_'):ratio=.80
        elif name.startswith('Continuous_eyelid_'):ratio=.70
        elif name.startswith('Nostril_'):ratio=.50
        elif name.startswith('Gentle_inquisitive_brow_'):ratio=.60
        elif name=='Warm_leaf_smile':ratio=.70
        elif name.startswith(('Restrained_outer_eye_accent_','Small_shell_blossom_')):ratio=1
        elif name=='Leaf_shell_core':ratio=.30
        if ratio<1:
            bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
            mod=ob.modifiers.new('Part_specific_runtime_reduction','DECIMATE');mod.ratio=ratio
            while ob.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    # Joining and exporting must retain bone membership and normalized weights.
    for v in ob.data.vertices:
        weight=sum(g.weight for g in v.groups);assert weight>0,('Unweighted vertex',ob.name,v.index)
        for group in list(v.groups):ob.vertex_groups[group.group].add([v.index],group.weight/weight,'REPLACE')
    part_report.append({'name':ob.name,'source_triangles':before,'lod_triangles':sum(len(p.vertices)-2 for p in ob.data.polygons)})
images=[i for i in bpy.data.images if i.name.startswith('LeafTurtle_') and i.users]
assert len(images)==2 and all(i.packed_file for i in images)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leaf-turtle-lod-parts.blend'))
# One skin renderer and one opaque atlas material. No extra palette draw calls.
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();merged=bpy.context.object
merged.name='LeafTurtle_SkinnedMesh';merged.data.materials.clear();merged.data.materials.append(bpy.data.materials['LeafAtlas_01'])
for polygon in merged.data.polygons:polygon.material_index=0
bm=bmesh.new();bm.from_mesh(merged.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(merged.data);bm.free()
triangles=len(merged.data.polygons);assert 28000<=triangles<=30000,('Runtime budget',triangles)
assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in merged.data.vertices)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leaf-turtle-runtime.blend'))
bpy.ops.export_scene.fbx(filepath=str(EXPORT/'leaf-turtle.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'leaf-turtle.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
assert_protected()
write(OUT/'lod-manifest.json',{'status':'isolated runtime candidate, QA and review pending; not promoted',
    'protected_inputs':protected,'source_high_sha256':sha(HERE/'leaf-turtle.blend'),'source_high_preview_sha256':sha(HERE/'render-three-quarter.png'),
    'builder_sha256':sha(Path(__file__)),'leaf_sampling':{'rows':ROWS,'columns':COLS,'original_grid':[17,18],'method':'exact authored sample selection, no leaf decimation'},
    'leaf_surface_comparison':leaf_report,'part_triangles':part_report,'triangles':triangles,'vertices':len(merged.data.vertices),
    'bones':len(rig.data.bones),'materials':len(merged.data.materials),'uv_layers':len(merged.data.uv_layers),
    'atlas_rebuilt_from_numeric_parameters':True,'atlas_byte_identical_to_approved':True,
    'atlas_sha256':{p.name:sha(p) for p in EXPORT.glob('*.png')},'fbx_sha256':sha(EXPORT/'leaf-turtle.fbx'),
    'lod_parts_sha256':sha(OUT/'leaf-turtle-lod-parts.blend'),'runtime_source_sha256':sha(OUT/'leaf-turtle-runtime.blend'),
    'packed_textures':2,'material_name':'LeafAtlas_01','material_prefix':'LeafAtlas_',
    'forward_blender':'-Y','up_blender':'+Z','fbx_export_forward':'-Z','fbx_export_up':'+Y',
    'cocos_expected_forward':'+Z','recommended_cocos_scale':.65,'runtime_written':False,'cocos_started':False})
print('LEAF_C04_RUNTIME_BUILT '+json.dumps({'triangles':triangles,'fbx_sha256':sha(EXPORT/'leaf-turtle.fbx')}))
