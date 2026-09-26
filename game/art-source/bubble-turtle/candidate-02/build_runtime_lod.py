"""Bubble c02 frozen shape -> independent mobile LOD, own six actions and export.
CPU 2; no resources writes, Cocos launch or promotion. Original c01/c02 preserved.
"""
import ast,bpy,bmesh,hashlib,json,math,shutil,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
OUT=HERE/'runtime-candidate';EXPORT=OUT/'export';INPUT=OUT/'inputs'
for p in [OUT,EXPORT,INPUT]:p.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(HERE))
from bubble_atlas_rebuild import rebuild
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
approved=json.loads((HERE/'candidate-manifest.json').read_text(encoding='utf-8'))
protected=dict(approved['protected_inputs'])
# Snapshot every pre-runtime c02 artifact and the approved builder before loading.
for p in [p for p in HERE.rglob('*') if p.is_file() and OUT not in p.parents and '__pycache__' not in p.parts and not (p.parent==HERE and p.suffix=='.py')]:
    protected[str(p.relative_to(ROOT))]=sha(p)
source_builder=ROOT/'game/art-source/build_bubble_turtle_candidate02.py'
protected[str(source_builder.relative_to(ROOT))]=sha(source_builder)
assert sha(HERE/'bubble-turtle.blend')=='e1e84485d53e76a04de7d6995655f78f845e3b1044b443da55f9a277383a5414'
def assert_protected():
    for path,digest in protected.items():assert sha(ROOT/path)==digest,('Protected source changed',path)
assert_protected()
bpy.ops.wm.open_mainfile(filepath=str(HERE/'bubble-turtle.blend'))
scene=bpy.context.scene;scene.render.fps=30
scene.render.threads_mode='FIXED';scene.render.threads=2
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
scene.frame_set(1);bpy.context.view_layer.update()
parts=[o for o in scene.objects if o.type=='MESH' and 'bone' in o]
shutil.copy2(source_builder,INPUT/'authored_bubble_c02_source.py')
shutil.copy2(HERE/'inputs/authored_mesh_atlas_helpers.py',INPUT/'authored_mesh_atlas_helpers.py')
_,parameters=rebuild(INPUT/'authored_bubble_c02_source.py',INPUT/'authored_mesh_atlas_helpers.py',EXPORT)
for name in ['bubble-colour.png','bubble-roughness.png']:
    assert (EXPORT/name).read_bytes()==(HERE/'textures'/name).read_bytes(),('Numeric atlas rebuild differs',name)
write(OUT/'atlas-parameters.json',parameters)
for image in list(bpy.data.images):
    if image.name.startswith('BubbleTurtle_') and image.users:
        name='bubble-roughness.png' if 'Roughness' in image.name else 'bubble-colour.png'
        image.filepath=str(EXPORT/name);image.pack()
