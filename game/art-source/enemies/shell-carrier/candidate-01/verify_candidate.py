"""Read-only FBX/source validation, then isolated real-mesh review renders.

Blender --background --factory-startup -t 2 --python-exit-code 1 --python PATH
Append -- --no-render to run checks alone. No runtime resources are modified.
"""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
STATS=json.loads((HERE/'model-stats.json').read_text(encoding='utf-8'))


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name,data):
    (HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def require(condition,message):
    if not condition:raise RuntimeError(message)
def action(rig,name):
    chosen=next(a for a in bpy.data.actions if a.name.split('|')[-1].split('.')[0]==name)
    data=rig.animation_data_create();data.use_nla=False;data.action=None
    for pb in rig.pose.bones:pb.matrix_basis.identity()
    data.action=chosen
    if len(chosen.slots):data.action_slot=chosen.slots[0]
    return chosen
def sample(mesh,frame):
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
    bpy.context.view_layer.update()
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
    try:vertices=[evaluated.matrix_world@v.co for v in data.vertices]
    finally:evaluated.to_mesh_clear()
    require(all(math.isfinite(x) for v in vertices for x in v),'Non-finite animated vertex')
    return vertices
def distance(a,b):return max((x-y).length for x,y in zip(a,b))


def verify_fbx():
    path=HERE/'export/shell-carrier.fbx'
    require(sha(path)==STATS['fbx_sha256'],'FBX changed after build')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    require(len(rigs)==len(meshes)==1,'Expected one rig and one runtime mesh')
    rig,mesh=rigs[0],meshes[0]
    require(set(b.name for b in rig.data.bones)==set(STATS['bones']),'Bone contract changed')
    require(len(mesh.data.materials)==1 and len(mesh.data.uv_layers)==1,'Expected one UV and material')
    triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons)
    require(triangles==STATS['triangles'] and triangles<=16000,'Triangle count mismatch/budget overflow')
    groups={group.index:group.name for group in mesh.vertex_groups}
    for vertex in mesh.data.vertices:
        weights=[g.weight for g in vertex.groups if groups[g.group] in STATS['bones']]
        require(weights and abs(sum(weights)-1)<.0001,'Unweighted/non-normalized vertex')
    report={'status':'pass','fbx_sha256':sha(path),'triangles':triangles,
            'vertices':len(mesh.data.vertices),'materials':[m.name for m in mesh.data.materials],
            'bones':[b.name for b in rig.data.bones],'clips':{},'warnings':[],
            'method':'Imported FBX, explicitly selected Blender 4.5 action slots, evaluated every half frame. Technical evidence does not imply art acceptance.'}
    for name,expected in STATS['clips'].items():
        clip=action(rig,name);first,last=map(float,clip.frame_range)
        require(abs(first-expected['first'])<.001 and abs(last-expected['last'])<.001,'Clip range mismatch')
        start=sample(mesh,first);motion=0;lowest=10;highest=-10
        for index in range(int((last-first)*2)+1):
            vertices=sample(mesh,first+index*.5)
            motion=max(motion,distance(start,vertices));lowest=min(lowest,min(v.z for v in vertices));highest=max(highest,max(v.z for v in vertices))
        finish=sample(mesh,last);seam=distance(start,finish)
        require(motion>.001,f'Static clip: {name}')
        require(lowest>-.002,f'Ground penetration > 2 mm: {name} / {lowest}')
        if name in ('idle','walk','attack','hit'):require(seam<.0001,f'Pose reset mismatch: {name}')
        if name=='exit':require(max(v.z for v in finish)<.08,'Exit does not shrink out')
        report['clips'][name]={'imported_action_name':clip.name,'first':first,'last':last,'seconds':(last-first)/30,
            'samples':int((last-first)*2)+1,'maximum_vertex_motion_m':motion,'minimum_z_m':lowest,
            'maximum_z_m':highest,'first_last_seam_m':seam,'loop':name in STATS['loops']}
    action(rig,'idle');vertices=sample(mesh,1)
    report['bounds_world_xyz']={'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]}
    for i in range(3):
        require(abs(report['bounds_world_xyz']['min'][i]-STATS['bounds_blender_xyz']['min'][i])<.0001,'FBX min bound changed')
        require(abs(report['bounds_world_xyz']['max'][i]-STATS['bounds_blender_xyz']['max'][i])<.0001,'FBX max bound changed')
    require(abs(report['bounds_world_xyz']['min'][2])<.0001,'Rest foot origin not zero')
    write('round-trip-check.json',report)
    print('SHELL_CARRIER_FBX_VERIFICATION_PASS '+json.dumps({name:value['maximum_vertex_motion_m'] for name,value in report['clips'].items()}),flush=True)


def verify_source():
    report={'status':'pass','files':{}}
    for filename in ('shell-carrier.blend','shell-carrier-review-scene.blend'):
        path=HERE/filename;before=sha(path)
        bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['ShellCarrier_Rig']
        images=[im for im in bpy.data.images if im.name.startswith(('ShellCarrier_Colour_','ShellCarrier_Roughness_'))]
        require(len(images)==2 and all(im.packed_file for im in images),'Expected two packed atlas images')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(mod.type=='ARMATURE' and mod.object==rig for mod in o.modifiers)]
        entry={'sha256':before,'packed_images':[im.name for im in images],'skinned_meshes':len(meshes)}
        if filename=='shell-carrier.blend':
            feet=[o for o in meshes if o.name.endswith('_curved_leg')]
            require(len(feet)==8,'Expected eight distinct editable walking legs')
            entry['walking_legs']=len(feet);entry['editable_parts']=len(meshes)
            fan=bpy.data.objects['Large_carried_fan_shell']
            require(fan.get('bone')=='carried_shell','Shell load lost its independent bone')
            entry['carried_fan_dimensions']=[max(v.co[i] for v in fan.data.vertices)-min(v.co[i] for v in fan.data.vertices) for i in range(3)]
            require(entry['carried_fan_dimensions'][0]>.9 and entry['carried_fan_dimensions'][2]>.6,'Large carried shell silhouette missing')
            for ob in meshes:
                bm=bmesh.new();bm.from_mesh(ob.data)
                try:
                    require(all(e.is_manifold for e in bm.edges),f'Nonmanifold part: {ob.name}')
                    require(bm.calc_volume(signed=True)>0,f'Inward/zero volume part: {ob.name}')
                finally:bm.free()
            # Eyes contain true closed topology; dark areas are UV paint.
            eyes=[o for o in meshes if o.name.startswith('Spherical_painted_eye_')]
            require(len(eyes)==2 and all(len(o.data.vertices)>450 for o in eyes),'Missing smooth eye topology')
            entry['eye_vertices']={o.name:len(o.data.vertices) for o in eyes}
        require(sha(path)==before,'Source was unexpectedly modified')
        report['files'][filename]=entry
    write('source-check.json',report);print('SHELL_CARRIER_SOURCE_VERIFICATION_PASS',flush=True)




verify_fbx();verify_source()
for name,digest in STATS['protected_reference_hashes'].items():require(sha(ROOT/name)==digest,'Protected frozen source changed: '+name)
write('reference-preservation.json',{'status':'pass','files':STATS['protected_reference_hashes'],'writes_to_other_assets':False})
print('SHELL_CARRIER_QA_COMPLETE',flush=True)