part_report=[];surface_report=[]
def sample_rings(ob,rows,width):
    old=ob.data;selected=[r*width+c for r in rows for c in range(width)]
    vertices=[old.vertices[i].co.copy() for i in selected]
    uv_by_vertex={loop.vertex_index:old.uv_layers.active.data[loop.index].uv.copy() for loop in old.loops}
    faces=[]
    for row in range(len(rows)-1):
        for col in range(width):
            faces.append((row*width+col,row*width+(col+1)%width,(row+1)*width+(col+1)%width,(row+1)*width+col))
    faces.extend([tuple(range(width-1,-1,-1)),tuple((len(rows)-1)*width+j for j in range(width))])
    mesh=bpy.data.meshes.new(ob.name+'_sampled_lod_mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
    for material in old.materials:mesh.materials.append(material)
    uv=mesh.uv_layers.new(name=old.uv_layers.active.name)
    for loop in mesh.loops:uv.data[loop.index].uv=uv_by_vertex[selected[loop.vertex_index]]
    for polygon in mesh.polygons:polygon.use_smooth=True
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    tree=BVHTree.FromPolygons(vertices,faces,all_triangles=False)
    distances=[tree.find_nearest(v.co)[3] for v in old.vertices]
    source_bounds=[[min(v.co[a] for v in old.vertices),max(v.co[a] for v in old.vertices)] for a in range(3)]
    lod_bounds=[[min(v[a] for v in vertices),max(v[a] for v in vertices)] for a in range(3)]
    error=max(abs(a-b) for x,y in zip(source_bounds,lod_bounds) for a,b in zip(x,y))
    surface_report.append({'name':ob.name,'method':'exact authored longitudinal ring selection; all rounded cross-section samples retained',
        'rows':rows,'cross_section_vertices':width,'max_source_to_lod_distance_m':max(distances),'max_bounds_error_m':error})
    assert max(distances)<.009 and error<.005,('Band/rim sampling error',ob.name,max(distances),error)
    ob.data=mesh;ob.vertex_groups.clear();group=ob.vertex_groups.new(name='shell');group.add(list(range(len(vertices))),1,'REPLACE')
for ob in parts:
    before=sum(len(p.vertices)-2 for p in ob.data.polygons);name=ob.name
    if name=='Continuous_blue_spiral_inlay':
        assert len(ob.data.vertices)==190*14
        sample_rings(ob,list(range(5))+[5+i for i in range(0,185,2)],14)
    elif name.startswith('Rounded_ivory_blue_collar_'):
        assert len(ob.data.vertices)==17*12
        sample_rings(ob,list(range(0,17,2)),12)
    else:
        ratio=.50
        if name.endswith('_sculpt') and name!='Head_sculpt':ratio=.60
        elif '_toe_' in name:ratio=.75
        elif name=='Head_sculpt':ratio=.60
        elif name.startswith('Eye_white_'):ratio=.95
        elif name.startswith('Continuous_eyelid_'):ratio=.85
        elif name.startswith('Nostril_'):ratio=.60
        elif name.startswith('Playful_asymmetric_brow_') or name=='Playful_half_smile':ratio=.85
        elif name=='Ivory_continuous_carapace':ratio=.60
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
        mod=ob.modifiers.new('Part_specific_runtime_reduction','DECIMATE');mod.ratio=ratio
        while ob.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for v in ob.data.vertices:
        weight=sum(g.weight for g in v.groups);assert weight>0,('Unweighted vertex',name,v.index)
        for group in list(v.groups):ob.vertex_groups[group.group].add([v.index],group.weight/weight,'REPLACE')
    part_report.append({'name':name,'source_triangles':before,'lod_triangles':sum(len(p.vertices)-2 for p in ob.data.polygons)})
# Replace inherited stone curves with this bubble character's original timing:
# small inhalation / forward exhalation; broader skill breath, no mesh projectile.
rig.animation_data_clear()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
FEET={name:[v.co.copy() for ob in parts if ob['bone']==name for v in ob.data.vertices if v.co.z<.07] for name in ['front_L','front_R','rear_L','rear_R']}
def setpose(frame,body_z=0,body_pitch=0,head_pitch=0,head_yaw=0,neck_back=0,body_y=0,legs=0,shell_pulse=0,shell_pitch=0,tail=0):
    for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['root'].location=rig.data.bones['root'].matrix_local.to_3x3().inverted()@Vector((0,0,body_z))
    rig.pose.bones['body'].rotation_euler.x=body_pitch
    rig.pose.bones['body'].location=rig.data.bones['body'].matrix_local.to_3x3().inverted()@Vector((0,body_y,0))
    rig.pose.bones['head'].rotation_euler.x=head_pitch;rig.pose.bones['head'].rotation_euler.y=head_yaw
    rig.pose.bones['neck'].location=rig.data.bones['neck'].matrix_local.to_3x3().inverted()@Vector((0,neck_back,0))
    rig.pose.bones['shell'].scale=(1+shell_pulse,1+shell_pulse,1+shell_pulse)
    rig.pose.bones['shell'].rotation_euler.x=shell_pitch;rig.pose.bones['tail'].rotation_euler.y=tail
    for name in FEET:rig.pose.bones[name].rotation_euler.x=legs*(1 if name.startswith('front') else -1)
    bpy.context.view_layer.update()
    if body_z<=.05:
        for name,points in FEET.items():
            pb=rig.pose.bones[name];deform=pb.matrix@pb.bone.matrix_local.inverted()
            lowest=min((deform@p).z for p in points)
            basis=pb.parent.matrix@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
            pb.location+=basis.to_3x3().inverted()@Vector((0,0,-lowest))
    for pb in rig.pose.bones:
        for channel in ['location','rotation_euler','scale']:pb.keyframe_insert(channel,frame=frame,group=pb.name)
CLIPS={
 'idle':[(1,{}),(24,{'body_z':.011,'head_pitch':-.015,'head_yaw':.012,'tail':.065}),(48,{'head_pitch':.008,'head_yaw':-.010,'tail':-.040}),(72,{})],
 'attack':[(1,{}),(8,{'body_z':.010,'neck_back':.013,'head_pitch':-.046,'shell_pulse':.020}),(13,{'body_z':.019,'body_y':-.020,'head_pitch':.021,'shell_pulse':.006}),(20,{'body_z':.004,'head_pitch':-.012,'tail':.025}),(27,{})],
 'skill':[(1,{}),(10,{'body_z':-.014,'neck_back':.018,'head_pitch':-.032,'legs':.025,'shell_pulse':.020}),(16,{'body_z':.016,'head_pitch':-.055,'shell_pulse':.037,'tail':.055}),(22,{'body_z':.030,'body_y':-.025,'head_pitch':.023,'shell_pulse':.009,'tail':-.040}),(31,{'body_z':.008,'head_pitch':-.010,'shell_pulse':.014}),(42,{})],
 'hit':[(1,{}),(4,{'body_y':.035,'body_pitch':-.030,'head_pitch':.105,'neck_back':.030}),(10,{'body_y':.009,'head_pitch':.025}),(18,{})],
 'rest':[(1,{'body_z':-.023,'neck_back':.052,'head_pitch':.105,'legs':.042}),(36,{'body_z':-.028,'neck_back':.052,'head_pitch':.120,'legs':.042,'tail':.012}),(72,{'body_z':-.023,'neck_back':.052,'head_pitch':.105,'legs':.042})],
 'fusion':[(1,{}),(12,{'body_z':-.035,'head_pitch':.072,'legs':.061,'shell_pulse':.018}),(23,{'body_z':.105,'head_pitch':-.105,'head_yaw':.025,'legs':-.090,'tail':.15,'shell_pulse':.030}),(31,{'body_z':-.023,'head_pitch':.051,'legs':.065}),(43,{'body_z':.047,'head_pitch':-.052,'head_yaw':-.020}),(60,{})]}
rig.animation_data_create()
for name,keys in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame,kwargs in keys:setpose(frame,**kwargs)
    action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name
    track.strips.new(name,1,action).name=name;track.mute=True
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(1);bpy.context.view_layer.update()
write(OUT/'animation-parameters.json',{'fps':30,'pose_keys':CLIPS,'description':'Original bubble breath/forward exhale for attack, larger breath for skill; shared ten-bone language, blend-friendly endpoints. Projectile/bubble ring belongs to game view.'})
images=[i for i in bpy.data.images if i.name.startswith('BubbleTurtle_') and i.users]
assert len(images)==2 and all(i.packed_file for i in images)
assert len(rig.data.bones)==10
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bubble-turtle-lod-parts.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();merged=bpy.context.object
merged.name='BubbleTurtle_SkinnedMesh';merged.data.materials.clear();merged.data.materials.append(bpy.data.materials['BubbleAtlas_01'])
for polygon in merged.data.polygons:polygon.material_index=0
bm=bmesh.new();bm.from_mesh(merged.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(merged.data);bm.free()
triangles=len(merged.data.polygons);assert 26000<=triangles<=30000,('Runtime budget',triangles)
assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in merged.data.vertices)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bubble-turtle-runtime.blend'))
bpy.ops.export_scene.fbx(filepath=str(EXPORT/'bubble-turtle.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'bubble-turtle.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
assert_protected()
write(OUT/'lod-manifest.json',{'status':'isolated runtime candidate, QA and image review pending; not promoted',
    'protected_inputs':protected,'source_high_sha256':sha(HERE/'bubble-turtle.blend'),
    'source_high_previews_sha256':{p.name:sha(p) for p in HERE.glob('render-*.png')},
    'builder_sha256':sha(Path(__file__)),'surface_sampling':surface_report,'part_triangles':part_report,
    'triangles':triangles,'vertices':len(merged.data.vertices),'bones':len(rig.data.bones),'materials':len(merged.data.materials),'uv_layers':len(merged.data.uv_layers),
    'atlas_rebuilt_from_numeric_parameters':True,'atlas_byte_identical_to_approved':True,
    'atlas_sha256':{p.name:sha(p) for p in EXPORT.glob('*.png')},'fbx_sha256':sha(EXPORT/'bubble-turtle.fbx'),
    'lod_parts_sha256':sha(OUT/'bubble-turtle-lod-parts.blend'),'runtime_source_sha256':sha(OUT/'bubble-turtle-runtime.blend'),
    'packed_textures':2,'material_name':'BubbleAtlas_01','material_prefix':'BubbleAtlas_',
    'forward_blender':'-Y','up_blender':'+Z','fbx_export_forward':'-Z','fbx_export_up':'+Y',
    'cocos_expected_forward':'+Z','recommended_cocos_scale':.65,'runtime_written':False,'cocos_started':False})
print('BUBBLE_C02_RUNTIME_BUILT '+json.dumps({'triangles':triangles,'fbx_sha256':sha(EXPORT/'bubble-turtle.fbx')}))
